'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, toast } from '@heroui/react';
import { Save } from 'lucide-react';
import { orderArtifactUrl, reviewApi } from '../../../lib/api/review';
import { useReviewStore } from '../../../lib/store/reviewStore';
import { reviewOrderKind } from '../../../lib/review-tabs';
import { ApoeProactiveCard } from './ApoeProactiveCard';
import type {
  PgxGeneResult,
  PgxApoePhasing,
  PgxApoeDiplotypeForReport,
  PgxPortalReview,
  PgxMeta,
  PgxArtifacts,
  ReviewData,
} from '@gx-portal/types';

export function PgxReview({
  orderId,
  onOpenApoeIgv,
}: {
  orderId: string;
  onOpenApoeIgv?: (relPath: string) => void;
}) {
  const { reviewData, setReviewData } = useReviewStore();
  const pgx = reviewData?.pgx;

  // ─── Local state for checkboxes ───
  const [geneConfirmed, setGeneConfirmed] = useState<Record<string, boolean>>({});
  const [customConfirmed, setCustomConfirmed] = useState<Record<string, boolean>>({});
  const [includeApoePdf, setIncludeApoePdf] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filter state
  const [geneFilter, setGeneFilter] = useState('');
  const [customFilter, setCustomFilter] = useState('');

  // Sort state
  const [geneSort, setGeneSort] = useState<{ col: string; asc: boolean }>({ col: '', asc: true });
  const [customSort, setCustomSort] = useState<{ col: string; asc: boolean }>({ col: '', asc: true });

  // Sync local state from pgx data
  useEffect(() => {
    if (!pgx) return;
    const pr = (pgx.portal_review && typeof pgx.portal_review === 'object' ? pgx.portal_review : {}) as PgxPortalReview;
    setIncludeApoePdf(!!(pr.include_apoe_proactive_pdf === true || pr.include_apoe_proactive_pdf === 'true'));

    const gc: Record<string, boolean> = {};
    (pgx.gene_results ?? []).forEach((g) => { gc[g.gene] = !!g.reviewer_confirmed; });
    setGeneConfirmed(gc);

    const cc: Record<string, boolean> = {};
    (pgx.custom_gene_results ?? []).forEach((g) => {
      cc[`${g.gene}|${g.rsid ?? ''}`] = !!g.reviewer_confirmed;
    });
    setCustomConfirmed(cc);
  }, [pgx]);

  // ─── Empty / status states ───
  if (!pgx || typeof pgx !== 'object') {
    return (
      <p className="py-8 text-center text-muted">
        No PGx data in result.json. Pipeline must produce <code>pgx/</code> (PharmCAT); reprocess only refreshes from disk.
      </p>
    );
  }

  const pr = (pgx.portal_review && typeof pgx.portal_review === 'object' ? pgx.portal_review : {}) as PgxPortalReview;
  const hasNotes = !!(pr.reviewer_notes && String(pr.reviewer_notes).trim());
  const hasPipeline = pgx.status === 'ok' || pgx.status === 'error' || !!((pgx.summary_text || '').trim());

  if (pgx.status === 'not_found' && !hasPipeline && !hasNotes) {
    const diskMsg = (pgx.message && String(pgx.message)) || 'No PharmCAT PGx output found on disk';
    return (
      <p className="py-8 text-center text-muted">
        {diskMsg}. Run the pipeline with PGx; reprocess does not run PharmCAT.
      </p>
    );
  }

  const genes: PgxGeneResult[] = Array.isArray(pgx.gene_results) ? pgx.gene_results : [];
  const customGenes: PgxGeneResult[] = Array.isArray(pgx.custom_gene_results) ? pgx.custom_gene_results : [];
  const aph = pgx.apoe_phasing as PgxApoePhasing | undefined;
  const meta = (pgx.meta && typeof pgx.meta === 'object' ? pgx.meta : {}) as PgxMeta;
  const art = (pgx.artifacts && typeof pgx.artifacts === 'object' ? pgx.artifacts : {}) as PgxArtifacts;
  const apoeDiplotype = pgx.apoe_diplotype_for_report as PgxApoeDiplotypeForReport | string | undefined;

  // Derive APOE IGV path
  let apoeIgvRel = '';
  const ve = reviewData?.dark_genes?.visual_evidence;
  const igvRel = ve?.igv_report_html || '';
  if (igvRel && igvRel.includes('_visual_report.html')) {
    apoeIgvRel = igvRel.replace('_visual_report.html', '_apoe_igv.html');
  } else {
    const sn = reviewData?.sample_name || '';
    if (sn) apoeIgvRel = `snapshots/${sn}_apoe_igv.html`;
  }

  const isProactive = reviewOrderKind(reviewData as Record<string, unknown>) === 'proactive';
  const showApoeCard = isProactive && customGenes.some((r) => String(r.gene || '').trim().toUpperCase() === 'APOE');

  // ─── Artifact links ───
  const artifactLinks: Array<{ label: string; url: string }> = [];
  if (art.pgx_summary_txt && orderId) {
    artifactLinks.push({
      label: 'pgx_summary.txt',
      url: orderArtifactUrl(orderId, art.pgx_summary_txt),
    });
  }
  if (art.reporter_html_basename && orderId) {
    artifactLinks.push({
      label: 'PharmCAT HTML report',
      url: orderArtifactUrl(orderId, `pgx/${art.reporter_html_basename}`),
    });
  }
  if (art.pgx_meta_json && orderId) {
    artifactLinks.push({
      label: 'pgx_meta.json',
      url: orderArtifactUrl(orderId, art.pgx_meta_json),
    });
  }
  if (art.pgx_result_json && orderId) {
    artifactLinks.push({
      label: 'pgx_result.json',
      url: orderArtifactUrl(orderId, `pgx/${art.pgx_result_json}`),
    });
  }

  // ─── Save handler ───
  const handleSave = async () => {
    setSaving(true);
    try {
      const gene_reviews = genes.map((g) => ({
        gene: g.gene,
        reviewer_confirmed: !!geneConfirmed[g.gene],
        reviewer_comment: '',
      }));
      const custom_gene_reviews = customGenes.map((g) => ({
        gene: g.gene || '',
        rsid: g.rsid || '',
        reviewer_confirmed: !!customConfirmed[`${g.gene}|${g.rsid ?? ''}`],
        reviewer_comment: String(g.reviewer_comment || ''),
      }));
      const res = await reviewApi.savePgx(orderId, {
        reviewer_notes: String(pr.reviewer_notes || ''),
        reviewed: false,
        gene_reviews,
        custom_gene_reviews,
        include_apoe_proactive_pdf: includeApoePdf,
      }) as { pgx?: unknown };
      if (res && res.pgx && typeof res.pgx === 'object' && reviewData) {
        setReviewData({ ...reviewData, pgx: res.pgx as ReviewData['pgx'] });
      }
      toast.success('PGx review saved');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const hint404 = msg === 'Not Found' || /\b404\b/.test(msg)
        ? ' Reload the page; ensure Daemon URL is scheme+host+port only.'
        : '';
      toast.danger(msg + hint404);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="mb-2.5 text-[11px] text-muted">PharmCAT / pharmacogenomics</p>

      {/* APOE phasing banner */}
      {aph && aph.show_alert && (
        <div className="mb-3.5 rounded-xl border border-amber-500/55 bg-amber-100/20 p-3 text-xs leading-relaxed">
          <strong className="mb-1.5 block">APOE phasing</strong>
          {aph.short_warning && <div>{aph.short_warning}</div>}
          {aph.detail && <div className="mt-2 text-[11px] text-muted">{aph.detail}</div>}
        </div>
      )}
      {aph && !aph.show_alert && aph.status === 'pipeline_resolved' && (
        <p className="mb-3 text-[11px] leading-snug text-muted">
          <strong>APOE phasing:</strong> marked resolved in pipeline output — confirm methodology in <code>pgx_custom_result.json</code> / lab SOP.
        </p>
      )}

      {/* Proactive APOE Card */}
      {showApoeCard && (
        <ApoeProactiveCard
          customGenes={customGenes}
          apoePhasing={aph}
          apoeDiplotype={apoeDiplotype}
          includeApoePdf={includeApoePdf}
          onToggleIncludePdf={setIncludeApoePdf}
          orderId={orderId}
          onOpenApoeIgv={onOpenApoeIgv}
          igvRelPath={apoeIgvRel}
        />
      )}

      {/* Meta line */}
      {(meta.tool_version || meta.genome_build || meta.exit_status != null) && (
        <p className="mb-2.5 text-xs text-muted">
          {[
            meta.tool_version && `Tool: ${meta.tool_version}`,
            meta.genome_build && `Genome: ${meta.genome_build}`,
            meta.exit_status != null && `Exit: ${meta.exit_status}`,
          ].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Error message */}
      {pgx.message && pgx.status === 'error' && (
        <p className="mb-2.5 text-[13px] text-danger">{String(pgx.message)}</p>
      )}

      {/* PharmCAT genes table */}
      {genes.length > 0 ? (
        <PharmcatGenesTable
          genes={genes}
          confirmed={geneConfirmed}
          onToggle={(gene, v) => setGeneConfirmed((s) => ({ ...s, [gene]: v }))}
          filter={geneFilter}
          onFilterChange={setGeneFilter}
          sort={geneSort}
          onSort={setGeneSort}
        />
      ) : (
        <p className="mb-3 text-xs text-muted">
          No gene rows parsed yet. Reprocess results after <code>pgx/pgx_result.json</code> exists (PharmCAT phenotype JSON). Until then, use the raw summary below.
        </p>
      )}

      {/* Extended PGx Panel */}
      {customGenes.length > 0 && (
        <ExtendedPanelTable
          genes={customGenes}
          confirmed={customConfirmed}
          onToggle={(key, v) => setCustomConfirmed((s) => ({ ...s, [key]: v }))}
          filter={customFilter}
          onFilterChange={setCustomFilter}
          sort={customSort}
          onSort={setCustomSort}
        />
      )}

      {/* Save button */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Button
          variant="primary"
          size="sm"
          isDisabled={saving}
          onPress={() => void handleSave()}
          className="gap-1.5"
        >
          <Save size={14} strokeWidth={2} aria-hidden />
          {saving ? 'Saving…' : 'Save PGx review'}
        </Button>
        <span className="max-w-[40rem] text-[11px] leading-snug text-muted">
          Saves PharmCAT and extended-panel <strong>Include</strong> choices into <code>result.json</code>. «Reprocess only» preserves these when pipeline data is regenerated.
        </span>
      </div>

      {/* Pipeline output details */}
      {(pgx.pgx_dir || artifactLinks.length > 0) && (
        <details className="mt-3">
          <summary className="cursor-pointer select-none text-[11px] text-muted">
            Pipeline output — path &amp; files
          </summary>
          <div className="mt-2 rounded-lg border border-border p-2.5 text-[11px] leading-relaxed">
            {pgx.pgx_dir && (
              <div className="mb-2.5 break-all text-muted">{pgx.pgx_dir}</div>
            )}
            {artifactLinks.length > 0 && (
              <div className="text-muted">
                Open:{' '}
                {artifactLinks.map((l, i) => (
                  <span key={l.label}>
                    {i > 0 && ' · '}
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="underline">
                      {l.label}
                    </a>
                  </span>
                ))}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// PharmCAT genes table
// ──────────────────────────────────────────────────────────────────

type SortState = { col: string; asc: boolean };

function PharmcatGenesTable({
  genes,
  confirmed,
  onToggle,
  filter,
  onFilterChange,
  sort,
  onSort,
}: {
  genes: PgxGeneResult[];
  confirmed: Record<string, boolean>;
  onToggle: (gene: string, v: boolean) => void;
  filter: string;
  onFilterChange: (v: string) => void;
  sort: SortState;
  onSort: (s: SortState) => void;
}) {
  const q = filter.toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return genes;
    return genes.filter((g) => {
      const text = [g.gene, g.guideline_source, g.diplotype, g.phenotype, g.allele1_function, g.allele2_function, g.category]
        .filter(Boolean).join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [genes, q]);

  const sorted = useMemo(() => {
    if (!sort.col) return filtered;
    return [...filtered].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sort.col] ?? '').toLowerCase();
      const bv = String((b as Record<string, unknown>)[sort.col] ?? '').toLowerCase();
      return sort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [filtered, sort]);

  const cols: Array<{ key: string; label: string; sortable: boolean }> = [
    { key: '_chk', label: '✓', sortable: false },
    { key: 'gene', label: 'Gene', sortable: true },
    { key: 'guideline_source', label: 'Source', sortable: true },
    { key: 'diplotype', label: 'Diplotype', sortable: true },
    { key: 'phenotype', label: 'Phenotype', sortable: true },
    { key: '_fn', label: 'Allele Functions', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
  ];

  const handleSort = (col: string) => {
    onSort(sort.col === col ? { col, asc: !sort.asc } : { col, asc: true });
  };

  return (
    <div className="mb-3.5">
      <input
        type="text"
        placeholder="Filter by gene, phenotype, diplotype, actionable…"
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        className="mb-2 w-full max-w-[360px] rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
      />
      <div className="max-h-[55vh] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={`border-b border-border px-2 py-1.5 text-left text-[11px] font-semibold ${c.key === '_chk' ? 'w-[50px] text-center' : ''} ${c.sortable ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
                  onClick={c.sortable ? () => handleSort(c.key === '_fn' ? 'allele1_function' : c.key) : undefined}
                  title={c.key === '_chk' ? 'Include on PDF report' : undefined}
                >
                  {c.label}
                  {c.sortable && sort.col === (c.key === '_fn' ? 'allele1_function' : c.key) && (
                    <span className="ml-0.5">{sort.asc ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const g = (row.gene ?? '').trim();
              if (!g) return null;
              const fn1 = (row.allele1_function ?? '').trim();
              const fn2 = (row.allele2_function ?? '').trim();
              const fn = [fn1, fn2].filter(Boolean).join(' / ') || '—';
              const cat = (row.category || '').trim();
              const isActionable = cat === 'actionable';
              return (
                <tr key={g} className={isActionable ? 'bg-amber-700/[.04]' : undefined}>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={!!confirmed[g]}
                      onChange={(e) => onToggle(g, e.target.checked)}
                    />
                  </td>
                  <td className="px-2 py-1.5 font-semibold">{g}</td>
                  <td className="px-2 py-1.5">{row.guideline_source ?? ''}</td>
                  <td className="px-2 py-1.5 font-mono text-[11px]">{row.diplotype ?? ''}</td>
                  <td className="px-2 py-1.5">{row.phenotype ?? ''}</td>
                  <td className="max-w-56 px-2 py-1.5 text-[11px]">{fn}</td>
                  <td className="px-2 py-1.5">
                    {isActionable ? (
                      <span className="rounded bg-amber-700/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Actionable</span>
                    ) : (
                      <span className="rounded bg-muted/10 px-1.5 py-0.5 text-[10px] opacity-60">Normal</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Extended PGx Panel table
// ──────────────────────────────────────────────────────────────────

function ExtendedPanelTable({
  genes,
  confirmed,
  onToggle,
  filter,
  onFilterChange,
  sort,
  onSort,
}: {
  genes: PgxGeneResult[];
  confirmed: Record<string, boolean>;
  onToggle: (key: string, v: boolean) => void;
  filter: string;
  onFilterChange: (v: string) => void;
  sort: SortState;
  onSort: (s: SortState) => void;
}) {
  const q = filter.toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return genes;
    return genes.filter((g) => {
      const text = [g.gene, g.rsid, g.variant_name, g.genotype, g.zygosity, g.clinical_significance, g.drugs, g.evidence_level]
        .filter(Boolean).join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [genes, q]);

  const sorted = useMemo(() => {
    if (!sort.col) return filtered;
    return [...filtered].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sort.col] ?? '').toLowerCase();
      const bv = String((b as Record<string, unknown>)[sort.col] ?? '').toLowerCase();
      return sort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [filtered, sort]);

  const handleSort = (col: string) => {
    onSort(sort.col === col ? { col, asc: !sort.asc } : { col, asc: true });
  };

  const cols: Array<{ key: string; label: string; sortable: boolean }> = [
    { key: '_chk', label: '✓', sortable: false },
    { key: 'gene', label: 'Gene', sortable: true },
    { key: 'rsid', label: 'rsID', sortable: true },
    { key: 'variant_name', label: 'Variant', sortable: true },
    { key: 'genotype', label: 'Genotype', sortable: true },
    { key: 'zygosity', label: 'Zygosity', sortable: true },
    { key: 'clinical_significance', label: 'Significance', sortable: true },
    { key: 'drugs', label: 'Affected Drug(s)', sortable: true },
    { key: 'evidence_level', label: 'Evidence', sortable: true },
    { key: '_status', label: 'Status', sortable: true },
  ];

  return (
    <div className="mb-3.5">
      <h4 className="mb-2 mt-4 text-[13px] font-semibold">Extended PGx Panel</h4>

      <details className="mb-3">
        <summary className="flex cursor-pointer select-none items-center gap-1.5 text-xs font-semibold text-muted">
          <span>Column guide &amp; evidence levels</span>
          <span className="text-[10px] font-normal">(show reference)</span>
        </summary>
        <div className="mt-2.5 grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-3 text-[11px] leading-relaxed md:grid-cols-2">
          <div>
            <strong className="text-xs">Column guide</strong><br />
            <b>Status</b> — <span className="rounded bg-amber-700/15 px-1 text-[10px] text-amber-700">Variant</span> = patient carries a non-reference allele;{' '}
            <span className="rounded bg-muted/10 px-1 text-[10px] opacity-60">Ref</span> = homozygous reference (wild-type, no variant).<br />
            <b>Affected Drug(s)</b> — Medications whose efficacy, metabolism, or safety may be altered by this variant.
            When a variant is present, prescribing of these drugs may require <em>dose adjustment, alternative selection, or additional monitoring</em>.<br />
            <b>Significance</b> — Pharmacogenomic effect of the variant (e.g. altered enzyme activity, drug transport, receptor expression).
          </div>
          <div>
            <strong className="text-xs">Evidence levels (CPIC/PharmGKB)</strong><br />
            <b>Level 1A</b> — CPIC guideline or FDA PGx label (strongest evidence)<br />
            <b>Level 1B</b> — Strong evidence; clinical annotation with prescribing action<br />
            <b>Level 2A</b> — Moderate evidence; consistent replicated studies<br />
            <b>Level 2B</b> — Moderate evidence; limited replication<br />
            <b>Level 3</b> — Low evidence; single study or small sample<br />
            <b>Level 4</b> — Preliminary; case reports or in-vitro only
          </div>
        </div>
      </details>

      <input
        type="text"
        placeholder="Filter by gene, rsID, drug, significance, variant…"
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        className="mb-2 w-full max-w-[360px] rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
      />
      <div className="max-h-[50vh] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={`border-b border-border px-2 py-1.5 text-left text-[11px] font-semibold ${c.key === '_chk' ? 'w-[50px] text-center' : ''} ${c.sortable ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
                  onClick={c.sortable ? () => handleSort(c.key === '_status' ? 'is_variant' : c.key) : undefined}
                  title={c.key === '_chk' ? 'Include on PDF report' : undefined}
                >
                  {c.label}
                  {c.sortable && sort.col === (c.key === '_status' ? 'is_variant' : c.key) && (
                    <span className="ml-0.5">{sort.asc ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const key = `${row.gene}|${row.rsid ?? ''}`;
              const isVar = row.is_variant || (!!row.zygosity && row.zygosity !== 'homozygous_ref');
              const zyg = (row.zygosity || '').replace(/_/g, ' ');
              return (
                <tr key={`${key}-${idx}`} className={isVar ? 'bg-amber-700/[.04]' : undefined}>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={!!confirmed[key]}
                      onChange={(e) => onToggle(key, e.target.checked)}
                    />
                  </td>
                  <td className="px-2 py-1.5 font-semibold">{row.gene || ''}</td>
                  <td className="px-2 py-1.5 text-[11px]">{row.rsid || ''}</td>
                  <td className="px-2 py-1.5 text-[11px]">{row.variant_name || ''}</td>
                  <td className="px-2 py-1.5 font-mono text-[11px]">{row.genotype || ''}</td>
                  <td className="px-2 py-1.5 text-[11px]">{zyg}</td>
                  <td className="px-2 py-1.5 text-[11px]">{row.clinical_significance || ''}</td>
                  <td className="max-w-56 px-2 py-1.5 text-[11px]">{row.drugs || ''}</td>
                  <td className="px-2 py-1.5 text-[11px]">{row.evidence_level || ''}</td>
                  <td className="px-2 py-1.5">
                    {isVar ? (
                      <span className="rounded bg-amber-700/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Variant</span>
                    ) : (
                      <span className="rounded bg-muted/10 px-1.5 py-0.5 text-[10px] opacity-60">Ref</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
