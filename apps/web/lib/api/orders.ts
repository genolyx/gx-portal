import { api } from './client';
import type { Order, OrderListResponse, OrderCreateBody } from '@gx-portal/types';

export interface OrderListParams {
  service_code?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export const ordersApi = {
  list: (params?: OrderListParams) => {
    const qs = params
      ? '?' + new URLSearchParams(
          Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
      : '';
    return api.get<OrderListResponse>(`/orders${qs}`);
  },
  getById: (id: string) => api.get<Order>(`/orders/${id}`),
  create: (serviceCode: string, body: OrderCreateBody) =>
    api.post<Order>(`/orders/${serviceCode}/save`, body),
  update: (id: string, body: Partial<OrderCreateBody>) =>
    api.patch<Order>(`/orders/${id}`, body),
  start: (id: string, opts?: { fresh?: boolean; force?: boolean }) =>
    api.post<Order>(`/orders/${id}/start`, opts),
  stop: (id: string) => api.post<Order>(`/orders/${id}/stop`),
  reprocess: (id: string) => api.post<Order>(`/orders/${id}/reprocess-results`),
  deleteRun: (id: string) => api.post<Order>(`/orders/${id}/delete-run`),
  purgeDb: (id: string) => api.post<Order>(`/orders/${id}/purge-db`),
  getFiles: (id: string) => api.get<unknown>(`/orders/${id}/files`),
  getLog: (id: string) => api.get<string>(`/orders/${id}/pipeline-log`),
};
