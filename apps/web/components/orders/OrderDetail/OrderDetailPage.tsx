'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ReportDownloadLink } from '../ReportDownloadLink';
import { reportLangLabel } from '../../../lib/report-downloads';
import { ordersApi } from '../../../lib/api/orders';
import { ApiError } from '../../../lib/api/client';
import { PageHeader } from '../../ui/PageHeader';
import { Button } from '../../ui/Button';
import { OrderStatusBadge } from '../../ui/Badge';
import type { Order } from '@gx-portal/types';
import { cn } from '../../../lib/utils';
import {
  formatPortalDate,
  formatPortalDateTimeDetail,
} from '../../../lib/datetime';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OutputFile { name: string; size: number; mtime_ms: number; type: string }

type P = Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDt(iso?: string | null) {
  return formatPortalDateTimeDetail(iso);
}

function fmtDate(val?: string | null) {
  return formatPortalDate(val);
}

function strVal(v: unknown, isDate = false): string {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.join(', ');
  if (isDate) return fmtDate(String(v));
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

function pathSplit(fp?: string | null): { dir: string; base: string } {
  if (!fp) return { dir: '', base: '' };
  const s = fp.trim();
  const idx = s.lastIndexOf('/');
  return idx >= 0 ? { dir: s.slice(0, idx + 1), base: s.slice(idx + 1) } : { dir: '', base: s };
}

const CARRIER_SERVICES = ['carrier_screening', 'whole_exome', 'health_screening', 'health_snp', 'wes_panel'];
const SGNIPT_SERVICES  = ['sgnipt'];

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Section({ title, children, className }: {
  title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('bg-gx-surface border border-gx-border rounded-gx p-4', className)}>
      <h4 className="text-[11px] font-bold uppercase tracking-widest text-gx-muted mb-3">{title}</h4>
      {children}
    </div>
  );
}

function KvGrid({ children, full }: { children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn(
      'grid gap-x-4 gap-y-2.5',
      full ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
    )}>
      {children}
    </div>
  );
}

function KvItem({ label, value, mono, danger, full, multiline }: {
  label: string; value?: string | React.ReactNode;
  mono?: boolean; danger?: boolean; full?: boolean; multiline?: boolean;
}) {
  return (
    <div className={cn('min-w-0', full && 'col-span-full')}>
      <p className="text-[11px] text-gx-muted uppercase tracking-wider mb-0.5">{label}</p>
      {multiline ? (
        <pre className="text-xs text-gx-text font-sans whitespace-pre-wrap break-words">{value ?? '—'}</pre>
      ) : (
        <p className={cn(
          'text-xs break-all',
          mono && 'font-mono',
          danger ? 'text-gx-danger' : 'text-gx-text',
        )}>
          {value ?? '—'}
        </p>
      )}
    </div>
  );
}

function PathItem({ label, path }: { label: string; path?: string | null }) {
  const { dir, base } = pathSplit(path);
  return (
    <div className="col-span-full min-w-0">
      <p className="text-[11px] text-gx-muted uppercase tracking-wider mb-0.5">{label}</p>
      {path ? (
        <p className="text-xs font-mono break-all">
          <span className="text-gx-muted">{dir}</span>
          <span className="text-gx-text font-semibold">{base}</span>
        </p>
      ) : (
        <p className="text-xs text-gx-muted">—</p>
      )}
    </div>
  );
}

// ─── Report Files Section ─────────────────────────────────────────────────────

