'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, Chip, EmptyState, Link, Spinner, Table } from '@heroui/react';
import { systemApi } from '../../lib/api/system';
import { formatPortalDateTime } from '../../lib/datetime';
import { cn } from '../../lib/utils';
import { PageHeader } from '../ui/PageHeader';
import { OrderStatusBadge } from '../ui/OrderStatusBadge';

type DashboardBucket = 'queued' | 'running' | 'completed' | 'failed';

interface QueueSummary {
  total_queued?: number;
  total_running?: number;
  total_completed?: number;
  total_failed?: number;
}

interface BucketOrder {
  order_id: string;
  status: string;
  order_updated?: string;
  message?: string;
}

const BUCKET_CARDS: {
  key: DashboardBucket;
  label: string;
  statKey: keyof QueueSummary;
  chipColor: 'default' | 'accent' | 'success' | 'danger' | 'warning';
}[] = [
  { key: 'queued', label: 'Queued', statKey: 'total_queued', chipColor: 'warning' },
  { key: 'running', label: 'Running', statKey: 'total_running', chipColor: 'accent' },
  { key: 'completed', label: 'Completed', statKey: 'total_completed', chipColor: 'success' },
  { key: 'failed', label: 'Failed', statKey: 'total_failed', chipColor: 'danger' },
];

export function DashboardClient() {
  const [queue, setQueue] = useState<QueueSummary | null>(null);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [activeBucket, setActiveBucket] = useState<DashboardBucket | null>(null);
  const [bucketOrders, setBucketOrders] = useState<BucketOrder[]>([]);
  const [bucketTotal, setBucketTotal] = useState(0);
  const [bucketLoading, setBucketLoading] = useState(false);
  const [bucketError, setBucketError] = useState<string | null>(null);

  const loadQueue = useCallback(() => {
    systemApi
      .queue()
      .then((q) => setQueue(q as QueueSummary))
      .catch(() => setQueue(null))
      .finally(() => setQueueLoaded(true));
  }, []);

  useEffect(() => {
    loadQueue();
    const id = setInterval(loadQueue, 15_000);
    return () => clearInterval(id);
  }, [loadQueue]);

  const loadBucket = useCallback(async (bucket: DashboardBucket) => {
    setActiveBucket(bucket);
    setBucketLoading(true);
    setBucketError(null);
    try {
      const data = await systemApi.dashboardBucket({
        bucket,
        sort: 'order_updated',
        order: 'desc',
      });
      setBucketOrders(data.orders ?? []);
      setBucketTotal(data.total ?? data.orders?.length ?? 0);
    } catch (e) {
      setBucketOrders([]);
      setBucketTotal(0);
      setBucketError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setBucketLoading(false);
    }
  }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Real-time analysis queue and system status."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BUCKET_CARDS.map(({ key, label, statKey, chipColor }) => {
          const value = queue?.[statKey] ?? 0;
          const active = activeBucket === key;
          return (
            <Card
              key={key}
              variant={active ? 'secondary' : 'default'}
              className={cn(
                'cursor-pointer transition-colors select-none',
                active && 'ring-1 ring-accent/40',
              )}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              onClick={() => void loadBucket(key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void loadBucket(key);
                }
              }}
            >
              <Card.Header className="pb-0">
                <Chip color={chipColor} size="sm" variant="soft">
                  <Chip.Label>{label}</Chip.Label>
                </Chip>
              </Card.Header>
              <Card.Content className="pt-3">
                <p className="text-2xl font-normal tabular-nums tracking-tight leading-none text-foreground">
                  {queueLoaded ? value : '—'}
                </p>
                <Card.Description className="mt-2">
                  {active ? 'Showing orders below' : 'Click to view orders'}
                </Card.Description>
              </Card.Content>
            </Card>
          );
        })}
      </div>

      {queueLoaded && !queue && (
        <p className="text-sm text-muted mt-4">No queue data available.</p>
      )}

      {activeBucket && (
        <Card className="mt-6">
          <Card.Header>
            <Card.Title>
              {BUCKET_CARDS.find((c) => c.key === activeBucket)?.label}
            </Card.Title>
            <Card.Description>
              {bucketLoading
                ? 'Loading…'
                : `${bucketTotal} order(s) · Order updated = last status change (KST)`}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {bucketError ? (
              <EmptyState className="py-8">
                <p className="text-sm text-danger">{bucketError}</p>
              </EmptyState>
            ) : bucketLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted">
                <Spinner size="md" color="current" />
                <span className="text-sm">Loading orders…</span>
              </div>
            ) : bucketOrders.length === 0 ? (
              <EmptyState className="py-8">
                <p className="text-sm text-muted">No orders in this bucket.</p>
              </EmptyState>
            ) : (
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={`${activeBucket} orders`}>
                    <Table.Header>
                      <Table.Column isRowHeader>Order ID</Table.Column>
                      <Table.Column>Status</Table.Column>
                      <Table.Column>Order Updated</Table.Column>
                      <Table.Column>Message</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {bucketOrders.map((o) => (
                        <Table.Row key={o.order_id}>
                          <Table.Cell>
                            <Link
                              href={`/orders/${encodeURIComponent(o.order_id)}`}
                              className="font-mono text-xs"
                            >
                              {o.order_id}
                            </Link>
                          </Table.Cell>
                          <Table.Cell>
                            <OrderStatusBadge status={o.status} />
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-xs text-muted whitespace-nowrap">
                              {formatPortalDateTime(o.order_updated)}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span
                              className="text-xs text-muted max-w-md truncate block"
                              title={o.message}
                            >
                              {o.message || '—'}
                            </span>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            )}
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
