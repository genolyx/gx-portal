'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Card, Chip, EmptyState, Link, Switch, Table } from '@heroui/react';
import { isPortalServiceCode, type UserProfile } from '@gx-portal/types';
import { authApi } from '../../lib/api/auth';
import {
  systemApi,
  type QueueCompletedTodayItem,
  type QueueFailedTodayItem,
  type QueueRunningItem,
  type QueueSummary,
  type QueueSummaryServiceRow,
  type QueueSummarySlotGroup,
  type QueueWaitingItem,
} from '../../lib/api/system';
import { formatPortalDateTime } from '../../lib/datetime';
import {
  readIncludeExternalPreference,
  writeIncludeExternalPreference,
} from '../../lib/include-external';
import { cn } from '../../lib/utils';
import { PageHeader } from '../ui/PageHeader';

function loadPct(running: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((running / max) * 100));
}

function formatDuration(sec?: number | null): string {
  if (sec == null || Number.isNaN(sec)) return '—';
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}

function parseRunningRatio(running: string | number | undefined, maxParallel?: number): {
  current: number;
  max: number;
  label: string;
} {
  if (typeof running === 'string' && running.includes('/')) {
    const [a, b] = running.split('/');
    const current = Number(a) || 0;
    const max = Number(b) || maxParallel || 0;
    return { current, max, label: `${current}/${max}` };
  }
  const current = typeof running === 'number' ? running : Number(running) || 0;
  const max = maxParallel ?? 0;
  return { current, max, label: max > 0 ? `${current}/${max}` : String(current) };
}

function allowService(code: string | undefined, includeExternal: boolean): boolean {
  if (includeExternal) return true;
  return isPortalServiceCode(code);
}

/**
 * External OFF → portal services only (hide nipt).
 * Recompute Cloud-style counters from filtered rows/lists.
 */
function filterQueueSummary(q: QueueSummary, includeExternal: boolean): QueueSummary {
  if (includeExternal) return q;

  const services = (q.services ?? []).filter((s) => isPortalServiceCode(s.service_code));
  const slot_groups = (q.slot_groups ?? [])
    .map((g): QueueSummarySlotGroup => ({
      ...g,
      services: (g.services ?? []).filter((code) => isPortalServiceCode(code)),
    }))
    .filter((g) => g.group !== 'nipt' && ((g.services?.length ?? 0) > 0 || g.group === 'sgnipt' || g.group === 'exome'));

  const d = q.details ?? {};
  const queue_waiting_list = (d.queue_waiting_list ?? []).filter((x) =>
    allowService(x.service_code, false),
  );
  const running_list = (d.running_list ?? []).filter((x) =>
    allowService(x.service_code, false),
  );
  const completed_today_list = (d.completed_today_list ?? []).filter((x) =>
    allowService(x.service_code, false),
  );
  const failed_today_list = (d.failed_today_list ?? []).filter((x) =>
    allowService(x.service_code, false),
  );

  const running = services.reduce((n, s) => n + (s.running ?? 0), 0);
  // Unique slot-group max (exome shared across 3 services)
  const groupMax = new Map<string, number>();
  for (const s of services) {
    const prev = groupMax.get(s.slot_group) ?? 0;
    groupMax.set(s.slot_group, Math.max(prev, s.max_parallel ?? 0));
  }
  const max_parallel = [...groupMax.values()].reduce((a, b) => a + b, 0);
  const queued = services.reduce((n, s) => n + (s.queued ?? 0), 0);
  const completed_today = completed_today_list.length;
  const failed_today = failed_today_list.length;

  // Lifetime totals from per-service stats (exclude external / nipt)
  let completed_total = 0;
  let failed_total = 0;
  const stats = q.stats_by_service ?? {};
  for (const [code, st] of Object.entries(stats)) {
    if (!isPortalServiceCode(code)) continue;
    completed_total += st.completed ?? 0;
    failed_total += st.failed ?? 0;
  }

  const requested_samples_today = new Set([
    ...queue_waiting_list.map((x) => x.order_id),
    ...running_list.map((x) => x.order_id),
    ...completed_today_list.map((x) => x.order_id),
    ...failed_today_list.map((x) => x.order_id),
  ]).size;
  const requested_samples_total = queued + running + completed_total + failed_total;

  return {
    ...q,
    services,
    slot_groups,
    running_jobs: (q.running_jobs ?? []).filter((j) => isPortalServiceCode(j.service_code)),
    requested_samples_today,
    running: `${running}/${max_parallel}`,
    max_parallel,
    queue_waiting: queued,
    completed_today,
    failed_today,
    requested_samples_total,
    // Keep memory totals from daemon for completed/failed when filtering is imperfect;
    // prefer recount from service rows if available via stats — fall back to list-based today.
    completed_total,
    failed_total,
    details: {
      ...d,
      queue_waiting_list,
      running_list,
      completed_today_list,
      failed_today_list,
      queue_items: queue_waiting_list.map((x) => x.order_id),
      running_items: Object.fromEntries(
        running_list.map((x) => [x.order_id, { start_time: x.started_at }]),
      ),
    },
    totals: {
      queued,
      running,
      completed_today,
      failed_today,
    },
    total_queued: queued,
    total_running: running,
  };
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) {
  return (
    <Card>
      <Card.Header className="pb-0">
        <Chip size="sm" variant="soft" className={accent}>
          <Chip.Label>{label}</Chip.Label>
        </Chip>
      </Card.Header>
      <Card.Content className="pt-3">
        <p
          className={cn(
            'text-2xl font-normal tabular-nums tracking-tight leading-none',
            accent?.includes('text-') ? accent : 'text-foreground',
          )}
        >
          {value}
        </p>
        {hint ? <Card.Description className="mt-2">{hint}</Card.Description> : null}
      </Card.Content>
    </Card>
  );
}

