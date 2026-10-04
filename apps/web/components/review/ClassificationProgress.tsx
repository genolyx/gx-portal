'use client';

import { useEffect, useState } from 'react';
import { reviewApi, type ClassificationProgressJob } from '../../lib/api/review';
import { cn } from '../../lib/utils';

export function useClassificationProgress(orderIds: string[]) {
  const [jobs, setJobs] = useState<Record<string, ClassificationProgressJob>>({});
  const key = orderIds.filter(Boolean).slice().sort().join('\n');

  useEffect(() => {
    const ids = key ? key.split('\n') : [];
    if (!ids.length) {
      setJobs({});
      return;
    }
    let cancelled = false;
    let timer = 0;
    const tick = () => {
      reviewApi
        .classificationProgress(ids)
        .then((res) => {
          if (cancelled) return;
          const next: Record<string, ClassificationProgressJob> = {};
          for (const job of res.jobs ?? []) next[job.orderId] = job;
          setJobs(next);
          const active = (res.jobs ?? []).some((job) => job.status === 'queued' || job.status === 'running');
          if (active && !cancelled) timer = window.setTimeout(tick, 4000);
        })
        .catch(() => {});
    };
    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key]);

  return jobs;
}

export function ClassificationProgress({ job }: { job?: ClassificationProgressJob | null }) {
  if (!job) return <span className="text-xs text-muted">—</span>;
  const queued = job.classification?.queued ?? 0;
  const running = job.classification?.running ?? 0;
  const succeeded = job.classification?.succeeded ?? 0;
  const failed = job.classification?.failed ?? 0;
  const total = queued + running + succeeded + failed;
  const active = job.status === 'queued' || job.status === 'running' || queued > 0 || running > 0;
  const queuedOnly = (queued > 0 && running === 0) || (job.status === 'queued' && total === 0);
  const pct = total > 0 ? Math.round((succeeded / total) * 100) : 0;
  const label = job.status === 'failed'
    ? 'Failed'
    : job.status === 'running' && total === 0
      ? 'Reading VCF'
      : queuedOnly
        ? 'Queue'
        : active
          ? 'Running'
          : 'Done';
  const bar = job.status === 'failed'
    ? 'bg-danger'
    : queuedOnly
      ? 'bg-muted'
      : !active && pct === 100
        ? 'bg-success'
        : 'bg-accent';

  return (
    <div className="min-w-[8.5rem]">
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className={cn(label === 'Running' ? 'font-medium text-warning' : label === 'Queue' ? 'font-medium text-foreground' : 'text-muted')}>{label}</span>
        {total > 0 && <span className="tabular-nums text-muted">{succeeded}/{total}</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
        <div
          className={cn('h-full rounded-full transition-all', bar, active && total === 0 && 'w-1/3 animate-pulse')}
          style={total > 0 ? { width: `${pct}%` } : undefined}
        />
      </div>
    </div>
  );
}
