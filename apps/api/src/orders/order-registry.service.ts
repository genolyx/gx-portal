import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  BadRequestException,
} from '@nestjs/common';
import { DbService } from '../common/db.service';
import { DaemonService } from '../daemon/daemon.service';
import type { Order, OrderListResponse, PortalOrderMeta } from '@gx-portal/types';

export const SERVICE_PREFIX: Record<string, string> = {
  carrier_screening: 'CS',
  sgnipt: 'SN',
  whole_exome: 'WE',
  health_screening: 'HS',
};

const DEFAULT_CLIENT_PREFIX = 'GX';

export type RequestUser = {
  id: number;
  username: string;
  role: 'admin' | 'client' | 'lab';
  client_id?: number;
  lab_id?: number;
};

interface PortalOrderRow {
  order_id: string;
  client_id: number;
  created_by: number | null;
  service_code: string;
  legacy_order_id: string | null;
  description: string | null;
  work_dir: string | null;
  created_at: string;
}

@Injectable()
export class OrderRegistryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OrderRegistryService.name);

  constructor(
    private readonly db: DbService,
    private readonly daemon: DaemonService,
  ) {}

  async onApplicationBootstrap() {
    this.ensureDefaultClientPrefix();
    await this.migrateExistingDaemonOrders().catch((err) => {
      this.logger.error(`Order registry migration failed: ${(err as Error).message}`);
    });
  }

  /** Resolve the client_id a user belongs to (lab users inherit from their lab). */
  resolveUserClientId(user?: RequestUser): number | undefined {
    if (!user) return undefined;
    if (user.role === 'admin') return undefined;
    if (user.client_id) return user.client_id;
    if (user.lab_id) {
      const row = this.db.db
        .prepare('SELECT client_id FROM labs WHERE id = ?')
        .get(user.lab_id) as { client_id: number | null } | undefined;
      return row?.client_id ?? undefined;
    }
    return undefined;
  }

  assertCanAccess(orderId: string, user?: RequestUser): PortalOrderMeta | undefined {
    const meta = this.getMeta(orderId);
    if (!user || user.role === 'admin') return meta;
    if (!meta) throw new NotFoundException(`Order not found: ${orderId}`);
    const clientId = this.resolveUserClientId(user);
    if (!clientId || meta.client_id !== clientId) {
      throw new ForbiddenException('You do not have access to this order');
    }
    return meta;
  }

  getMeta(orderId: string): PortalOrderMeta | undefined {
    const row = this.db.db
      .prepare('SELECT * FROM portal_orders WHERE order_id = ? OR legacy_order_id = ?')
      .get(orderId, orderId) as PortalOrderRow | undefined;
    return row ? this.toMeta(row) : undefined;
  }

  /** Map legacy or canonical id to the current daemon order_id. */
  resolveCanonicalOrderId(orderId: string): string {
    const row = this.db.db
      .prepare('SELECT order_id FROM portal_orders WHERE order_id = ? OR legacy_order_id = ?')
      .get(orderId, orderId) as { order_id: string } | undefined;
    return row?.order_id ?? orderId;
  }

  getAllowedOrderIds(user?: RequestUser): Set<string> | null {
    if (!user || user.role === 'admin') return null; // null = no filter
    const clientId = this.resolveUserClientId(user);
    if (!clientId) return new Set();
    const rows = this.db.db
      .prepare('SELECT order_id FROM portal_orders WHERE client_id = ?')
      .all(clientId) as { order_id: string }[];
    return new Set(rows.map((r) => r.order_id));
  }

  filterOrderList(response: OrderListResponse, user?: RequestUser): OrderListResponse {
    const allowed = this.getAllowedOrderIds(user);
    let orders = response.orders;
    if (allowed !== null) {
      orders = orders.filter((o) => allowed.has(o.order_id));
    }
    orders = orders.map((o) => this.enrichOrder(o));
    return { ...response, orders, total: orders.length };
  }

  enrichOrder(order: Order): Order {
    const meta = this.getMeta(order.order_id);
    if (!meta) return order;
    const legacy = meta.legacy_order_id ?? undefined;
    const note = meta.description?.trim() || legacy;
    return {
      ...order,
      order_id: meta.order_id,
      client_id: meta.client_id,
      legacy_order_id: legacy,
      description: note || undefined,
    };
  }

  resolveClientIdForCreate(user: RequestUser | undefined, explicitClientId?: number): number {
    if (user?.role === 'admin') {
      if (explicitClientId) return explicitClientId;
      const defaultClient = this.getDefaultClient();
      if (!defaultClient) throw new BadRequestException('No client configured. Create a client with an order prefix first.');
      return defaultClient.id;
    }
    const clientId = this.resolveUserClientId(user);
    if (!clientId) throw new ForbiddenException('Your account is not linked to a client');
    return clientId;
  }

  allocateOrderId(serviceCode: string, clientId: number, yymm?: string): string {
    const svcPrefix = SERVICE_PREFIX[serviceCode];
    if (!svcPrefix) throw new BadRequestException(`Unsupported service for order ID: ${serviceCode}`);

    const client = this.db.db
      .prepare('SELECT order_prefix FROM clients WHERE id = ?')
      .get(clientId) as { order_prefix: string | null } | undefined;
    if (!client?.order_prefix) {
      throw new BadRequestException('Client has no order prefix configured');
    }
    const clientPrefix = client.order_prefix.toUpperCase();
    const period = yymm ?? currentYymm();

    const nextSeq = this.db.db.transaction(() => {
      this.db.db
        .prepare(
          `INSERT INTO order_sequences (client_id, service_prefix, yymm, last_seq)
           VALUES (?, ?, ?, 0)
           ON CONFLICT(client_id, service_prefix, yymm) DO NOTHING`,
        )
        .run(clientId, svcPrefix, period);
      this.db.db
        .prepare(
          `UPDATE order_sequences SET last_seq = last_seq + 1
           WHERE client_id = ? AND service_prefix = ? AND yymm = ?`,
        )
        .run(clientId, svcPrefix, period);
      const row = this.db.db
        .prepare(
          `SELECT last_seq FROM order_sequences
           WHERE client_id = ? AND service_prefix = ? AND yymm = ?`,
        )
        .get(clientId, svcPrefix, period) as { last_seq: number };
      return row.last_seq;
    })();

    return `${svcPrefix}${clientPrefix}${period}${String(nextSeq).padStart(4, '0')}`;
  }

  registerOrder(opts: {
    orderId: string;
    clientId: number;
    createdBy?: number;
    serviceCode: string;
    legacyOrderId?: string;
    description?: string;
    workDir?: string;
  }): PortalOrderMeta {
    this.db.db
      .prepare(
        `INSERT INTO portal_orders
           (order_id, client_id, created_by, service_code, legacy_order_id, description, work_dir)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        opts.orderId,
        opts.clientId,
        opts.createdBy ?? null,
        opts.serviceCode,
        opts.legacyOrderId ?? null,
        opts.description?.trim() || null,
        opts.workDir ?? null,
      );
    return this.getMeta(opts.orderId)!;
  }

  workDirFromOrderId(orderId: string): string | undefined {
    const m = orderId.match(/(\d{4})\d{4}$/);
    return m?.[1];
  }

  private ensureDefaultClientPrefix() {
    const genolyx = this.db.db
      .prepare(`SELECT id, order_prefix FROM clients WHERE UPPER(name) LIKE '%GENOLYX%' LIMIT 1`)
      .get() as { id: number; order_prefix: string | null } | undefined;

    if (genolyx && !genolyx.order_prefix) {
      this.db.db
        .prepare(`UPDATE clients SET order_prefix = ? WHERE id = ?`)
        .run(DEFAULT_CLIENT_PREFIX, genolyx.id);
      this.logger.log(`Set order_prefix=${DEFAULT_CLIENT_PREFIX} on Genolyx client (id=${genolyx.id})`);
      return;
    }

    const anyClient = this.db.db
      .prepare(`SELECT id, order_prefix FROM clients ORDER BY id LIMIT 1`)
      .get() as { id: number; order_prefix: string | null } | undefined;
    if (anyClient && !anyClient.order_prefix) {
      this.db.db
        .prepare(`UPDATE clients SET order_prefix = ? WHERE id = ?`)
        .run(DEFAULT_CLIENT_PREFIX, anyClient.id);
      this.logger.log(`Set order_prefix=${DEFAULT_CLIENT_PREFIX} on client id=${anyClient.id}`);
    }
  }

  private getDefaultClient(): { id: number; order_prefix: string } | undefined {
    const row = this.db.db
      .prepare(
        `SELECT id, order_prefix FROM clients
         WHERE order_prefix IS NOT NULL
         ORDER BY CASE WHEN UPPER(name) LIKE '%GENOLYX%' THEN 0 ELSE 1 END, id
         LIMIT 1`,
      )
      .get() as { id: number; order_prefix: string } | undefined;
    return row;
  }

  private async migrateExistingDaemonOrders() {
    const done = this.db.db
      .prepare(`SELECT value FROM portal_meta WHERE key = 'daemon_orders_migrated'`)
      .get() as { value: string } | undefined;
    if (done?.value === '1') return;

    const defaultClient = this.getDefaultClient();
    if (!defaultClient) {
      this.logger.warn('Skipping daemon order migration — no client with order_prefix');
      return;
    }

    let daemonOrders: Order[];
    try {
      const resp = await this.daemon.get<OrderListResponse>('/orders');
      daemonOrders = resp.orders ?? [];
    } catch {
      this.logger.warn('Skipping daemon order migration — gx-daemon unreachable');
      return;
    }

    let migrated = 0;
    for (const order of daemonOrders) {
      const oldId = order.order_id;
      if (!oldId) continue;

      const existing = this.getMeta(oldId);
      if (existing) continue;

      const byLegacy = this.db.db
        .prepare(`SELECT order_id FROM portal_orders WHERE legacy_order_id = ?`)
        .get(oldId) as { order_id: string } | undefined;
      if (byLegacy) continue;

      const svcPrefix = SERVICE_PREFIX[order.service_code];
      if (!svcPrefix) {
        this.logger.warn(`Skip migrate ${oldId}: unknown service ${order.service_code}`);
        continue;
      }

      // Already in canonical format for Genolyx?
      const canonicalRe = new RegExp(
        `^${svcPrefix}${DEFAULT_CLIENT_PREFIX}\\d{8}$`,
      );
      if (canonicalRe.test(oldId)) {
        this.registerOrder({
          orderId: oldId,
          clientId: defaultClient.id,
          serviceCode: order.service_code,
          workDir: order.work_dir ?? this.workDirFromOrderId(oldId),
        });
        migrated++;
        continue;
      }

      const yymm = yymmFromIso(order.created_at) ?? currentYymm();
      const newId = this.allocateOrderId(order.service_code, defaultClient.id, yymm);

      try {
        await this.daemon.patch(`/order/${encodeURIComponent(oldId)}`, {
          order_id: newId,
          work_dir: order.work_dir ?? this.workDirFromOrderId(newId),
        });
      } catch (err) {
        this.logger.warn(`Could not rename daemon order ${oldId} → ${newId}: ${(err as Error).message}`);
        continue;
      }

      this.registerOrder({
        orderId: newId,
        clientId: defaultClient.id,
        serviceCode: order.service_code,
        legacyOrderId: oldId,
        workDir: order.work_dir ?? this.workDirFromOrderId(newId),
      });
      migrated++;
      this.logger.log(`Migrated order ${oldId} → ${newId}`);
    }

    this.db.db
      .prepare(
        `INSERT INTO portal_meta (key, value) VALUES ('daemon_orders_migrated', '1')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run();
    this.logger.log(`Daemon order migration complete (${migrated} orders)`);
  }

  private toMeta(row: PortalOrderRow): PortalOrderMeta {
    const legacy = row.legacy_order_id ?? undefined;
    const note = row.description?.trim() || undefined;
    return {
      order_id: row.order_id,
      client_id: row.client_id,
      created_by: row.created_by ?? undefined,
      service_code: row.service_code,
      legacy_order_id: legacy,
      description: note || legacy,
      work_dir: row.work_dir ?? undefined,
      created_at: row.created_at,
    };
  }
}

function currentYymm(): string {
  const now = new Date();
  return `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function yymmFromIso(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
}
