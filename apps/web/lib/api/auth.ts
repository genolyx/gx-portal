import { api } from './client';
import type { UserProfile } from '@gx-portal/types';

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ user: UserProfile }>('/auth/login', { username, password }),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<UserProfile>('/auth/me'),
};
