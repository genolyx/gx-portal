import { api } from './client';
import type { Order, OrderListResponse, OrderCreateBody } from '@gx-portal/types';

const enc = (id: string) => encodeURIComponent(id);

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
  getById: (id: string) => api.get<Order>(`/orders/${enc(id)}`),
  create: (serviceCode: string, body: OrderCreateBody) =>
    api.post<Order>(`/orders/${enc(serviceCode)}/save`, body),
  update: (id: string, body: Partial<OrderCreateBody>) =>
    api.patch<Order>(`/orders/${enc(id)}`, body),
  start: (id: string, opts?: { fresh?: boolean; force?: boolean }) =>
    api.post<Order>(`/orders/${enc(id)}/start`, opts),
  stop: (id: string) => api.post<Order>(`/orders/${enc(id)}/stop`),
  reprocess: (id: string) => api.post<Order>(`/orders/${enc(id)}/reprocess-results`),
  deleteRun: (id: string) => api.post<Order>(`/orders/${enc(id)}/delete-run`),
  purgeDb: (id: string) => api.post<Order>(`/orders/${enc(id)}/purge-db`),
  getFiles: (id: string) => api.get<{ files: { name: string; size: number; mtime_ms: number; type: string }[] }>(`/orders/${enc(id)}/files`),
  getOutputFileUrl: (id: string, filename: string) => `/api/orders/${enc(id)}/output/${encodeURIComponent(filename)}`,
  getLog: (id: string) => api.getText(`/orders/${enc(id)}/pipeline-log`),
};
