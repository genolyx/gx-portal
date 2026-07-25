'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, Chip, Dropdown, Input, Label, Switch } from '@heroui/react';
import { ordersApi } from '../../../lib/api/orders';
import { PageHeader } from '../../ui/PageHeader';
import { OrderStatusBadge } from '../../ui/OrderStatusBadge';
import { DatePickerField } from '../../ui/DatePickerField';
import { SelectField } from '../../ui/SelectField';
import { RefreshButton } from '../../ui/RefreshButton';
import { CreateOrderModal } from '../CreateOrder/CreateOrderModal';
import { ReportDownloadLink } from '../ReportDownloadLink';
import { reportLangLabel } from '../../../lib/report-downloads';
import type { Order } from '@gx-portal/types';
import { buildOrderMenuItems, canEditOrderService, type OrderMenuAction } from '../../../lib/order-menu';
import { cn } from '../../../lib/utils';
import { formatPortalDateTime, parsePortalDate, portalDayEnd, portalDayStart } from '../../../lib/datetime';

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
  return formatPortalDateTime(iso);
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
  return reportLangLabel(name);
}

/** Check if order matches filter */
function matchesFilter(o: Order, f: FilterState): boolean {
  // Date range
  if (f.dateFrom) {
    const d = parsePortalDate(o.created_at);
    if (!d || d < portalDayStart(f.dateFrom)) return false;
  }
  if (f.dateTo) {
    const d = parsePortalDate(o.created_at);
    if (!d || d > portalDayEnd(f.dateTo)) return false;
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

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <Label htmlFor={htmlFor} className="block text-[11px] font-semibold text-muted mb-1 uppercase tracking-wide">
      {children}
    </Label>
  );
}

// ─── Search Panel ─────────────────────────────────────────────────────────────

interface SearchPanelProps {
  pending: FilterState;
  setPending: React.Dispatch<React.SetStateAction<FilterState>>;
  onApply: () => void;
  onExport: () => void;
  onRefresh: () => void | Promise<void>;
  refreshing?: boolean;
  resultCount: number;
}

