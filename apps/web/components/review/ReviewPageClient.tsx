'use client';

import { useEffect, useState } from 'react';
import { reviewApi } from '../../lib/api/review';
import { formatPortalDateTime } from '../../lib/datetime';
import { useReviewStore } from '../../lib/store/reviewStore';
import { PageHeader } from '../ui/PageHeader';
import { VariantTable } from './VariantTable/VariantTable';
import { DarkGenesPanel } from './DarkGenesPanel/DarkGenesPanel';
import { PgxReview } from './PgxReview/PgxReview';
import { CoverageViewer } from './CoverageViewer/CoverageViewer';
import { ReportBuilder } from './ReportBuilder/ReportBuilder';
import { GeneDatabase } from './GeneDatabase/GeneDatabase';
import type { QcSummary, VariantStats } from '@gx-portal/types';
import styles from './Review.module.css';

type ReviewTab = 'variants' | 'darkgenes' | 'pgx' | 'report' | 'genedb' | 'coverage';

const TABS: { id: ReviewTab; label: string }[] = [
  { id: 'variants',  label: 'Variants'      },
  { id: 'darkgenes', label: 'Dark genes'    },
  { id: 'pgx',       label: 'PGx'           },
  { id: 'report',    label: 'Review Case'   },
  { id: 'genedb',    label: 'Gene database' },
  { id: 'coverage',  label: 'Coverage'      },
];

// ─── QC panel ────────────────────────────────────────────────────────────────

interface QcRow { metric: string; value: string; unit: string; status?: 'ok' | 'warn' | 'err' }

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

function statusClass(status?: 'ok' | 'warn' | 'err') {
  if (status === 'ok')   return styles.qcStatusOk;
  if (status === 'warn') return styles.qcStatusWarn;
  if (status === 'err')  return styles.qcStatusErr;
  return '';
}

function QcTable({ rows, header }: { rows: QcRow[]; header: string }) {
  return (
    <details className={styles.qcSection} open>
      <summary>{header}</summary>
      {rows.length === 0
        ? <p style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No data</p>
        : (
          <div className={styles.qcTableWrap}>
            <table className={styles.qcTable}>
              <thead><tr><th>Metric</th><th>Value</th><th>Unit</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.metric}>
                    <td>{r.metric}</td>
                    <td className={styles.mono ?? ''}>{r.value}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.unit}</td>
                    <td className={statusClass(r.status)}>
                      {r.status === 'ok' ? '✓ Pass' : r.status === 'warn' ? '⚠ Check' : r.status === 'err' ? '✗ Fail' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </details>
  );
}

function QcPanel({ qc }: { qc: QcSummary }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={styles.qcPanel}>
      <h3 className={styles.qcTitle} onClick={() => setOpen((o) => !o)}>
        Quality Control Results
        <span style={{ fontSize: 12, fontWeight: 400 }}>{open ? '▲ collapse' : '▼ expand'}</span>
      </h3>
      {open && (
        <div className={styles.qcGrid}>
          <QcTable rows={seqRows(qc)} header="Sequencing metrics" />
          <QcTable rows={covRows(qc)} header="Analysis quality control" />
        </div>
      )}
    </div>
  );
}

// ─── carrier banner ──────────────────────────────────────────────────────────

function CarrierBanner({ stats, serviceCode }: { stats: VariantStats; serviceCode: string }) {
  const plp   = stats.pathogenic_or_likely ?? 0;
  const vus   = stats.vus ?? 0;
  const total = stats.total ?? 0;

  const isCarrier = serviceCode.includes('carrier') || serviceCode.includes('whole_exome') || serviceCode.includes('health');
  if (!isCarrier) return null;

  let cls   = styles.bannerNegative;
  let icon  = '✓';
  let title = 'No pathogenic variants detected';
  let detail = `${total} variants analysed — no P/LP findings`;

  if (plp > 0) {
    cls   = styles.bannerPositive;
    icon  = '⚑';
    title = `${plp} pathogenic / likely pathogenic variant${plp > 1 ? 's' : ''} found`;
    detail = `${total} variants analysed, ${vus} VUS`;
  } else if (vus > 0) {
    cls   = styles.bannerUncertain;
    icon  = '?';
    title = `${vus} variant${vus > 1 ? 's' : ''} of uncertain significance`;
    detail = `${total} variants analysed — no P/LP, ${vus} VUS`;
  }

  return (
    <div className={`${styles.carrierBanner} ${cls}`}>
      <span className={styles.bannerIcon}>{icon}</span>
      <div>
        <p className={styles.bannerText}>{title}</p>
        <p className={styles.bannerDetail}>{detail}</p>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function ReviewPageClient({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [tab, setTab]         = useState<ReviewTab>('variants');
  const { setReviewData, reviewData, reset } = useReviewStore();

  useEffect(() => {
    reset();
    reviewApi.getResult(orderId)
      .then(setReviewData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load review data'))
      .finally(() => setLoading(false));
  }, [orderId, reset, setReviewData]);

  if (loading) return <p className={styles.center}>Loading review data…</p>;
  if (error)   return <p style={{ textAlign: 'center', padding: 48, color: 'var(--text-danger)' }}>{error}</p>;
  if (!reviewData) return null;

  const serviceCode  = String(reviewData.service_code ?? reviewData._service_code ?? reviewData.type ?? '');
  const sampleName   = String(reviewData.sample_name ?? orderId);
  const qcSummary    = reviewData.qc_summary as QcSummary | undefined;
  const variantStats = reviewData.variant_stats as VariantStats | undefined;
  const generatedAt  = reviewData.generated_at ? formatPortalDateTime(String(reviewData.generated_at), '') : '';

  return (
    <div>
      <PageHeader
        title="Variant Review"
        description={`Order: ${orderId}`}
        backHref="/orders"
      />

      {/* result meta */}
      <p className={styles.resultMeta}>
        Sample: <strong>{sampleName}</strong>
        {serviceCode && <> · Service: <strong>{serviceCode.replace(/_/g, ' ')}</strong></>}
        {variantStats?.total != null && <> · <strong>{variantStats.total}</strong> variants</>}
        {variantStats?.pathogenic_or_likely != null && <> · <strong style={{ color: 'var(--text-danger)' }}>{variantStats.pathogenic_or_likely} P/LP</strong></>}
        {variantStats?.vus != null && <> · <strong style={{ color: 'var(--text-warning, #d97706)' }}>{variantStats.vus} VUS</strong></>}
        {generatedAt && <> · Generated: {generatedAt}</>}
      </p>

      {/* carrier banner */}
      {variantStats && <CarrierBanner stats={variantStats} serviceCode={serviceCode} />}

      {/* QC panel */}
      {qcSummary && <QcPanel qc={qcSummary} />}

      {/* sub-tabs */}
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${tab === t.id ? styles.active : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.panel}>
        {tab === 'variants'  && <VariantTable  orderId={orderId} />}
        {tab === 'darkgenes' && <DarkGenesPanel />}
        {tab === 'pgx'       && <PgxReview orderId={orderId} />}
        {tab === 'report'    && <ReportBuilder orderId={orderId} />}
        {tab === 'genedb'    && <GeneDatabase />}
        {tab === 'coverage'  && <CoverageViewer orderId={orderId} />}
      </div>
    </div>
  );
}
