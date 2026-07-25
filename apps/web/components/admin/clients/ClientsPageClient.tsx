'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Chip, Link, Table } from '@heroui/react';
import { Pencil, Trash2 } from 'lucide-react';
import { clientsApi } from '../../../lib/api/admin';
import { PageHeader } from '../../ui/PageHeader';
import { CreateClientModal } from './CreateClientModal';
import type { Client } from '@gx-portal/types';

export function ClientsPageClient() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      setClients(await clientsApi.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
        actions={
          <Button variant="primary" onPress={() => setShowCreate(true)}>
            + New Client
          </Button>
        }
      />

      {showCreate && (
        <CreateClientModal
          onClose={() => setShowCreate(false)}
          onSaved={() => void load()}
        />
      )}

      {loading ? (
        <p className="py-8 text-center text-muted">Loading…</p>
      ) : clients.length === 0 ? (
        <p className="py-8 text-center text-muted">No clients yet. Create one to get started.</p>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Clients">
              <Table.Header>
                <Table.Column isRowHeader>Name</Table.Column>
                <Table.Column>Prefix</Table.Column>
                <Table.Column>Type</Table.Column>
                <Table.Column>Sequencing</Table.Column>
                <Table.Column>Services</Table.Column>
                <Table.Column>Email</Table.Column>
                <Table.Column>Created</Table.Column>
                <Table.Column>Actions</Table.Column>
              </Table.Header>
              <Table.Body>
                {clients.map((c) => (
                  <Table.Row key={c.id}>
                    <Table.Cell>
                      <Link href={`/admin/clients/${c.id}`} className="text-sm font-medium">
                        {c.name}
                      </Link>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-muted">{c.order_prefix ?? '—'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip color={c.type === 'Managing' ? 'accent' : 'default'} size="sm" variant="soft">
                        <Chip.Label>{c.type}</Chip.Label>
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip
                        color={c.sequencing_data_method === 'Remote' ? 'accent' : 'warning'}
                        size="sm"
                        variant="soft"
                      >
                        <Chip.Label>{c.sequencing_data_method}</Chip.Label>
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      {c.service_codes.length === 0 ? (
                        <span className="text-sm text-muted">All</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {c.service_codes.map((s) => (
                            <Chip key={s} size="sm" variant="soft">
                              <Chip.Label>{s}</Chip.Label>
                            </Chip>
                          ))}
                        </div>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-muted">{c.email ?? '—'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-muted">{c.created_at.slice(0, 10)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          aria-label={`Edit ${c.name}`}
                          onPress={() => router.push(`/admin/clients/${c.id}`)}
                        >
                          <Pencil size={15} strokeWidth={2} aria-hidden />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          isIconOnly
                          aria-label={`Delete ${c.name}`}
                          onPress={() => handleDelete(c.id, c.name)}
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