function ReportFilesSection({ orderId, status }: { orderId: string; status: string }) {
  const [files, setFiles] = useState<OutputFile[] | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (!['COMPLETED', 'REPORT_READY'].includes(status)) return;
    if (fetched.current) return;
    fetched.current = true;
    ordersApi.getFiles(orderId)
      .then(r => setFiles(r.files ?? []))
      .catch(() => setFiles([]));
  }, [orderId, status]);

  if (!['COMPLETED', 'REPORT_READY'].includes(status)) return null;
  if (!files) return (
    <Section title="Report Files">
      <p className="text-xs text-gx-muted">Loading…</p>
    </Section>
  );

  const reportFiles = files.filter(f => /^Report_.*\.(pdf|html)$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (reportFiles.length === 0) return (
    <Section title="Report Files">
      <p className="text-xs text-gx-muted">
        No <code>Report_*</code> files yet. Open <strong>Review → Report</strong>, select languages, then <strong>Generate Report</strong>.
      </p>
    </Section>
  );

  return (
    <Section title="Report Files">
      <p className="text-[11px] text-gx-muted mb-3">
        One PDF/HTML per language: <code>Report_&#123;order&#125;_&#123;patient&#125;_&#123;LANG&#125;.ext</code>.
        Generate in <strong>Review → Report</strong> with language checkboxes.
      </p>
      <div className="flex flex-wrap gap-2">
        {reportFiles.map(f => {
          const isPdf = /\.pdf$/i.test(f.name);
          const lang = reportLangLabel(f.name);
          const label = `${isPdf ? 'PDF' : 'HTML'} ${lang}`;
          return (
            <ReportDownloadLink
              key={f.name}
              orderId={orderId}
              filename={f.name}
              label={label}
              kind={isPdf ? 'pdf' : 'html'}
              size="md"
              showFilename
            />
          );
        })}
      </div>
    </Section>
  );
}

// ─── Carrier / WES clinical sections ─────────────────────────────────────────

const CARRIER_LABELS: Record<string, { label: string; date?: boolean; full?: boolean; multi?: boolean }> = {
  test_category:               { label: 'Test Category' },
  other_test_type:             { label: 'Other Test Type' },
  package_code:                { label: 'Package Code (Test Type)' },
  report_mode:                 { label: 'Report Mode' },
  partner_order_id:            { label: 'Partner Order ID (Couples)' },
  prior_order_id:              { label: 'Prior Order (Follow-up)' },
  reuse_prior_pipeline_outputs:{ label: 'Reuse Prior Pipeline' },
  patient_name:                { label: 'Patient Name', full: true },
  patient_birth:               { label: 'Patient Birth', date: true },
  patient_gender:              { label: 'Patient Gender' },
  patient2_name:               { label: 'Patient 2 Name', full: true },
  patient2_birth:              { label: 'Patient 2 Birth', date: true },
  patient2_gender:             { label: 'Patient 2 Gender' },
  patient2_affected:           { label: 'Affected 2' },
  patient3_name:               { label: 'Patient 3 Name', full: true },
  patient3_birth:              { label: 'Patient 3 Birth', date: true },
  patient3_gender:             { label: 'Patient 3 Gender' },
  patient3_affected:           { label: 'Affected 3' },
  hospital_name:               { label: 'Hospital Name', full: true },
  doctor:                      { label: 'Doctor' },
  medical_record_id:           { label: 'Medical Record ID' },
  sample_id:                   { label: 'Sample ID' },
  affected:                    { label: 'Affected' },
  clinical_information:        { label: 'Clinical Information', full: true, multi: true },
  sample_collection_date:      { label: 'Sample Collection Date', date: true },
  receipt_date:                { label: 'Receipt Date', date: true },
  report_language:             { label: 'Report Language' },
  report_type:                 { label: 'Report Type' },
  sample_specimen_type:        { label: 'Sample Specimen Type' },
  sample_barcode:              { label: 'Sample Barcode' },
};

function carrierVal(c: P, k: string): string {
  const v = c[k];
  const meta = CARRIER_LABELS[k];
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (meta?.date) return fmtDate(String(v));
  if (k === 'test_category' && v === 'standard_carrier') return 'Carrier Screening (standard)';
  return strVal(v);
}

function CarrierKvRows({ c, keys }: { c: P; keys: string[] }) {
  return (
    <>
      {keys.map(k => {
        const meta = CARRIER_LABELS[k] ?? { label: k };
        return (
          <KvItem
            key={k}
            label={meta.label}
            value={carrierVal(c, k)}
            full={meta.full}
            multiline={meta.multi}
          />
        );
      })}
    </>
  );
}

// ─── sgNIPT clinical sections ─────────────────────────────────────────────────

