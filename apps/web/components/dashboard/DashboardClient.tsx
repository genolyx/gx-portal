'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Chip, EmptyState, Link, Spinner, Switch, Table } from '@heroui/react';
import { isPortalServiceCode, type UserProfile } from '@gx-portal/types';
import { authApi } from '../../lib/api/auth';
import { ordersApi } from '../../lib/api/orders';
import {
  systemApi,
  type QueueSummary,
  type QueueSummaryServiceRow,
  type QueueSummarySlotGroup,
} from '../../lib/api/system';
import { formatPortalDateTime } from '../../lib/datetime';
import {
  readIncludeExternalPreference,
  writeIncludeExternalPreference,
} from '../../lib/include-external';
import { cn } from '../../lib/utils';
import { PageHeader } from '../ui/PageHeader';
import { OrderStatusBadge } from '../ui/OrderStatusBadge';

type DashboardBucket = 'queued' | 'running' | 'completed' | 'failed';

interface BucketOrder {
  order_id: string;
  status: string;
  service_code?: string;
  order_updated?: string;
  message?: string;
}

const BUCKET_CARDS: {
  key: DashboardBucket;
  label: string;
  hint: string;
  getValue: (q: QueueSummary) => number;
  chipColor: 'default' | 'accent' | 'success' | 'danger' | 'warning';
}[] = [
  {
    key: 'queued',
    label: 'Queued',
    hint: 'Waiting for a slot',
    getValue: (q) => q.totals?.queued ?? q.total_queued ?? 0,
    chipColor: 'warning',
  },
  {
    key: 'running',
    label: 'Running',
    hint: 'Live pipelines',
    getValue: (q) => q.totals?.running ?? q.total_running ?? 0,
    chipColor: 'accent',
  },
  {
    key: 'completed',
    label: 'Completed today',
    hint: 'KST calendar day',
    getValue: (q) => q.totals?.completed_today ?? 0,
    chipColor: 'success',
  },
  {
    key: 'failed',
    label: 'Failed today',
    hint: 'KST calendar day',
    getValue: (q) => q.totals?.failed_today ?? 0,
    chipColor: 'danger',
  },
];

function loadPct(running: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((running / max) * 100));
}

/** Hide non-portal services (e.g. nipt) and recompute totals from remaining rows. */
function filterQueueSummary(q: QueueSummary): QueueSummary {
  const services = (q.services ?? []).filter((s) => isPortalServiceCode(s.service_code));
  const totals = {
    queued: services.reduce((n, s) => n + (s.queued ?? 0), 0),
    running: services.reduce((n, s) => n + (s.running ?? 0), 0),
    completed_today: services.reduce((n, s) => n + (s.completed_today ?? 0), 0),
    failed_today: services.reduce((n, s) => n + (s.failed_today ?? 0), 0),
  };
  const slot_groups = (q.slot_groups ?? [])
    .map((g): QueueSummarySlotGroup => ({
      ...g,
      services: (g.services ?? []).filter((code) => isPortalServiceCode(code)),
    }))
    .filter((g) => {
      // External NIPT slot pool — hide when external services are off
      if (g.group === 'nipt') return false;
      return (g.services?.length ?? 0) > 0 || g.group === 'sgnipt' || g.group === 'exome';
    });
  const running_jobs = (q.running_jobs ?? []).filter((j) =>
    isPortalServiceCode(j.service_code),
  );
  return {
    ...q,
    services,
    slot_groups,
    running_jobs,
    totals,
    total_queued: totals.queued,
    total_running: totals.running,
  };
}