function OrderListSection({
  title,
  chipClass,
  empty,
  children,
}: {
  title: string;
  chipClass?: string;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="mt-4">
      <Card.Header>
        <Chip size="sm" variant="soft" className={chipClass}>
          <Chip.Label>{title}</Chip.Label>
        </Chip>
      </Card.Header>
      <Card.Content>
        {empty ? (
          <EmptyState className="py-6">
            <p className="text-sm text-muted">No results.</p>
          </EmptyState>
        ) : (
          children
        )}
      </Card.Content>
    </Card>
  );
}

export function DashboardClient() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [includeExternal, setIncludeExternal] = useState(readIncludeExternalPreference);
  const [queueRaw, setQueueRaw] = useState<QueueSummary | null>(null);
  const [queueLoaded, setQueueLoaded] = useState(false);

  const isAdmin = user?.role === 'admin';
  const showExternal = isAdmin && includeExternal;

  useEffect(() => {
    authApi.me().then(setUser).catch(() => setUser(null));
  }, []);

  const queue = useMemo(() => {
    if (!queueRaw) return null;
    return filterQueueSummary(queueRaw, showExternal);
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

  const handleIncludeExternalChange = (value: boolean) => {
    setIncludeExternal(value);
    writeIncludeExternalPreference(value);
  };

  const services: QueueSummaryServiceRow[] = queue?.services ?? [];
  const slotGroups = queue?.slot_groups ?? [];
  const details = queue?.details;
  const waitingList: QueueWaitingItem[] = details?.queue_waiting_list ?? [];
  const runningList: QueueRunningItem[] = details?.running_list ?? [];
  const completedList: QueueCompletedTodayItem[] = details?.completed_today_list ?? [];
  const failedList: QueueFailedTodayItem[] = details?.failed_today_list ?? [];

  const runningParsed = parseRunningRatio(queue?.running, queue?.max_parallel);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          queue?.today
            ? `Analysis status monitoring (KST ${queue.today}; today counters UTC).`
            : 'Real-time analysis status monitoring.'
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

      {/* Today cards — Cloud Portal style */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard
          label="Today Requested"
          value={queueLoaded ? (queue?.requested_samples_today ?? 0) : '—'}
          hint="UTC calendar day"
          accent="text-purple-600"
        />
        <StatCard
          label="Running"
          value={queueLoaded ? runningParsed.label : '—'}
          hint="Live / max slots"
        />
        <StatCard
          label="Queue Waiting"
          value={queueLoaded ? (queue?.queue_waiting ?? 0) : '—'}
          hint="Waiting for a slot"
          accent="text-amber-600"
        />
        <StatCard
          label="Today Completed"
          value={queueLoaded ? (queue?.completed_today ?? 0) : '—'}
          hint="UTC calendar day"
          accent="text-emerald-600"
        />
        <StatCard
          label="Today Failed"
          value={queueLoaded ? (queue?.failed_today ?? 0) : '—'}
          hint="UTC calendar day"
          accent="text-red-600"
        />
      </div>

      {/* Totals — in-memory cumulative */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <StatCard
          label="Total Requested"
          value={queueLoaded ? (queue?.requested_samples_total ?? 0) : '—'}
          hint="queue + running + completed + failed"
        />
        <StatCard
          label="Total Completed"
          value={queueLoaded ? (queue?.completed_total ?? queue?.total_completed ?? 0) : '—'}
          hint="In-memory cumulative"
        />
        <StatCard
          label="Total Failed"
          value={queueLoaded ? (queue?.failed_total ?? queue?.total_failed ?? 0) : '—'}
          hint="In-memory cumulative"
        />
      </div>

      {queueLoaded && !queue && (
        <p className="text-sm text-muted mt-4">No queue data available.</p>
      )}

      {/* Per-service breakdown (multi-service; gx-portal specific) */}
      {services.length > 0 && (
        <Card className="mt-6">
          <Card.Header>
            <Card.Title>Services</Card.Title>
            <Card.Description>
              Per-service load. Max parallel comes from the daemon slot group
              {showExternal ? '' : ' (external / NIPT hidden)'}.
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

      {/* Sample lists — Cloud Portal style */}
      <div className="mt-8">
        <h2 className="text-sm font-medium text-foreground mb-1">Sample lists</h2>
        <p className="text-xs text-muted mb-2">
          Live and today (UTC) orders from daemon summary details.
        </p>

        <OrderListSection
          title="Analysis Running"
          chipClass="text-blue-700"
          empty={runningList.length === 0}
        >
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Running orders">
                <Table.Header>
                  <Table.Column isRowHeader>Order ID</Table.Column>
                  <Table.Column>Service</Table.Column>
                  <Table.Column>Started At</Table.Column>
                </Table.Header>
                <Table.Body>
                  {runningList.map((row) => (
                    <Table.Row key={row.order_id}>
                      <Table.Cell>
                        <Link
                          href={`/orders/${encodeURIComponent(row.order_id)}`}
                          className="font-mono text-xs"
                        >
                          {row.order_id}
                        </Link>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="font-mono text-xs">{row.service_code || '—'}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-xs tabular-nums">
                          {row.started_at ? formatPortalDateTime(row.started_at) : '—'}
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </OrderListSection>

        <OrderListSection
          title="Analysis Waiting"
          chipClass="text-amber-700"
          empty={waitingList.length === 0}
        >
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Queued orders">
                <Table.Header>
                  <Table.Column isRowHeader>Order ID</Table.Column>
                  <Table.Column>Service</Table.Column>
                  <Table.Column>Queued At</Table.Column>
                </Table.Header>
                <Table.Body>
                  {waitingList.map((row) => (
                    <Table.Row key={row.order_id}>
                      <Table.Cell>
                        <Link
                          href={`/orders/${encodeURIComponent(row.order_id)}`}
                          className="font-mono text-xs"
                        >
                          {row.order_id}
                        </Link>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="font-mono text-xs">{row.service_code || '—'}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-xs tabular-nums">
                          {row.queued_at ? formatPortalDateTime(row.queued_at) : '—'}
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </OrderListSection>

        <OrderListSection
          title="Analysis Completed Today"
          chipClass="text-emerald-700"
          empty={completedList.length === 0}
        >
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Completed today">
                <Table.Header>
                  <Table.Column isRowHeader>Order ID</Table.Column>
                  <Table.Column>Service</Table.Column>
                  <Table.Column>Completed At</Table.Column>
                  <Table.Column>Duration</Table.Column>
                </Table.Header>
                <Table.Body>
                  {completedList.map((row) => (
                    <Table.Row key={row.order_id}>
                      <Table.Cell>
                        <Link
                          href={`/orders/${encodeURIComponent(row.order_id)}`}
                          className="font-mono text-xs"
                        >
                          {row.order_id}
                        </Link>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="font-mono text-xs">{row.service_code || '—'}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-xs tabular-nums">
                          {row.completed_at ? formatPortalDateTime(row.completed_at) : '—'}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-xs tabular-nums">
                          {formatDuration(row.duration_seconds)}
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </OrderListSection>

        <OrderListSection
          title="Analysis Failed Today"
          chipClass="text-red-700"
          empty={failedList.length === 0}
        >
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Failed today">
                <Table.Header>
                  <Table.Column isRowHeader>Order ID</Table.Column>
                  <Table.Column>Service</Table.Column>
                  <Table.Column>Failed At</Table.Column>
                  <Table.Column>Message</Table.Column>
                </Table.Header>
                <Table.Body>
                  {failedList.map((row) => (
                    <Table.Row key={row.order_id}>
                      <Table.Cell>
                        <Link
                          href={`/orders/${encodeURIComponent(row.order_id)}`}
                          className="font-mono text-xs"
                        >
                          {row.order_id}
                        </Link>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="font-mono text-xs">{row.service_code || '—'}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-xs tabular-nums">
                          {row.failed_at ? formatPortalDateTime(row.failed_at) : '—'}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-xs text-muted truncate block max-w-md" title={row.message}>
                          {row.message || '—'}
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </OrderListSection>
      </div>
    </div>
  );
}