const NIPT_LABELS: Record<string, { label: string; date?: boolean }> = {
  previous_order_id:         { label: 'Previous Order ID' },
  patient_name:              { label: 'Patient Name' },
  patient_birth:             { label: 'Patient Birth', date: true },
  patient_gender:            { label: 'Patient Gender' },
  gestational_age_weeks:     { label: 'Gestational Age (weeks)' },
  gestational_age_days:      { label: 'Gestational Age (days)' },
  height_cm:                 { label: 'Height (cm)' },
  weight_kg:                 { label: 'Weight (kg)' },
  pregnancy_type:            { label: 'Pregnancy Type' },
  estimated_delivery_date:   { label: 'Estimated Delivery Date', date: true },
  hospital_name:             { label: 'Hospital Name' },
  doctor:                    { label: 'Doctor' },
  medical_record_id:         { label: 'Medical Record ID' },
  sample_id:                 { label: 'Sample ID' },
  indication_for_testing:    { label: 'Indication for Testing' },
  sample_collection_date:    { label: 'Sample Collection Date', date: true },
  receipt_date:              { label: 'Receipt Date', date: true },
  package_code:              { label: 'Package Code' },
  report_language:           { label: 'Report Language' },
  report_type:               { label: 'Report Type' },
  sample_specimen_type:      { label: 'Sample Specimen Type' },
  measurement_method:        { label: 'Measurement Method' },
  sample_barcode:            { label: 'Sample Barcode' },
  category:                  { label: 'Category' },
  nipt_kit_id:               { label: 'NIPT Kit ID' },
  sequencing_batch_id:       { label: 'Sequencing Batch ID' },
  control_sample:            { label: 'Control Sample' },
  trf_consent:               { label: 'TRF Consent' },
  show_fetal_gender:         { label: 'Show Fetal Gender' },
  resample:                  { label: 'Resample' },
};

function niptVal(n: P, k: string): string {
  const v = n[k];
  const meta = NIPT_LABELS[k];
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (meta?.date) return fmtDate(String(v));
  return strVal(v);
}

function NiptKvRows({ n, keys }: { n: P; keys: string[] }) {
  return (
    <>
      {keys.map(k => {
        const meta = NIPT_LABELS[k] ?? { label: k };
        return <KvItem key={k} label={meta.label} value={niptVal(n, k)} />;
      })}
    </>
  );
}

// ─── Pipeline Log ─────────────────────────────────────────────────────────────

