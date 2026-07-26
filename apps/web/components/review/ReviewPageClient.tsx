'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { Accordion, Button, Card, Chip, Disclosure, Spinner, Tabs } from '@heroui/react';
import { catalogApi } from '../../lib/api/catalog';
import { reviewApi, reviewResultUrl } from '../../lib/api/review';
import { formatPortalDateTime } from '../../lib/datetime';
import { getVisibleReviewTabs, reviewOrderKind, type ReviewTabId } from '../../lib/review-tabs';
import { isSgniptReviewData, normalizeSgniptReviewData } from '../../lib/sgnipt-normalize';
import { useReviewStore } from '../../lib/store/reviewStore';
import { PageHeader } from '../ui/PageHeader';
import { VariantTable } from './VariantTable/VariantTable';
import { SgniptVariantTable } from './VariantTable/SgniptVariantTable';
import { DarkGenesPanel } from './DarkGenesPanel/DarkGenesPanel';
import { PgxReview } from './PgxReview/PgxReview';
import { CoverageViewer } from './CoverageViewer/CoverageViewer';
import { ReportBuilder } from './ReportBuilder/ReportBuilder';
import { GeneDatabase } from './GeneDatabase/GeneDatabase';
import { ArtifactHtmlModal } from './ArtifactHtmlModal';
import type { QcSummary, ReviewData, VariantStats } from '@gx-portal/types';

function ReviewLoadingState({
  orderId,
  elapsedMs,
}: {
  orderId: string;
  elapsedMs: number;
}) {
  const seconds = (elapsedMs / 1000).toFixed(1);
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
      <Spinner size="lg" color="accent" />
      <div className="text-center max-w-lg">
        <p className="text-sm font-medium">Loading review data…</p>
        <p className="mt-1.5 text-xs text-muted break-all font-mono">
          GET {reviewResultUrl(orderId)}
        </p>
        <p className="mt-1 text-xs text-muted tabular-nums">
          {seconds}s · check DevTools → Network for timing
        </p>
      </div>
    </div>
  );
}

function TabPanelSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-muted">
      <Spinner size="lg" color="accent" />
      <p className="text-sm">Loading {label}…</p>
    </div>
  );
}

const ALL_TABS: { id: ReviewTabId; label: string }[] = [
  { id: 'variants',  label: 'Variants'      },
  { id: 'darkgenes', label: 'Dark genes'    },
  { id: 'pgx',       label: 'PGx'           },
  { id: 'report',    label: 'Review Case'   },
  { id: 'genedb',    label: 'Gene database' },
  { id: 'coverage',  label: 'Coverage'      },
];

interface QcRow { metric: string; value: string; unit: string; status?: 'ok' | 'warn' | 'err' }

function qcEvalMin(val: unknown, pass: number, warn: number): 'ok' | 'warn' | 'err' | undefined {
  const n = Number(val);
  if (!Number.isFinite(n)) return undefined;
  if (n >= pass) return 'ok';
  if (n >= warn) return 'warn';
  return 'err';
}

function qcEvalMax(val: unknown, pass: number, warn: number): 'ok' | 'warn' | 'err' | undefined {
  const n = Number(val);
  if (!Number.isFinite(n)) return undefined;
  if (n <= pass) return 'ok';
  if (n <= warn) return 'warn';
  return 'err';
}

function qcEvalRange(val: unknown, lo: number, hi: number): 'ok' | 'warn' | 'err' | undefined {
  const n = Number(val);
  if (!Number.isFinite(n)) return undefined;
  if (n >= lo && n <= hi) return 'ok';
  if (n >= lo - 5 && n <= hi + 5) return 'warn';
  return 'err';
}

/** Normalize fraction (0–1) or percent (>1) to percent. */
function qcNormPct(val: unknown): number | null {
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  return n <= 1.5 ? n * 100 : n;
}

