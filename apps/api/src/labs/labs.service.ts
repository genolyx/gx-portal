import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../common/db.service';
import type { Lab, CreateLabDto, UpdateLabDto } from '@gx-portal/types';

interface LabRow {
  id: number;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  client_id: number | null;
  client_name: string | null;
  services: string | null;
  created_at: string;
}

@Injectable()
export class LabsService {
  constructor(private readonly db: DbService) {}

  list(clientId?: number): Lab[] {
    const where = clientId ? 'WHERE l.client_id = ?' : '';
    const rows = this.db.db.prepare(`
      SELECT l.*, c.name as client_name,
             GROUP_CONCAT(ls.service_code) as services
      FROM labs l
      LEFT JOIN clients c  ON c.id = l.client_id
      LEFT JOIN lab_services ls ON ls.lab_id = l.id
      ${where}
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `).all(...(clientId ? [clientId] : [])) as LabRow[];
    return rows.map((r) => this.toLab(r));
  }

  getById(id: number): Lab {
    const row = this.db.db.prepare(`
      SELECT l.*, c.name as client_name,
             GROUP_CONCAT(ls.service_code) as services
      FROM labs l
      LEFT JOIN clients c  ON c.id = l.client_id
      LEFT JOIN lab_services ls ON ls.lab_id = l.id
      WHERE l.id = ?
      GROUP BY l.id
    `).get(id) as LabRow | undefined;
    if (!row) throw new NotFoundException(`Lab ${id} not found`);
    return this.toLab(row);
  }

  create(dto: CreateLabDto): Lab {
    const result = this.db.db.prepare(`
      INSERT INTO labs (name, address, email, phone, client_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      dto.name,
      dto.address ?? null,
      dto.email ?? null,
      dto.phone ?? null,
      dto.client_id ?? null,
    );
    const newId = result.lastInsertRowid as number;
    this.setServices(newId, dto.service_codes ?? []);
    return this.getById(newId);
  }

  update(id: number, dto: UpdateLabDto): Lab {
    this.getById(id);
    const fields: string[] = [];
    const values: unknown[] = [];

    if (dto.name !== undefined)      { fields.push('name = ?');      values.push(dto.name); }
    if (dto.address !== undefined)   { fields.push('address = ?');   values.push(dto.address); }
    if (dto.email !== undefined)     { fields.push('email = ?');     values.push(dto.email); }
    if (dto.phone !== undefined)     { fields.push('phone = ?');     values.push(dto.phone); }
    if (dto.client_id !== undefined) { fields.push('client_id = ?'); values.push(dto.client_id); }

    if (fields.length > 0) {
      values.push(id);
      this.db.db.prepare(`UPDATE labs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    if (dto.service_codes !== undefined) {
      this.setServices(id, dto.service_codes);
    }

    return this.getById(id);
  }

  delete(id: number): void {
    this.getById(id);
    this.db.db.prepare('DELETE FROM labs WHERE id = ?').run(id);
  }

  private setServices(labId: number, codes: string[]) {
    this.db.db.prepare('DELETE FROM lab_services WHERE lab_id = ?').run(labId);
    const stmt = this.db.db.prepare('INSERT INTO lab_services (lab_id, service_code) VALUES (?, ?)');
    for (const code of codes) stmt.run(labId, code);
  }

  private toLab(row: LabRow): Lab {
    return {
      id: row.id,
      name: row.name,
      address: row.address ?? undefined,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      client_id: row.client_id ?? undefined,
      client_name: row.client_name ?? undefined,
      service_codes: row.services ? row.services.split(',') : [],
      created_at: row.created_at,
    };
  }
}