function SearchPanel({ pending, setPending, onApply, onExport, onRefresh, refreshing, resultCount }: SearchPanelProps) {
  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setPending(prev => ({ ...prev, [k]: v }));

  const hasActive = pending.text || pending.dateFrom || pending.dateTo || pending.service || pending.status;

  return (
    <Card className="mb-4 overflow-hidden">
      <Card.Content className="p-0">
      {/* Row 1 — text search + date range + option toggle */}
      <div className="flex flex-wrap items-end gap-3 px-4 pt-4 pb-3">
        {/* Text search */}
        <div className="flex-1 min-w-[260px]">
          <FieldLabel htmlFor="orders-search">Search across text fields</FieldLabel>
          <Input
            id="orders-search"
            type="text"
            placeholder="e.g. order-id, sample, labcode, message, COMPLETED…"
            value={pending.text}
            onChange={e => set('text', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onApply()}
            fullWidth
          />
        </div>

        {/* Date from */}
        <div className="w-52">
          <FieldLabel>Order created from</FieldLabel>
          <DatePickerField
            aria-label="Order created from"
            value={pending.dateFrom}
            onChange={(v) => set('dateFrom', v)}
          />
        </div>

        {/* Date to */}
        <div className="w-52">
          <FieldLabel>Order created to</FieldLabel>
          <DatePickerField
            aria-label="Order created to"
            value={pending.dateTo}
            onChange={(v) => set('dateTo', v)}
          />
        </div>

        {/* Deep-search toggle */}
        <div className="flex flex-col items-end gap-1.5 self-end pb-[1px]">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">
            Deep Search
          </span>
          <Switch
            isSelected={pending.deepSearch}
            onChange={(v) => set('deepSearch', v)}
            size="sm"
            className="!flex-row !items-center !gap-2"
          >
            <Switch.Content className="!flex-row !items-center !gap-2">
              <span className="text-xs text-muted tabular-nums w-7 text-right">
                {pending.deepSearch ? 'ON' : 'OFF'}
              </span>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border mx-4" />

      {/* Row 2 — service + status dropdowns */}
      <div className="flex flex-wrap items-end gap-3 px-4 py-3">
        <div className="w-48">
          <FieldLabel>All Services</FieldLabel>
          <SelectField
            aria-label="Service filter"
            value={pending.service}
            onChange={(v) => set('service', v)}
            options={SERVICES.map(({ value, label }) => ({ id: value, label }))}
          />
        </div>

        <div className="w-44">
          <FieldLabel>All Status</FieldLabel>
          <SelectField
            aria-label="Status filter"
            value={pending.status}
            onChange={(v) => set('status', v)}
            options={STATUSES.map((s) => ({ id: s, label: s || 'All Status' }))}
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 ml-auto mt-4">
          {hasActive && (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setPending(EMPTY_FILTER)}
            >
              Clear
            </Button>
          )}
          <Button variant="primary" size="sm" onPress={onApply}>
            Apply filters
          </Button>
          <Button variant="secondary" size="sm" onPress={onExport}>
            Export as TSV
          </Button>
          <RefreshButton
            variant="ghost"
            label="Refresh"
            successToast="Orders refreshed"
            isLoading={refreshing}
            onPress={onRefresh}
          />
          <span className="text-xs text-muted pl-1">
            {resultCount} result{resultCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      </Card.Content>
    </Card>
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
        'px-3 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wide',
        'cursor-pointer select-none whitespace-nowrap hover:text-foreground border-b border-border',
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={cn('text-[10px]', active ? 'text-accent' : 'text-muted')}>
          {active ? (current.dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct === 100 ? 'bg-success' : pct > 0 ? 'bg-accent' : 'bg-muted/30';
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-20 rounded-full bg-surface-secondary overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-muted tabular-nums w-7 text-right">{pct}%</span>
    </div>
  );
}

// ─── ServiceBadge ─────────────────────────────────────────────────────────────

function ServiceBadge({ code }: { code: string }) {
  const SERVICE_META: Record<string, { label: string; color?: 'accent' | 'warning' | 'success' | 'default' }> = {
    carrier_screening: { label: 'Carrier Screening', color: 'accent' },
    carrier:           { label: 'Carrier Screening', color: 'accent' },
    carrier_couples:   { label: 'Carrier Screening', color: 'accent' },
    whole_exome:       { label: 'Whole Exome',        color: 'warning'  },
    wes_panel:         { label: 'Whole Exome',        color: 'warning'  },
    health_snp:        { label: 'Health Screening',   color: 'success'    },
    sgnipt:            { label: 'Single-gene NIPT',   color: 'accent'    },
    nipt:              { label: 'NIPT',               color: 'accent'    },
  };
  const meta = SERVICE_META[code.toLowerCase()];
  const label = meta?.label ?? code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <Chip
      color={meta?.color ?? 'default'}
      size="sm"
      variant="soft"
      className="max-w-none whitespace-nowrap"
    >
      <Chip.Label className="whitespace-nowrap">{label}</Chip.Label>
    </Chip>
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

  if (!['COMPLETED', 'REPORT_READY'].includes(status)) return <span className="text-muted text-xs">—</span>;
  if (loading) return <span className="text-muted text-xs">…</span>;
  if (!files) return null;

  const { pdfs, htmls } = getReportFiles(files);
  if (pdfs.length === 0 && htmls.length === 0) return <span className="text-muted text-xs">No report</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {pdfs.map(f => (
        <ReportDownloadLink
          key={f.name}
          orderId={orderId}
          filename={f.name}
          label={`PDF ${getLangLabel(f.name)}`}
          kind="pdf"
          stopRowClick
        />
      ))}
      {htmls.map(f => (
        <ReportDownloadLink
          key={f.name}
          orderId={orderId}
          filename={f.name}
          label={`HTML ${getLangLabel(f.name)}`}
          kind="html"
          stopRowClick
        />
      ))}
    </div>
  );
}

// ─── ActionsMenu ──────────────────────────────────────────────────────────────

function ActionsMenu({
  order,
  onActionDone,
  onEdit,
  onFollowUp,
}: {
  order: Order;
  onActionDone: () => void;
  onEdit: (order: Order) => void;
  onFollowUp: (order: Order) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const items = buildOrderMenuItems(order);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (!confirm(`"${label}" 실행하시겠습니까?`)) return;
    setBusy(true);
    try { await fn(); onActionDone(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const handleAction = async (action: OrderMenuAction) => {
    switch (action) {
      case 'edit':
        if (!canEditOrderService(order.service_code)) {
          alert('Editing is only supported for Carrier Screening, Whole Exome, Health Screening, and Single-gene NIPT orders.');
          return;
        }
        try {
          const full = await ordersApi.getById(order.order_id);
          onEdit(full);
        } catch (e) {
          alert(e instanceof Error ? e.message : String(e));
        }
        return;
      case 'new-from':
        if (!canEditOrderService(order.service_code)) {
          alert('Follow-up orders are only supported for carrier screening, whole exome, health screening, and Single-gene NIPT.');
          return;
        }
        try {
          const full = await ordersApi.getById(order.order_id);
          onFollowUp(full);
        } catch (e) {
          alert(e instanceof Error ? e.message : String(e));
        }
        return;
      case 'review':
        router.push(`/review/${order.order_id}`);
        return;
      case 'submit':
        await run('Submit', () => ordersApi.start(order.order_id));
        return;
      case 'force-run':
        await run('Force Run', () => ordersApi.start(order.order_id));
        return;
      case 'force-run-fresh':
        await run('Force Run (Fresh)', () => ordersApi.start(order.order_id, { fresh: true }));
        return;
      case 'reprocess-only':
        await run('Reprocess only', () => ordersApi.reprocess(order.order_id));
        return;
      case 'stop':
        await run('Stop', () => ordersApi.stop(order.order_id));
        return;
      case 'delete':
        await run('Delete', () => ordersApi.deleteRun(order.order_id));
        return;
      case 'purge-db':
        await run('Purge DB', () => ordersApi.purgeDb(order.order_id));
        return;
    }
  };

  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
      <Dropdown>
        <Dropdown.Trigger>
          <Button variant="ghost" size="sm" isDisabled={busy} aria-label="Order actions">
            ···
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Popover>
          <Dropdown.Menu
            onAction={(key) => void handleAction(key as OrderMenuAction)}
            aria-label="Order actions"
          >
            {items.map((item) => (
              <Dropdown.Item
                key={item.action}
                id={item.action}
                textValue={item.label}
                className={item.danger ? 'text-danger' : undefined}
              >
                {item.label}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OrdersPageClient() {
  const router = useRouter();
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort]       = useState<SortState>({ key: 'created_at', dir: 'desc' });
  const [showCreate, setShowCreate] = useState(false);
  const [orderForm, setOrderForm] = useState<null | { mode: 'edit' | 'followUp'; order: Order }>(null);

  // Two-stage filter: pending (in the form) → active (applied to data)
  const [pending, setPending] = useState<FilterState>(EMPTY_FILTER);
  const [active,  setActive]  = useState<FilterState>(EMPTY_FILTER);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await ordersApi.list();
      setOrders(res.orders ?? []);
    } catch (e) {
      if (manual) throw e instanceof Error ? e : new Error('Failed to refresh orders');
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const id = setInterval(() => void load(false), 15_000);
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
        actions={
          <Button variant="primary" onPress={() => setShowCreate(true)}>
            + Create an order
          </Button>
        }
      />

      {(showCreate || orderForm) && (
        <CreateOrderModal
          initial={orderForm ?? undefined}
          onClose={() => { setShowCreate(false); setOrderForm(null); }}
          onSaved={() => { setShowCreate(false); setOrderForm(null); load(); }}
        />
      )}

      {/* ── Search Panel ── */}
      <SearchPanel
        pending={pending}
        setPending={setPending}
        onApply={applyFilters}
        onExport={() => exportTsv(sorted)}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        resultCount={sorted.length}
      />

      {/* ── Instruction hint ── */}
      <p className="text-[11px] text-muted mb-3">
        Click a row to open detail. Report-ready orders show PDF / HTML buttons. Use ··· for Edit, Review, Force Run, Reprocess, Delete, and other actions.
      </p>

      {loading ? (
        <p className="text-center text-muted py-10">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-center text-muted py-10">No orders match the current filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-surface-secondary/60">
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
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wide border-b border-border whitespace-nowrap">Report</th>
                <th className="px-3 py-2.5 border-b border-border w-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((o, idx) => (
                <tr
                  key={o.order_id}
                  className={cn(
                    'cursor-pointer transition-colors',
                    idx % 2 === 0 ? 'bg-background' : 'bg-surface',
                    'hover:bg-surface-secondary',
                  )}
                  onClick={() => router.push(`/orders/${encodeURIComponent(o.order_id)}`)}
                >
                  <td className="px-3 py-2.5 border-b border-border" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/orders/${encodeURIComponent(o.order_id)}`}
                      className="font-mono text-xs text-accent hover:underline"
                    >
                      {o.order_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 border-b border-border whitespace-nowrap">
                    <ServiceBadge code={o.service_code} />
                  </td>
                  <td className="px-3 py-2.5 border-b border-border">
                    <span className="text-xs text-muted">{getLabCode(o) || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-border whitespace-nowrap">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-3 py-2.5 border-b border-border">
                    <ProgressBar value={o.progress ?? 0} />
                  </td>
                  <td className="px-3 py-2.5 border-b border-border whitespace-nowrap">
                    <span className="text-xs text-muted">{fmtDate(o.created_at)}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-border whitespace-nowrap">
                    <span className="text-xs text-muted">{fmtDate(o.updated_at)}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-border whitespace-nowrap">
                    <span className="text-xs text-muted">{fmtDate(o.completed_at)}</span>
                  </td>
                  <td className="px-3 py-2.5 border-b border-border max-w-[180px]">
                    {o.message ? (
                      <span
                        title={o.message}
                        className={cn('text-xs',
                          /fail|error/i.test(o.message) ? 'text-danger' : 'text-muted')}
                      >
                        {o.message.length > 36 ? o.message.slice(0, 33) + '…' : o.message}
                      </span>
                    ) : <span className="text-muted text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 border-b border-border">
                    <ReportFilesCell orderId={o.order_id} status={o.status} />
                  </td>
                  <td className="px-2 py-2.5 border-b border-border">
                    <ActionsMenu
                      order={o}
                      onActionDone={load}
                      onEdit={(order) => setOrderForm({ mode: 'edit', order })}
                      onFollowUp={(order) => setOrderForm({ mode: 'followUp', order })}
                    />
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

