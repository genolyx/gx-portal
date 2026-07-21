'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ordersApi } from '../../../lib/api/orders';
import { PageHeader } from '../../ui/PageHeader';
import { Button } from '../../ui/Button';
import { OrderStatusBadge } from '../../ui/Badge';
import type { Order } from '@gx-portal/types';
import styles from './OrderDetail.module.css';

export function OrderDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    try { setOrder(await ordersApi.getById(id)); }
    catch { router.push('/orders'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const action = async (fn: () => Promise<unknown>, label: string) => {
    if (!confirm(`Run "${label}"?`)) return;
    setActionLoading(true);
    try { await fn(); await load(); }
    catch (err) { alert(err instanceof Error ? err.message : String(err)); }
    finally { setActionLoading(false); }
  };

  if (loading) return <p style={{ padding: 32, color: 'var(--text-muted)' }}>Loading…</p>;
  if (!order) return null;

  const canStart = ['SAVED', 'FAILED', 'CANCELLED'].includes(order.status);
  const canStop = order.status === 'RUNNING' || order.status === 'QUEUED';
  const canReview = order.status === 'COMPLETED' || order.status === 'REPORT_READY';

  return (
    <div>
      <PageHeader title="Order Detail" backHref="/orders" />

      <div className={styles.headerRow}>
        <div>
          <code className={styles.orderId}>{order.order_id}</code>
          <p className={styles.service}>{order.service_code}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className={styles.actions}>
        {canStart && (
          <Button variant="primary" loading={actionLoading}
            onClick={() => action(() => ordersApi.start(id), 'Start')}>
            Start
          </Button>
        )}
        {canStart && (
          <Button variant="secondary" loading={actionLoading}
            onClick={() => action(() => ordersApi.start(id, { fresh: true }), 'Fresh Start')}>
            Fresh Start
          </Button>
        )}
        {canStop && (
          <Button variant="danger" loading={actionLoading}
            onClick={() => action(() => ordersApi.stop(id), 'Stop')}>
            Stop
          </Button>
        )}
        {canReview && (
          <Button variant="primary" onClick={() => router.push(`/review/${id}`)}>
            Open Review
          </Button>
        )}
        <Button variant="secondary" loading={actionLoading}
          onClick={() => action(() => ordersApi.reprocess(id), 'Reprocess Results')}>
          Reprocess
        </Button>
        <Button variant="ghost" loading={actionLoading}
          onClick={() => action(() => ordersApi.deleteRun(id), 'Delete Run')}>
          Delete Run
        </Button>
        <Button variant="danger" loading={actionLoading}
          onClick={() => action(() => ordersApi.purgeDb(id), 'Purge from DB')}>
          Purge DB
        </Button>
      </div>

      <div className={styles.grid}>
        <InfoCard title="Order Info">
          <InfoRow label="Order ID" value={order.order_id} mono />
          <InfoRow label="Service" value={order.service_code} />
          <InfoRow label="Status" value={order.status} />
          <InfoRow label="Created" value={order.created_at?.slice(0, 19).replace('T', ' ')} />
          <InfoRow label="Updated" value={order.updated_at?.slice(0, 19).replace('T', ' ')} />
          <InfoRow label="Completed" value={order.completed_at?.slice(0, 19).replace('T', ' ')} />
          {order.error_message && <InfoRow label="Error" value={order.error_message} danger />}
          {order.pipeline_step && <InfoRow label="Step" value={order.pipeline_step} />}
        </InfoCard>

        <InfoCard title="Parameters">
          {order.params ? (
            <pre className={styles.pre}>{JSON.stringify(order.params, null, 2)}</pre>
          ) : (
            <p className={styles.muted}>No parameters</p>
          )}
        </InfoCard>
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '20px',
    }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono, danger }: { label: string; value?: string; mono?: boolean; danger?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontFamily: mono ? 'monospace' : 'inherit',
        color: danger ? 'var(--danger)' : 'var(--text-primary)',
        textAlign: 'right', wordBreak: 'break-all',
      }}>
        {value}
      </span>
    </div>
  );
}