function seqRows(qc: QcSummary): QcRow[] {
  const a = qc.alignment ?? {};
  const rows: QcRow[] = [];
  if (a.total_reads     != null) rows.push({ metric: 'Total reads',           value: Number(a.total_reads).toLocaleString(),     unit: 'reads' });
  if (a.mapped_reads    != null) rows.push({ metric: 'Mapped reads',          value: Number(a.mapped_reads).toLocaleString(),    unit: 'reads' });
  if (a.mapping_rate    != null) rows.push({ metric: 'Mapping rate',          value: Number(a.mapping_rate).toFixed(2),          unit: '%', status: Number(a.mapping_rate) >= 95 ? 'ok' : 'warn' });
  if (a.properly_paired_rate != null) rows.push({ metric: 'Properly paired',  value: Number(a.properly_paired_rate).toFixed(2),  unit: '%' });
  if (a.duplicates      != null) rows.push({ metric: 'Duplicates',            value: Number(a.duplicates).toLocaleString(),      unit: 'reads' });
  if (a.insert_size_avg != null) rows.push({ metric: 'Insert size (avg)',     value: Number(a.insert_size_avg).toFixed(1),       unit: 'bp' });
  if (a.average_quality != null) rows.push({ metric: 'Avg. quality',          value: Number(a.average_quality).toFixed(1),       unit: 'Q' });
  return rows;
}

function covRows(qc: QcSummary): QcRow[] {
  const c = qc.coverage ?? {};
  const rows: QcRow[] = [];
  if (c.mean_coverage   != null) rows.push({ metric: 'Mean coverage',  value: Number(c.mean_coverage).toFixed(2), unit: '×', status: Number(c.mean_coverage) >= 30 ? 'ok' : 'warn' });
  if (c.pct_bases_20x   != null) rows.push({ metric: '≥20× bases',     value: String(c.pct_bases_20x),            unit: '%', status: Number(c.pct_bases_20x) >= 90 ? 'ok' : 'warn' });
  if (c.pct_bases_50x   != null) rows.push({ metric: '≥50× bases',     value: String(c.pct_bases_50x),            unit: '%' });
  if (c.pct_bases_100x  != null) rows.push({ metric: '≥100× bases',    value: String(c.pct_bases_100x),           unit: '%' });
  if (c.min_coverage    != null) rows.push({ metric: 'Min coverage',    value: String(c.min_coverage),             unit: '×' });
  if (c.max_coverage    != null) rows.push({ metric: 'Max coverage',    value: Number(c.max_coverage).toLocaleString(), unit: '×' });
  return rows;
}

/** Portal buildSgniptSequencingRows — from fastq_qc + bam_qc */
function sgniptSeqRows(rd: ReviewData): QcRow[] {
  const fq = (rd.fastq_qc && typeof rd.fastq_qc === 'object' ? rd.fastq_qc : {}) as Record<string, unknown>;
  const bq = (rd.bam_qc && typeof rd.bam_qc === 'object' ? rd.bam_qc : {}) as Record<string, unknown>;
  const tr = fq.total_reads ?? bq.total_reads;
  const mapRate = qcNormPct(bq.mapping_rate);
  const dupRate = qcNormPct(fq.duplication_rate ?? fq.duplicate_rate ?? bq.duplicate_rate ?? bq.duplication_rate);
  const gc = qcNormPct(fq.gc_content);
  const meanQ = bq.mean_mapping_quality ?? bq.average_quality ?? fq.average_quality;
  const meanCov = bq.mean_coverage;
  const mapped = bq.mapped_reads;
  const rows: QcRow[] = [];
  if (tr != null) {
    rows.push({
      metric: 'Total reads',
      value: Number(tr).toLocaleString(),
      unit: 'reads',
      status: qcEvalMin(tr, 1e6, 5e5),
    });
  }
  if (mapped != null) {
    const ratio = tr != null && Number(tr) > 0 ? Number(mapped) / Number(tr) : null;
    rows.push({
      metric: 'Mapped reads',
      value: Number(mapped).toLocaleString(),
      unit: 'reads',
      status: ratio != null ? qcEvalMin(ratio, 0.85, 0.75) : undefined,
    });
  }
  if (mapRate != null) {
    rows.push({
      metric: 'Mapping rate',
      value: mapRate.toFixed(2),
      unit: '%',
      status: qcEvalMin(mapRate, 85, 75),
    });
  }
  if (dupRate != null) {
    rows.push({
      metric: 'Duplication rate',
      value: dupRate.toFixed(2),
      unit: '%',
      status: qcEvalMax(dupRate, 40, 50),
    });
  }
  if (meanQ != null) {
    rows.push({
      metric: 'Mean mapping quality',
      value: Number(meanQ).toFixed(2),
      unit: 'score',
      status: qcEvalMin(meanQ, 20, 15),
    });
  }
  if (meanCov != null) {
    rows.push({
      metric: 'Mean coverage',
      value: `${Number(meanCov).toFixed(2)}`,
      unit: '×',
      status: qcEvalMin(meanCov, 0.1, 0.05),
    });
  }
  if (gc != null) {
    rows.push({
      metric: 'GC content',
      value: gc.toFixed(2),
      unit: '%',
      status: qcEvalRange(gc, 33, 55),
    });
  }
  return rows;
}

