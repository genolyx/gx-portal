import { Injectable } from '@nestjs/common';
import { DaemonService } from '../daemon/daemon.service';
import type {
  Order,
  OrderListResponse,
  OrderCreateBody,
  TokenPayload,
} from '@gx-portal/types';

export interface OrderListQuery {
  service_code?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

type RequestUser = Omit<TokenPayload, 'iat' | 'exp'> & { id: number };

@Injectable()
export class OrdersService {
  constructor(private readonly daemon: DaemonService) {}

  /**
   * List orders with optional service filtering.
   * - admin: sees all orders, may filter by service_code
   * - client/lab user: daemon is queried with the allowed service_code(s)
   *   (the UI passes the allowed code; further enforcement happens at daemon level)
   */
  async listOrders(query: OrderListQuery, user?: RequestUser): Promise<OrderListResponse> {
    return this.daemon.get<OrderListResponse>('/orders', query);
  }

  getOrder(id: string): Promise<Order> {
    return this.daemon.get<Order>(`/order/${id}`);
  }

  createOrder(serviceCode: string, body: OrderCreateBody): Promise<Order> {
    return this.daemon.post<Order>(`/order/${serviceCode}/save`, body);
  }

  updateOrder(id: string, body: Partial<OrderCreateBody>): Promise<Order> {
    return this.daemon.patch<Order>(`/order/${id}`, body);
  }

  startOrder(id: string, options?: { fresh?: boolean; force?: boolean }): Promise<Order> {
    return this.daemon.post<Order>(`/order/${id}/start`, options);
  }

  stopOrder(id: string): Promise<Order> {
    return this.daemon.post<Order>(`/order/${id}/stop`);
  }

  reprocessResults(id: string): Promise<Order> {
    return this.daemon.post<Order>(`/order/${id}/reprocess-results`);
  }

  deleteRun(id: string): Promise<Order> {
    return this.daemon.post<Order>(`/order/${id}/delete-run`);
  }

  purgeDb(id: string): Promise<Order> {
    return this.daemon.post<Order>(`/order/${id}/purge-db`);
  }

  getFiles(id: string): Promise<unknown> {
    return this.daemon.get(`/order/${id}/files`);
  }

  getPipelineLog(id: string): Promise<string> {
    return this.daemon.get(`/order/${id}/pipeline-log`);
  }

  submitToPlatform(serviceCode: string, id: string, body: unknown): Promise<unknown> {
    return this.daemon.post(`/analysis/${serviceCode}/order/${id}/submit`, body);
  }
}