export function DashboardClient() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [includeExternal, setIncludeExternal] = useState(readIncludeExternalPreference);
  const [queueRaw, setQueueRaw] = useState<QueueSummary | null>(null);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [activeBucket, setActiveBucket] = useState<DashboardBucket | null>(null);
  const [bucketOrders, setBucketOrders] = useState<BucketOrder[]>([]);
  const [bucketTotal, setBucketTotal] = useState(0);
  const [bucketLoading, setBucketLoading] = useState(false);
  const [bucketError, setBucketError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';
  const showExternal = isAdmin && includeExternal;

  useEffect(() => {
    authApi.me().then(setUser).catch(() => setUser(null));
  }, []);

  const queue = useMemo(() => {
    if (!queueRaw) return null;
    return showExternal ? queueRaw : filterQueueSummary(queueRaw);
  }, [queueRaw, showExternal]);

  const loadQueue = useCallback(() => {
    systemApi
      .queue()
      .then((q) => setQueueRaw(q))
      .catch(() => setQueueRaw(null))
      .finally(() => setQueueLoaded(true));
  }, []);

  useEffect(() => {
    loadQueue();
    const id = setInterval(loadQueue, 15_000);
    return () => clearInterval(id);
  }, [loadQueue]);

  const loadBucket = useCallback(async (bucket: DashboardBucket, external: boolean) => {
    setActiveBucket(bucket);
    setBucketLoading(true);
    setBucketError(null);
    try {
      const data = await systemApi.dashboardBucket({
        bucket,
        sort: 'order_updated',
        order: 'desc',
      });
      let orders: BucketOrder[] = data.orders ?? [];
      if (!external) {
        const withCode = orders.filter((o) => o.service_code != null && o.service_code !== '');
        if (withCode.length === orders.length && orders.length > 0) {
          orders = orders.filter((o) => isPortalServiceCode(o.service_code));
        } else {
          // Bucket payload may omit service_code — intersect with portal-filtered order list
          const list = await ordersApi.list();
          const allowed = new Set((list.orders ?? []).map((o) => o.order_id));
          orders = orders.filter((o) => {
            if (o.service_code) return isPortalServiceCode(o.service_code);
            return allowed.has(o.order_id);
          });
        }
      }
      setBucketOrders(orders);
      setBucketTotal(orders.length);
    } catch (e) {
      setBucketOrders([]);
      setBucketTotal(0);
      setBucketError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setBucketLoading(false);
    }
  }, []);

  // Re-filter open bucket when external toggle changes
  useEffect(() => {
    if (activeBucket) void loadBucket(activeBucket, showExternal);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on toggle / role resolve
  }, [showExternal]);

  const handleIncludeExternalChange = (value: boolean) => {
    setIncludeExternal(value);
    writeIncludeExternalPreference(value);
  };

  const services: QueueSummaryServiceRow[] = queue?.services ?? [];
  const slotGroups = queue?.slot_groups ?? [];
  const runningJobs = queue?.running_jobs ?? [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          queue?.today
            ? `Queue load and today’s outcomes (KST ${queue.today}).`
            : 'Real-time analysis queue and system status.'
        }
        actions={
          isAdmin ? (
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">
                External services
              </span>
              <Switch
                isSelected={includeExternal}
                onChange={handleIncludeExternalChange}
                size="sm"
                className="!flex-row !items-center !gap-2"
              >
                <Switch.Content className="!flex-row !items-center !gap-2">
                  <span className="text-xs text-muted tabular-nums w-7 text-right">
                    {includeExternal ? 'ON' : 'OFF'}
                  </span>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BUCKET_CARDS.map(({ key, label, hint, getValue, chipColor }) => {
          const value = queue ? getValue(queue) : 0;
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
              onClick={() => void loadBucket(key, showExternal)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void loadBucket(key, showExternal);
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
                  {active ? 'Showing orders below' : hint}
                </Card.Description>
              </Card.Content>
            </Card>
          );
        })}
      </div>

      {queueLoaded && !queue && (
        <p className="text-sm text-muted mt-4">No queue data available.</p>
      )}

      {services.length > 0 && (
        <Card className="mt-6">
          <Card.Header>
            <Card.Title>Services</Card.Title>
            <Card.Description>
              Per-service load. Max parallel comes from the daemon slot group.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Service queue summary">
                  <Table.Header>
                    <Table.Column isRowHeader>Service</Table.Column>
                    <Table.Column>Slot group</Table.Column>
                    <Table.Column>Running</Table.Column>
                    <Table.Column>Max</Table.Column>
                    <Table.Column>Queued</Table.Column>
                    <Table.Column>Available</Table.Column>
                    <Table.Column>Done today</Table.Column>
                    <Table.Column>Fail today</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {services.map((row) => {
                      const pct = loadPct(row.running, row.max_parallel);
                      return (
                        <Table.Row key={row.service_code}>
                          <Table.Cell>
                            <div>
                              <p className="text-sm">{row.display_name || row.service_code}</p>
                              <p className="font-mono text-xs text-muted">{row.service_code}</p>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="font-mono text-xs">{row.slot_group}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex items-center gap-2 min-w-[7rem]">
                              <span className="tabular-nums text-sm">{row.running}</span>
                              <span className="relative h-1.5 flex-1 rounded-full bg-default/40 overflow-hidden">
                                <span
                                  className="absolute inset-y-0 left-0 bg-accent/80"
                                  style={{ width: `${pct}%` }}
                                />
                              </span>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="tabular-nums text-sm">{row.max_parallel}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="tabular-nums text-sm">{row.queued}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="tabular-nums text-sm">{row.available}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="tabular-nums text-sm">{row.completed_today}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="tabular-nums text-sm">{row.failed_today}</span>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card.Content>
        </Card>
      )}

      {slotGroups.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-foreground mb-1">Slot groups</h2>
          <p className="text-xs text-muted mb-3">
            Shared concurrency caps (exome = carrier + whole exome + health).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {slotGroups.map((g) => (
              <Card key={g.group}>
                <Card.Header className="pb-0">
                  <Card.Title className="font-mono text-sm">{g.group}</Card.Title>
                  <Card.Description>
                    {(g.services || []).join(', ') || '—'}
                  </Card.Description>
                </Card.Header>
                <Card.Content className="pt-3">
                  <p className="text-2xl font-normal tabular-nums tracking-tight">
                    {g.running} / {g.max_parallel}
                  </p>
                  <p className="text-xs text-muted mt-2">
                    queued {g.queued} · available {g.available}
                  </p>
                </Card.Content>
              </Card>
            ))}
          </div>
        </div>
      )}

      {runningJobs.length > 0 && (
        <Card className="mt-6">
          <Card.Header>
            <Card.Title>Running jobs</Card.Title>
            <Card.Description>Live pipeline processes on this daemon.</Card.Description>
          </Card.Header>
          <Card.Content>
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Running jobs">
                  <Table.Header>
                    <Table.Column isRowHeader>Order ID</Table.Column>
                    <Table.Column>Service</Table.Column>
                    <Table.Column>Progress</Table.Column>
                    <Table.Column>Message</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {runningJobs.map((j) => (
                      <Table.Row key={j.order_id}>
                        <Table.Cell>
                          <Link
                            href={`/orders/${encodeURIComponent(j.order_id)}`}
                            className="font-mono text-xs"
                          >
                            {j.order_id}
                          </Link>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="font-mono text-xs">{j.service_code || '—'}</span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="tabular-nums text-sm">{j.progress ?? 0}%</span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-xs text-muted truncate block max-w-md" title={j.message}>
                            {j.message || j.status || '—'}
                          </span>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card.Content>
        </Card>
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
                : activeBucket === 'completed' || activeBucket === 'failed'
                  ? `${bucketTotal} order(s) retained by daemon (not today-only) · Order updated = last status change (KST)`
                  : `${bucketTotal} order(s) · Order updated = last status change (KST)`}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {bucketError ? (
              <EmptyState className="py-8">
                <p className="text-sm text-danger">{bucketError}</p>
              </EmptyState>
            ) : bucketLoading ? (
              <div className="flex items-center gap-2 justify-center py-10 text-muted">
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
