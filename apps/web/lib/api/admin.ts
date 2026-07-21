import { api } from './client';
import type {
  Client, CreateClientDto, UpdateClientDto,
  Lab, CreateLabDto, UpdateLabDto,
  UserProfile, CreateUserDto, UpdateUserDto,
} from '@gx-portal/types';

// ─── Clients ──────────────────────────────────────────────────────────────────
export const clientsApi = {
  list: () => api.get<Client[]>('/admin/clients'),
  getById: (id: number) => api.get<Client>(`/admin/clients/${id}`),
  create: (dto: CreateClientDto) => api.post<Client>('/admin/clients', dto),
  update: (id: number, dto: UpdateClientDto) => api.put<Client>(`/admin/clients/${id}`, dto),
  delete: (id: number) => api.delete<void>(`/admin/clients/${id}`),
};

// ─── Labs ─────────────────────────────────────────────────────────────────────
export const labsApi = {
  list: (clientId?: number) =>
    api.get<Lab[]>(clientId ? `/admin/labs?client_id=${clientId}` : '/admin/labs'),
  getById: (id: number) => api.get<Lab>(`/admin/labs/${id}`),
  create: (dto: CreateLabDto) => api.post<Lab>('/admin/labs', dto),
  update: (id: number, dto: UpdateLabDto) => api.put<Lab>(`/admin/labs/${id}`, dto),
  delete: (id: number) => api.delete<void>(`/admin/labs/${id}`),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get<UserProfile[]>('/admin/users'),
  getById: (id: number) => api.get<UserProfile>(`/admin/users/${id}`),
  create: (dto: CreateUserDto) => api.post<UserProfile>('/admin/users', dto),
  update: (id: number, dto: UpdateUserDto) => api.put<UserProfile>(`/admin/users/${id}`, dto),
  delete: (id: number) => api.delete<void>(`/admin/users/${id}`),
};
