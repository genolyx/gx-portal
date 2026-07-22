'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientsApi } from '../../../lib/api/admin';
import { systemApi } from '../../../lib/api/system';
import { PageHeader } from '../../ui/PageHeader';
import { Button } from '../../ui/Button';
import { Toggle } from '../../ui/Toggle';
import { MultiSelect } from '../../ui/MultiSelect';
import type { Client, CreateClientDto } from '@gx-portal/types';
import styles from '../Admin.module.css';

interface Props { id: string; }

export function ClientFormPage({ id }: Props) {
  const isNew = id === 'new';
  const router = useRouter();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [availableServices, setAvailableServices] = useState<string[]>([]);

  const [form, setForm] = useState<CreateClientDto>({
    name: '',
    order_prefix: '',
    address: '',
    email: '',
    phone: '',
    language: '',
    type: 'Service',
    sequencing_data_method: 'Remote',
    is_managing_hospitals: false,
    auto_approve_orders: false,
    sign_report: false,
    service_codes: [],
  });

  useEffect(() => {
    systemApi.services().then((svcs: unknown) => {
      if (Array.isArray(svcs)) {
        setAvailableServices((svcs as { code: string }[]).map((s) => s.code));
      }
    }).catch(() => {});

    if (!isNew) {
      clientsApi.getById(Number(id)).then((c: Client) => {
        setForm({
          name: c.name,
          order_prefix: c.order_prefix ?? '',
          address: c.address ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          language: c.language ?? '',
          type: c.type,
          sequencing_data_method: c.sequencing_data_method,
          is_managing_hospitals: c.is_managing_hospitals,
          auto_approve_orders: c.auto_approve_orders,
          sign_report: c.sign_report,
          service_codes: c.service_codes,
        });
      }).catch(() => router.push('/admin/clients'))
        .finally(() => setLoading(false));
    }
  }, [id, isNew, router]);

  const set = <K extends keyof CreateClientDto>(key: K, value: CreateClientDto[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (isNew) {
        await clientsApi.create(form);
      } else {
        await clientsApi.update(Number(id), form);
      }
      router.push('/admin/clients');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className={styles.empty}>Loading…</p>;

  return (
    <div>
      <PageHeader
        title={isNew ? 'New Client' : 'Update Client'}
        description={isNew ? 'Register a new client organization.' : 'Update a client'}
        backHref="/admin/clients"
      />

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Client Name <span className={styles.req}>*</span></label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Order Prefix <span className={styles.req}>*</span></label>
            <input
              value={form.order_prefix ?? ''}
              onChange={(e) => set('order_prefix', e.target.value.toUpperCase())}
              required
              maxLength={2}
              placeholder="GX"
              className={styles.input}
              style={{ maxWidth: 80, textTransform: 'uppercase' }}
            />
            <p className={styles.hint}>Two letters used in order IDs (e.g. CS<strong>GX</strong>26070001).</p>
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
            <label className={styles.label}>Phone Number</label>
            <input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} className={styles.input} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Language</label>
            <input value={form.language ?? ''} onChange={(e) => set('language', e.target.value)} placeholder="e.g. KO, EN" className={styles.input} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Type <span className={styles.req}>*</span></label>
            <select value={form.type} onChange={(e) => set('type', e.target.value as 'Managing' | 'Service')} className={styles.input}>
              <option value="Service">Service</option>
              <option value="Managing">Managing</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Sequencing Data Method <span className={styles.req}>*</span></label>
            <select
              value={form.sequencing_data_method}
              onChange={(e) => set('sequencing_data_method', e.target.value as 'Remote' | 'Local')}
              className={styles.input}
            >
              <option value="Remote">Remote</option>
              <option value="Local">Local</option>
            </select>
          </div>
        </div>

        <div className={styles.toggleRow}>
          <Toggle
            label="Is Managing Hospitals"
            checked={form.is_managing_hospitals ?? false}
            onChange={(v) => set('is_managing_hospitals', v)}
          />
          <Toggle
            label="Auto Approve Orders"
            checked={form.auto_approve_orders ?? false}
            onChange={(v) => set('auto_approve_orders', v)}
          />
          <Toggle
            label="Sign Report"
            checked={form.sign_report ?? false}
            onChange={(v) => set('sign_report', v)}
          />
        </div>

        {availableServices.length > 0 && (
          <div className={styles.field}>
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
          <Button type="submit" variant="primary" loading={saving}>
            {isNew ? 'Create Client' : 'Save Changes'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/admin/clients')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
