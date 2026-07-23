'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { systemApi } from '../../lib/api/system';
import { formatPortalDateTime } from '../../lib/datetime';
import { cn } from '../../lib/utils';
import { PageHeader } from '../ui/PageHeader';
import { Card, CardContent, CardTitle } from '../ui/Card';
import { OrderStatusBadge } from '../ui/Badge';

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
  accent?: 'ok' | 'err';
}[] = [
  { key: 'queued',    label: 'Queued',    statKey: 'total_queued' },
  { key: 'running',   label: 'Running',   statKey: 'total_running' },
  { key: 'completed', label: 'Completed', statKey: 'total_completed', accent: 'ok' },
  { key: 'failed',    label: 'Failed',    statKey: 'total_failed', accent: 'err' },
];

const BUCKET_HEADLINE: Record<DashboardBucket, string> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

export function DashboardClient() {
  const [queue, setQueue] = useState<QueueSummary | null>(null);
  const [activeBucket, setActiveBucket] = useState<DashboardBucket | null>(null);
  const [bucketOrders, setBucketOrders] = useState<BucketOrder[]>([]);
  const [bucketTotal, setBucketTotal] = useState(0);
  const [bucketLoading, setBucketLoading] = useState(false);
  const [bucketError, setBucketError] = useState<string | null>(null);

  const loadQueue = useCallback(() => {
    systemApi.queue().then((q) => setQueue(q as QueueSummary)).catch(() => setQueue(null));
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

  const handleBucketClick = (bucket: DashboardBucket) => {
    void loadBucket(bucket);
  };

  return (
    <div>
      <PageHeader title="Dashboard" description="Real-time analysis queue and system status." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {BUCKET_CARDS.map(({ key, label, statKey, accent }) => {
          const value = queue?.[statKey] ?? 0;
          const active = activeBucket === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => handleBucketClick(key)}
              className="text-left w-full"
            >
              <Card
                className={cn(
                  'transition-shadow cursor-pointer hover:border-gx-accent/40',
                  active && 'ring-2 ring-gx-accent border-gx-accent',
                  accent === 'ok' && 'border-gx-success/30',
                  accent === 'err' && 'border-gx-danger/30',
                )}
              >
                <CardContent className="pt-5">
                  <p className={cn(
                    'text-3xl font-bold',
                    accent === 'ok' && 'text-gx-success',
                    accent === 'err' && 'text-gx-danger',
                    !accent && 'text-gx-text',
                  )}>
                    {value}
                  </p>
                  <CardTitle className="mt-1 normal-case tracking-normal text-xs font-medium text-gx-muted">
                    {label}
                  </CardTitle>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {!queue && (
        <p className="text-sm text-gx-muted mt-4">No queue data available.</p>
      )}

      {activeBucket && (
        <section className="mt-6 rounded-gx border border-gx-border bg-gx-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-gx-text">
              {BUCKET_HEADLINE[activeBucket]}
            </h3>
            <p className="text-xs text-gx-muted">
              {bucketLoading
                ? 'Loading…'
                : `${bucketTotal} order(s) · Order updated = last status change (KST)`}
            </p>
          </div>

          {bucketError ? (
            <p className="text-sm text-gx-danger py-4 text-center">{bucketError}</p>
          ) : bucketLoading ? (
            <p className="text-sm text-gx-muted py-4 text-center">Loading orders…</p>
          ) : bucketOrders.length === 0 ? (
            <p className="text-sm text-gx-muted py-4 text-center">No orders</p>
          ) : (
            <div className="overflow-x-auto rounded-gx border border-gx-border">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gx-elevated/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gx-text-2 uppercase tracking-wide border-b border-gx-border">
                      Order ID
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gx-text-2 uppercase tracking-wide border-b border-gx-border">
                      Status
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gx-text-2 uppercase tracking-wide border-b border-gx-border whitespace-nowrap">
                      Order Updated
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gx-text-2 uppercase tracking-wide border-b border-gx-border">
                      Message
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bucketOrders.map((o) => (
                    <tr
                      key={o.order_id}
                      className="hover:bg-gx-accent-dim transition-colors"
                    >
                      <td className="px-3 py-2 border-b border-gx-border">
                        <Link
                          href={`/orders/${encodeURIComponent(o.order_id)}`}
                          className="font-mono text-xs text-gx-accent hover:underline"
                        >
                          {o.order_id}
                        </Link>
                      </td>
                      <td className="px-3 py-2 border-b border-gx-border whitespace-nowrap">
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className="px-3 py-2 border-b border-gx-border whitespace-nowrap text-xs text-gx-text-2">
                        {formatPortalDateTime(o.order_updated)}
                      </td>
                      <td className="px-3 py-2 border-b border-gx-border text-xs text-gx-text-2 max-w-md truncate" title={o.message}>
                        {o.message || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
