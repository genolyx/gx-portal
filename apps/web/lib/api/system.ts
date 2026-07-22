import { api } from './client';

export const systemApi = {
  health:    () => api.get<unknown>('/system/health'),
  queue:     () => api.get<unknown>('/system/queue'),
  dashboard: () => api.get<unknown>('/system/dashboard'),
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
};