function PipelineLogPanel({ orderId, status }: { orderId: string; status: string }) {
  const [open, setOpen]   = useState(false);
  const [log, setLog]     = useState('');
  const [loading, setLoading] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const copyHintTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const activeForPoll = ['QUEUED', 'RUNNING', 'RECEIVED', 'DOWNLOADING', 'PROCESSING', 'UPLOADING'];

  const showCopyHint = useCallback((text: string) => {
    setCopyHint(`✔ Copied ${text.length} chars`);
    if (copyHintTimerRef.current) clearTimeout(copyHintTimerRef.current);
    copyHintTimerRef.current = setTimeout(() => setCopyHint(null), 1400);
  }, []);

  const handleLogMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString();
    if (!text) return;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showCopyHint(text))
        .catch(() => {
          try {
            document.execCommand('copy');
            showCopyHint(text);
          } catch { /* ignore */ }
        });
      return;
    }
    try {
      document.execCommand('copy');
      showCopyHint(text);
    } catch { /* ignore */ }
  }, [showCopyHint]);

  useEffect(() => () => {
    if (copyHintTimerRef.current) clearTimeout(copyHintTimerRef.current);
  }, []);

  const fetchLog = useCallback(async () => {
    try {
      const text = await ordersApi.getLog(orderId);
      setLog(text || '(empty)');
      if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to load log';
      setLog(msg.includes('not found') || msg.includes('404')
        ? `${msg}\n\nPipeline may still be starting — try Refresh in a few seconds.`
        : msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!open) {
      clearInterval(intervalRef.current);
      return;
    }
    setLoading(true);
    fetchLog();
    if (activeForPoll.includes(status)) {
      intervalRef.current = setInterval(fetchLog, 4000);
    }
    return () => clearInterval(intervalRef.current);
  }, [open, fetchLog, status]);

  return (
    <>
    <div className="border border-gx-border rounded-gx overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gx-elevated">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
        >
          <span className="text-xs font-semibold text-gx-text-2 uppercase tracking-wide">
            Pipeline Log (nextflow.log)
          </span>
          <span className="block text-[10px] font-normal normal-case text-gx-muted mt-0.5">
            Timestamps in the log file are written by Nextflow as-is (not converted by Portal).
          </span>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {open && (
            <button
              type="button"
              className="text-[11px] font-normal leading-none text-gx-muted hover:text-gx-accent hover:underline p-0 bg-transparent border-0"
              onClick={() => { setLoading(true); void fetchLog(); }}
            >
              Refresh
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="text-[11px] font-normal leading-none text-gx-muted hover:opacity-80 p-0 bg-transparent border-0"
          >
            {open ? '▲ collapse' : '▼ expand'}
          </button>
        </div>
      </div>
      {open && (
        <div className="bg-[#0a0c12] border-t border-gx-border">
          {loading ? (
            <p className="text-xs text-gx-muted px-4 py-3">Loading log…</p>
          ) : (
            <pre
              ref={preRef}
              onMouseUp={handleLogMouseUp}
              className="text-[11px] leading-[1.45] text-green-400 font-mono p-4 overflow-auto whitespace-pre-wrap max-h-[calc(11px*1.45*30)] select-text"
            >
              {log || '(empty)'}
            </pre>
          )}
        </div>
      )}
    </div>
    {copyHint && (
      <div
        className="fixed bottom-[68px] right-6 z-[9999] rounded-md bg-gx-success text-white text-xs px-3 py-1.5 pointer-events-none shadow-gx-md transition-opacity"
        role="status"
        aria-live="polite"
      >
        {copyHint}
      </div>
    )}
    </>
  );
}

// ─── Action Bar ───────────────────────────────────────────────────────────────

function ActionBar({ order, onDone }: { order: Order; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (!confirm(`"${label}" 실행하시겠습니까?`)) return;
    setBusy(true);
    try { await fn(); await onDone(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const canStart  = ['SAVED', 'FAILED', 'CANCELLED'].includes(order.status);
  const canStop   = ['RUNNING', 'QUEUED'].includes(order.status);
  const canReview = ['COMPLETED', 'REPORT_READY'].includes(order.status);

  return (
    <div className="flex flex-wrap gap-2 items-center mb-5 p-3 bg-gx-surface border border-gx-border rounded-gx">
      <span className="text-[11px] text-gx-muted flex-1 min-w-[200px]">
        Click a row to open detail. Use buttons to control the pipeline.
      </span>
      {canReview && (
        <Button variant="primary" size="sm" onClick={() => router.push(`/review/${order.order_id}`)}>
          Open Review
        </Button>
      )}
      {canStart && (<>
        <Button variant="primary" size="sm" loading={busy}
          onClick={() => run('Start', () => ordersApi.start(order.order_id))}>
          ▶ Start
        </Button>
        <Button variant="secondary" size="sm" loading={busy}
          onClick={() => run('Force Run', () => ordersApi.start(order.order_id))}>
          ▶ Force Run
        </Button>
        <Button variant="secondary" size="sm" loading={busy}
          onClick={() => run('Force Run (Fresh)', () => ordersApi.start(order.order_id, { fresh: true }))}>
          ▶ Force Run (Fresh)
        </Button>
      </>)}
      {canStop && (
        <Button variant="danger" size="sm" loading={busy}
          onClick={() => run('Stop', () => ordersApi.stop(order.order_id))}>
          ■ Stop
        </Button>
      )}
      <Button variant="ghost" size="sm" loading={busy}
        onClick={() => run('Reprocess only', () => ordersApi.reprocess(order.order_id))}>
        ↺ Reprocess only
      </Button>
      <Button variant="ghost" size="sm" loading={busy}
        onClick={() => run('Delete', () => ordersApi.deleteRun(order.order_id))}>
        ✕ Delete
      </Button>
      <Button variant="danger" size="sm" loading={busy}
        onClick={() => run('Purge DB', () => ordersApi.purgeDb(order.order_id))}>
        ⊗ Purge
      </Button>
    </div>
  );
}

// ─── Clinical Sections (Carrier / WES / Health) ───────────────────────────────

function CarrierSections({ params }: { params: P }) {
  const c: P = (params.carrier && typeof params.carrier === 'object')
    ? (params.carrier as P) : {};

  const keysTest  = ['test_category', 'other_test_type', 'package_code', 'report_mode', 'partner_order_id', 'prior_order_id', 'reuse_prior_pipeline_outputs'];
  const keysP1    = ['patient_name', 'patient_birth', 'patient_gender'];
  const keysP2    = ['patient2_name', 'patient2_birth', 'patient2_gender', 'patient2_affected'];
  const keysP3    = ['patient3_name', 'patient3_birth', 'patient3_gender', 'patient3_affected'];
  const keysHosp  = ['hospital_name', 'doctor', 'medical_record_id', 'sample_id', 'affected', 'clinical_information'];
  const keysSamp  = ['sample_collection_date', 'receipt_date', 'report_language', 'report_type', 'sample_specimen_type', 'sample_barcode'];

  const hasP2 = keysP2.some(k => c[k]);
  const hasP3 = keysP3.some(k => c[k]);

  // Pipeline extras (everything except 'carrier' key)
  const pipeEntries = Object.entries(params).filter(([k]) => k !== 'carrier' && !k.startsWith('_'));

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <Section title="Test Type & Report Pairing">
            <KvGrid><CarrierKvRows c={c} keys={keysTest} /></KvGrid>
          </Section>
          <Section title="Patient">
            <KvGrid><CarrierKvRows c={c} keys={keysP1} /></KvGrid>
          </Section>
          {hasP2 && (
            <Section title="Patient 2">
              <KvGrid><CarrierKvRows c={c} keys={keysP2} /></KvGrid>
            </Section>
          )}
          {hasP3 && (
            <Section title="Patient 3">
              <KvGrid><CarrierKvRows c={c} keys={keysP3} /></KvGrid>
            </Section>
          )}
        </div>
        {/* Right column */}
        <div className="flex flex-col gap-4">
          <Section title="Hospital and Identifiers">
            <KvGrid><CarrierKvRows c={c} keys={keysHosp} /></KvGrid>
          </Section>
          <Section title="Sample and Report Details">
            <KvGrid><CarrierKvRows c={c} keys={keysSamp} /></KvGrid>
          </Section>
        </div>
      </div>
      {pipeEntries.length > 0 && (
        <Section title="Pipeline / Other Parameters">
          <KvGrid full>
            {pipeEntries.map(([k, v]) => (
              <KvItem key={k} label={k} value={strVal(v)}
                mono={typeof v === 'string' && v.length > 60}
                full={typeof v === 'object' || String(v).length > 80}
              />
            ))}
          </KvGrid>
        </Section>
      )}
    </>
  );
}

// ─── Clinical Sections (sgNIPT) ───────────────────────────────────────────────

function NiptSections({ params }: { params: P }) {
  const n: P = (params.nipt && typeof params.nipt === 'object')
    ? (params.nipt as P) : {};

  const keysPatient  = ['previous_order_id', 'patient_name', 'patient_birth', 'patient_gender', 'gestational_age_weeks', 'gestational_age_days', 'height_cm', 'weight_kg', 'pregnancy_type', 'estimated_delivery_date'];
  const keysHospital = ['hospital_name', 'doctor', 'medical_record_id', 'sample_id', 'indication_for_testing'];
  const keysSample   = ['sample_collection_date', 'receipt_date', 'package_code', 'report_language', 'report_type', 'sample_specimen_type', 'measurement_method', 'sample_barcode', 'category', 'nipt_kit_id', 'sequencing_batch_id', 'control_sample', 'trf_consent', 'show_fetal_gender', 'resample'];

  const pipeEntries = Object.entries(params).filter(([k]) => k !== 'nipt' && !k.startsWith('_'));

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <Section title="Patient and Pregnancy Information">
            <KvGrid><NiptKvRows n={n} keys={keysPatient} /></KvGrid>
          </Section>
          <Section title="Hospital and Identifier Information">
            <KvGrid><NiptKvRows n={n} keys={keysHospital} /></KvGrid>
          </Section>
        </div>
        <Section title="Sample and Test Details">
          <KvGrid><NiptKvRows n={n} keys={keysSample} /></KvGrid>
        </Section>
      </div>
      {pipeEntries.length > 0 && (
        <Section title="Pipeline / Other Parameters">
          <KvGrid full>
            {pipeEntries.map(([k, v]) => (
              <KvItem key={k} label={k} value={strVal(v)}
                full={typeof v === 'object' || String(v).length > 80}
              />
            ))}
          </KvGrid>
        </Section>
      )}
    </>
  );
}

// ─── Generic params section ───────────────────────────────────────────────────

function GenericParamsSection({ params }: { params: P }) {
  const entries = Object.entries(params).filter(([k]) => !k.startsWith('_'));
  if (!entries.length) return null;
  return (
    <Section title="Service Parameters">
      <KvGrid full>
        {entries.map(([k, v]) => (
          <KvItem key={k} label={k} value={strVal(v)}
            full={typeof v === 'object' || String(v).length > 80}
            multiline={typeof v === 'object'}
          />
        ))}
      </KvGrid>
    </Section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function OrderDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const [order, setOrder]   = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrder(await ordersApi.getById(id));
    } catch (e) {
      setOrder(null);
      setError(e instanceof Error ? e.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="p-8 text-gx-muted text-sm">Loading…</p>;
  if (error) {
    return (
      <div className="p-8">
        <PageHeader title="Order Detail" backHref="/orders" />
        <p className="text-gx-danger text-sm mb-4">{error}</p>
        <Button variant="secondary" size="sm" onClick={() => router.push('/orders')}>
          Back to Orders
        </Button>
      </div>
    );
  }
  if (!order) return null;

  const params = (order.params && typeof order.params === 'object') ? order.params as P : {};
  const pipelineCmd = String(params._pipeline_command ?? '');
  const errorMsg = order.error_log || order.error_message || '';

  const isCarrier = CARRIER_SERVICES.includes(order.service_code);
  const isSgnipt  = SGNIPT_SERVICES.includes(order.service_code);

  return (
    <div>
      <PageHeader title="Order Detail" backHref="/orders" />

      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <code className="text-base font-bold text-gx-text font-mono">{order.order_id}</code>
          {(order.description || order.legacy_order_id) && (
            <p className="text-sm text-gx-muted mt-1">
              Description:{' '}
              <code className="font-mono text-gx-text-2">{order.description ?? order.legacy_order_id}</code>
            </p>
          )}
          <p className="text-sm text-gx-muted mt-0.5">{order.service_code}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Action bar */}
      <ActionBar order={order} onDone={load} />

      {/* All sections stacked */}
      <div className="flex flex-col gap-4">

        {/* 1. Report Files — top position when available */}
        <ReportFilesSection orderId={order.order_id} status={order.status} />

        {/* 2. Order Logistics & Pipeline */}
        <Section title="Order Logistics & Pipeline">
          <KvGrid>
            <KvItem label="Order ID"     value={order.order_id} mono />
            {(order.description || order.legacy_order_id) && (
              <KvItem label="Description" value={order.description ?? order.legacy_order_id} mono full />
            )}
            <KvItem label="Service"      value={order.service_code} />
            <KvItem label="Work Directory" value={order.work_dir || '—'} mono />
            <KvItem label="Status"       value={<OrderStatusBadge status={order.status} />} />
            <KvItem label="Progress"     value={`${order.progress ?? 0}%`} />
            <KvItem label="Message"      value={order.message || '—'} />
            {errorMsg && <KvItem label="Error" value={errorMsg} danger full />}
            <KvItem label="Created"      value={fmtDt(order.created_at)} />
            <KvItem label="Started"      value={fmtDt(order.started_at)} />
            <KvItem label="Last Updated" value={fmtDt(order.updated_at)} />
            <KvItem label="Completed"    value={fmtDt(order.completed_at)} />
            {order.pid != null && <KvItem label="PID" value={String(order.pid)} mono />}
          </KvGrid>

          {/* FASTQ paths */}
          <div className="mt-3 pt-3 border-t border-gx-border">
            <div className="grid grid-cols-1 gap-2">
              <PathItem label="R1 FASTQ" path={order.fastq_r1_path} />
              <PathItem label="R2 FASTQ" path={order.fastq_r2_path} />
            </div>
          </div>
        </Section>

        {/* 3. Pipeline command (if present) */}
        {pipelineCmd && (
          <Section title="Pipeline Command">
            <pre className="text-[11px] font-mono text-gx-text-2 whitespace-pre-wrap break-all bg-gx-elevated rounded-gx-sm p-3">
              {pipelineCmd}
            </pre>
          </Section>
        )}

        {/* 4. Service-specific clinical sections */}
        {isCarrier && <CarrierSections params={params} />}
        {isSgnipt  && <NiptSections params={params} />}
        {!isCarrier && !isSgnipt && <GenericParamsSection params={params} />}

        {/* 5. Pipeline log (collapsible) */}
        <PipelineLogPanel orderId={order.order_id} status={order.status} />

      </div>
    </div>
  );
}
