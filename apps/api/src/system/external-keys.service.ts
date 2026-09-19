import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { DbService } from '../common/db.service';

const META_INBOUND = 'external_inbound_api_key';
const META_OUTBOUND = 'external_outbound_api_key';

const PLACEHOLDER_KEYS = new Set([
  '',
  'generate-a-long-secret',
  'dev-external-api-key-change-me',
  'change-me',
]);

export type ExternalKeysStatus = {
  inboundConfigured: boolean;
  outboundConfigured: boolean;
  inboundPreview: string | null;
  outboundPreview: string | null;
};

function preview(key: string | null): string | null {
  if (!key || key.length < 4) return key ? '****' : null;
  return `…${key.slice(-4)}`;
}

function usable(key: string | null | undefined): string | null {
  const v = (key ?? '').trim();
  if (!v || PLACEHOLDER_KEYS.has(v)) return null;
  return v;
}

/**
 * Runtime External Portal keys (DB portal_meta, env fallback).
 * Inbound: external → gx-portal. Outbound: gx-portal → external callbacks.
 */
@Injectable()
export class ExternalKeysService {
  private readonly logger = new Logger(ExternalKeysService.name);

  constructor(
    private readonly db: DbService,
    private readonly config: ConfigService,
  ) {}

  private getMeta(key: string): string | null {
    const row = this.db.db
      .prepare('SELECT value FROM portal_meta WHERE key = ?')
      .get(key) as { value: string } | undefined;
    return row?.value?.trim() || null;
  }

  private setMeta(key: string, value: string | null): void {
    if (value === null || value === '') {
      this.db.db.prepare('DELETE FROM portal_meta WHERE key = ?').run(key);
      return;
    }
    this.db.db
      .prepare(
        `INSERT INTO portal_meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
  }

  /** Resolved inbound key (DB > EXTERNAL_API_KEY / GX_EXTERNAL_API_KEY). */
  getInbound(): string | null {
    const fromDb = usable(this.getMeta(META_INBOUND));
    if (fromDb) return fromDb;
    return (
      usable(this.config.get<string>('EXTERNAL_API_KEY')) ||
      usable(this.config.get<string>('GX_EXTERNAL_API_KEY'))
    );
  }

  /** All accepted inbound secrets (DB + optional distinct env GX key). */
  getInboundCandidates(): string[] {
    const keys: string[] = [];
    const add = (k: string | null) => {
      if (k && !keys.includes(k)) keys.push(k);
    };
    add(usable(this.getMeta(META_INBOUND)));
    add(usable(this.config.get<string>('EXTERNAL_API_KEY')));
    add(usable(this.config.get<string>('GX_EXTERNAL_API_KEY')));
    return keys;
  }

  /** Resolved outbound key (DB > GX_CALLBACK_API_KEY). */
  getOutbound(): string | null {
    const fromDb = usable(this.getMeta(META_OUTBOUND));
    if (fromDb) return fromDb;
    return usable(this.config.get<string>('GX_CALLBACK_API_KEY'));
  }

  getStatus(): ExternalKeysStatus {
    const inbound = this.getInbound();
    const outbound = this.getOutbound();
    return {
      inboundConfigured: Boolean(inbound),
      outboundConfigured: Boolean(outbound),
      inboundPreview: preview(inbound),
      outboundPreview: preview(outbound),
    };
  }

  generateInbound(): string {
    const key = randomBytes(32).toString('hex');
    this.setMeta(META_INBOUND, key);
    this.logger.log('External inbound API key rotated');
    return key;
  }

  setOutbound(key: string): ExternalKeysStatus {
    const trimmed = (key ?? '').trim();
    this.setMeta(META_OUTBOUND, trimmed || null);
    this.logger.log(trimmed ? 'External outbound API key saved' : 'External outbound API key cleared');
    return this.getStatus();
  }
}
