import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  getGxOrderSchema,
  listGxSchemaCodes,
  resolveGxDaemonService,
  type GxOrderSchema,
  type Order,
} from '@gx-portal/types';
import { FastqDownloadService } from '../external/fastq-download.service';
import { OrdersService } from '../orders/orders.service';
import type { RequestUser } from '../orders/order-registry.service';
import type { GxCreateOrderDto } from './dto/gx-create-order.dto';
import { GxCallbacksService } from './gx-callbacks.service';
import { buildGxMeta, mapGxToCreateBody } from './gx-mapper';

const ACTIVE = new Set([
  'DOWNLOADING',
  'QUEUED',
  'RUNNING',
  'PROCESSING',
  'UPLOADING',
  'RECEIVED',
]);
const CAN_RESTART = new Set(['SAVED', 'FAILED', 'CANCELLED']);
const CAN_SEND = new Set(['REPORT_READY', 'COMPLETED']);

@Injectable()
export class GxService {
  private readonly logger = new Logger(GxService.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly fastq: FastqDownloadService,
    private readonly callbacks: GxCallbacksService,
  ) {}

  getSchema(serviceCode: string): GxOrderSchema {
    const schema = getGxOrderSchema(serviceCode);
    if (!schema) {
      throw new NotFoundException(
        `Unknown service_code: ${serviceCode}. Supported: ${listGxSchemaCodes().join(', ')}`,
      );
    }
    return schema;
  }

  async createOrder(body: GxCreateOrderDto, user: RequestUser): Promise<{ order_id: string; status: string }> {
    if ((body.source || '').trim() !== 'gx-portal') {
      throw new UnprocessableEntityException('source must be gx-portal');
    }
    const orderId = (body.order_id || '').trim();
    if (!orderId) throw new UnprocessableEntityException('order_id is required');
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/.test(orderId)) {
      throw new UnprocessableEntityException('invalid order_id');
    }

    const r1 = (body.sample?.fastq_r1_url || '').trim();
    const r2 = (body.sample?.fastq_r2_url || '').trim();
    if (!r1 || !r2) throw new UnprocessableEntityException('fastq_r1_url and fastq_r2_url are required');

    const daemonCode = resolveGxDaemonService(body.service_code);
    if (!daemonCode) {
      throw new NotFoundException(`Unknown service_code: ${body.service_code}`);
    }

    const orgType = (body.organization?.type || '').trim().toUpperCase();
    if (orgType !== 'CLIENT' && orgType !== 'PARTNER') {
      throw new UnprocessableEntityException('organization.type must be CLIENT or PARTNER');
    }
    if (!(body.callback?.report_url || '').trim()) {
      throw new UnprocessableEntityException('callback.report_url is required');
    }

    const existing = await this.tryGetOrder(orderId, user);
    const status = String(existing?.status ?? '').toUpperCase();
    if (existing && ACTIVE.has(status)) {
      this.logger.log(`GX submit idempotent no-op for active order ${orderId} (${status})`);
      return { order_id: orderId, status: 'accepted' };
    }

    const gxMeta = buildGxMeta(body);
    const createBody = mapGxToCreateBody(daemonCode, body, gxMeta);

    if (existing && !CAN_RESTART.has(status) && !ACTIVE.has(status)) {
      const params = { ...(existing.params ?? {}), _gx: gxMeta };
      await this.orders.updateOrder(orderId, { params }, user);
      this.logger.log(`GX submit updated callbacks for terminal order ${orderId}`);
      return { order_id: orderId, status: 'accepted' };
    }

    if (existing && CAN_RESTART.has(status)) {
      await this.orders.updateOrder(orderId, createBody, user);
    } else {
      await this.orders.createOrder(daemonCode, createBody, user, { useProvidedOrderId: true });
    }

    setImmediate(() => {
      this.ingestAndStart(orderId, daemonCode, r1, r2, user, body.callback.status_url).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`GX ingest failed for ${orderId}: ${msg}`);
      });
    });

    return { order_id: orderId, status: 'accepted' };
  }

  async sendReport(orderId: string, user: RequestUser): Promise<Record<string, unknown>> {
    const order = await this.orders.getOrder(orderId, user);
    const meta = this.gxMeta(order);
    const reportUrl = typeof meta.report_url === 'string' ? meta.report_url.trim() : '';
    if (!reportUrl) {
      throw new ConflictException('Not a GX Portal order (no callback.report_url)');
    }
    const status = String(order.status ?? '').toUpperCase();
    if (!CAN_SEND.has(status)) {
      throw new ConflictException(`Order status ${order.status} cannot send report`);
    }

    const { filePath } = await this.pickReportPdf(orderId, user);
    return this.callbacks.sendReportPdf(reportUrl, filePath, order.order_id);
  }

  private async ingestAndStart(
    orderId: string,
    serviceCode: string,
    r1Url: string,
    r2Url: string,
    user: RequestUser,
    statusUrl?: string,
  ): Promise<void> {
    try {
      const r1 = await this.fastq.downloadToOrderDir(serviceCode, orderId, r1Url, 'r1');
      const r2 = await this.fastq.downloadToOrderDir(serviceCode, orderId, r2Url, 'r2', r1.split(/[/\\]/).pop());
      const order = await this.orders.getOrder(orderId, user);
      const meta = { ...this.gxMeta(order), fastq_downloaded: true };
      await this.orders.updateOrder(
        orderId,
        {
          fastq_r1_path: r1,
          fastq_r2_path: r2,
          params: { ...(order.params ?? {}), _gx: meta },
        },
        user,
      );
      await this.orders.startOrder(orderId, undefined, user);
      this.logger.log(`GX order ${orderId} queued after FASTQ download`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.fastq.cleanupOrderDir(serviceCode, orderId).catch(() => undefined);
      await this.callbacks.notifyFailed(statusUrl, orderId, msg);
      throw err;
    }
  }

  private async tryGetOrder(orderId: string, user: RequestUser): Promise<Order | null> {
    try {
      return await this.orders.getOrder(orderId, user);
    } catch (err) {
      if (err instanceof HttpException && err.getStatus() === 404) return null;
      throw err;
    }
  }

  private gxMeta(order: Order): Record<string, unknown> {
    const gx = order.params && (order.params as Record<string, unknown>)._gx;
    return gx && typeof gx === 'object' && !Array.isArray(gx) ? (gx as Record<string, unknown>) : {};
  }

  private async pickReportPdf(orderId: string, user: RequestUser): Promise<{ filePath: string }> {
    const raw = (await this.orders.getFiles(orderId, user)) as { files?: { name: string; mtime_ms?: number }[] };
    const pdfs = (raw.files ?? []).filter((f) => /^Report_.*\.pdf$/i.test(f.name));
    if (pdfs.length === 0) {
      throw new UnprocessableEntityException('No Report_*.pdf found. Generate the report first.');
    }
    pdfs.sort((a, b) => (b.mtime_ms ?? 0) - (a.mtime_ms ?? 0));
    return this.orders.getOutputFile(orderId, pdfs[0].name, user);
  }
}
