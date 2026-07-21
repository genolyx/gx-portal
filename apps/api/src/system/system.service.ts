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

  daemonLog(): Promise<string> {
    return this.daemon.get('/daemon-log');
  }
}
