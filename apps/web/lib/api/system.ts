import { api } from './client';

export const systemApi = {
  health: () => api.get<unknown>('/system/health'),
  queue: () => api.get<unknown>('/system/queue'),
  dashboard: () => api.get<unknown>('/system/dashboard'),
  services: () => api.get<unknown>('/system/services'),
  resources: () => api.get<unknown>('/system/resources'),
  log: () => api.get<string>('/system/log'),
};
