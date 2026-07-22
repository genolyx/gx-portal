'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ordersApi } from '../../lib/api/orders';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { OrderStatusBadge } from '../ui/Badge';
import type { Order } from '@gx-portal/types';

const REVIEWABLE_STATUSES = new Set(['COMPLETED', 'REPORT_READY']);

export function ReviewListPageClient() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await ordersApi.list();
      setOrders((res.orders ?? []).filter((o) => REVIEWABLE_STATUSES.has(o.status)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Review"
        description="Select an order to review variants, coverage, and reports."
      />

      {loading ? (
        <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Loading…</p>
      ) : orders.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>No orders ready for review.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Order ID', 'Service', 'Status', 'Updated', ''].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <code style={{ fontSize: '0.85em', color: 'var(--accent)' }}>{o.order_id}</code>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <code style={{ fontSize: '0.85em' }}>{o.service_code}</code>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.85em' }}>
                    {o.updated_at?.slice(0, 16).replace('T', ' ') ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <Button
                      size="sm"
                      variant="accent"
                      onClick={() => router.push(`/review/${o.order_id}`)}
                    >
                      Open Review
                    </Button>
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
