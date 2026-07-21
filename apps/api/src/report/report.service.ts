import { Injectable } from '@nestjs/common';
import { DaemonService } from '../daemon/daemon.service';
import type { ReportBody, ReportPreviewResponse } from '@gx-portal/types';

@Injectable()
export class ReportService {
  constructor(private readonly daemon: DaemonService) {}

  generateReport(orderId: string, body: ReportBody): Promise<unknown> {
    return this.daemon.post(`/order/${orderId}/report`, body);
  }

  previewReport(orderId: string, body: ReportBody): Promise<ReportPreviewResponse> {
    return this.daemon.post<ReportPreviewResponse>(`/order/${orderId}/report/preview`, body);
  }

  reportFromHtml(orderId: string, body: { html: string }): Promise<unknown> {
    return this.daemon.post(`/order/${orderId}/report/from-html`, body);
  }
}
