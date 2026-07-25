'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Chip,
  Input,
  Tabs,
  toast,
} from '@heroui/react';
import { ListChecks, ListX, Save } from 'lucide-react';
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

type PgxTableTab = 'pharmcat' | 'extended';
type SortState = { col: string; asc: boolean };

function TableCheckbox({
  isSelected,
  onChange,
  'aria-label': ariaLabel,
}: {
  isSelected: boolean;
  onChange: (selected: boolean) => void;
  'aria-label': string;
}) {
  return (
    <Checkbox
      isSelected={isSelected}
      onChange={onChange}
      aria-label={ariaLabel}
      className="inline-flex justify-center"
    >
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}

function SortableTh({
  label,
  sortKey,
  current,
  asc,
  onSort,
  title,
}: {
  label: string;
  sortKey: string;
  current: string;
  asc: boolean;
  onSort: (key: string) => void;
  title?: string;
}) {
  const active = current === sortKey;
  const arrow = active ? (asc ? ' ▲' : ' ▼') : '';
  return (
    <th
      className={`sticky top-0 z-10 cursor-pointer select-none bg-surface px-2.5 py-1.5 text-left text-[11px] uppercase tracking-wide text-muted hover:text-accent hover:underline ${active ? 'text-accent' : ''}`}
      title={title}
      onClick={() => onSort(sortKey)}
    >
      {label}
      {arrow && <span className="ml-0.5 text-[9px] opacity-65">{arrow}</span>}
    </th>
  );
}

export function PgxReview({
  orderId,
  onOpenApoeIgv,
}: {
  orderId: string;
  onOpenApoeIgv?: (relPath: string) => void;
}) {
  const { reviewData, setReviewData } = useReviewStore();
  const pgx = reviewData?.pgx;

  const [geneConfirmed, setGeneConfirmed] = useState<Record<string, boolean>>({});
  const [customConfirmed, setCustomConfirmed] = useState<Record<string, boolean>>({});
  const [includeApoePdf, setIncludeApoePdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tableTab, setTableTab] = useState<PgxTableTab>('pharmcat');

  const [geneFilter, setGeneFilter] = useState('');
  const [customFilter, setCustomFilter] = useState('');
  const [geneSort, setGeneSort] = useState<SortState>({ col: '', asc: true });
  const [customSort, setCustomSort] = useState<SortState>({ col: '', asc: true });

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

  const showPharmcatTab = genes.length > 0 || customGenes.length === 0;
  const showExtendedTab = customGenes.length > 0;
  const effectiveTab: PgxTableTab =
    tableTab === 'extended' && showExtendedTab
      ? 'extended'
      : showPharmcatTab
        ? 'pharmcat'
        : 'extended';

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

      {(meta.tool_version || meta.genome_build || meta.exit_status != null) && (
        <p className="mb-2.5 text-xs text-muted">
          {[
            meta.tool_version && `Tool: ${meta.tool_version}`,
            meta.genome_build && `Genome: ${meta.genome_build}`,
            meta.exit_status != null && `Exit: ${meta.exit_status}`,
          ].filter(Boolean).join(' · ')}
        </p>
      )}

      {pgx.message && pgx.status === 'error' && (
        <p className="mb-2.5 text-[13px] text-danger">{String(pgx.message)}</p>
      )}

      {(showPharmcatTab || showExtendedTab) && (
        <Tabs
          selectedKey={effectiveTab}
          onSelectionChange={(key) => setTableTab(key as PgxTableTab)}
          className="mb-3"
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="PGx tables">
              {showPharmcatTab && (
                <Tabs.Tab id="pharmcat" className="relative">
                  PharmCAT genes ({genes.length})
                  <Tabs.Indicator />
                </Tabs.Tab>
              )}
              {showExtendedTab && (
                <Tabs.Tab id="extended" className="relative">
                  Extended PGx Panel ({customGenes.length})
                  <Tabs.Indicator />
                </Tabs.Tab>
              )}
            </Tabs.List>
          </Tabs.ListContainer>

          {showPharmcatTab && (
            <Tabs.Panel id="pharmcat" className="pt-3">
              {genes.length > 0 ? (
                <PharmcatGenesTable
                  genes={genes}
                  confirmed={geneConfirmed}
                  onToggle={(gene, v) => setGeneConfirmed((s) => ({ ...s, [gene]: v }))}
                  onSelectKeys={(keys, value) => {
                    setGeneConfirmed((s) => {
                      const next = { ...s };
                      keys.forEach((k) => { next[k] = value; });
                      return next;
                    });
                  }}
                  filter={geneFilter}
                  onFilterChange={setGeneFilter}
                  sort={geneSort}
                  onSort={setGeneSort}
                />
              ) : (
                <p className="py-8 text-center text-muted">
                  No gene rows parsed yet. Reprocess results after <code>pgx/pgx_result.json</code> exists (PharmCAT phenotype JSON). Until then, use the raw summary below.
                </p>
              )}
            </Tabs.Panel>
          )}

          {showExtendedTab && (
            <Tabs.Panel id="extended" className="pt-3">
              <ExtendedPanelTable
                genes={customGenes}
                confirmed={customConfirmed}
                onToggle={(key, v) => setCustomConfirmed((s) => ({ ...s, [key]: v }))}
                onSelectKeys={(keys, value) => {
                  setCustomConfirmed((s) => {
                    const next = { ...s };
                    keys.forEach((k) => { next[k] = value; });
                    return next;
                  });
                }}
                filter={customFilter}
                onFilterChange={setCustomFilter}
                sort={customSort}
                onSort={setCustomSort}
              />
            </Tabs.Panel>
          )}
        </Tabs>
      )}

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

function sortRows(rows: PgxGeneResult[], sort: SortState): PgxGeneResult[] {
  if (!sort.col) return rows;
  return [...rows].sort((a, b) => {
    let av: string;
    let bv: string;
    if (sort.col === 'allele1_function') {
      av = [a.allele1_function, a.allele2_function].filter(Boolean).join(' / ').toLowerCase();
      bv = [b.allele1_function, b.allele2_function].filter(Boolean).join(' / ').toLowerCase();
    } else if (sort.col === 'is_variant') {
      const aVar = a.is_variant || (!!a.zygosity && a.zygosity !== 'homozygous_ref');
      const bVar = b.is_variant || (!!b.zygosity && b.zygosity !== 'homozygous_ref');
      av = aVar ? '1' : '0';
      bv = bVar ? '1' : '0';
    } else {
      av = String((a as Record<string, unknown>)[sort.col] ?? '').toLowerCase();
      bv = String((b as Record<string, unknown>)[sort.col] ?? '').toLowerCase();
    }
    return sort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
  });
}

function PharmcatGenesTable({
  genes,
  confirmed,
  onToggle,
  onSelectKeys,
  filter,
  onFilterChange,
  sort,
  onSort,
}: {
  genes: PgxGeneResult[];
  confirmed: Record<string, boolean>;
  onToggle: (gene: string, v: boolean) => void;
  onSelectKeys: (keys: string[], value: boolean) => void;
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

  const sorted = useMemo(() => sortRows(filtered, sort), [filtered, sort]);
  const visibleKeys = sorted.map((g) => (g.gene ?? '').trim()).filter(Boolean);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((k) => confirmed[k]);
  const selectedCount = Object.values(confirmed).filter(Boolean).length;

  const handleSort = (col: string) => {
    onSort(sort.col === col ? { col, asc: !sort.asc } : { col, asc: true });
  };

  const thProps = { current: sort.col, asc: sort.asc, onSort: handleSort };

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search gene, phenotype, diplotype…"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="max-w-[260px]"
          aria-label="Filter PharmCAT genes"
        />
        <span className="whitespace-nowrap text-[11px] text-muted">
          {sorted.length} gene{sorted.length !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onPress={() => onSelectKeys(visibleKeys, true)}
            className="gap-1.5"
          >
            <ListChecks size={14} strokeWidth={2} aria-hidden />
            Select All Visible
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => onSelectKeys(Object.keys(confirmed), false)}
            className="gap-1.5"
          >
            <ListX size={14} strokeWidth={2} aria-hidden />
            Deselect All
          </Button>
          <span className="whitespace-nowrap text-[11px] text-muted">
            {selectedCount} selected
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-muted">No genes match the current filters.</p>
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky top-0 z-10 w-10 bg-surface px-2.5 py-1.5 text-center" title="Include on PDF report">
                  <TableCheckbox
                    isSelected={allVisibleSelected}
                    aria-label="Select all visible PharmCAT genes"
                    onChange={(checked) => onSelectKeys(visibleKeys, checked)}
                  />
                </th>
                <SortableTh label="Gene" sortKey="gene" {...thProps} />
                <SortableTh label="Source" sortKey="guideline_source" {...thProps} />
                <SortableTh label="Diplotype" sortKey="diplotype" {...thProps} />
                <SortableTh label="Phenotype" sortKey="phenotype" {...thProps} />
                <SortableTh label="Allele Functions" sortKey="allele1_function" {...thProps} />
                <SortableTh label="Category" sortKey="category" {...thProps} />
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
                const selected = !!confirmed[g];
                const rowClass = selected
                  ? 'bg-accent/10'
                  : isActionable
                    ? 'bg-amber-700/[.04]'
                    : 'hover:bg-accent/5';
                return (
                  <tr key={g} className={`border-b border-border ${rowClass}`}>
                    <td className="px-2.5 py-1 text-center">
                      <TableCheckbox
                        isSelected={selected}
                        aria-label={`Include ${g}`}
                        onChange={(checked) => onToggle(g, checked)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1"><strong>{g}</strong></td>
                    <td className="whitespace-nowrap px-2.5 py-1 text-muted">{row.guideline_source || '—'}</td>
                    <td className="whitespace-nowrap px-2.5 py-1 font-mono"><code>{row.diplotype || '—'}</code></td>
                    <td className="px-2.5 py-1">{row.phenotype || '—'}</td>
                    <td className="max-w-[180px] truncate px-2.5 py-1 text-muted" title={fn}>{fn}</td>
                    <td className="whitespace-nowrap px-2.5 py-1">
                      {isActionable ? (
                        <Chip color="warning" size="sm" variant="soft">
                          <Chip.Label>Actionable</Chip.Label>
                        </Chip>
                      ) : (
                        <Chip size="sm" variant="soft">
                          <Chip.Label>Normal</Chip.Label>
                        </Chip>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ExtendedPanelTable({
  genes,
  confirmed,
  onToggle,
  onSelectKeys,
  filter,
  onFilterChange,
  sort,
  onSort,
}: {
  genes: PgxGeneResult[];
  confirmed: Record<string, boolean>;
  onToggle: (key: string, v: boolean) => void;
  onSelectKeys: (keys: string[], value: boolean) => void;
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

  const sorted = useMemo(() => sortRows(filtered, sort), [filtered, sort]);
  const visibleKeys = sorted.map((g) => `${g.gene}|${g.rsid ?? ''}`);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((k) => confirmed[k]);
  const selectedCount = Object.values(confirmed).filter(Boolean).length;

  const handleSort = (col: string) => {
    onSort(sort.col === col ? { col, asc: !sort.asc } : { col, asc: true });
  };

  const thProps = { current: sort.col, asc: sort.asc, onSort: handleSort };

  return (
    <div>
      <details className="mb-3">
        <summary className="flex cursor-pointer select-none items-center gap-1.5 text-xs font-semibold text-muted">
          <span>Column guide &amp; evidence levels</span>
          <span className="text-[10px] font-normal">(show reference)</span>
        </summary>
        <div className="mt-2.5 grid grid-cols-1 gap-4 rounded-md border border-border bg-surface p-3 text-[11px] leading-relaxed md:grid-cols-2">
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

      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search gene, rsID, drug, significance…"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="max-w-[260px]"
          aria-label="Filter extended PGx panel"
        />
        <span className="whitespace-nowrap text-[11px] text-muted">
          {sorted.length} row{sorted.length !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onPress={() => onSelectKeys(visibleKeys, true)}
            className="gap-1.5"
          >
            <ListChecks size={14} strokeWidth={2} aria-hidden />
            Select All Visible
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => onSelectKeys(Object.keys(confirmed), false)}
            className="gap-1.5"
          >
            <ListX size={14} strokeWidth={2} aria-hidden />
            Deselect All
          </Button>
          <span className="whitespace-nowrap text-[11px] text-muted">
            {selectedCount} selected
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-muted">No rows match the current filters.</p>
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky top-0 z-10 w-10 bg-surface px-2.5 py-1.5 text-center" title="Include on PDF report">
                  <TableCheckbox
                    isSelected={allVisibleSelected}
                    aria-label="Select all visible extended panel rows"
                    onChange={(checked) => onSelectKeys(visibleKeys, checked)}
                  />
                </th>
                <SortableTh label="Gene" sortKey="gene" {...thProps} />
                <SortableTh label="rsID" sortKey="rsid" {...thProps} />
                <SortableTh label="Variant" sortKey="variant_name" {...thProps} />
                <SortableTh label="Genotype" sortKey="genotype" {...thProps} />
                <SortableTh label="Zygosity" sortKey="zygosity" {...thProps} />
                <SortableTh label="Significance" sortKey="clinical_significance" {...thProps} />
                <SortableTh label="Affected Drug(s)" sortKey="drugs" {...thProps} />
                <SortableTh label="Evidence" sortKey="evidence_level" {...thProps} />
                <SortableTh label="Status" sortKey="is_variant" {...thProps} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => {
                const key = `${row.gene}|${row.rsid ?? ''}`;
                const isVar = row.is_variant || (!!row.zygosity && row.zygosity !== 'homozygous_ref');
                const zyg = (row.zygosity || '').replace(/_/g, ' ');
                const selected = !!confirmed[key];
                const rowClass = selected
                  ? 'bg-accent/10'
                  : isVar
                    ? 'bg-amber-700/[.04]'
                    : 'hover:bg-accent/5';
                return (
                  <tr key={`${key}-${idx}`} className={`border-b border-border ${rowClass}`}>
                    <td className="px-2.5 py-1 text-center">
                      <TableCheckbox
                        isSelected={selected}
                        aria-label={`Include ${row.gene || 'row'}`}
                        onChange={(checked) => onToggle(key, checked)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1"><strong>{row.gene || '—'}</strong></td>
                    <td className="whitespace-nowrap px-2.5 py-1 font-mono text-[11px]">{row.rsid || '—'}</td>
                    <td className="max-w-[160px] truncate px-2.5 py-1 text-muted" title={row.variant_name || ''}>
                      {row.variant_name || '—'}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1 font-mono"><code>{row.genotype || '—'}</code></td>
                    <td className="whitespace-nowrap px-2.5 py-1">
                      {zyg
                        ? <span className="text-[11px] font-semibold">{zyg}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="max-w-[160px] truncate px-2.5 py-1" title={row.clinical_significance || ''}>
                      {row.clinical_significance || '—'}
                    </td>
                    <td className="max-w-[180px] truncate px-2.5 py-1 text-muted" title={row.drugs || ''}>
                      {row.drugs || '—'}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1 text-[11px]">{row.evidence_level || '—'}</td>
                    <td className="whitespace-nowrap px-2.5 py-1">
                      {isVar ? (
                        <Chip color="warning" size="sm" variant="soft">
                          <Chip.Label>Variant</Chip.Label>
                        </Chip>
                      ) : (
                        <Chip size="sm" variant="soft">
                          <Chip.Label>Ref</Chip.Label>
                        </Chip>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
