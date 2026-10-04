import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import type { InterpretationServiceName, InterpretationServiceSources, ReviewData } from '@gx-portal/types';
import { DbService } from '../common/db.service';
import {
  INTERPRETATION_SERVICES,
  interpretationServiceKey,
  parseServiceSources,
  resolveInterpretationSource,
  sourceForService,
  type InterpretationSource,
} from './gvc-interpretation';

const META_SOURCE = 'interpretation_source';
const META_SERVICES = 'interpretation_service_sources';
const META_URL = 'gvc_partner_url';
const META_TOKEN = 'gvc_partner_token';

export interface InterpretationSettings {
  source: InterpretationSource;
  /** True when this value was saved from Config, rather than taken from the environment. */
  saved: boolean;
  gvcConfigured: boolean;
  url: string;
  tokenPreview: string | null;
  services: InterpretationServiceSources;
}

@Injectable()
export class InterpretationSettingsService {
  private readonly logger = new Logger(InterpretationSettingsService.name);

  constructor(
    private readonly db: DbService,
    private readonly config: ConfigService,
  ) {}

  get(): InterpretationSettings {
    const stored = this.storedSource();
    const url = this.partnerUrl();
    const token = this.partnerToken();
    return {
      source: resolveInterpretationSource(stored, this.config.get<string>('INTERPRETATION_SOURCE')),
      saved: stored === 'pipeline' || stored === 'gvc',
      gvcConfigured: Boolean(url) && token.length >= 32,
      url,
      tokenPreview: preview(token),
      services: this.serviceSources(),
    };
  }

  sourceFor(review: ReviewData): InterpretationSource {
    return sourceForService(this.get().source, this.serviceSources(), interpretationServiceKey(review));
  }

  partnerUrl(): string {
    return (this.getMeta(META_URL) || this.config.get<string>('GVC_PARTNER_URL') || '')
      .trim()
      .replace(/\/$/, '');
  }

  partnerToken(): string {
    return this.getMeta(META_TOKEN) || (this.config.get<string>('GVC_PARTNER_TOKEN') || '').trim();
  }

  set(source: InterpretationSource): InterpretationSettings {
    this.setMeta(META_SOURCE, source);
    if (source === 'pipeline') this.setMeta(META_SERVICES, null);
    return this.get();
  }

  setService(service: string, source: InterpretationSource | null): InterpretationSettings {
    if (!INTERPRETATION_SERVICES.includes(service as InterpretationServiceName)) {
      throw new BadRequestException('Unknown interpretation service');
    }
    const services = this.serviceSources();
    const key = service as InterpretationServiceName;
    if (source === null) delete services[key];
    else services[key] = source;
    this.setMeta(META_SERVICES, Object.keys(services).length ? JSON.stringify(services) : null);
    return this.get();
  }

  setConnection(body: { url?: string; token?: string }): InterpretationSettings {
    if (body.url !== undefined) {
      const url = body.url.trim().replace(/\/$/, '');
      if (url && !/^https?:\/\//i.test(url)) {
        throw new BadRequestException('GVC URL must start with http:// or https://');
      }
      this.setMeta(META_URL, url || null);
      this.logger.log(url ? 'GVC partner URL saved' : 'GVC partner URL cleared');
    }
    if (body.token !== undefined) {
      const token = body.token.trim();
      if (token && token.length < 32) {
        throw new BadRequestException('GVC token must be at least 32 characters');
      }
      this.setMeta(META_TOKEN, token || null);
      this.logger.log(token ? 'GVC partner token saved' : 'GVC partner token cleared');
    }
    return this.get();
  }

  generateToken(): string {
    const token = randomBytes(32).toString('hex');
    this.setMeta(META_TOKEN, token);
    this.logger.log('GVC partner token generated');
    return token;
  }

  private serviceSources(): InterpretationServiceSources {
    return parseServiceSources(this.getMeta(META_SERVICES));
  }

  private storedSource(): string | null {
    return this.getMeta(META_SOURCE)?.toLowerCase() ?? null;
  }

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
}

function preview(token: string): string | null {
  if (!token) return null;
  if (token.length < 4) return '****';
  return `…${token.slice(-4)}`;
}
