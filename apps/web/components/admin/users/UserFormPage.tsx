'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usersApi, clientsApi, labsApi } from '../../../lib/api/admin';
import { PageHeader } from '../../ui/PageHeader';
import { Button } from '../../ui/Button';
import { Toggle } from '../../ui/Toggle';
import type { UserProfile, CreateUserDto, UpdateUserDto, Client, Lab } from '@gx-portal/types';
import styles from '../Admin.module.css';

type Role = 'admin' | 'client' | 'lab';

interface FormState {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  client_id?: number;
  lab_id?: number;
  password: string;
  email_notification: boolean;
}

export function UserFormPage({ id }: { id: string }) {
  const isNew = id === 'new';
  const router = useRouter();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);

  const [form, setForm] = useState<FormState>({
    username: '', first_name: '', last_name: '', email: '',
    role: 'client', client_id: undefined, lab_id: undefined,
    password: '', email_notification: false,
  });

  useEffect(() => {
    clientsApi.list().then(setClients).catch(() => {});
    labsApi.list().then(setLabs).catch(() => {});

    if (!isNew) {
      usersApi.getById(Number(id)).then((u: UserProfile) => {
        setForm({
          username: u.username,
          first_name: u.first_name ?? '',
          last_name: u.last_name ?? '',
          email: u.email ?? '',
          role: u.role as Role,
          client_id: u.client_id,
          lab_id: u.lab_id,
          password: '',
          email_notification: u.email_notification,
        });
      }).catch(() => router.push('/admin/users'))
        .finally(() => setLoading(false));
    }
  }, [id, isNew, router]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  // When role changes, clear other affiliation
  const setRole = (role: Role) => {
    setForm((p) => ({ ...p, role, client_id: undefined, lab_id: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (isNew) {
        const dto: CreateUserDto = {
          username: form.username,
          password: form.password,
          first_name: form.first_name || undefined,
          last_name: form.last_name || undefined,
          email: form.email || undefined,
          role: form.role,
          client_id: form.role === 'client' ? form.client_id : undefined,
          lab_id: form.role === 'lab' ? form.lab_id : undefined,
          email_notification: form.email_notification,
        };
        await usersApi.create(dto);
      } else {
        const dto: UpdateUserDto = {
          first_name: form.first_name || undefined,
          last_name: form.last_name || undefined,
          email: form.email || undefined,
          role: form.role,
          client_id: form.role === 'client' ? form.client_id : undefined,
          lab_id: form.role === 'lab' ? form.lab_id : undefined,
          email_notification: form.email_notification,
          password: form.password || undefined,
        };
        await usersApi.update(Number(id), dto);
      }
      router.push('/admin/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  if (loading) return <p className={styles.empty}>Loading…</p>;

  return (
    <div>
      <PageHeader
        title={isNew ? 'Create User' : 'Update User'}
        description={isNew ? 'Create a new user.' : `Update user "${form.username}"`}
        backHref="/admin/users"
      />

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.full}`}>
            <label className={styles.label}>Username <span className={styles.req}>*</span></label>
            <input
              value={form.username}
              onChange={(e) => set('username', e.target.value)}
              required
              disabled={!isNew}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>First Name <span className={styles.req}>*</span></label>
            <input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} className={styles.input} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Last Name <span className={styles.req}>*</span></label>
            <input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} className={styles.input} />
          </div>

          <div className={`${styles.field} ${styles.full}`}>
            <label className={styles.label}>Email <span className={styles.req}>*</span></label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={styles.input} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Role <span className={styles.req}>*</span></label>
            <select value={form.role} onChange={(e) => setRole(e.target.value as Role)} className={styles.input}>
              <option value="admin">Administrator</option>
              <option value="client">Client</option>
              <option value="lab">Lab</option>
            </select>
          </div>

          {/* Conditional: client or lab selector */}
          {form.role === 'client' && (
            <div className={styles.field}>
              <label className={styles.label}>Client <span className={styles.req}>*</span></label>
              <select
                value={form.client_id ?? ''}
                onChange={(e) => set('client_id', e.target.value ? Number(e.target.value) : undefined)}
                className={styles.input}
              >
                <option value="">— Select Client —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {form.role === 'lab' && (
            <div className={styles.field}>
              <label className={styles.label}>Lab <span className={styles.req}>*</span></label>
              <select
                value={form.lab_id ?? ''}
                onChange={(e) => set('lab_id', e.target.value ? Number(e.target.value) : undefined)}
                className={styles.input}
              >
                <option value="">— Select Lab —</option>
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}{l.client_name ? ` (${l.client_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Password {isNew && <span className={styles.req}>*</span>}</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              required={isNew}
              placeholder={isNew ? '' : 'Leave blank to keep current'}
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.toggleRow}>
          <Toggle
            label="Email Notification"
            checked={form.email_notification}
            onChange={(v) => set('email_notification', v)}
            required
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button type="submit" variant="primary" loading={saving}>
            {isNew ? 'Create User' : 'Save Changes'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/admin/users')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
