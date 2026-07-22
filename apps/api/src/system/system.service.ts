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

  dashboardBucket(): Promise<unknown> {
    return this.daemon.get('/queue/dashboard-bucket');
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
    return this.daemon.patch('/ai/config', body);
  }

  getOllamaModels(): Promise<unknown> {
    return this.daemon.get('/ai/ollama/models');
  }
}
