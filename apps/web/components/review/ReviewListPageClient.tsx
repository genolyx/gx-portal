'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Button, Link, Spinner, Table } from '@heroui/react';
import { ordersApi } from '../../lib/api/orders';
import { formatPortalDateTime } from '../../lib/datetime';
import { PageHeader } from '../ui/PageHeader';
import { OrderStatusBadge } from '../ui/OrderStatusBadge';
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
        <div className="flex items-center justify-center gap-2 py-16 text-muted">
          <Spinner size="md" color="current" />
          <span className="text-sm">Loading orders…</span>
        </div>
      ) : orders.length === 0 ? (
        <p className="py-4 text-sm text-muted">No orders ready for review.</p>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Orders ready for review">
              <Table.Header>
                <Table.Column isRowHeader>Order ID</Table.Column>
                <Table.Column>Service</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column>Updated</Table.Column>
                <Table.Column> </Table.Column>
              </Table.Header>
              <Table.Body>
                {orders.map((o) => (
                  <Table.Row key={o.order_id}>
                    <Table.Cell>
                      <Link
                        href={`/review/${o.order_id}`}
                        className="font-mono text-xs text-accent"
                      >
                        {o.order_id}
                      </Link>
                    </Table.Cell>
                    <Table.Cell>
                      <code className="text-xs">{o.service_code}</code>
                    </Table.Cell>
                    <Table.Cell>
                      <OrderStatusBadge status={o.status} />
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs text-muted whitespace-nowrap">
                        {formatPortalDateTime(o.updated_at)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="sm"
                        variant="primary"
                        onPress={() => router.push(`/review/${o.order_id}`)}
                        className="gap-1.5"
                      >
                        Open Review
                        <ArrowRight size={14} strokeWidth={2} aria-hidden />
                      </Button>
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
