'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ordersApi } from '../../../lib/api/orders';
import { PageHeader } from '../../ui/PageHeader';
import { Button } from '../../ui/Button';
import { OrderStatusBadge } from '../../ui/Badge';
import { CreateOrderModal } from '../CreateOrder/CreateOrderModal';
import type { Order } from '@gx-portal/types';
import { cn } from '../../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey =
  | 'order_id' | 'service_code' | 'lab_code'
  | 'status' | 'progress'
  | 'created_at' | 'updated_at' | 'completed_at'
  | 'message';
type SortDir = 'asc' | 'desc';
interface SortState { key: SortKey; dir: SortDir }

interface OutputFile { name: string; size: number; mtime_ms: number; type: string }

interface FilterState {
  text: string;
  dateFrom: string;
  dateTo: string;
  service: string;
  status: string;
  deepSearch: boolean;   // Search Option toggle
}

const EMPTY_FILTER: FilterState = {
  text: '', dateFrom: '', dateTo: '', service: '', status: '', deepSearch: false,
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = ['', 'SAVED', 'QUEUED', 'RUNNING', 'COMPLETED', 'REPORT_READY', 'FAILED', 'CANCELLED'];
const SERVICES: { value: string; label: string }[] = [
  { value: '',                  label: 'All Services'      },
  { value: 'carrier_screening', label: 'Carrier Screening' },
  { value: 'whole_exome',       label: 'Whole Exome'       },
  { value: 'health_snp',        label: 'Health Screening'  },
  { value: 'sgnipt',            label: 'Single-gene NIPT'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}

function getLabCode(o: Order): string {
  if (!o.params) return '';
  const p = o.params as Record<string, unknown>;
  if (typeof p['labcode'] === 'string' && p['labcode']) return p['labcode'];
  const labIds = p['lab_identifier'];
  if (Array.isArray(labIds) && labIds.length > 0) return String(labIds[0]);
  return '';
}

function getPatientName(o: Order): string {
  if (!o.params) return '';
  const p = o.params as Record<string, unknown>;
  return (
    String(p['patient_name'] ?? p['patientName'] ?? p['patient_birth_date'] ?? '').trim()
  );
}

function getReportFiles(files: OutputFile[]): { pdfs: OutputFile[]; htmls: OutputFile[] } {
  const pdfs  = files.filter(f => f.type === 'pdf'  && f.name.toLowerCase().startsWith('report_'));
  const htmls = files.filter(f => f.type === 'html' && f.name.toLowerCase().startsWith('report_'));
  return { pdfs, htmls };
}

function getLangLabel(name: string): string {
  const m = name.match(/_([A-Z]{2,3})\.(pdf|html)$/i);
  return m ? m[1].toUpperCase() : 'FILE';
}

/** Check if order matches filter */
function matchesFilter(o: Order, f: FilterState): boolean {
  // Date range
  if (f.dateFrom) {
    const d = new Date(o.created_at);
    if (isNaN(d.getTime()) || d < new Date(f.dateFrom)) return false;
  }
  if (f.dateTo) {
    const d = new Date(o.created_at);
    const to = new Date(f.dateTo);
    to.setHours(23, 59, 59, 999);
    if (isNaN(d.getTime()) || d > to) return false;
  }
  // Service
  if (f.service && o.service_code !== f.service) return false;
  // Status
  if (f.status && o.status !== f.status) return false;
  // Text
  if (f.text) {
    const q = f.text.toLowerCase();
    const topLevel = [
      o.order_id, o.service_code, o.status,
      getLabCode(o), o.message ?? '', o.sample_name ?? '',
      getPatientName(o),
    ].join(' ').toLowerCase();
    if (topLevel.includes(q)) return true;
    if (f.deepSearch && o.params) {
      if (JSON.stringify(o.params).toLowerCase().includes(q)) return true;
    }
    return false;
  }
  return true;
}

function sortOrders(orders: Order[], { key, dir }: SortState): Order[] {
  return [...orders].sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    switch (key) {
      case 'order_id':    av = a.order_id;       bv = b.order_id;      break;
      case 'service_code': av = a.service_code;  bv = b.service_code;  break;
      case 'lab_code':    av = getLabCode(a);    bv = getLabCode(b);   break;
      case 'status':      av = a.status;         bv = b.status;        break;
      case 'progress':    av = a.progress ?? 0;  bv = b.progress ?? 0; break;
      case 'created_at':  av = a.created_at;     bv = b.created_at;    break;
      case 'updated_at':  av = a.updated_at ?? ''; bv = b.updated_at ?? ''; break;
      case 'completed_at': av = a.completed_at ?? ''; bv = b.completed_at ?? ''; break;
      case 'message':     av = a.message ?? '';  bv = b.message ?? '';  break;
    }
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv : String(av).localeCompare(String(bv));
    return dir === 'asc' ? cmp : -cmp;
  });
}

