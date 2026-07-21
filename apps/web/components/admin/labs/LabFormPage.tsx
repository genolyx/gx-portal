'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { labsApi, clientsApi } from '../../../lib/api/admin';
import { systemApi } from '../../../lib/api/system';
import { PageHeader } from '../../ui/PageHeader';
import { Button } from '../../ui/Button';
import { MultiSelect } from '../../ui/MultiSelect';
import type { Lab, CreateLabDto, Client } from '@gx-portal/types';
import styles from '../Admin.module.css';

export function LabFormPage({ id }: { id: string }) {
  const isNew = id === 'new';
  const router = useRouter();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [availableServices, setAvailableServices] = useState<string[]>([]);

  const [form, setForm] = useState<CreateLabDto>({
    name: '', address: '', email: '', phone: '', client_id: undefined, service_codes: [],
  });

  useEffect(() => {
    clientsApi.list().then(setClients).catch(() => {});
    systemApi.services().then((svcs: unknown) => {
      if (Array.isArray(svcs)) setAvailableServices((svcs as { code: string }[]).map((s) => s.code));
    }).catch(() => {});

    if (!isNew) {
      labsApi.getById(Number(id)).then((l: Lab) => {
        setForm({ name: l.name, address: l.address ?? '', email: l.email ?? '', phone: l.phone ?? '', client_id: l.client_id, service_codes: l.service_codes });
      }).catch(() => router.push('/admin/labs'))
        .finally(() => setLoading(false));
    }
  }, [id, isNew, router]);

  const set = <K extends keyof CreateLabDto>(k: K, v: CreateLabDto[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      isNew ? await labsApi.create(form) : await labsApi.update(Number(id), form);
      router.push('/admin/labs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  if (loading) return <p className={styles.empty}>Loading…</p>;

  return (
    <div>
      <PageHeader
        title={isNew ? 'New Lab' : 'Update Lab'}
        description={isNew ? 'Register a sequencing lab.' : 'Update a lab'}
        backHref="/admin/labs"
      />
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Lab Name <span className={styles.req}>*</span></label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required className={styles.input} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Address <span className={styles.req}>*</span></label>
            <input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} className={styles.input} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Email <span className={styles.req}>*</span></label>
            <input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} className={styles.input} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Phone Number <span className={styles.req}>*</span></label>
            <input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} className={styles.input} />
          </div>
          <div className={`${styles.field} ${styles.full}`}>
            <label className={styles.label}>Clients <span className={styles.req}>*</span></label>
            <select
              value={form.client_id ?? ''}
              onChange={(e) => set('client_id', e.target.value ? Number(e.target.value) : undefined)}
              className={styles.input}
            >
              <option value="">— No Client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {availableServices.length > 0 && (
          <div className={`${styles.field} ${styles.full}`} style={{ marginBottom: 24 }}>
            <label className={styles.label}>Allowed Services</label>
            <p className={styles.hint}>Leave empty to allow all services.</p>
            <MultiSelect
              options={availableServices}
              selected={form.service_codes ?? []}
              onChange={(v) => set('service_codes', v)}
            />
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button type="submit" variant="primary" loading={saving}>{isNew ? 'Create Lab' : 'Save Changes'}</Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/admin/labs')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
