import { api } from './client';

export const systemApi = {
  health:    () => api.get<unknown>('/system/health'),
  queue:     () => api.get<unknown>('/system/queue'),
  dashboardBucket: (params: {
    bucket: string;
    sort?: string;
    order?: 'asc' | 'desc';
    service_code?: string;
  }) => {
    const qs = new URLSearchParams({ bucket: params.bucket });
    if (params.sort) qs.set('sort', params.sort);
    if (params.order) qs.set('order', params.order);
    if (params.service_code) qs.set('service_code', params.service_code);
    return api.get<{
      bucket: string;
      total: number;
      orders: { order_id: string; status: string; order_updated?: string; message?: string }[];
    }>(`/system/dashboard/bucket?${qs.toString()}`);
  },
  services:  () => api.get<unknown>('/system/services'),
  resources: () => api.get<unknown>('/system/resources'),
  log: (lines = 200) => api.get<unknown>(`/system/log?lines=${lines}`),

  getConfig: () => api.get<{ daemonUrl: string; hasApiKey: boolean }>('/system/config'),
  setConfig: (daemonUrl: string, apiKey?: string) =>
    api.put<{ ok: boolean; daemonUrl: string }>('/system/config', { daemonUrl, apiKey }),

  getAiConfig: () => api.get<unknown>('/system/ai-config'),
  setAiConfig: (body: unknown) => api.put<unknown>('/system/ai-config', body),
  getOllamaModels: () => api.get<{ models?: { name: string }[] } | string[]>('/system/ai/models'),

  testConnection: () =>
    api.get<unknown>('/system/health'),

  hostResources: () => api.get<unknown>('/system/host-resources'),
};
