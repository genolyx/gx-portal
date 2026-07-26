'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Chip, Link, Table } from '@heroui/react';
import { Pencil, Trash2 } from 'lucide-react';
import { usersApi } from '../../../lib/api/admin';
import { formatPortalDate } from '../../../lib/datetime';
import { PageHeader } from '../../ui/PageHeader';
import { CreateUserModal } from './CreateUserModal';
import type { UserProfile } from '@gx-portal/types';

const ROLE_COLOR: Record<string, 'accent' | 'warning' | 'default'> = {
  admin: 'accent',
  client: 'default',
  lab: 'warning',
};

function roleLabel(role: string) {
  return role === 'admin' ? 'Administrator' : role.charAt(0).toUpperCase() + role.slice(1);
}

export function UsersPageClient() {
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      setUsers(await usersApi.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
        actions={
          <Button variant="primary" onPress={() => setShowCreate(true)}>
            + New User
          </Button>
        }
      />

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onSaved={() => void load()}
        />
      )}

      {loading ? (
        <p className="py-8 text-center text-muted">Loading…</p>
      ) : users.length === 0 ? (
        <p className="py-8 text-center text-muted">No users yet.</p>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Users">
              <Table.Header>
                <Table.Column isRowHeader>Username</Table.Column>
                <Table.Column>Name</Table.Column>
                <Table.Column>Role</Table.Column>
                <Table.Column>Client / Lab</Table.Column>
                <Table.Column>Email</Table.Column>
                <Table.Column>Created</Table.Column>
                <Table.Column>Actions</Table.Column>
              </Table.Header>
              <Table.Body>
                {users.map((u) => (
                  <Table.Row key={u.id}>
                    <Table.Cell>
                      <Link href={`/admin/users/${u.id}`} className="text-sm font-medium">
                        {u.username}
                      </Link>
                    </Table.Cell>
                    <Table.Cell>
                      {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip color={ROLE_COLOR[u.role] ?? 'default'} size="sm" variant="soft">
                        <Chip.Label>{roleLabel(u.role)}</Chip.Label>
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-muted">{u.client_name ?? u.lab_name ?? '—'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-muted">{u.email ?? '—'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-muted">{formatPortalDate(u.created_at)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          aria-label={`Edit ${u.username}`}
                          onPress={() => router.push(`/admin/users/${u.id}`)}
                        >
                          <Pencil size={15} strokeWidth={2} aria-hidden />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          isIconOnly
                          aria-label={`Delete ${u.username}`}
                          onPress={() => handleDelete(u.id, u.username)}
                        >
                          <Trash2 size={15} strokeWidth={2} aria-hidden />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </div>
  );
}
