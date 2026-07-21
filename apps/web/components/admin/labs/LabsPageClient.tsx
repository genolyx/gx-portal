'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { labsApi } from '../../../lib/api/admin';
import { PageHeader } from '../../ui/PageHeader';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import type { Lab } from '@gx-portal/types';
import styles from '../Admin.module.css';

export function LabsPageClient() {
  const router = useRouter();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setLabs(await labsApi.list()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete lab "${name}"?`)) return;
    await labsApi.delete(id);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Labs"
        description="Manage sequencing labs and their client associations."
        action={
          <Button variant="primary" onClick={() => router.push('/admin/labs/new')}>
            + New Lab
          </Button>
        }
      />

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : labs.length === 0 ? (
        <p className={styles.empty}>No labs yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Lab Name</th>
                <th>Client</th>
                <th>Services</th>
                <th>Email</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {labs.map((l) => (
                <tr key={l.id}>
                  <td>
                    <button className={styles.linkBtn} onClick={() => router.push(`/admin/labs/${l.id}`)}>
                      {l.name}
                    </button>
                  </td>
                  <td>
                    {l.client_name ? (
                      <Badge variant="accent">{l.client_name}</Badge>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td>
                    {l.service_codes.length === 0 ? (
                      <span className={styles.muted}>All</span>
                    ) : (
                      l.service_codes.map((s) => (
                        <Badge key={s} variant="default" className={styles.serviceTag}>{s}</Badge>
                      ))
                    )}
                  </td>
                  <td className={styles.muted}>{l.email ?? '—'}</td>
                  <td className={styles.muted}>{l.created_at.slice(0, 10)}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => router.push(`/admin/labs/${l.id}`)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(l.id, l.name)}>Delete</Button>
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
