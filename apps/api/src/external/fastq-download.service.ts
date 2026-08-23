import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'fs';
import { mkdir, rm, stat, unlink } from 'fs/promises';
import * as dns from 'dns/promises';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import type { Readable } from 'stream';

const EXOME_SERVICES = new Set([
  'carrier_screening',
  'whole_exome',
  'health_screening',
]);

const MAX_REDIRECTS = 5;
const CONNECT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024 * 1024; // 50 GiB

@Injectable()
export class FastqDownloadService {
  private readonly logger = new Logger(FastqDownloadService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Local write root (API process) and optional daemon-visible root.
   * When the API runs in Docker and gx-daemon is on the host, set
   * FASTQ_DIR_*_DAEMON to the host absolute path of the same bind mount.
   */
  resolveRoots(serviceCode: string): { localRoot: string; daemonRoot: string } {
    let localKey: string;
    let daemonKey: string;
    if (serviceCode === 'sgnipt') {
      localKey = 'FASTQ_DIR_SGNIPT';
      daemonKey = 'FASTQ_DIR_SGNIPT_DAEMON';
    } else if (EXOME_SERVICES.has(serviceCode)) {
      localKey = 'FASTQ_DIR_CARRIER';
      daemonKey = 'FASTQ_DIR_CARRIER_DAEMON';
    } else {
      throw new BadRequestException(`Unsupported service for FASTQ download: ${serviceCode}`);
    }

    const localRaw = this.config.get<string>(localKey)?.trim();
    if (!localRaw) {
      throw new BadRequestException(
        `${localKey} is not configured (required for URL downloads)`,
      );
    }
    const localRoot = path.resolve(localRaw);
    const daemonRaw = this.config.get<string>(daemonKey)?.trim();
    const daemonRoot = daemonRaw ? path.resolve(daemonRaw) : localRoot;
    return { localRoot, daemonRoot };
  }

  resolveDestDir(serviceCode: string, orderId: string): string {
    this.assertSafeOrderId(orderId);
    const { localRoot } = this.resolveRoots(serviceCode);
    const destDir = path.resolve(localRoot, orderId);
    if (destDir !== localRoot && !destDir.startsWith(localRoot + path.sep)) {
      throw new BadRequestException('Invalid order_id for FASTQ path');
    }
    return destDir;
  }

  /** Map a local write path to the path gx-daemon should use. */
  toDaemonPath(serviceCode: string, localPath: string): string {
    const { localRoot, daemonRoot } = this.resolveRoots(serviceCode);
    const resolved = path.resolve(localPath);
    if (resolved === localRoot) return daemonRoot;
    if (!resolved.startsWith(localRoot + path.sep)) {
      return resolved;
    }
    return path.join(daemonRoot, resolved.slice(localRoot.length + 1));
  }

  /**
   * Download a remote FASTQ into `{root}/{orderId}/{filename}`.
   * Returns the path that should be stored on the order (daemon-visible).
   */
  async downloadToOrderDir(
    serviceCode: string,
    orderId: string,
    url: string,
    role: 'r1' | 'r2',
    avoidName?: string,
  ): Promise<string> {
    const destDir = this.resolveDestDir(serviceCode, orderId);
    await mkdir(destDir, { recursive: true });

    const basename = this.uniqueFileName(url, role, avoidName);
    const destPath = path.join(destDir, basename);
    this.assertUnderDir(destDir, destPath);

    this.logger.log(`Downloading FASTQ ${role} for ${orderId} → ${destPath}`);
    try {
      await this.downloadUrl(url, destPath);
    } catch (err) {
      await unlink(destPath).catch(() => undefined);
      throw err;
    }
    return this.toDaemonPath(serviceCode, destPath);
  }

  /** Best-effort cleanup after a failed create (order dir under FASTQ root). */
  async cleanupOrderDir(serviceCode: string, orderId: string): Promise<void> {
    try {
      const destDir = this.resolveDestDir(serviceCode, orderId);
      await rm(destDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  private assertSafeOrderId(orderId: string): void {
    if (!orderId || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/.test(orderId)) {
      throw new BadRequestException('Invalid order_id for FASTQ path');
    }
  }

  private assertUnderDir(dir: string, filePath: string): void {
    const resolvedDir = path.resolve(dir);
    const resolvedFile = path.resolve(filePath);
    if (resolvedFile !== resolvedDir && !resolvedFile.startsWith(resolvedDir + path.sep)) {
      throw new BadRequestException('Refusing path outside FASTQ directory');
    }
  }

  private uniqueFileName(url: string, role: 'r1' | 'r2', avoidName?: string): string {
    let name = this.basenameFromUrl(url, role);
    if (avoidName && name.toLowerCase() === avoidName.toLowerCase()) {
      const { stem, ext } = splitCompoundExt(name);
      name = `${stem}_${role.toUpperCase()}${ext}`;
    }
    return name;
  }

  private basenameFromUrl(urlStr: string, role: 'r1' | 'r2'): string {
    let pathname: string;
    try {
      pathname = new URL(urlStr).pathname;
    } catch {
      throw new BadRequestException(`Invalid FASTQ URL (${role}): ${urlStr}`);
    }
    const raw = path.basename(pathname) || '';
    if (raw && raw !== '/' && raw !== '.') {
      const safe = raw.replace(/[^a-zA-Z0-9._+-]+/g, '_').replace(/^\.+/, '');
      if (safe.length > 0 && !safe.includes('..')) return safe.slice(0, 180);
    }
    return role === 'r1' ? 'R1.fastq.gz' : 'R2.fastq.gz';
  }

  private async downloadUrl(urlStr: string, destPath: string, redirectsLeft = MAX_REDIRECTS): Promise<void> {
    const maxBytes = Number(this.config.get<string>('EXTERNAL_FASTQ_MAX_BYTES') ?? DEFAULT_MAX_BYTES);

    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      throw new BadRequestException(`Invalid FASTQ URL: ${urlStr}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('FASTQ URL must be http or https');
    }
    if (parsed.username || parsed.password) {
      throw new BadRequestException('FASTQ URL must not include credentials');
    }

    await this.assertPublicHostname(parsed.hostname);

    const transport = parsed.protocol === 'https:' ? https : http;
    await new Promise<void>((resolve, reject) => {
      const req = transport.get(
        parsed,
        {
          timeout: CONNECT_TIMEOUT_MS,
          headers: { 'User-Agent': 'gx-portal-external-api/1.0' },
        },
        (res) => {
          const status = res.statusCode ?? 0;
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            if (redirectsLeft <= 0) {
              reject(new BadRequestException('Too many redirects fetching FASTQ'));
              return;
            }
            const next = new URL(res.headers.location, parsed).toString();
            this.downloadUrl(next, destPath, redirectsLeft - 1).then(resolve, reject);
            return;
          }
          if (status < 200 || status >= 300) {
            res.resume();
            reject(new BadRequestException(`FASTQ download failed HTTP ${status} for ${urlStr}`));
            return;
          }

          const contentLength = Number(res.headers['content-length'] ?? 0);
          if (contentLength > maxBytes) {
            res.resume();
            reject(new BadRequestException(`FASTQ exceeds max size (${maxBytes} bytes)`));
            return;
          }

          let received = 0;
          res.on('data', (chunk: Buffer) => {
            received += chunk.length;
            if (received > maxBytes) {
              req.destroy();
              reject(new BadRequestException(`FASTQ exceeds max size (${maxBytes} bytes)`));
            }
          });

          const out = createWriteStream(destPath);
          pipeline(res as Readable, out)
            .then(async () => {
              const st = await stat(destPath);
              if (st.size <= 0) {
                throw new BadRequestException('Downloaded FASTQ is empty');
              }
              resolve();
            })
            .catch(reject);
        },
      );
      req.on('timeout', () => {
        req.destroy();
        reject(new ServiceUnavailableException(`Timeout downloading FASTQ from ${urlStr}`));
      });
      req.on('error', (err) => {
        reject(new ServiceUnavailableException(`FASTQ download error: ${err.message}`));
      });
    });
  }

  /** Block SSRF to loopback / private / link-local / metadata endpoints. */
  private async assertPublicHostname(hostname: string): Promise<void> {
    // URL.hostname may be "[::1]" for IPv6 literals
    let host = hostname.trim().toLowerCase().replace(/\.$/, '');
    if (host.startsWith('[') && host.endsWith(']')) {
      host = host.slice(1, -1);
    }
    if (!host) throw new BadRequestException('FASTQ URL host is empty');
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
      throw new BadRequestException('FASTQ URL must not target private hosts');
    }
    if (
      host === 'metadata.google.internal' ||
      host === 'metadata' ||
      host === 'instance-data'
    ) {
      throw new BadRequestException('FASTQ URL must not target metadata endpoints');
    }

    if (net.isIP(host)) {
      if (this.isPrivateIp(host)) {
        throw new BadRequestException('FASTQ URL must not target private IP addresses');
      }
      return;
    }

    let addresses: string[];
    try {
      const result = await dns.lookup(host, { all: true, verbatim: true });
      addresses = result.map((r) => r.address);
    } catch {
      throw new BadRequestException(`Cannot resolve FASTQ host: ${host}`);
    }
    if (addresses.length === 0) {
      throw new BadRequestException(`Cannot resolve FASTQ host: ${host}`);
    }
    for (const addr of addresses) {
      if (this.isPrivateIp(addr)) {
        throw new BadRequestException('FASTQ URL resolves to a private IP address');
      }
    }
  }

  private isPrivateIp(ip: string): boolean {
    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map(Number);
      const [a, b] = parts;
      if (a === 10) return true;
      if (a === 127) return true;
      if (a === 0) return true;
      if (a === 169 && b === 254) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
      if (a === 168 && b === 63 && parts[2] === 129 && parts[3] === 16) return true; // Azure IMDS
      return false;
    }
    if (net.isIPv6(ip)) {
      const normalized = ip.toLowerCase();
      if (normalized === '::1') return true;
      if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
      if (normalized.startsWith('fe80')) return true;
      if (normalized.startsWith('::ffff:')) {
        const v4 = normalized.slice('::ffff:'.length);
        if (net.isIPv4(v4)) return this.isPrivateIp(v4);
      }
      return false;
    }
    return true;
  }
}

/** Prefer compound FASTQ extensions over path.extname (".gz"). */
function splitCompoundExt(name: string): { stem: string; ext: string } {
  const lower = name.toLowerCase();
  for (const ext of ['.fastq.gz', '.fq.gz', '.fastq', '.fq', '.gz']) {
    if (lower.endsWith(ext)) {
      return { stem: name.slice(0, -ext.length), ext: name.slice(-ext.length) };
    }
  }
  return { stem: name, ext: '.fastq.gz' };
}
