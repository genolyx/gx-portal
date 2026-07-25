import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DaemonService {
  private readonly logger = new Logger(DaemonService.name);
  private _baseUrl: string;
  private _apiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this._baseUrl = config.get<string>('DAEMON_URL', 'http://localhost:8010');
    this._apiKey = config.get<string>('DAEMON_API_KEY');
  }

  /** Update daemon URL (and optionally API key) at runtime */
  setDaemonUrl(url: string, apiKey?: string) {
    this._baseUrl = url.replace(/\/$/, '');
    if (apiKey !== undefined) this._apiKey = apiKey || undefined;
    this.logger.log(`Daemon URL updated → ${this._baseUrl}`);
  }

  getConfig() {
    return {
      daemonUrl: this._baseUrl,
      hasApiKey: Boolean(this._apiKey),
    };
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this._apiKey) {
      headers['X-API-Key'] = this._apiKey;
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    let url = `${this._baseUrl}${path}`;

    if (query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    this.logger.debug(`${method} ${url}`);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: this.buildHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      this.logger.error(`Daemon unreachable: ${(err as Error).message}`);
      throw new HttpException('gx-daemon unreachable', HttpStatus.BAD_GATEWAY);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Daemon ${method} ${path} → ${res.status}: ${text}`);
      throw new HttpException(
        text || `Daemon error ${res.status}`,
        res.status,
      );
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return res.json() as Promise<T>;
    }
    return res.text() as unknown as T;
  }

  get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('GET', path, undefined, query);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  /** Fetch a binary/text artifact from the daemon (does not force JSON parse). */
  async fetchRaw(path: string): Promise<{ body: Buffer; contentType: string; status: number }> {
    const url = `${this._baseUrl}${path}`;
    const headers: Record<string, string> = {};
    if (this._apiKey) headers['X-API-Key'] = this._apiKey;

    let res: Response;
    try {
      res = await fetch(url, { method: 'GET', headers });
    } catch (err) {
      this.logger.error(`Daemon unreachable: ${(err as Error).message}`);
      throw new HttpException('gx-daemon unreachable', HttpStatus.BAD_GATEWAY);
    }

    const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
    const ab = await res.arrayBuffer();
    return { body: Buffer.from(ab), contentType, status: res.status };
  }

  /**
   * Stream a daemon response (supports Range / HEAD for IGV BAM).
   * Caller is responsible for piping `response.body` to the client.
   */
  async fetchStream(
    path: string,
    opts?: { method?: 'GET' | 'HEAD' | 'POST'; range?: string; body?: unknown },
  ): Promise<Response> {
    const url = `${this._baseUrl}${path}`;
    const headers: Record<string, string> = {};
    if (this._apiKey) headers['X-API-Key'] = this._apiKey;
    if (opts?.range) headers['Range'] = opts.range;
    const method = opts?.method ?? 'GET';
    if (opts?.body !== undefined) headers['Content-Type'] = 'application/json';

    try {
      return await fetch(url, {
        method,
        headers,
        body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (err) {
      this.logger.error(`Daemon unreachable: ${(err as Error).message}`);
      throw new HttpException('gx-daemon unreachable', HttpStatus.BAD_GATEWAY);
    }
  }
}
