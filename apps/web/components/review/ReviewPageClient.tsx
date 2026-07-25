'use client';

import { useEffect, useMemo, useState } from 'react';
import { Accordion, Card, Disclosure, Tabs } from '@heroui/react';
import { catalogApi } from '../../lib/api/catalog';
import { reviewApi } from '../../lib/api/review';
import { formatPortalDateTime } from '../../lib/datetime';
import { getVisibleReviewTabs, type ReviewTabId } from '../../lib/review-tabs';
import { useReviewStore } from '../../lib/store/reviewStore';
import { PageHeader } from '../ui/PageHeader';
import { VariantTable } from './VariantTable/VariantTable';
import { DarkGenesPanel } from './DarkGenesPanel/DarkGenesPanel';
import { PgxReview } from './PgxReview/PgxReview';
import { CoverageViewer } from './CoverageViewer/CoverageViewer';
import { ReportBuilder } from './ReportBuilder/ReportBuilder';
import { GeneDatabase } from './GeneDatabase/GeneDatabase';
import { ArtifactHtmlModal } from './ArtifactHtmlModal';
import type { QcSummary, VariantStats } from '@gx-portal/types';

const ALL_TABS: { id: ReviewTabId; label: string }[] = [
  { id: 'variants',  label: 'Variants'      },
  { id: 'darkgenes', label: 'Dark genes'    },
  { id: 'pgx',       label: 'PGx'           },
  { id: 'report',    label: 'Review Case'   },
  { id: 'genedb',    label: 'Gene database' },
  { id: 'coverage',  label: 'Coverage'      },
];

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

function QcPanel({ qc }: { qc: QcSummary }) {
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
              <QcTable rows={seqRows(qc)} header="Sequencing metrics" />
              <QcTable rows={covRows(qc)} header="Analysis quality control" />
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

export function ReviewPageClient({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [tab, setTab]         = useState<ReviewTabId>('variants');
  const [panelsById, setPanelsById] = useState<Record<string, { category?: string }>>({});
  const [apoeIgvPath, setApoeIgvPath] = useState<string | null>(null);
  const { setReviewData, reviewData, reset, patchReviewData } = useReviewStore();

  useEffect(() => {
    reset();
    reviewApi.getResult(orderId)
      .then(setReviewData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load review data'))
      .finally(() => setLoading(false));
  }, [orderId, reset, setReviewData]);

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

  // If the active tab is hidden for this kind, jump to the first visible one.
  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.some((t) => t.id === tab)) {
      setTab(visibleTabs[0].id);
    }
  }, [visibleTabs, tab]);

  // Soft-refresh PGx when focusing the PGx tab (parity with Portal).
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

  if (loading) return <p className="py-12 text-center text-muted">Loading review data…</p>;
  if (error)   return <p className="py-12 text-center text-danger">{error}</p>;
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

      <p className="mb-3 text-xs leading-relaxed text-muted">
        Sample: <strong className="text-foreground">{sampleName}</strong>
        {serviceCode && <> · Service: <strong className="text-foreground">{serviceCode.replace(/_/g, ' ')}</strong></>}
        {variantStats?.total != null && <> · <strong className="text-foreground">{variantStats.total}</strong> variants</>}
        {variantStats?.pathogenic_or_likely != null && <> · <strong className="text-danger">{variantStats.pathogenic_or_likely} P/LP</strong></>}
        {variantStats?.vus != null && <> · <strong className="text-warning">{variantStats.vus} VUS</strong></>}
        {generatedAt && <> · Generated: {generatedAt}</>}
      </p>

      {variantStats && <CarrierBanner stats={variantStats} serviceCode={serviceCode} />}

      {qcSummary && <QcPanel qc={qcSummary} />}

      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => setTab(key as ReviewTabId)}
        className="mb-4"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Review sections">
            {visibleTabs.map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className="relative">
                {t.label}
                {/* Must live inside each Tab — sibling of Tab breaks SharedElementTransition */}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        {visibleTabs.map((t) => (
          <Tabs.Panel key={t.id} id={t.id} className="min-h-[400px] pt-4">
            {t.id === 'variants'  && <VariantTable  orderId={orderId} />}
            {t.id === 'darkgenes' && (
              <DarkGenesPanel
                orderId={orderId}
                onJumpCoverage={() => setTab('coverage')}
              />
            )}
            {t.id === 'pgx' && (
              <PgxReview
                orderId={orderId}
                onOpenApoeIgv={(rel) => setApoeIgvPath(rel)}
              />
            )}
            {t.id === 'report'    && <ReportBuilder orderId={orderId} />}
            {t.id === 'genedb'    && <GeneDatabase />}
            {t.id === 'coverage'  && <CoverageViewer orderId={orderId} />}
          </Tabs.Panel>
        ))}
      </Tabs>

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
