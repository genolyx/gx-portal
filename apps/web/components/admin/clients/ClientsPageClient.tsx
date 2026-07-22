'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientsApi } from '../../../lib/api/admin';
import { PageHeader } from '../../ui/PageHeader';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import type { Client } from '@gx-portal/types';
import styles from '../Admin.module.css';

export function ClientsPageClient() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setClients(await clientsApi.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete client "${name}"?`)) return;
    await clientsApi.delete(id);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Manage client organizations and their service permissions."
        action={
          <Button variant="primary" onClick={() => router.push('/admin/clients/new')}>
            + New Client
          </Button>
        }
      />

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : clients.length === 0 ? (
        <p className={styles.empty}>No clients yet. Create one to get started.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Type</th>
                <th>Sequencing</th>
                <th>Services</th>
                <th>Email</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button
                      className={styles.linkBtn}
                      onClick={() => router.push(`/admin/clients/${c.id}`)}
                    >
                      {c.name}
                    </button>
                  </td>
                  <td className={styles.muted}>{c.order_prefix ?? '—'}</td>
                  <td>
                    <Badge variant={c.type === 'Managing' ? 'accent' : 'default'}>{c.type}</Badge>
                  </td>
                  <td>
                    <Badge variant={c.sequencing_data_method === 'Remote' ? 'info' : 'warning'}>
                      {c.sequencing_data_method}
                    </Badge>
                  </td>
                  <td>
                    {c.service_codes.length === 0 ? (
                      <span className={styles.muted}>All</span>
                    ) : (
                      c.service_codes.map((s) => (
                        <Badge key={s} variant="default" className={styles.serviceTag}>{s}</Badge>
                      ))
                    )}
                  </td>
                  <td className={styles.muted}>{c.email ?? '—'}</td>
                  <td className={styles.muted}>{c.created_at.slice(0, 10)}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => router.push(`/admin/clients/${c.id}`)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(c.id, c.name)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
