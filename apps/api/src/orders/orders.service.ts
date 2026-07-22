import * as path from 'path';
import * as fs from 'fs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DaemonService } from '../daemon/daemon.service';
import { OrderRegistryService, RequestUser } from './order-registry.service';
import type {
  Order,
  OrderListResponse,
  OrderCreateBody,
} from '@gx-portal/types';

export interface OrderListQuery {
  [key: string]: string | number | boolean | undefined;
  service_code?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly daemon: DaemonService,
    private readonly registry: OrderRegistryService,
  ) {}

  async listOrders(query: OrderListQuery, user?: RequestUser): Promise<OrderListResponse> {
    const resp = await this.daemon.get<OrderListResponse>('/orders', query);
    return this.registry.filterOrderList(resp, user);
  }

  async getOrder(id: string, user?: RequestUser): Promise<Order> {
    const canonicalId = this.registry.resolveCanonicalOrderId(id);
    this.registry.assertCanAccess(canonicalId, user);
    const order = await this.daemon.get<Order>(`/order/${canonicalId}`);
    return this.registry.enrichOrder(order);
  }

  async createOrder(
    serviceCode: string,
    body: OrderCreateBody,
    user?: RequestUser,
  ): Promise<Order> {
    const clientId = this.registry.resolveClientIdForCreate(user, body.client_id);
    const orderId = this.registry.allocateOrderId(serviceCode, clientId);
    const workDir =
      body.work_dir?.trim() ||
      this.registry.workDirFromOrderId(orderId) ||
      undefined;

    const description = body.description?.trim() || undefined;
    const daemonBody = { ...body, order_id: orderId, work_dir: workDir };
    delete (daemonBody as Record<string, unknown>).client_id;
    delete (daemonBody as Record<string, unknown>).description;

    const order = await this.daemon.post<Order>(`/order/${serviceCode}/save`, daemonBody);

    this.registry.registerOrder({
      orderId: order.order_id || orderId,
      clientId,
      createdBy: user?.id,
      serviceCode,
      description,
      workDir: order.work_dir ?? workDir,
    });

    return this.registry.enrichOrder(order);
  }

  async updateOrder(
    id: string,
    body: Partial<OrderCreateBody>,
    user?: RequestUser,
  ): Promise<Order> {
    this.registry.assertCanAccess(id, user);
    const patch = { ...body };
    delete (patch as Record<string, unknown>).client_id;
    const order = await this.daemon.patch<Order>(`/order/${id}`, patch);
    return this.registry.enrichOrder(order);
  }

  async startOrder(
    id: string,
    options?: { fresh?: boolean; force?: boolean },
    user?: RequestUser,
  ): Promise<Order> {
    this.registry.assertCanAccess(id, user);
    const order = await this.daemon.post<Order>(`/order/${id}/start`, options);
    return this.registry.enrichOrder(order);
  }

  async stopOrder(id: string, user?: RequestUser): Promise<Order> {
    this.registry.assertCanAccess(id, user);
    const order = await this.daemon.post<Order>(`/order/${id}/stop`);
    return this.registry.enrichOrder(order);
  }

  async reprocessResults(id: string, user?: RequestUser): Promise<Order> {
    this.registry.assertCanAccess(id, user);
    const order = await this.daemon.post<Order>(`/order/${id}/reprocess-results`);
    return this.registry.enrichOrder(order);
  }

  async deleteRun(id: string, user?: RequestUser): Promise<Order> {
    this.registry.assertCanAccess(id, user);
    const order = await this.daemon.post<Order>(`/order/${id}/delete-run`);
    return this.registry.enrichOrder(order);
  }

  async purgeDb(id: string, user?: RequestUser): Promise<Order> {
    this.registry.assertCanAccess(id, user);
    const order = await this.daemon.post<Order>(`/order/${id}/purge-db`);
    return this.registry.enrichOrder(order);
  }

  async getFiles(id: string, user?: RequestUser): Promise<unknown> {
    this.registry.assertCanAccess(id, user);
    return this.daemon.get(`/order/${id}/files`);
  }

  async getPipelineLog(id: string, user?: RequestUser): Promise<string> {
    this.registry.assertCanAccess(id, user);
    return this.daemon.get(`/order/${id}/pipeline-log`);
  }

  async getOutputFile(
    id: string,
    filename: string,
    user?: RequestUser,
  ): Promise<{ filePath: string; mimeType: string }> {
    const order = await this.getOrder(id, user);
    const safeFilename = path.basename(filename);
    const outputDir = (order as unknown as Record<string, string>)['output_dir'];
    if (!outputDir) throw new NotFoundException('Output directory not found for this order');
    const filePath = path.join(outputDir, safeFilename);
    if (!fs.existsSync(filePath)) throw new NotFoundException(`File "${safeFilename}" not found`);
    const ext = path.extname(safeFilename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf':  'application/pdf',
      '.html': 'text/html',
      '.json': 'application/json',
      '.tsv':  'text/tab-separated-values',
      '.vcf':  'text/plain',
      '.gz':    'application/gzip',
      '.bam':  'application/octet-stream',
      '.bai':  'application/octet-stream',
      '.cram': 'application/octet-stream',
      '.crai': 'application/octet-stream',
    };
    return { filePath, mimeType: mimeMap[ext] ?? 'application/octet-stream' };
  }

  async getBamContext(id: string, user?: RequestUser): Promise<{
    bam_path?: string;
    bam_index_path?: string;
    genome?: string;
  }> {
    try {
      const order = await this.getOrder(id, user);
      const outputDir = (order as unknown as Record<string, string>)['output_dir'];
      if (!outputDir || !fs.existsSync(outputDir)) return {};

      const files = fs.readdirSync(outputDir);
      const bamFile  = files.find((f) => f.endsWith('.bam'));
      const cramFile = files.find((f) => f.endsWith('.cram'));
      const chosen   = bamFile ?? cramFile;
      if (!chosen) return {};

      const baiFile = files.find(
        (f) => f === chosen + '.bai' || f === chosen + '.crai' || f === chosen.replace(/\.bam$/, '.bai').replace(/\.cram$/, '.crai'),
      );

      return {
        bam_path:       path.join(outputDir, chosen),
        bam_index_path: baiFile ? path.join(outputDir, baiFile) : undefined,
        genome:         (order as unknown as Record<string, string>)['genome'] ?? 'hg38',
      };
    } catch {
      return {};
    }
  }

  submitToPlatform(serviceCode: string, id: string, body: unknown, user?: RequestUser): Promise<unknown> {
    this.registry.assertCanAccess(id, user);
    return this.daemon.post(`/analysis/${serviceCode}/order/${id}/submit`, body);
  }
}
