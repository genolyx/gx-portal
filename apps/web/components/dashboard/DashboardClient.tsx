'use client';

import { useEffect, useState } from 'react';
import { systemApi } from '../../lib/api/system';
import { PageHeader } from '../ui/PageHeader';
import styles from './Dashboard.module.css';

interface QueueSummary {
  running?: number;
  queued?: number;
  completed?: number;
  failed?: number;
  total?: number;
  [key: string]: unknown;
}

export function DashboardClient() {
  const [queue, setQueue] = useState<QueueSummary | null>(null);
  const [daemonOk, setDaemonOk] = useState<boolean | null>(null);

  useEffect(() => {
    systemApi.health().then((h: unknown) => {
      const health = h as { daemon?: { status?: string } };
      setDaemonOk(health?.daemon?.status !== 'unreachable');
    }).catch(() => setDaemonOk(false));

    systemApi.queue().then((q) => setQueue(q as QueueSummary)).catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader title="Dashboard" description="Real-time analysis queue and system status." />

      <div className={styles.statusRow}>
        <div className={`${styles.statusCard} ${daemonOk === null ? '' : daemonOk ? styles.ok : styles.err}`}>
          <span className={styles.statusDot} />
          <span>{daemonOk === null ? 'Checking daemon…' : daemonOk ? 'gx-daemon connected' : 'gx-daemon unreachable'}</span>
        </div>
      </div>

      {queue && (
        <div className={styles.statsGrid}>
          {Object.entries(queue).map(([k, v]) => (
            typeof v === 'number' ? (
              <div key={k} className={styles.statCard}>
                <p className={styles.statValue}>{v}</p>
                <p className={styles.statLabel}>{k.replace(/_/g, ' ').toUpperCase()}</p>
              </div>
            ) : null
          ))}
        </div>
      )}
    </div>
  );
}
