import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const EXOME_SERVICES = new Set([
  'carrier_screening',
  'whole_exome',
  'health_screening',
]);

const MAX_BYTES = 50 * 1024 * 1024 * 1024; // 50 GiB soft cap
const FETCH_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class FastqDownloadService {
  private readonly logger = new Logger(FastqDownloadService.name);

  constructor(private readonly config: ConfigService) {}

  resolveRoot(serviceCode: string): string {
    if (serviceCode === 'sgnipt') {
      const dir = this.config.get<string>('FASTQ_DIR_SGNIPT')?.trim();
      if (!dir) {
        throw new BadRequestException(
          'FASTQ_DIR_SGNIPT is not configured (required for URL downloads)',
        );
      }
      return dir;
    }
    if (EXOME_SERVICES.has(serviceCode)) {
      const dir = this.config.get<string>('FASTQ_DIR_CARRIER')?.trim();
      if (!dir) {
        throw new BadRequestException(
          'FASTQ_DIR_CARRIER is not configured (required for URL downloads)',
        );
      }
      return dir;
    }
    throw new BadRequestException(`Unsupported service for FASTQ download: ${serviceCode}`);
  }

  /**
   * Download a remote FASTQ into `{root}/{orderId}/{filename}`.
   * Returns the absolute local path.
   */
  async downloadToOrderDir(
    serviceCode: string,
    orderId: string,
    url: string,
    role: 'r1' | 'r2',
  ): Promise<string> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException(`Invalid FASTQ URL (${role}): ${url}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException(`FASTQ URL must be http(s) (${role})`);
    }

    const root = this.resolveRoot(serviceCode);
    const destDir = path.join(root, orderId);
    await mkdir(destDir, { recursive: true });

    const basename = basenameFromUrl(parsed, role);
    const destPath = path.join(destDir, basename);

    this.logger.log(`Downloading FASTQ ${role} for ${orderId} → ${destPath}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
      });
      if (!res.ok || !res.body) {
        throw new BadRequestException(
          `FASTQ download failed (${role}): HTTP ${res.status} ${res.statusText}`,
        );
      }
      const len = res.headers.get('content-length');
      if (len && Number(len) > MAX_BYTES) {
        throw new BadRequestException(`FASTQ file too large (${role})`);
      }

      const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream);
      await pipeline(nodeStream, createWriteStream(destPath));
    } catch (err) {
      await unlink(destPath).catch(() => undefined);
      if (err instanceof BadRequestException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`FASTQ download failed (${role}): ${msg}`);
    } finally {
      clearTimeout(timer);
    }

    return destPath;
  }
}

function basenameFromUrl(u: URL, role: 'r1' | 'r2'): string {
  const raw = path.basename(u.pathname) || '';
  if (raw && raw !== '/' && raw !== '.') {
    // Sanitize path segments
    const safe = raw.replace(/[^a-zA-Z0-9._+-]/g, '_');
    if (safe.length > 0) return safe;
  }
  return role === 'r1' ? 'R1.fastq.gz' : 'R2.fastq.gz';
}
