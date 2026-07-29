import { api } from './client';

export type SystemHealth = {
  portal?: string;
  version?: string;
  daemon?: { status?: string };
};

/** gx-daemon GET /queue/summary — Admin Dashboard schema */
export type QueueSummaryTotals = {
  queued: number;
  running: number;
  completed_today: number;
  failed_today: number;
};

export type QueueSummaryServiceRow = {
  service_code: string;
  display_name: string;
  slot_group: string;
  max_parallel: number;
  running: number;
  queued: number;
  available: number;
  completed_today: number;
  failed_today: number;
};

export type QueueSummarySlotGroup = {
  group: string;
  max_parallel: number;
  running: number;
  queued: number;
  available: number;
  services: string[];
};

export type QueueSummary = {
  today?: string;
  totals?: QueueSummaryTotals;
  services?: QueueSummaryServiceRow[];
  slot_groups?: QueueSummarySlotGroup[];
  running_jobs?: {
    order_id: string;
    service_code?: string;
    sample_name?: string;
    status?: string;
    progress?: number;
    message?: string;
    started_at?: string;
  }[];
  // Legacy (still returned by gx-daemon)
  total_queued?: number;
  total_running?: number;
  total_completed?: number;
  total_failed?: number;
};

export const systemApi = {
  health:    () => api.get<SystemHealth>('/system/health'),
  queue:     () => api.get<QueueSummary>('/system/queue'),
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
      orders: {
        order_id: string;
        status: string;
        service_code?: string;
        order_updated?: string;
        message?: string;
      }[];
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
  getOllamaModels: () => api.get<{ models?: { name: string }[] | string[] } | string[]>('/system/ai/models'),

  /** Stream Ollama model pull progress (NDJSON). */
  pullOllamaModel: async (
    model: string,
    onLine?: (evt: Record<string, unknown>) => void,
  ): Promise<void> => {
    const res = await fetch('/api/system/ai/ollama/pull', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Pull failed (${res.status})`);
    }
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          onLine?.(JSON.parse(line) as Record<string, unknown>);
        } catch {
          onLine?.({ status: line });
        }
      }
    }
    if (buf.trim()) {
      try {
        onLine?.(JSON.parse(buf) as Record<string, unknown>);
      } catch {
        onLine?.({ status: buf });
      }
    }
  },

  testConnection: () =>
    api.get<unknown>('/system/health'),

  hostResources: () => api.get<unknown>('/system/host-resources'),
};
