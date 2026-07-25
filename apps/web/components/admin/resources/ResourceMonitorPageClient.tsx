'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, ToggleButton, ToggleButtonGroup, type Key } from '@heroui/react';
import { systemApi } from '../../../lib/api/system';
import { formatPortalDateTime } from '../../../lib/datetime';
import { PageHeader } from '../../ui/PageHeader';
import { RefreshButton } from '../../ui/RefreshButton';

interface CpuCore {
  core: number;
  usage: number;
}
interface Memory {
  total: number;
  used: number;
  free: number;
  cached: number;
  usedPercent: number;
}
interface Disk {
  path: string;
  total: number;
  used: number;
  free: number;
  usedPercent: number;
}
interface HostResources {
  cpu: CpuCore[];
  memory: Memory;
  disk: Disk[];
  timestamp: string;
}

function fmt(bytes: number) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  return (bytes / 1e3).toFixed(0) + ' KB';
}

function barColor(pct: number, thresholds: { warn: number; danger: number }) {
  if (pct > thresholds.danger) return 'bg-danger';
  if (pct > thresholds.warn) return 'bg-warning';
  return 'bg-accent';
}

function UsageBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-surface-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor(pct, { warn: 60, danger: 85 })}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted w-10 text-right">{pct}%</span>
    </div>
  );
}

const INTERVALS = [5, 10, 30, 60];

export function ResourceMonitorPageClient() {
  const [data, setData] = useState<HostResources | null>(null);
  const [error, setError] = useState('');
  const [interval, setInterval_] = useState(10);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await systemApi.hostResources();
      setData(res as HostResources);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      if (manual) throw e instanceof Error ? e : new Error('Failed to refresh resources');
    } finally {
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    timerRef.current = setInterval(() => void load(false), interval * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load, interval]);

  return (
    <div>
      <PageHeader
        title="Resource Monitor"
        description="Host CPU, memory and disk usage. Admin only."
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-sm text-muted">Refresh every</span>
        <div className="rounded-full bg-default p-0.5 min-w-[12rem]">
          <ToggleButtonGroup
            aria-label="Refresh interval"
            selectionMode="single"
            disallowEmptySelection
            isDetached
            fullWidth
            size="sm"
            selectedKeys={new Set([String(interval)])}
            onSelectionChange={(keys: Set<Key>) => {
              const next = Number([...keys][0]);
              if (INTERVALS.includes(next)) setInterval_(next);
            }}
          >
            {INTERVALS.map((s) => (
              <ToggleButton
                key={s}
                id={String(s)}
                variant="ghost"
                className="flex-1"
              >
                {s}s
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
        <RefreshButton
          className="ml-auto"
          label="Refresh now"
          successToast="Resources refreshed"
          isLoading={refreshing}
          onPress={() => load(true)}
        />
        {data && (
          <span className="text-xs text-muted">{formatPortalDateTime(data.timestamp)}</span>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-danger/10 text-danger text-sm mb-6">{error}</div>
      )}

      {data && (
        <div className="flex flex-col gap-6">
          <Card>
            <Card.Header>
              <Card.Title>CPU — {data.cpu.length} cores</Card.Title>
            </Card.Header>
            <Card.Content>
              <div
                className="grid gap-x-3 gap-y-1.5"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
              >
                {data.cpu.map(({ core, usage }) => {
                  const pct = Math.min(100, Math.max(0, usage));
                  return (
                    <div key={core} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted w-7 text-right shrink-0">C{core}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-surface-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor(pct, { warn: 60, danger: 85 })}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted w-7 text-right shrink-0">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Memory</Card.Title>
            </Card.Header>
            <Card.Content>
              <UsageBar value={data.memory.usedPercent} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                {[
                  { label: 'Total', val: data.memory.total },
                  { label: 'Used', val: data.memory.used },
                  { label: 'Free', val: data.memory.free },
                  { label: 'Cached', val: data.memory.cached },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-surface-secondary rounded-lg p-3">
                    <p className="text-xs text-muted mb-1">{label}</p>
                    <p className="text-sm font-semibold text-foreground">{fmt(val)}</p>
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>

          {data.disk.length > 0 && (
            <Card>
              <Card.Header>
                <Card.Title>Disk</Card.Title>
              </Card.Header>
              <Card.Content>
                <div
                  className="grid grid-cols-1 gap-3"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
                >
                  {data.disk.map((d, i) => {
                    const pct = Math.min(100, Math.max(0, d.usedPercent));
                    return (
                      <div key={`${d.path}-${i}`} className="bg-surface-secondary rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {d.path}
                          </span>
                          <span className="text-xs text-muted">{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-border overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all ${barColor(pct, { warn: 75, danger: 90 })}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[11px] text-muted">
                          <div>
                            <span className="block text-foreground font-medium">Used</span>
                            {fmt(d.used)}
                          </div>
                          <div>
                            <span className="block text-foreground font-medium">Free</span>
                            {fmt(d.free)}
                          </div>
                          <div>
                            <span className="block text-foreground font-medium">Total</span>
                            {fmt(d.total)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card.Content>
            </Card>
          )}
        </div>
      )}

      {!data && !error && <div className="text-muted text-sm">Loading…</div>}
    </div>
  );
}