/** Portal buildSgniptAnalysisRows — from fetal_fraction_detail */
function sgniptAnalysisRows(rd: ReviewData): QcRow[] {
  const ff = (rd.fetal_fraction_detail && typeof rd.fetal_fraction_detail === 'object'
    ? rd.fetal_fraction_detail
    : {}) as Record<string, unknown>;
  const rows: QcRow[] = [];
  const addPct = (metric: string, val: unknown) => {
    if (val == null || val === '') return;
    const p = qcNormPct(val);
    const n = p != null ? p : Number(val);
    if (!Number.isFinite(n)) return;
    rows.push({
      metric,
      value: n.toFixed(2),
      unit: '%',
      status: qcEvalMin(n, 4, 3),
    });
  };
  addPct('Fetal fraction Y', ff.fetal_fraction_y ?? ff.y_chromosome_ff ?? ff.ff_y);
  addPct('Fetal fraction S', ff.fetal_fraction_s ?? ff.seq_ff ?? ff.autosomal_ff);
  if (ff.ff_ratio != null && ff.ff_ratio !== '') {
    const n = Number(ff.ff_ratio);
    if (Number.isFinite(n)) {
      rows.push({
        metric: 'FF ratio',
        value: n.toFixed(2),
        unit: '',
        status: qcEvalMax(n, 2.5, 3),
      });
    }
  }
  if (ff.sample_bias_qc != null && ff.sample_bias_qc !== '') {
    const n = Number(ff.sample_bias_qc);
    if (Number.isFinite(n)) {
      rows.push({
        metric: 'Sample bias QC',
        value: n.toFixed(3),
        unit: '',
        status: qcEvalMax(n, 4, 5),
      });
    }
  }
  if (!rows.length) {
    for (const [k, v] of Object.entries(ff)) {
      if (v == null || typeof v === 'object') continue;
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      rows.push({ metric: k, value: String(n), unit: '' });
    }
  }
  return rows;
}

function statusLabel(status?: 'ok' | 'warn' | 'err') {
  if (status === 'ok') return { text: '✓ Pass', className: 'text-success font-semibold' };
  if (status === 'warn') return { text: '⚠ Check', className: 'text-warning font-semibold' };
  if (status === 'err') return { text: '✗ Fail', className: 'text-danger font-semibold' };
  return { text: '—', className: 'text-muted' };
}

