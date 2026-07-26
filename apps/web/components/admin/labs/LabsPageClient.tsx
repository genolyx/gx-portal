'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Chip, Link, Table } from '@heroui/react';
import { Pencil, Trash2 } from 'lucide-react';
import { labsApi } from '../../../lib/api/admin';
import { formatPortalDate } from '../../../lib/datetime';
import { PageHeader } from '../../ui/PageHeader';
import { CreateLabModal } from './CreateLabModal';
import type { Lab } from '@gx-portal/types';

export function LabsPageClient() {
  const router = useRouter();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      setLabs(await labsApi.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
        actions={
          <Button variant="primary" onPress={() => setShowCreate(true)}>
            + New Lab
          </Button>
        }
      />

      {showCreate && (
        <CreateLabModal
          onClose={() => setShowCreate(false)}
          onSaved={() => void load()}
        />
      )}

      {loading ? (
        <p className="py-8 text-center text-muted">Loading…</p>
      ) : labs.length === 0 ? (
        <p className="py-8 text-center text-muted">No labs yet.</p>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Labs">
              <Table.Header>
                <Table.Column isRowHeader>Lab Name</Table.Column>
                <Table.Column>Client</Table.Column>
                <Table.Column>Services</Table.Column>
                <Table.Column>Email</Table.Column>
                <Table.Column>Created</Table.Column>
                <Table.Column>Actions</Table.Column>
              </Table.Header>
              <Table.Body>
                {labs.map((l) => (
                  <Table.Row key={l.id}>
                    <Table.Cell>
                      <Link href={`/admin/labs/${l.id}`} className="text-sm font-medium">
                        {l.name}
                      </Link>
                    </Table.Cell>
                    <Table.Cell>
                      {l.client_name ? (
                        <Chip color="accent" size="sm" variant="soft">
                          <Chip.Label>{l.client_name}</Chip.Label>
                        </Chip>
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {l.service_codes.length === 0 ? (
                        <span className="text-sm text-muted">All</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {l.service_codes.map((s) => (
                            <Chip key={s} size="sm" variant="soft">
                              <Chip.Label>{s}</Chip.Label>
                            </Chip>
                          ))}
                        </div>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-muted">{l.email ?? '—'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-muted">{formatPortalDate(l.created_at)}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          aria-label={`Edit ${l.name}`}
                          onPress={() => router.push(`/admin/labs/${l.id}`)}
                        >
                          <Pencil size={15} strokeWidth={2} aria-hidden />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          isIconOnly
                          aria-label={`Delete ${l.name}`}
                          onPress={() => handleDelete(l.id, l.name)}
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
