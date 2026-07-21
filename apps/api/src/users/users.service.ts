import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DbService } from '../common/db.service';
import type { UserProfile, CreateUserDto, UpdateUserDto } from '@gx-portal/types';

interface UserRow {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  password_hash: string;
  role: string;
  client_id: number | null;
  client_name: string | null;
  lab_id: number | null;
  lab_name: string | null;
  email_notification: number;
  created_at: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  list(): UserProfile[] {
    const rows = this.db.db.prepare(`
      SELECT u.*,
             c.name as client_name,
             l.name as lab_name
      FROM users u
      LEFT JOIN clients c ON c.id = u.client_id
      LEFT JOIN labs    l ON l.id = u.lab_id
      ORDER BY u.created_at DESC
    `).all() as UserRow[];
    return rows.map((r) => this.toProfile(r));
  }

  findById(id: number): UserProfile | undefined {
    const row = this.db.db.prepare(`
      SELECT u.*, c.name as client_name, l.name as lab_name
      FROM users u
      LEFT JOIN clients c ON c.id = u.client_id
      LEFT JOIN labs    l ON l.id = u.lab_id
      WHERE u.id = ?
    `).get(id) as UserRow | undefined;
    if (!row) return undefined;
    return this.toProfile(row);
  }

  findRawByUsername(username: string): UserRow | undefined {
    return this.db.db.prepare(`
      SELECT u.*, c.name as client_name, l.name as lab_name
      FROM users u
      LEFT JOIN clients c ON c.id = u.client_id
      LEFT JOIN labs    l ON l.id = u.lab_id
      WHERE u.username = ?
    `).get(username) as UserRow | undefined;
  }

  async validateUser(username: string, password: string): Promise<UserProfile | null> {
    const row = this.findRawByUsername(username);
    if (!row) return null;
    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) return null;
    return this.toProfile(row);
  }

  async create(dto: CreateUserDto): Promise<UserProfile> {
    const existing = this.db.db.prepare('SELECT id FROM users WHERE username = ?').get(dto.username);
    if (existing) throw new ConflictException(`Username "${dto.username}" already taken`);

    const hash = await bcrypt.hash(dto.password, 10);
    const result = this.db.db.prepare(`
      INSERT INTO users
        (username, first_name, last_name, email, password_hash, role,
         client_id, lab_id, email_notification)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      dto.username,
      dto.first_name ?? null,
      dto.last_name ?? null,
      dto.email ?? null,
      hash,
      dto.role ?? 'client',
      dto.client_id ?? null,
      dto.lab_id ?? null,
      dto.email_notification ? 1 : 0,
    );
    const profile = this.findById(result.lastInsertRowid as number);
    if (!profile) throw new NotFoundException('User creation failed');
    return profile;
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserProfile> {
    if (!this.findById(id)) throw new NotFoundException(`User ${id} not found`);

    const fields: string[] = [];
    const values: unknown[] = [];

    if (dto.first_name !== undefined)        { fields.push('first_name = ?');        values.push(dto.first_name); }
    if (dto.last_name !== undefined)         { fields.push('last_name = ?');         values.push(dto.last_name); }
    if (dto.email !== undefined)             { fields.push('email = ?');             values.push(dto.email); }
    if (dto.role !== undefined)              { fields.push('role = ?');              values.push(dto.role); }
    if (dto.client_id !== undefined)         { fields.push('client_id = ?');         values.push(dto.client_id); }
    if (dto.lab_id !== undefined)            { fields.push('lab_id = ?');            values.push(dto.lab_id); }
    if (dto.email_notification !== undefined){ fields.push('email_notification = ?'); values.push(dto.email_notification ? 1 : 0); }

    if (dto.password) {
      fields.push('password_hash = ?');
      values.push(await bcrypt.hash(dto.password, 10));
    }

    if (fields.length > 0) {
      values.push(id);
      this.db.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    return this.findById(id)!;
  }

  delete(id: number): void {
    if (!this.findById(id)) throw new NotFoundException(`User ${id} not found`);
    this.db.db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  private toProfile(row: UserRow): UserProfile {
    return {
      id: row.id,
      username: row.username,
      first_name: row.first_name ?? undefined,
      last_name: row.last_name ?? undefined,
      display_name: row.display_name ?? undefined,
      email: row.email ?? undefined,
      role: row.role as UserProfile['role'],
      client_id: row.client_id ?? undefined,
      client_name: row.client_name ?? undefined,
      lab_id: row.lab_id ?? undefined,
      lab_name: row.lab_name ?? undefined,
      email_notification: Boolean(row.email_notification),
      created_at: row.created_at,
    };
  }
}
