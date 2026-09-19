import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { ExternalKeysService } from '../system/external-keys.service';

@Injectable()
export class GxCallbacksService {
  private readonly logger = new Logger(GxCallbacksService.name);

  constructor(private readonly keys: ExternalKeysService) {}

  private authHeaders(): Record<string, string> {
    const key = this.keys.getOutbound();
    if (!key) return {};
    return { Authorization: `Bearer ${key}` };
  }

  private safeUrl(url: string): string {
    return (url || '').split('?')[0];
  }

  async notifyFailed(statusUrl: string | undefined, orderId: string, message: string): Promise<void> {
    if (!statusUrl) {
      this.logger.warn(`GX status_url missing; skip failed notify for ${orderId}`);
      return;
    }
    try {
      const res = await fetch(statusUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({ order_id: orderId, status: 'failed', message }),
      });
      this.logger.log(`GX status callback ${this.safeUrl(statusUrl)} → HTTP ${res.status}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`GX status callback failed for ${orderId}: ${msg}`);
    }
  }

  async sendReportPdf(reportUrl: string, pdfPath: string, orderId: string): Promise<Record<string, unknown>> {
    const buf = await readFile(pdfPath);
    const filename = path.basename(pdfPath);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buf)], { type: 'application/pdf' }), filename);
    form.append('external_order_id', orderId);
    form.append('completed_at', new Date().toISOString());

    const res = await fetch(reportUrl, {
      method: 'POST',
      headers: this.authHeaders(),
      body: form,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`GX report send HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    this.logger.log(`GX report sent for ${orderId} → ${this.safeUrl(reportUrl)}`);
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { order_id: orderId, status: 'REPORT_READY' };
    }
  }
}
