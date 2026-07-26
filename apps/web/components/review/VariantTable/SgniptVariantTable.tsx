'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  ListBox,
  Select,
  Tabs,
} from '@heroui/react';
import { ListChecks, ListX, Tags } from 'lucide-react';
import { reviewApi } from '../../../lib/api/review';
import { useReviewStore } from '../../../lib/store/reviewStore';
import {
  isFetalOrigin,
  isMaternalOrigin,
  isPathogenicSig,
  sgniptOriginLabel,
} from '../../../lib/sgnipt-normalize';
import type { Variant, AcmgClass } from '@gx-portal/types';

type OriginTab = 'all' | 'fetal' | 'plp' | 'maternal';
type SortKey = 'gene' | 'hgvsc' | 'hgvsp' | 'origin' | 'vaf' | 'clinvar' | 'acmg' | 'confidence';
type SortDir = 'asc' | 'desc' | null;

/** Keep DOM light — sgNIPT tables are often 1k–20k rows. */
const PAGE_SIZE = 100;

function isNoiseOrigin(origin: string): boolean {
  return origin === 'noise' || origin === 'ambiguous' || origin === 'unknown';
}

function SortableTh({
  label, sortKey, current, dir, onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey | null;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  const arrow = active && dir === 'asc' ? ' ▲' : active && dir === 'desc' ? ' ▼' : '';
  return (
    <th
      className={`sticky top-0 z-10 cursor-pointer select-none bg-surface px-2.5 py-1.5 text-left text-[11px] uppercase tracking-wide text-muted hover:text-accent hover:underline ${active ? 'text-accent' : ''}`}
      onClick={() => onSort(sortKey)}
    >
      {label}
      {arrow && <span className="ml-0.5 text-[9px] opacity-65">{arrow}</span>}
    </th>
  );
}

function fmtVaf(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `${(v * 100).toFixed(1)}%`;
}

function fmtAf(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n === 0) return '0';
  if (n >= 0.01) return n.toFixed(4);
  return n.toExponential(2);
}

function badgeClass(kind: 'danger' | 'warning' | 'success' | 'sky' | 'muted'): string {
  switch (kind) {
    case 'danger': return 'bg-danger/15 text-danger';
    case 'warning': return 'bg-warning/15 text-warning';
    case 'success': return 'bg-success/15 text-success';
    case 'sky': return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
    default: return 'bg-default text-muted';
  }
}

