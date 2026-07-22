import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DbService } from '../common/db.service';
import type { Client, CreateClientDto, UpdateClientDto } from '@gx-portal/types';

interface ClientRow {
  id: number;
  name: string;
  order_prefix: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  language: string | null;
  type: string;
  sequencing_data_method: string;
  is_managing_hospitals: number;
  auto_approve_orders: number;
  sign_report: number;
  created_at: string;
}

@Injectable()
export class ClientsService {
  constructor(private readonly db: DbService) {}

  list(): Client[] {
    const rows = this.db.db.prepare(`
      SELECT c.*,
             GROUP_CONCAT(cs.service_code) as services
      FROM clients c
      LEFT JOIN client_services cs ON cs.client_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all() as (ClientRow & { services: string | null })[];
    return rows.map((r) => this.toClient(r));
  }

  getById(id: number): Client {
    const row = this.db.db.prepare(`
      SELECT c.*,
             GROUP_CONCAT(cs.service_code) as services
      FROM clients c
      LEFT JOIN client_services cs ON cs.client_id = c.id
      WHERE c.id = ?
      GROUP BY c.id
    `).get(id) as (ClientRow & { services: string | null }) | undefined;
    if (!row) throw new NotFoundException(`Client ${id} not found`);
    return this.toClient(row);
  }

  create(dto: CreateClientDto): Client {
    const existing = this.db.db.prepare('SELECT id FROM clients WHERE name = ?').get(dto.name);
    if (existing) throw new ConflictException(`Client "${dto.name}" already exists`);

    const prefix = normalizeOrderPrefix(dto.order_prefix);
    if (prefix) assertPrefixAvailable(this.db.db, prefix);

    const result = this.db.db.prepare(`
      INSERT INTO clients
        (name, order_prefix, address, email, phone, language, type, sequencing_data_method,
         is_managing_hospitals, auto_approve_orders, sign_report)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      dto.name,
      prefix,
      dto.address ?? null,
      dto.email ?? null,
      dto.phone ?? null,
      dto.language ?? null,
      dto.type ?? 'Service',
      dto.sequencing_data_method ?? 'Remote',
      dto.is_managing_hospitals ? 1 : 0,
      dto.auto_approve_orders ? 1 : 0,
      dto.sign_report ? 1 : 0,
    );

    const newId = result.lastInsertRowid as number;
    this.setServices(newId, dto.service_codes ?? []);
    return this.getById(newId);
  }

  update(id: number, dto: UpdateClientDto): Client {
    this.getById(id); // 404 if missing

    const fields: string[] = [];
    const values: unknown[] = [];

    if (dto.name !== undefined)                    { fields.push('name = ?');                    values.push(dto.name); }
    if (dto.order_prefix !== undefined) {
      const prefix = normalizeOrderPrefix(dto.order_prefix);
      if (prefix) assertPrefixAvailable(this.db.db, prefix, id);
      fields.push('order_prefix = ?');
      values.push(prefix);
    }
    if (dto.address !== undefined)                 { fields.push('address = ?');                 values.push(dto.address); }
    if (dto.email !== undefined)                   { fields.push('email = ?');                   values.push(dto.email); }
    if (dto.phone !== undefined)                   { fields.push('phone = ?');                   values.push(dto.phone); }
    if (dto.language !== undefined)                { fields.push('language = ?');                values.push(dto.language); }
    if (dto.type !== undefined)                    { fields.push('type = ?');                    values.push(dto.type); }
    if (dto.sequencing_data_method !== undefined)  { fields.push('sequencing_data_method = ?');  values.push(dto.sequencing_data_method); }
    if (dto.is_managing_hospitals !== undefined)   { fields.push('is_managing_hospitals = ?');   values.push(dto.is_managing_hospitals ? 1 : 0); }
    if (dto.auto_approve_orders !== undefined)     { fields.push('auto_approve_orders = ?');     values.push(dto.auto_approve_orders ? 1 : 0); }
    if (dto.sign_report !== undefined)             { fields.push('sign_report = ?');             values.push(dto.sign_report ? 1 : 0); }

    if (fields.length > 0) {
      values.push(id);
      this.db.db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    if (dto.service_codes !== undefined) {
      this.setServices(id, dto.service_codes);
    }

    return this.getById(id);
  }

  delete(id: number): void {
    this.getById(id);
    this.db.db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  }

  private setServices(clientId: number, codes: string[]) {
    this.db.db.prepare('DELETE FROM client_services WHERE client_id = ?').run(clientId);
    const stmt = this.db.db.prepare('INSERT INTO client_services (client_id, service_code) VALUES (?, ?)');
    for (const code of codes) stmt.run(clientId, code);
  }

  private toClient(row: ClientRow & { services: string | null }): Client {
    return {
      id: row.id,
      name: row.name,
      order_prefix: row.order_prefix ?? undefined,
      address: row.address ?? undefined,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      language: row.language ?? undefined,
      type: row.type as Client['type'],
      sequencing_data_method: row.sequencing_data_method as Client['sequencing_data_method'],
      is_managing_hospitals: Boolean(row.is_managing_hospitals),
      auto_approve_orders: Boolean(row.auto_approve_orders),
      sign_report: Boolean(row.sign_report),
      service_codes: row.services ? row.services.split(',') : [],
      created_at: row.created_at,
    };
  }
}

function normalizeOrderPrefix(raw?: string): string | null {
  if (!raw) return null;
  const p = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(p)) {
    throw new ConflictException('Order prefix must be exactly 2 letters (A–Z)');
  }
  return p;
}

function assertPrefixAvailable(db: DbService['db'], prefix: string, excludeId?: number) {
  const row = db.prepare('SELECT id FROM clients WHERE order_prefix = ?').get(prefix) as { id: number } | undefined;
  if (row && row.id !== excludeId) {
    throw new ConflictException(`Order prefix "${prefix}" is already in use`);
  }
}
