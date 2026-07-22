'use client';

import { useEffect, useState } from 'react';
import { systemApi } from '../../lib/api/system';
import { PageHeader } from '../ui/PageHeader';
import { Card, CardContent, CardTitle } from '../ui/Card';

interface QueueStats {
  running?: number;
  queued?: number;
  completed?: number;
  failed?: number;
  total?: number;
  [key: string]: unknown;
}

const STAT_LABELS: Record<string, string> = {
  running: 'Running',
  queued: 'Queued',
  completed: 'Completed',
  failed: 'Failed',
  total: 'Total',
};

export function DashboardClient() {
  const [queue, setQueue] = useState<QueueStats | null>(null);

  useEffect(() => {
    systemApi.queue().then((q) => setQueue(q as QueueStats)).catch(() => {});
  }, []);

  const statEntries = queue
    ? Object.entries(queue).filter(([, v]) => typeof v === 'number') as [string, number][]
    : [];

  return (
    <div>
      <PageHeader title="Dashboard" description="Real-time analysis queue and system status." />

      {/* Stats grid */}
      {statEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {statEntries.map(([key, value]) => (
            <Card key={key}>
              <CardContent className="pt-5">
                <p className="text-3xl font-bold text-gx-text">{value}</p>
                <CardTitle className="mt-1 normal-case tracking-normal text-xs font-medium text-gx-muted">
                  {STAT_LABELS[key] ?? key.replace(/_/g, ' ')}
                </CardTitle>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {statEntries.length === 0 && (
        <p className="text-sm text-gx-muted">No queue data available.</p>
      )}
    </div>
  );
}
