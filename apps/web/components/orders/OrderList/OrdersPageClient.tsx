'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ordersApi } from '../../../lib/api/orders';
import { PageHeader } from '../../ui/PageHeader';
import { Button } from '../../ui/Button';
import { OrderStatusBadge } from '../../ui/Badge';
import type { Order } from '@gx-portal/types';
import styles from './Orders.module.css';

const STATUSES = ['', 'SAVED', 'QUEUED', 'RUNNING', 'COMPLETED', 'REPORT_READY', 'FAILED', 'CANCELLED'];

export function OrdersPageClient() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await ordersApi.list({
        status: statusFilter || undefined,
        service_code: serviceFilter || undefined,
      });
      setOrders(res.orders ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, serviceFilter]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Manage analysis orders."
        action={
          <Button variant="primary" onClick={() => router.push('/orders/new')}>+ New Order</Button>
        }
      />

      <div className={styles.filters}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={styles.filterSelect}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || 'All Status'}</option>
          ))}
        </select>
        <input
          placeholder="Filter by service code…"
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className={styles.filterInput}
        />
        <Button size="sm" variant="ghost" onClick={load}>Refresh</Button>
      </div>

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : orders.length === 0 ? (
        <p className={styles.empty}>No orders found.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Service</th>
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_id}>
                  <td>
                    <button className={styles.linkBtn} onClick={() => router.push(`/orders/${o.order_id}`)}>
                      <code>{o.order_id.slice(0, 12)}…</code>
                    </button>
                  </td>
                  <td><code className={styles.code}>{o.service_code}</code></td>
                  <td><OrderStatusBadge status={o.status} /></td>
                  <td className={styles.muted}>{o.created_at?.slice(0, 16).replace('T', ' ') ?? '—'}</td>
                  <td className={styles.muted}>{o.updated_at?.slice(0, 16).replace('T', ' ') ?? '—'}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => router.push(`/orders/${o.order_id}`)}>
                      Detail
                    </Button>
                    {(o.status === 'COMPLETED' || o.status === 'REPORT_READY') && (
                      <Button size="sm" variant="accent" onClick={() => router.push(`/review/${o.order_id}`)}>
                        Review
                      </Button>
                    )}
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