/** Export current visible orders as TSV */
function exportTsv(orders: Order[]) {
  const headers = [
    'Order ID', 'Service', 'Lab/Client', 'Status', 'Progress(%)',
    'Order Created', 'Result Updated', 'Completed', 'Message',
    'Sample Name', 'Patient',
  ];
  const rows = orders.map(o => [
    o.order_id,
    o.service_code,
    getLabCode(o),
    o.status,
    String(o.progress ?? 0),
    o.created_at ?? '',
    o.updated_at ?? '',
    o.completed_at ?? '',
    o.message ?? '',
    o.sample_name ?? '',
    getPatientName(o),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join('\t'));

  const tsv = [headers.join('\t'), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + tsv], { type: 'text/tab-separated-values;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders_${new Date().toISOString().slice(0, 10)}.tsv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const selectCls =
  'bg-gx-elevated border border-gx-border rounded-gx-sm px-3 py-[7px] text-sm text-gx-text ' +
  'outline-none focus:border-gx-accent w-full';

const inputCls =
  'bg-gx-elevated border border-gx-border rounded-gx-sm px-3 py-[7px] text-sm text-gx-text ' +
  'outline-none focus:border-gx-accent w-full placeholder:text-gx-muted';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-gx-text-2 mb-1 uppercase tracking-wide">
      {children}
    </label>
  );
}

// ─── Search Panel ─────────────────────────────────────────────────────────────

interface SearchPanelProps {
  pending: FilterState;
  setPending: React.Dispatch<React.SetStateAction<FilterState>>;
  onApply: () => void;
  onExport: () => void;
  onRefresh: () => void;
  resultCount: number;
}

function SearchPanel({ pending, setPending, onApply, onExport, onRefresh, resultCount }: SearchPanelProps) {
  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setPending(prev => ({ ...prev, [k]: v }));

  const hasActive = pending.text || pending.dateFrom || pending.dateTo || pending.service || pending.status;

  return (
    <div className="rounded-gx border border-gx-border bg-gx-surface mb-4 overflow-hidden">
      {/* Row 1 — text search + date range + option toggle */}
      <div className="flex flex-wrap items-end gap-3 px-4 pt-4 pb-3">
        {/* Text search */}
        <div className="flex-1 min-w-[260px]">
          <FieldLabel>Search across text fields</FieldLabel>
          <input
            type="text"
            className={inputCls}
            placeholder="e.g. order-id, sample, labcode, message, COMPLETED…"
            value={pending.text}
            onChange={e => set('text', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onApply()}
          />
        </div>

        {/* Date from */}
        <div className="w-44">
          <FieldLabel>Order created from</FieldLabel>
          <input
            type="date"
            className={inputCls}
            value={pending.dateFrom}
            onChange={e => set('dateFrom', e.target.value)}
          />
        </div>

        {/* Date to */}
        <div className="w-44">
          <FieldLabel>Order created to</FieldLabel>
          <input
            type="date"
            className={inputCls}
            value={pending.dateTo}
            onChange={e => set('dateTo', e.target.value)}
          />
        </div>

        {/* Deep-search toggle */}
        <div className="flex flex-col items-end gap-1 self-end pb-[1px]">
          <span className="text-[11px] font-semibold text-gx-text-2 uppercase tracking-wide">
            Deep Search
          </span>
          <button
            type="button"
            onClick={() => set('deepSearch', !pending.deepSearch)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-gx-sm border text-xs font-bold transition-colors',
              pending.deepSearch
                ? 'bg-gx-accent text-white border-gx-accent'
                : 'bg-gx-elevated text-gx-muted border-gx-border hover:border-gx-accent',
            )}
          >
            <span className={cn(
              'w-7 h-3.5 rounded-full relative transition-colors',
              pending.deepSearch ? 'bg-white/30' : 'bg-gx-muted/30',
            )}>
              <span className={cn(
                'absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all',
                pending.deepSearch ? 'left-[14px] bg-white' : 'left-0.5 bg-gx-muted',
              )} />
            </span>
            {pending.deepSearch ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gx-border mx-4" />

      {/* Row 2 — service + status dropdowns */}
      <div className="flex flex-wrap items-end gap-3 px-4 py-3">
        <div className="w-48">
          <FieldLabel>All Services</FieldLabel>
          <select className={selectCls} value={pending.service} onChange={e => set('service', e.target.value)}>
            {SERVICES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="w-44">
          <FieldLabel>All Status</FieldLabel>
          <select className={selectCls} value={pending.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
          </select>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 ml-auto mt-4">
          {hasActive && (
            <button
              type="button"
              className="text-xs text-gx-muted hover:text-gx-text underline underline-offset-2 transition-colors"
              onClick={() => setPending(EMPTY_FILTER)}
            >
              Clear
            </button>
          )}
          <Button variant="primary" size="sm" onClick={onApply}>
            Apply filters
          </Button>
          <Button variant="secondary" size="sm" onClick={onExport}>
            Export as TSV
          </Button>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            ↺ Refresh
          </Button>
          <span className="text-xs text-gx-muted pl-1">
            {resultCount} result{resultCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── SortableHead ─────────────────────────────────────────────────────────────

function SortableHead({
  label, sortKey, current, onSort, className,
}: {
  label: string; sortKey: SortKey; current: SortState;
  onSort: (k: SortKey) => void; className?: string;
}) {
  const active = current.key === sortKey;
  return (
    <th
      className={cn(
        'px-3 py-2.5 text-left text-xs font-semibold text-gx-text-2 uppercase tracking-wide',
        'cursor-pointer select-none whitespace-nowrap hover:text-gx-text border-b border-gx-border',
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={cn('text-[10px]', active ? 'text-gx-accent' : 'text-gx-muted')}>
          {active ? (current.dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct === 100 ? 'bg-gx-success' : pct > 0 ? 'bg-gx-accent' : 'bg-gx-muted/30';
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-20 rounded-full bg-gx-elevated overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-gx-text-2 tabular-nums w-7 text-right">{pct}%</span>
    </div>
  );
}

// ─── ServiceBadge ─────────────────────────────────────────────────────────────

function ServiceBadge({ code }: { code: string }) {
  const SERVICE_META: Record<string, { label: string; cls: string }> = {
    carrier_screening: { label: 'Carrier Screening', cls: 'bg-purple-500/15 text-purple-400' },
    carrier:           { label: 'Carrier Screening', cls: 'bg-purple-500/15 text-purple-400' },
    carrier_couples:   { label: 'Carrier Screening', cls: 'bg-purple-500/15 text-purple-400' },
    whole_exome:       { label: 'Whole Exome',        cls: 'bg-amber-500/15 text-amber-400'  },
    wes_panel:         { label: 'Whole Exome',        cls: 'bg-amber-500/15 text-amber-400'  },
    health_snp:        { label: 'Health Screening',   cls: 'bg-teal-500/15 text-teal-400'    },
    sgnipt:            { label: 'Single-gene NIPT',   cls: 'bg-blue-500/15 text-blue-400'    },
    nipt:              { label: 'NIPT',               cls: 'bg-blue-500/15 text-blue-400'    },
  };
  const meta = SERVICE_META[code.toLowerCase()];
  const cls   = meta?.cls   ?? 'bg-gx-elevated text-gx-text-2';
  const label = meta?.label ?? code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={cn('inline-flex items-center rounded-gx-sm px-2 py-0.5 text-xs font-semibold whitespace-nowrap', cls)}>
      {label}
    </span>
  );
}

// ─── ReportFilesCell ──────────────────────────────────────────────────────────

function ReportFilesCell({ orderId, status }: { orderId: string; status: string }) {
  const [files, setFiles] = useState<OutputFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (!['COMPLETED', 'REPORT_READY'].includes(status)) return;
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true);
    ordersApi.getFiles(orderId)
      .then(r => setFiles(r.files ?? []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [orderId, status]);

  if (!['COMPLETED', 'REPORT_READY'].includes(status)) return <span className="text-gx-muted text-xs">—</span>;
  if (loading) return <span className="text-gx-muted text-xs">…</span>;
  if (!files) return null;

  const { pdfs, htmls } = getReportFiles(files);
  if (pdfs.length === 0 && htmls.length === 0) return <span className="text-gx-muted text-xs">No report</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {pdfs.map(f => (
        <a
          key={f.name}
          href={ordersApi.getOutputFileUrl(orderId, f.name)}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-gx-sm border text-[11px] font-semibold',
            'bg-gx-danger/10 text-gx-danger border-gx-danger/30',
            'hover:bg-gx-danger/20 hover:border-gx-danger/60 active:scale-95',
            'transition-all select-none whitespace-nowrap',
          )}
        >
          <span className="text-[10px]">↓</span>
          PDF {getLangLabel(f.name)}
        </a>
      ))}
      {htmls.map(f => (
        <a
          key={f.name}
          href={ordersApi.getOutputFileUrl(orderId, f.name)}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-gx-sm border text-[11px] font-semibold',
            'bg-gx-info/10 text-gx-info border-gx-info/30',
            'hover:bg-gx-info/20 hover:border-gx-info/60 active:scale-95',
            'transition-all select-none whitespace-nowrap',
          )}
        >
          <span className="text-[10px]">↓</span>
          HTML {getLangLabel(f.name)}
        </a>
      ))}
    </div>
  );
}

// ─── ActionsMenu ──────────────────────────────────────────────────────────────

function ActionsMenu({ order, onActionDone }: { order: Order; onActionDone: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (!confirm(`"${label}" 실행하시겠습니까?`)) return;
    setBusy(true); setOpen(false);
    try { await fn(); onActionDone(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const canStart  = ['SAVED', 'FAILED', 'CANCELLED'].includes(order.status);
  const canStop   = ['RUNNING', 'QUEUED'].includes(order.status);
  const canReview = ['COMPLETED', 'REPORT_READY'].includes(order.status);

  return (
    <div className="relative" ref={ref}>
      <button
        className={cn(
          'w-7 h-7 rounded flex items-center justify-center text-gx-text-2',
          'hover:bg-gx-elevated hover:text-gx-text transition-colors text-base',
          busy && 'opacity-50 pointer-events-none',
        )}
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
      >···</button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-44 rounded-gx bg-gx-surface border border-gx-border shadow-gx-md py-1"
          onClick={e => e.stopPropagation()}>
          <MenuItem onClick={() => { setOpen(false); router.push(`/orders/${order.order_id}`); }}>Detail →</MenuItem>
          {canReview && <MenuItem onClick={() => { setOpen(false); router.push(`/review/${order.order_id}`); }}>Review →</MenuItem>}
          {canStart && (<>
            <Divider />
            <MenuItem onClick={() => run('Start',       () => ordersApi.start(order.order_id))}>▶ Start</MenuItem>
            <MenuItem onClick={() => run('Fresh Start', () => ordersApi.start(order.order_id, { fresh: true }))}>▶ Fresh Start</MenuItem>
            <MenuItem onClick={() => run('Force Run',   () => ordersApi.start(order.order_id, { force: true }))}>▶ Force Run</MenuItem>
          </>)}
          {canStop && (<><Divider /><MenuItem danger onClick={() => run('Stop', () => ordersApi.stop(order.order_id))}>■ Stop</MenuItem></>)}
          <Divider />
          <MenuItem onClick={() => run('Reprocess',  () => ordersApi.reprocess(order.order_id))}>↺ Reprocess</MenuItem>
          <MenuItem danger onClick={() => run('Delete Run', () => ordersApi.deleteRun(order.order_id))}>✕ Delete Run</MenuItem>
          <MenuItem danger onClick={() => run('Purge DB',   () => ordersApi.purgeDb(order.order_id))}>⊗ Purge DB</MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      className={cn('w-full text-left px-3 py-1.5 text-xs transition-colors',
        danger ? 'text-gx-danger hover:bg-gx-danger/10' : 'text-gx-text hover:bg-gx-elevated')}
      onClick={onClick}
    >{children}</button>
  );
}
function Divider() { return <div className="my-1 border-t border-gx-border" />; }

// ─── Main Component ───────────────────────────────────────────────────────────

export function OrdersPageClient() {
  const router = useRouter();
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort]       = useState<SortState>({ key: 'created_at', dir: 'desc' });
  const [showCreate, setShowCreate] = useState(false);

  // Two-stage filter: pending (in the form) → active (applied to data)
  const [pending, setPending] = useState<FilterState>(EMPTY_FILTER);
  const [active,  setActive]  = useState<FilterState>(EMPTY_FILTER);

  const load = useCallback(async () => {
    try {
      const res = await ordersApi.list();
      setOrders(res.orders ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const applyFilters = () => setActive({ ...pending });

  const handleSort = (key: SortKey) =>
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));

  const filtered = orders.filter(o => matchesFilter(o, active));
  const sorted   = sortOrders(filtered, sort);

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Manage and monitor analysis orders."
        action={
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + Create an order
          </Button>
        }
      />

      {showCreate && (
        <CreateOrderModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {/* ── Search Panel ── */}
      <SearchPanel
        pending={pending}
        setPending={setPending}
        onApply={applyFilters}
        onExport={() => exportTsv(sorted)}
        onRefresh={load}
        resultCount={sorted.length}
      />

      {/* ── Instruction hint ── */}
      <p className="text-[11px] text-gx-muted mb-3">
        Click a row to open detail. Report-ready orders show PDF / HTML buttons.  Use ··· for Start, Stop, Delete, Purge actions.
      </p>

      {loading ? (
        <p className="text-center text-gx-muted py-10">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-center text-gx-muted py-10">No orders match the current filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-gx border border-gx-border">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gx-elevated/60">
              <tr>
                <SortableHead label="Order ID"       sortKey="order_id"     current={sort} onSort={handleSort} />
                <SortableHead label="Service"        sortKey="service_code" current={sort} onSort={handleSort} />
                <SortableHead label="Lab / Client"   sortKey="lab_code"     current={sort} onSort={handleSort} />
                <SortableHead label="Status"         sortKey="status"       current={sort} onSort={handleSort} />
                <SortableHead label="Progress"       sortKey="progress"     current={sort} onSort={handleSort} />
                <SortableHead label="Order Created"  sortKey="created_at"   current={sort} onSort={handleSort} />
                <SortableHead label="Result Updated" sortKey="updated_at"   current={sort} onSort={handleSort} />
                <SortableHead label="Completed"      sortKey="completed_at" current={sort} onSort={handleSort} />
                <SortableHead label="Message"        sortKey="message"      current={sort} onSort={handleSort} />
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gx-text-2 uppercase tracking-wide border-b border-gx-border whitespace-nowrap">Report</th>
                <th className="px-3 py-2.5 border-b border-gx-border w-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((o, idx) => (
                <tr
                  key={o.order_id}
                  className={cn(
                    'cursor-pointer transition-colors',
                    idx % 2 === 0 ? 'bg-gx-bg' : 'bg-gx-surface',
                    'hover:bg-gx-accent-dim',
                  )}
                  onClick={() => router.push(`/orders/${o.order_id}`)}
                >
                  <td className="px-3 py-2.5 border-b border-gx-border">
                    <span className="font-mono text-xs text-gx-accent">{o.order_id}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-gx-border">
                    <ServiceBadge code={o.service_code} />
                  </td>
                  <td className="px-3 py-2.5 border-b border-gx-border">
                    <span className="text-xs text-gx-text-2">{getLabCode(o) || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-gx-border whitespace-nowrap">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-3 py-2.5 border-b border-gx-border">
                    <ProgressBar value={o.progress ?? 0} />
                  </td>
                  <td className="px-3 py-2.5 border-b border-gx-border whitespace-nowrap">
                    <span className="text-xs text-gx-text-2">{fmtDate(o.created_at)}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-gx-border whitespace-nowrap">
                    <span className="text-xs text-gx-text-2">{fmtDate(o.updated_at)}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-gx-border whitespace-nowrap">
                    <span className="text-xs text-gx-text-2">{fmtDate(o.completed_at)}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-gx-border max-w-[180px]">
                    {o.message ? (
                      <span
                        title={o.message}
                        className={cn('text-xs',
                          /fail|error/i.test(o.message) ? 'text-gx-danger' : 'text-gx-text-2')}
                      >
                        {o.message.length > 36 ? o.message.slice(0, 33) + '…' : o.message}
                      </span>
                    ) : <span className="text-gx-muted text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-gx-border">
                    <ReportFilesCell orderId={o.order_id} status={o.status} />
                  </td>
                  <td className="px-2 py-2.5 border-b border-gx-border">
                    <ActionsMenu order={o} onActionDone={load} />
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