function QcTable({ rows, header }: { rows: QcRow[]; header: string }) {
  const sectionId = header.toLowerCase().replace(/\s+/g, '-');
  return (
    <Accordion defaultExpandedKeys={[sectionId]} variant="surface">
      <Accordion.Item id={sectionId}>
        <Accordion.Heading>
          <Accordion.Trigger>{header}</Accordion.Trigger>
        </Accordion.Heading>
        <Accordion.Panel>
          <Accordion.Body>
            {rows.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted">No data</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-border">
                      {['Metric', 'Value', 'Unit', 'Status'].map((h) => (
                        <th key={h} className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wide text-muted font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const st = statusLabel(r.status);
                      return (
                        <tr key={r.metric} className="border-b border-border hover:bg-accent/5">
                          <td className="px-3 py-1.5">{r.metric}</td>
                          <td className="px-3 py-1.5 font-mono">{r.value}</td>
                          <td className="px-3 py-1.5 text-muted">{r.unit}</td>
                          <td className={`px-3 py-1.5 ${st.className}`}>{st.text}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}

function QcPanel({
  seq,
  analysis,
}: {
  seq: QcRow[];
  analysis: QcRow[];
}) {
  if (seq.length === 0 && analysis.length === 0) return null;
  return (
    <Card className="mb-4 overflow-hidden">
      <Disclosure defaultExpanded>
        <Disclosure.Heading className="bg-surface">
          <Disclosure.Trigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
            <span className="text-sm font-semibold">Quality Control Results</span>
            <Disclosure.Indicator />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body className="border-t border-border p-0">
            <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <QcTable rows={seq} header="Sequencing metrics" />
              <QcTable rows={analysis} header="Analysis quality control" />
            </div>
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </Card>
  );
}

function CarrierBanner({ stats, serviceCode }: { stats: VariantStats; serviceCode: string }) {
  const plp   = stats.pathogenic_or_likely ?? 0;
  const vus   = stats.vus ?? 0;
  const total = stats.total ?? 0;

  const isCarrier = serviceCode.includes('carrier') || serviceCode.includes('whole_exome') || serviceCode.includes('health');
  if (!isCarrier) return null;

  let bannerClass = 'border-success/30 bg-success/10';
  let icon  = '✓';
  let title = 'No pathogenic variants detected';
  let detail = `${total} variants analysed — no P/LP findings`;

  if (plp > 0) {
    bannerClass = 'border-danger/30 bg-danger/10';
    icon  = '⚑';
    title = `${plp} pathogenic / likely pathogenic variant${plp > 1 ? 's' : ''} found`;
    detail = `${total} variants analysed, ${vus} VUS`;
  } else if (vus > 0) {
    bannerClass = 'border-warning/30 bg-warning/10';
    icon  = '?';
    title = `${vus} variant${vus > 1 ? 's' : ''} of uncertain significance`;
    detail = `${total} variants analysed — no P/LP, ${vus} VUS`;
  }

  return (
    <div className={`mb-3.5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${bannerClass}`}>
      <span className="text-2xl shrink-0">{icon}</span>
      <div>
        <p className="text-[15px] font-bold">{title}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
    </div>
  );
}

function SgniptBanner({ rd }: { rd: ReviewData }) {
  const sum = (rd.summary && typeof rd.summary === 'object' ? rd.summary : {}) as Record<string, unknown>;
  const va = (rd.variant_analysis_summary && typeof rd.variant_analysis_summary === 'object'
    ? rd.variant_analysis_summary
    : {}) as Record<string, unknown>;
  const ffDetail = (rd.fetal_fraction_detail && typeof rd.fetal_fraction_detail === 'object'
    ? rd.fetal_fraction_detail
    : {}) as Record<string, unknown>;
  const ffFailed = ffDetail.status === 'FAILED' || (ffDetail.primary_ff == null && ffDetail.status != null);
  const ffRaw = ffFailed ? null : (rd.fetal_fraction_used ?? ffDetail.primary_ff);
  const ff = ffRaw != null ? Number(ffRaw) : null;
  const panel = String(rd.panel || '');
  const pipelineStatus = String(rd.sgnipt_status || rd.status || '');
  const flags = Array.isArray(rd.sgnipt_status_flags)
    ? (rd.sgnipt_status_flags as unknown[]).join(', ')
    : '';

  const fetal = Number(sum.fetal_specific_variants ?? va.fetal_variants ?? 0) || 0;
  const matHet = Number(sum.maternal_heterozygous_variants ?? 0) || 0;
  const matHom = Number(sum.maternal_homozygous_variants ?? 0) || 0;
  const total = Number(
    sum.total_variants_analyzed ?? va.total_variants ?? rd.variants?.length ?? 0,
  ) || 0;

  let bannerClass = 'border-success/30 bg-success/10';
  let icon = '✓';
  let title = 'No Fetal-Specific Variants Detected';
  let detail = `Total analyzed: ${total} · Maternal het: ${matHet} · Maternal hom: ${matHom}`;

  if (pipelineStatus === 'NO_CALL' || pipelineStatus === 'FAILED') {
    bannerClass = 'border-warning/30 bg-warning/10';
    icon = '!';
    title = `${pipelineStatus}${flags ? ` — ${flags}` : ''}`;
    detail = `Insufficient data for variant calling.${total ? ` Variants analyzed: ${total}` : ''}`;
  } else if (fetal > 0) {
    bannerClass = 'border-danger/30 bg-danger/10';
    icon = '⚠';
    title = `Fetal Variant(s) Detected — ${fetal} fetal-specific`;
    detail = `Total analyzed: ${total} · Maternal het: ${matHet} · Maternal hom: ${matHom}`;
  }

  return (
    <div className={`mb-3.5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${bannerClass}`}>
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold">{title}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {ff != null && Number.isFinite(ff) ? (
          <Chip size="sm" variant="soft" color="accent">
            <Chip.Label>FF: {(ff <= 1.5 ? ff * 100 : ff).toFixed(1)}%</Chip.Label>
          </Chip>
        ) : ffFailed ? (
          <Chip size="sm" variant="soft" color="danger">
            <Chip.Label>FF: N/A</Chip.Label>
          </Chip>
        ) : null}
        {panel ? (
          <Chip size="sm" variant="soft">
            <Chip.Label>{panel}</Chip.Label>
          </Chip>
        ) : null}
        <Chip size="sm" variant="soft" color="danger">
          <Chip.Label>{fetal} Fetal</Chip.Label>
        </Chip>
        <Chip size="sm" variant="soft" color="warning">
          <Chip.Label>{matHet} MatHet</Chip.Label>
        </Chip>
        <Chip size="sm" variant="soft" color="success">
          <Chip.Label>{matHom} MatHom</Chip.Label>
        </Chip>
      </div>
    </div>
  );
}

export function ReviewPageClient({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [tab, setTab]         = useState<ReviewTabId>('variants');
  /**
   * Panels stay mounted after first open (hidden when inactive) so Coverage / Gene DB
   * don't re-fetch. First open is deferred so a Spinner can paint before heavy mount.
   */
  const [mountedTabs, setMountedTabs] = useState<Set<ReviewTabId>>(() => new Set(['variants']));
  /** Tab waiting to mount — show Spinner until deferred mount runs. */
  const [pendingTab, setPendingTab] = useState<ReviewTabId | null>(null);
  const [panelsById, setPanelsById] = useState<Record<string, { category?: string }>>({});
  const [apoeIgvPath, setApoeIgvPath] = useState<string | null>(null);
  const { setReviewDataAndSelection, reviewData, reset, patchReviewData } = useReviewStore();

  // After Spinner paints, mount the pending tab panel (avoids blank freeze on first open).
  useEffect(() => {
    if (!pendingTab) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      setMountedTabs((prev) => {
        if (prev.has(pendingTab)) return prev;
        const next = new Set(prev);
        next.add(pendingTab);
        return next;
      });
      setPendingTab(null);
    }, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [pendingTab]);

  // Client-side fetch — visible in DevTools Network as GET /api/review/:id/result
  useEffect(() => {
    const ac = new AbortController();
    const started = performance.now();
    setLoading(true);
    setError('');
    setElapsedMs(0);
    reset();
    setMountedTabs(new Set(['variants']));
    setPendingTab(null);
    setTab('variants');

    const tick = window.setInterval(() => {
      setElapsedMs(Math.round(performance.now() - started));
    }, 100);

    const url = reviewResultUrl(orderId);
    console.info(`[review] fetch start ${url}`);

    reviewApi
      .getResult(orderId, { signal: ac.signal })
      .then((data) => {
        const ms = Math.round(performance.now() - started);
        console.info(`[review] fetch ok ${url} (${ms}ms)`, {
          variants: data?.variants?.length ?? 0,
        });
        // API already slims sgNIPT; client pass is a no-op when `_sgnipt_slim` is set.
        const normalized = normalizeSgniptReviewData(data);
        const autoSelect = isSgniptReviewData(normalized as Record<string, unknown>)
          ? (normalized.variants ?? [])
              .filter((v) => {
                const s = String(v.clinvar_sig_primary || v.acmg_classification || '').toLowerCase();
                return s.includes('pathogenic');
              })
              .map((v) => v.variant_id)
          : [];
        // Defer heavy table mount so Spinner can paint; single store commit avoids double render.
        startTransition(() => {
          setReviewDataAndSelection(normalized, autoSelect);
        });
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        const ms = Math.round(performance.now() - started);
        console.warn(`[review] fetch failed ${url} (${ms}ms)`, err);
        setError(err instanceof Error ? err.message : 'Failed to load review data');
      })
      .finally(() => {
        window.clearInterval(tick);
        if (!ac.signal.aborted) {
          setElapsedMs(Math.round(performance.now() - started));
          setLoading(false);
        }
      });

    return () => {
      ac.abort();
      window.clearInterval(tick);
    };
  }, [orderId, reset, setReviewDataAndSelection]);

  useEffect(() => {
    catalogApi.getPanels()
      .then((r) => {
        const map: Record<string, { category?: string }> = {};
        for (const p of r.panels ?? []) {
          if (p?.id) map[p.id] = { category: p.category };
        }
        setPanelsById(map);
      })
      .catch(() => {});
  }, []);

  const visibleTabs = useMemo(() => {
    const ids = new Set(getVisibleReviewTabs(reviewData, panelsById));
    return ALL_TABS.filter((t) => ids.has(t.id));
  }, [reviewData, panelsById]);

  const isSgnipt = useMemo(
    () => isSgniptReviewData(reviewData as Record<string, unknown> | null)
      || reviewOrderKind(reviewData as Record<string, unknown> | null, panelsById) === 'sgnipt',
    [reviewData, panelsById],
  );

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.some((t) => t.id === tab)) {
      setTab(visibleTabs[0].id);
    }
  }, [visibleTabs, tab]);

  useEffect(() => {
    if (tab !== 'pgx' || loading) return;
    let cancelled = false;
    reviewApi
      .getResult(orderId)
      .then((data) => {
        if (cancelled || !data?.pgx) return;
        patchReviewData({ pgx: data.pgx });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tab, orderId, loading, patchReviewData]);

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Variant Review"
          description={`Order: ${orderId}`}
          backHref="/orders"
        />
        <ReviewLoadingState orderId={orderId} elapsedMs={elapsedMs} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Variant Review"
          description={`Order: ${orderId}`}
          backHref="/orders"
        />
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm text-danger">{error}</p>
          <p className="text-xs text-muted font-mono break-all">
            GET {reviewResultUrl(orderId)}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!reviewData) return null;

  const serviceCode  = String(reviewData.service_code ?? reviewData._service_code ?? reviewData.type ?? '');
  const sampleName   = String(reviewData.sample_name ?? orderId);
  const qcSummary    = reviewData.qc_summary as QcSummary | undefined;
  const variantStats = reviewData.variant_stats as VariantStats | undefined;
  const generatedAt  = reviewData.generated_at ? formatPortalDateTime(String(reviewData.generated_at), '') : '';

  const seqQc = isSgnipt ? sgniptSeqRows(reviewData) : seqRows(qcSummary ?? {});
  const analysisQc = isSgnipt ? sgniptAnalysisRows(reviewData) : covRows(qcSummary ?? {});

  return (
    <div>
      <PageHeader
        title="Variant Review"
        description={`Order: ${orderId}`}
        backHref="/orders"
      />

      <p className="mb-3 text-xs leading-relaxed text-muted">
        Sample: <strong className="text-foreground">{sampleName}</strong>
        {serviceCode && <> · Service: <strong className="text-foreground">{serviceCode.replace(/_/g, ' ')}</strong></>}
        {variantStats?.total != null && <> · <strong className="text-foreground">{variantStats.total}</strong> variants</>}
        {isSgnipt && variantStats?.fetal_specific != null && (
          <> · <strong className="text-foreground">{Number(variantStats.fetal_specific)}</strong> fetal</>
        )}
        {variantStats?.pathogenic_or_likely != null && <> · <strong className="text-danger">{variantStats.pathogenic_or_likely} P/LP</strong></>}
        {variantStats?.vus != null && <> · <strong className="text-warning">{variantStats.vus} VUS</strong></>}
        {generatedAt && <> · Generated: {generatedAt}</>}
      </p>

      {isSgnipt
        ? <SgniptBanner rd={reviewData} />
        : (variantStats && <CarrierBanner stats={variantStats} serviceCode={serviceCode} />)}

      <QcPanel seq={seqQc} analysis={analysisQc} />

      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => {
          const next = key as ReviewTabId;
          setTab(next);
          // First visit: paint Spinner before mounting heavy panels (Gene DB / Coverage / …).
          if (!mountedTabs.has(next)) {
            setPendingTab(next);
          } else {
            setPendingTab(null);
          }
        }}
        className="mb-4 review-section-tabs"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Review sections">
            {visibleTabs.map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className="relative">
                {t.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      {/*
        Defer first mount of inactive→active tabs so Spinner paints immediately.
        Once mounted, keep panels alive (hidden) to avoid refetch on switch.
      */}
      {visibleTabs.map((t) => {
        const active = tab === t.id;
        const mounted = mountedTabs.has(t.id);
        const waiting = active && pendingTab === t.id && !mounted;
        if (!mounted && !waiting) return null;
        return (
          <div
            key={t.id}
            className={active ? 'min-h-[400px] pt-4' : 'hidden'}
            aria-hidden={!active}
          >
            {waiting ? (
              <TabPanelSpinner label={t.label} />
            ) : (
              <>
                {t.id === 'variants' && (
                  isSgnipt
                    ? <SgniptVariantTable orderId={orderId} />
                    : <VariantTable orderId={orderId} />
                )}
                {t.id === 'darkgenes' && (
                  <DarkGenesPanel
                    orderId={orderId}
                    onJumpCoverage={() => {
                      setTab('coverage');
                      if (!mountedTabs.has('coverage')) setPendingTab('coverage');
                    }}
                  />
                )}
                {t.id === 'pgx' && (
                  <PgxReview
                    orderId={orderId}
                    onOpenApoeIgv={(rel) => setApoeIgvPath(rel)}
                  />
                )}
                {t.id === 'report' && <ReportBuilder orderId={orderId} />}
                {t.id === 'genedb' && <GeneDatabase orderId={orderId} />}
                {t.id === 'coverage' && <CoverageViewer orderId={orderId} />}
              </>
            )}
          </div>
        );
      })}

      <ArtifactHtmlModal
        open={!!apoeIgvPath}
        orderId={orderId}
        relPath={apoeIgvPath}
        title="APOE cis/trans IGV"
        help="IGV phasing view for APOE tag SNPs."
        onClose={() => setApoeIgvPath(null)}
      />
    </div>
  );
}
