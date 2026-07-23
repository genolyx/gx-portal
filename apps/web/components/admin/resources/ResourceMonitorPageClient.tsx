'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { systemApi } from '../../../lib/api/system';
import { formatPortalDateTime } from '../../../lib/datetime';
import { PageHeader } from '../../ui/PageHeader';

interface CpuCore { core: number; usage: number }
interface Memory { total: number; used: number; free: number; cached: number; usedPercent: number }
interface Disk { path: string; total: number; used: number; free: number; usedPercent: number }
interface HostResources { cpu: CpuCore[]; memory: Memory; disk: Disk[]; timestamp: string }

function fmt(bytes: number) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  return (bytes / 1e3).toFixed(0) + ' KB';
}

function UsageBar({ value, color = 'gx-accent' }: { value: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const bg = pct > 85 ? 'bg-gx-danger' : pct > 60 ? 'bg-gx-warning' : 'bg-gx-accent';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gx-elevated overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bg}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gx-text-2 w-10 text-right">{pct}%</span>
    </div>
  );
}

const INTERVALS = [5, 10, 30, 60];

export function ResourceMonitorPageClient() {
  const [data, setData] = useState<HostResources | null>(null);
  const [error, setError] = useState('');
  const [interval, setInterval_] = useState(10);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await systemApi.hostResources();
      setData(res as HostResources);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, interval * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load, interval]);

  return (
    <div>
      <PageHeader
        title="Resource Monitor"
        description="Host CPU, memory and disk usage. Admin only."
      />

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-gx-text-2">Refresh every</span>
        {INTERVALS.map((s) => (
          <button
            key={s}
            onClick={() => setInterval_(s)}
            className={[
              'px-3 py-1 rounded-gx text-sm font-medium transition-colors',
              interval === s
                ? 'bg-gx-accent-dim text-gx-accent'
                : 'bg-gx-elevated text-gx-text-2 hover:text-gx-text',
            ].join(' ')}
          >
            {s}s
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto px-3 py-1 rounded-gx text-sm bg-gx-elevated text-gx-text-2 hover:text-gx-text transition-colors"
        >
          ↻ Refresh now
        </button>
        {data && (
          <span className="text-xs text-gx-muted">
            {formatPortalDateTime(data.timestamp)}
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-gx bg-gx-danger/10 text-gx-danger text-sm mb-6">{error}</div>
      )}

      {data && (
        <div className="flex flex-col gap-6">
          {/* CPU */}
          <section className="bg-gx-surface rounded-gx border border-gx-border p-5">
            <h2 className="font-semibold text-gx-text mb-3">CPU — {data.cpu.length} cores</h2>
            <div className="grid gap-x-3 gap-y-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
              {data.cpu.map(({ core, usage }) => {
                const pct = Math.min(100, Math.max(0, usage));
                const barColor = pct > 85 ? '#e05c6a' : pct > 60 ? '#e8a04e' : '#5b7cf5';
                return (
                  <div key={core} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gx-muted w-7 text-right shrink-0">C{core}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-gx-elevated overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                    </div>
                    <span className="text-[10px] text-gx-text-2 w-7 text-right shrink-0">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Memory */}
          <section className="bg-gx-surface rounded-gx border border-gx-border p-5">
            <h2 className="font-semibold text-gx-text mb-4">Memory</h2>
            <UsageBar value={data.memory.usedPercent} />
            <div className="grid grid-cols-4 gap-4 mt-4">
              {[
                { label: 'Total', val: data.memory.total },
                { label: 'Used', val: data.memory.used },
                { label: 'Free', val: data.memory.free },
                { label: 'Cached', val: data.memory.cached },
              ].map(({ label, val }) => (
                <div key={label} className="bg-gx-elevated rounded-gx p-3">
                  <p className="text-xs text-gx-muted mb-1">{label}</p>
                  <p className="text-sm font-semibold text-gx-text">{fmt(val)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Disk */}
          {data.disk.length > 0 && (
            <section className="bg-gx-surface rounded-gx border border-gx-border p-5">
              <h2 className="font-semibold text-gx-text mb-4">Disk</h2>
              <div className="grid grid-cols-1 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {data.disk.map((d, i) => {
                  const pct = Math.min(100, Math.max(0, d.usedPercent));
                  const barColor = pct > 90 ? '#e05c6a' : pct > 75 ? '#e8a04e' : '#5b7cf5';
                  return (
                    <div key={`${d.path}-${i}`} className="bg-gx-elevated rounded-gx p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm font-semibold text-gx-text">{d.path}</span>
                        <span className="text-xs text-gx-muted">{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gx-border overflow-hidden mb-2">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[11px] text-gx-muted">
                        <div><span className="block text-gx-text-2 font-medium">Used</span>{fmt(d.used)}</div>
                        <div><span className="block text-gx-text-2 font-medium">Free</span>{fmt(d.free)}</div>
                        <div><span className="block text-gx-text-2 font-medium">Total</span>{fmt(d.total)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {!data && !error && (
        <div className="text-gx-muted text-sm">Loading…</div>
      )}
    </div>
  );
}
