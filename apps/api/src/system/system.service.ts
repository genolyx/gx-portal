import { Injectable } from '@nestjs/common';
import { DaemonService } from '../daemon/daemon.service';

@Injectable()
export class SystemService {
  constructor(private readonly daemon: DaemonService) {}

  health(): Promise<unknown> {
    return this.daemon.get('/health');
  }

  queueSummary(): Promise<unknown> {
    return this.daemon.get('/queue/summary');
  }

  dashboardBucket(query: {
    bucket: string;
    sort?: string;
    order?: 'asc' | 'desc';
    service_code?: string;
  }): Promise<unknown> {
    const params = new URLSearchParams({ bucket: query.bucket });
    if (query.sort) params.set('sort', query.sort);
    if (query.order) params.set('order', query.order);
    if (query.service_code) params.set('service_code', query.service_code);
    return this.daemon.get(`/queue/dashboard-bucket?${params.toString()}`);
  }

  services(): Promise<unknown> {
    return this.daemon.get('/services');
  }

  resources(): Promise<unknown> {
    return this.daemon.get('/api/portal/resources');
  }

  daemonLog(lines = 200): Promise<unknown> {
    return this.daemon.get('/daemon-log', { lines });
  }

  getConfig() {
    return this.daemon.getConfig();
  }

  setConfig(daemonUrl: string, apiKey?: string) {
    this.daemon.setDaemonUrl(daemonUrl, apiKey);
  }

  getAiConfig(): Promise<unknown> {
    return this.daemon.get('/ai/config').catch(() => null);
  }

  setAiConfig(body: unknown): Promise<unknown> {
    // Accept nested portal shape or flat daemon shape; always send flat keys.
    const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const ollama = (raw.ollama && typeof raw.ollama === 'object'
      ? raw.ollama
      : {}) as Record<string, unknown>;
    const flat: Record<string, unknown> = {};
    if (raw.provider != null) flat.provider = raw.provider;
    const baseUrl = raw.ollama_base_url ?? ollama.base_url;
    const model = raw.ollama_model ?? ollama.model;
    if (baseUrl != null) flat.ollama_base_url = baseUrl;
    if (model != null) flat.ollama_model = model;
    return this.daemon.patch('/ai/config', flat);
  }

  getOllamaModels(): Promise<unknown> {
    return this.daemon.get('/ai/ollama/models');
  }

  pullOllamaModel(model: string): Promise<Response> {
    return this.daemon.fetchStream('/ai/ollama/pull', {
      method: 'POST',
      body: { model },
    });
  }
}
