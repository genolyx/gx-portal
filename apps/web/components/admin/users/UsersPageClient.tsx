'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usersApi } from '../../../lib/api/admin';
import { PageHeader } from '../../ui/PageHeader';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import type { UserProfile } from '@gx-portal/types';
import styles from '../Admin.module.css';

const ROLE_VARIANT: Record<string, 'accent' | 'warning' | 'info' | 'default'> = {
  admin: 'accent', client: 'info', lab: 'warning',
};

export function UsersPageClient() {
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setUsers(await usersApi.list()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Delete user "${username}"?`)) return;
    await usersApi.delete(id);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage portal users and their role assignments."
        action={
          <Button variant="primary" onClick={() => router.push('/admin/users/new')}>+ New User</Button>
        }
      />

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : users.length === 0 ? (
        <p className={styles.empty}>No users yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Role</th>
                <th>Client / Lab</th>
                <th>Email</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <button className={styles.linkBtn} onClick={() => router.push(`/admin/users/${u.id}`)}>
                      {u.username}
                    </button>
                  </td>
                  <td>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td>
                    <Badge variant={ROLE_VARIANT[u.role] ?? 'default'}>
                      {u.role === 'admin' ? 'Administrator' : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </Badge>
                  </td>
                  <td className={styles.muted}>
                    {u.client_name ?? u.lab_name ?? '—'}
                  </td>
                  <td className={styles.muted}>{u.email ?? '—'}</td>
                  <td className={styles.muted}>{u.created_at.slice(0, 10)}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => router.push(`/admin/users/${u.id}`)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(u.id, u.username)}>Delete</Button>
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