function SoftBadge({
  children,
  kind = 'muted',
}: {
  children: React.ReactNode;
  kind?: 'danger' | 'warning' | 'success' | 'sky' | 'muted';
}) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeClass(kind)}`}>
      {children}
    </span>
  );
}

function clinvarKind(label: string): 'danger' | 'warning' | 'muted' | 'success' {
  const l = label.toLowerCase();
  if (l.includes('pathogenic') && !l.includes('likely')) return 'danger';
  if (l.includes('likely pathogenic')) return 'warning';
  if (l.includes('uncertain') || l.includes('vus')) return 'muted';
  return 'success';
}

function acmgKind(cls: string): 'danger' | 'warning' | 'muted' | 'success' {
  const c = cls.toLowerCase();
  if (c.includes('pathogenic') && !c.includes('likely')) return 'danger';
  if (c.includes('likely pathogenic') || c === 'lp') return 'warning';
  if (c.includes('benign')) return 'success';
  return 'muted';
}

function originKind(origin: string): 'warning' | 'muted' | 'success' | 'sky' {
  if (isFetalOrigin(origin)) return 'sky';
  if (origin === 'maternal_het') return 'muted';
  if (origin === 'maternal_hom') return 'success';
  return 'muted';
}

function buildTags(v: Variant): string[] {
  const tags: string[] = [];
  const origin = String(v.origin || '');
  if (isFetalOrigin(origin)) tags.push('Fetal');
  const sig = String(v.clinvar_sig_primary || v.acmg_classification || '');
  if (sig.toLowerCase() === 'pathogenic') tags.push('Pathogenic');
  else if (sig.toLowerCase().includes('likely pathogenic')) tags.push('Likely Path.');
  else if (sig.toLowerCase().includes('vus') || sig.toLowerCase().includes('uncertain')) tags.push('VUS');
  if (String(v.confidence || '').toLowerCase() === 'low') tags.push('Low conf.');
  if (v.in_zero_probe_region) tags.push('Low cov. region');
  if (v.gnomad_af == null && !String(v.clinvar_id || '').trim()) tags.push('Novel');
  return tags;
}

export function SgniptVariantTable({ orderId }: { orderId: string }) {
  const reviewData = useReviewStore((s) => s.reviewData);
  const selectedVariants = useReviewStore((s) => s.selectedVariants);
  const variantComments = useReviewStore((s) => s.variantComments);
  const toggleVariant = useReviewStore((s) => s.toggleVariant);
  const selectAll = useReviewStore((s) => s.selectAll);
  const clearSelection = useReviewStore((s) => s.clearSelection);
  const setVariantComment = useReviewStore((s) => s.setVariantComment);
  const setReviewData = useReviewStore((s) => s.setReviewData);

  // Fetal-first: much smaller than "All" (noise-heavy) and clinically primary.
  const [tab, setTab] = useState<OriginTab>('fetal');
  const [hideNoise, setHideNoise] = useState(true);
  const [search, setSearch] = useState('');
  const [geneFilter, setGeneFilter] = useState('');
  const [confFilter, setConfFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [classifying, setClassifying] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const variants = reviewData?.variants ?? [];
  const va = reviewData?.variant_analysis ?? {};
  const vaSummary = (reviewData as Record<string, unknown> | null)?.variant_analysis_summary as
    | Record<string, unknown>
    | undefined;

  const fetalCount = useMemo(() => {
    const fromSum = Number(vaSummary?.fetal_variants);
    if (Number.isFinite(fromSum)) return fromSum;
    return variants.filter((v) => isFetalOrigin(String(v.origin || ''))).length;
  }, [variants, vaSummary]);

  const plpCount = useMemo(() => {
    const fromSum = Number(vaSummary?.pathogenic_variants);
    if (Number.isFinite(fromSum)) return fromSum;
    return variants.filter((v) =>
      isPathogenicSig(String(v.clinvar_sig_primary || v.acmg_classification || '')),
    ).length;
  }, [variants, vaSummary]);

  const fetalPathoCount = useMemo(
    () =>
      variants.filter((v) => {
        const o = String(v.origin || '');
        const s = String(v.clinvar_sig_primary || v.acmg_classification || '');
        return isFetalOrigin(o) && isPathogenicSig(s);
      }).length,
    [variants],
  );

  const totalCount = useMemo(() => {
    const fromSum = Number(vaSummary?.total_variants);
    if (Number.isFinite(fromSum)) return fromSum;
    return variants.length;
  }, [variants, vaSummary]);

  const noiseCount = useMemo(
    () => variants.filter((v) => isNoiseOrigin(String(v.origin || ''))).length,
    [variants],
  );

  const geneOptions = useMemo(() => {
    const genes = [...new Set(variants.map((v) => v.gene).filter(Boolean))].sort() as string[];
    return [{ value: '', label: 'All genes' }, ...genes.map((g) => ({ value: g, label: g }))];
  }, [variants]);

  const sourceVariants = useMemo(() => {
    const pathoDetail = Array.isArray(va.pathogenic_details)
      ? (va.pathogenic_details as Variant[])
      : null;
    let list: Variant[];
    if (tab === 'plp') {
      list = pathoDetail && pathoDetail.length
        ? pathoDetail
        : variants.filter((v) =>
            isPathogenicSig(String(v.clinvar_sig_primary || v.acmg_classification || '')),
          );
    } else if (tab === 'fetal') {
      list = variants.filter((v) => isFetalOrigin(String(v.origin || '')));
    } else if (tab === 'maternal') {
      list = variants.filter((v) => isMaternalOrigin(String(v.origin || '')));
    } else {
      list = variants;
    }
    if (tab === 'all' && hideNoise) {
      list = list.filter((v) => !isNoiseOrigin(String(v.origin || '')));
    }
    return list;
  }, [variants, va.pathogenic_details, tab, hideNoise]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sourceVariants.filter((v) => {
      if (geneFilter && v.gene !== geneFilter) return false;
      if (confFilter && String(v.confidence || '').toLowerCase() !== confFilter) return false;
      if (!q) return true;
      const blob = [
        v.gene, v.hgvsc, v.hgvsp, v.disease, v.chrom && v.pos != null ? `${v.chrom}:${v.pos}` : '',
      ].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [sourceVariants, search, geneFilter, confFilter]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const pick = (v: Variant): string | number => {
        switch (sortKey) {
          case 'gene': return v.gene ?? '';
          case 'hgvsc': return v.hgvsc ?? '';
          case 'hgvsp': return v.hgvsp ?? '';
          case 'origin': return String(v.origin ?? '');
          case 'vaf': return v.vaf ?? -1;
          case 'clinvar': return String(v.clinvar_sig_primary ?? '');
          case 'acmg': return String(v.acmg_classification ?? '');
          case 'confidence': return String(v.confidence ?? '');
          default: return '';
        }
      };
      const av = pick(a);
      const bv = pick(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  // Reset window when the working set changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab, search, geneFilter, confFilter, sortKey, sortDir, hideNoise, orderId]);

  const pageRows = useMemo(
    () => sorted.slice(0, visibleCount),
    [sorted, visibleCount],
  );
  const hasMore = visibleCount < sorted.length;

  const handleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const handleClassify = async () => {
    const toClassify = sorted.slice(0, 200).map((v) => ({
      variant_id: v.variant_id,
      chrom: v.chrom,
      pos: v.pos,
      ref: v.ref,
      alt: v.alt,
      gene: v.gene,
    }));
    setClassifying(true);
    try {
      const res = await reviewApi.classify(orderId, { variants: toClassify });
      if (reviewData) {
        const byId = new Map(res.results.map((r) => [r.variant_id, r]));
        const updated = reviewData.variants.map((v) => {
          const r = byId.get(v.variant_id);
          return r ? { ...v, ...r } : v;
        });
        setReviewData({ ...reviewData, variants: updated });
      }
    } finally {
      setClassifying(false);
    }
  };

  const visibleIds = useMemo(() => sorted.map((v) => v.variant_id), [sorted]);
  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedVariants.has(id)),
    [visibleIds, selectedVariants],
  );
  const thProps = { current: sortKey, dir: sortDir, onSort: handleSort };
  const showConfFilter = tab === 'all' || tab === 'fetal';
  const detailVariant = detailId
    ? variants.find((x) => x.variant_id === detailId) ?? null
    : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2.5">
        {[
          { label: 'Total Variants', value: totalCount, className: '' },
          { label: 'Fetal-Specific', value: fetalCount, className: 'text-sky-600' },
          { label: 'Pathogenic / LP', value: plpCount, className: 'text-danger' },
          { label: 'Fetal + Pathogenic', value: fetalPathoCount, className: 'text-orange-500' },
        ].map((c) => (
          <div
            key={c.label}
            className="flex min-w-[120px] flex-1 flex-col gap-0.5 rounded-xl border border-border bg-surface px-3.5 py-2.5"
          >
            <span className={`text-[22px] font-normal tabular-nums leading-tight ${c.className}`}>{c.value}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{c.label}</span>
          </div>
        ))}
      </div>

      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => setTab(key as OriginTab)}
        className="mb-2"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="sgNIPT origin filters">
            <Tabs.Tab id="fetal" className="relative">
              Fetal{fetalCount > 0 ? ` (${fetalCount})` : ''}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="plp" className="relative">
              P / LP{plpCount > 0 ? ` (${plpCount})` : ''}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="maternal" className="relative">
              Maternal
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="all" className="relative">
              All
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search gene, position, disease…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[260px]"
          aria-label="Search sgNIPT variants"
        />
        <Select
          selectedKey={geneFilter || '__all__'}
          onSelectionChange={(key) => setGeneFilter(key === '__all__' ? '' : String(key))}
          aria-label="Gene filter"
        >
          <Select.Trigger className="min-w-[120px]">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {geneOptions.map((o) => (
                <ListBox.Item key={o.value || '__all__'} id={o.value || '__all__'} textValue={o.label}>
                  {o.label}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        {showConfFilter && (
          <>
            <span className="text-[11px] font-semibold text-muted">Confidence</span>
            {(['', 'high', 'medium', 'low'] as const).map((c) => (
              <Button
                key={c || 'any'}
                size="sm"
                variant={confFilter === c ? 'primary' : 'ghost'}
                onPress={() => setConfFilter(c)}
              >
                {c ? c : 'Any'}
              </Button>
            ))}
          </>
        )}

        {tab === 'all' && (
          <Button
            size="sm"
            variant={hideNoise ? 'secondary' : 'ghost'}
            onPress={() => setHideNoise((v) => !v)}
          >
            {hideNoise ? `Noise hidden (${noiseCount})` : 'Showing noise'}
          </Button>
        )}

        <span className="whitespace-nowrap text-[11px] text-muted">
          Showing {Math.min(visibleCount, sorted.length)} of {sorted.length}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            isDisabled={classifying}
            onPress={() => void handleClassify()}
            className="gap-1.5"
          >
            <Tags size={14} strokeWidth={2} aria-hidden />
            {classifying ? 'Classifying…' : 'Classify'}
          </Button>
          <Button size="sm" variant="ghost" onPress={() => selectAll(visibleIds)} className="gap-1.5">
            <ListChecks size={14} strokeWidth={2} aria-hidden />
            Select All Visible
          </Button>
          <Button size="sm" variant="ghost" onPress={clearSelection} className="gap-1.5">
            <ListX size={14} strokeWidth={2} aria-hidden />
            Deselect All
          </Button>
          <span className="whitespace-nowrap text-[11px] text-muted">
            {selectedVariants.size} selected
          </span>
        </div>
      </div>

      {detailVariant && (
        <SgniptDetail
          variant={detailVariant}
          comment={variantComments[detailVariant.variant_id]}
          onComment={(patch) => setVariantComment(detailVariant.variant_id, patch)}
          onClose={() => setDetailId(null)}
        />
      )}

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-muted">No variants match the current filters.</p>
      ) : (
        <>
          <div className="max-h-[60vh] overflow-auto rounded-md border border-border bg-surface">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky top-0 z-10 w-10 bg-surface px-2.5 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      aria-label="Select all visible variants"
                      onChange={(e) => (e.target.checked ? selectAll(visibleIds) : clearSelection())}
                      className="size-3.5 accent-[var(--accent)]"
                    />
                  </th>
                  <SortableTh label="Gene" sortKey="gene" {...thProps} />
                  <SortableTh label="HGVSc" sortKey="hgvsc" {...thProps} />
                  <SortableTh label="HGVSp" sortKey="hgvsp" {...thProps} />
                  <SortableTh label="Origin" sortKey="origin" {...thProps} />
                  <SortableTh label="VAF" sortKey="vaf" {...thProps} />
                  <SortableTh label="ClinVar" sortKey="clinvar" {...thProps} />
                  <SortableTh label="ACMG" sortKey="acmg" {...thProps} />
                  <SortableTh label="Confidence" sortKey="confidence" {...thProps} />
                  <th className="sticky top-0 z-10 bg-surface px-2.5 py-1.5 text-left text-[11px] uppercase tracking-wide text-muted">Tags</th>
                  <th className="sticky top-0 z-10 bg-surface px-2.5 py-1.5 text-left text-[11px] uppercase tracking-wide text-muted">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((v) => {
                  const selected = selectedVariants.has(v.variant_id);
                  const expanded = detailId === v.variant_id;
                  const fetal = isFetalOrigin(String(v.origin || ''));
                  const rowClass = selected
                    ? 'bg-accent/10'
                    : expanded
                      ? 'bg-accent/5'
                      : fetal
                        ? 'bg-sky-500/[.04] hover:bg-accent/5'
                        : 'hover:bg-accent/5';
                  const cv = String(v.clinvar_sig_primary || '');
                  const acmg = String(v.acmg_classification || '');
                  const origin = String(v.origin || '');
                  const tags = buildTags(v);
                  const override = variantComments[v.variant_id]?.classification;
                  return (
                    <tr key={v.variant_id} className={`border-b border-border ${rowClass}`}>
                      <td className="px-2.5 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={selected}
                          aria-label={`Select ${v.gene ?? 'variant'}`}
                          onChange={() => toggleVariant(v.variant_id)}
                          className="size-3.5 accent-[var(--accent)]"
                        />
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-1"><strong>{v.gene || '—'}</strong></td>
                      <td className="whitespace-nowrap px-2.5 py-1 font-mono">
                        <code>{v.hgvsc || (v.chrom && v.pos != null ? `${v.chrom}:${v.pos}` : '—')}</code>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-1 font-mono">
                        {v.hgvsp ? <code>{v.hgvsp}</code> : <span className="text-muted">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-1">
                        {origin ? (
                          <SoftBadge kind={originKind(origin)}>{sgniptOriginLabel(origin)}</SoftBadge>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-1 font-mono text-[11px]">{fmtVaf(v.vaf)}</td>
                      <td className="whitespace-nowrap px-2.5 py-1">
                        {cv ? <SoftBadge kind={clinvarKind(cv)}>{cv}</SoftBadge> : <span className="text-muted">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-1">
                        {override ? (
                          <SoftBadge kind={acmgKind(override)}>{override.replace(/_/g, ' ')} *</SoftBadge>
                        ) : acmg ? (
                          <SoftBadge kind={acmgKind(acmg)}>{acmg.replace(/_/g, ' ')}</SoftBadge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-1 text-[11px] capitalize">
                        {String(v.confidence || '—')}
                      </td>
                      <td className="px-2.5 py-1">
                        <div className="flex flex-wrap gap-1">
                          {tags.length === 0 ? (
                            <span className="text-muted">—</span>
                          ) : (
                            tags.map((t) => <SoftBadge key={t}>{t}</SoftBadge>)
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-1">
                        <button
                          type="button"
                          className="text-[11px] font-medium text-accent hover:underline bg-transparent border-0 p-0 cursor-pointer"
                          onClick={() => setDetailId((prev) => (prev === v.variant_id ? null : v.variant_id))}
                        >
                          {expanded ? 'Hide' : 'Detail'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="mt-2 flex justify-center">
              <Button
                size="sm"
                variant="secondary"
                onPress={() => setVisibleCount((n) => n + PAGE_SIZE)}
              >
                Show more ({sorted.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SgniptDetail({
  variant: v,
  comment,
  onComment,
  onClose,
}: {
  variant: Variant;
  comment?: { classification?: AcmgClass; comment?: string };
  onComment: (patch: { classification?: AcmgClass }) => void;
  onClose: () => void;
}) {
  return (
    <div className="mb-3 rounded-md border border-border bg-surface p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold">
          {v.gene} — {v.hgvsc || `${v.chrom}:${v.pos}`}
        </p>
        <Button size="sm" variant="ghost" onPress={onClose}>Close</Button>
      </div>
      <dl className="grid grid-cols-[minmax(10rem,auto)_1fr] items-baseline gap-x-4 gap-y-1.5 text-xs">
        <dt className="font-semibold text-muted">HGVSp</dt><dd className="m-0 font-mono">{v.hgvsp || '—'}</dd>
        <dt className="font-semibold text-muted">Origin</dt><dd className="m-0">{sgniptOriginLabel(String(v.origin || ''))}</dd>
        <dt className="font-semibold text-muted">VAF</dt><dd className="m-0 font-mono">{fmtVaf(v.vaf)}</dd>
        <dt className="font-semibold text-muted">Depth</dt><dd className="m-0 font-mono">{v.dp ?? '—'}</dd>
        <dt className="font-semibold text-muted">REF / ALT</dt>
        <dd className="m-0 font-mono">{v.ref_depth ?? '—'} / {v.alt_depth ?? '—'}</dd>
        <dt className="font-semibold text-muted">Fetal genotype</dt><dd className="m-0">{String(v.fetal_genotype || '—')}</dd>
        <dt className="font-semibold text-muted">Maternal genotype</dt><dd className="m-0">{String(v.maternal_genotype || '—')}</dd>
        <dt className="font-semibold text-muted">Confidence</dt><dd className="m-0 capitalize">{String(v.confidence || '—')}</dd>
        <dt className="font-semibold text-muted">ClinVar</dt><dd className="m-0">{String(v.clinvar_sig_primary || '—')}</dd>
        <dt className="font-semibold text-muted">ACMG</dt><dd className="m-0">{String(v.acmg_classification || '—').replace(/_/g, ' ')}</dd>
        <dt className="font-semibold text-muted">Override</dt>
        <dd className="m-0">
          <Select
            selectedKey={comment?.classification || '__auto__'}
            onSelectionChange={(key) =>
              onComment({
                classification: key === '__auto__' ? undefined : (String(key) as AcmgClass),
              })
            }
            aria-label="Override classification"
          >
            <Select.Trigger className="min-w-[140px]">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="__auto__" textValue="auto">— auto —</ListBox.Item>
                {(['Pathogenic', 'Likely_pathogenic', 'Uncertain_significance', 'Likely_benign', 'Benign'] as const).map((c) => (
                  <ListBox.Item key={c} id={c} textValue={c}>
                    {c.replace(/_/g, ' ')}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </dd>
        <dt className="font-semibold text-muted">gnomAD AF</dt><dd className="m-0 font-mono">{fmtAf(v.gnomad_af)}</dd>
        <dt className="font-semibold text-muted">Effect</dt><dd className="m-0">{v.effect || '—'}</dd>
        <dt className="font-semibold text-muted">Disease</dt>
        <dd className="m-0">{Array.isArray(v.diseases) ? v.diseases.join('; ') : (v.disease || '—')}</dd>
        {v.acmg_reasoning ? (
          <>
            <dt className="font-semibold text-muted">ACMG reasoning</dt>
            <dd className="m-0 whitespace-pre-wrap text-[11px] text-muted">{v.acmg_reasoning}</dd>
          </>
        ) : null}
        {v.details ? (
          <>
            <dt className="font-semibold text-muted">Details</dt>
            <dd className="m-0 whitespace-pre-wrap text-[11px] text-muted">{String(v.details)}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
