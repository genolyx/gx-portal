'use client';

import { Chip } from '@heroui/react';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'accent' | 'default'> = {
  COMPLETED: 'success',
  REPORT_READY: 'success',
  RUNNING: 'accent',
  QUEUED: 'warning',
  FAILED: 'danger',
  CANCELLED: 'danger',
  SAVED: 'default',
};

export function OrderStatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? 'default';
  return (
    <Chip color={color} size="sm" variant="soft">
      <Chip.Label>{status}</Chip.Label>
    </Chip>
  );
}
