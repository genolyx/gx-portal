'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button, Card, Checkbox, Chip, Input, ListBox, Select } from '@heroui/react';
import {
  ChevronDown,
  ChevronUp,
  ListChecks,
  ListX,
  ShieldAlert,
  Tags,
  X,
} from 'lucide-react';
import { reviewApi } from '../../../lib/api/review';
import { useReviewStore } from '../../../lib/store/reviewStore';
import type { Variant, AcmgClass } from '@gx-portal/types';

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

const ACMG_COLOR: Record<string, 'danger' | 'warning' | 'default' | 'success'> = {
  Pathogenic: 'danger',
  Likely_pathogenic: 'warning',
  'Likely pathogenic': 'warning',
  Uncertain_significance: 'default',
  VUS: 'default',
  Likely_benign: 'success',
  'Likely benign': 'success',
  Benign: 'success',
};

const ACMG_CLASSES: AcmgClass[] = [
  'Pathogenic', 'Likely_pathogenic', 'Uncertain_significance', 'Likely_benign', 'Benign',
];

const CLINVAR_OPTIONS = [
  { value: '', label: 'All ClinVar' },
  { value: 'Pathogenic', label: 'Pathogenic' },
  { value: 'Likely pathogenic', label: 'Likely Pathogenic' },
  { value: 'Uncertain significance', label: 'VUS' },
  { value: 'Benign', label: 'Benign / Likely Benign' },
];

type SortKey =
  | 'gene' | 'hgvsc' | 'hgvsp' | 'clinical_nm'
  | 'effect' | 'zygosity' | 'vaf' | 'gnomad_af'
  | 'clinvar_sig_primary' | 'acmg_classification';
type SortDir = 'asc' | 'desc' | null;

function FilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
  className?: string;
}) {
  const items = options.map((o) => ({ id: o.value || '__all__', label: o.label }));
  return (
    <Select
      selectedKey={value || '__all__'}
      onSelectionChange={(key) => onChange(key === '__all__' ? '' : String(key))}
      aria-label={ariaLabel ?? options[0]?.label}
      className={className}
    >
      <Select.Trigger className="min-w-[120px]">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox items={items}>
          {(item) => (
            <ListBox.Item id={item.id} textValue={item.label}>
              {item.label}
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function clinvarLabel(v: Variant): string {
  return v.clinvar_sig_primary ?? v.clinvar_sig ?? v.clinvar_significance ?? '';
}

function clinvarColor(label: string): 'danger' | 'warning' | 'default' | 'success' {
  const l = label.toLowerCase();
  if (l.includes('pathogenic') && !l.includes('likely')) return 'danger';
  if (l.includes('likely pathogenic')) return 'warning';
  if (l.includes('uncertain') || l.includes('vus')) return 'default';
  return 'success';
}

function allelDepth(v: Variant): string {
  if (v.ref_depth != null && v.alt_depth != null) {
    return `${v.ref_depth}/${v.alt_depth}`;
  }
  if (v.allele_depth) return v.allele_depth;
  if (v.dp != null) return `—/${v.dp}`;
  return '—';
}

function fmtAf(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n === 0) return '0';
  if (n >= 0.01) return n.toFixed(4);
  return n.toExponential(2);
}

function diseasesLabel(v: Variant): string {
  if (v.diseases && v.diseases.length > 0) {
    const first = String(v.diseases[0]).split('|')[0].replace(/_/g, ' ');
    return v.diseases.length > 1 ? `${first} +${v.diseases.length - 1}` : first;
  }
  if (v.disease) return v.disease;
  return '—';
}

function sortValue(v: Variant, key: SortKey): string | number {
  switch (key) {
    case 'gene':               return v.gene ?? '';
    case 'hgvsc':              return v.hgvsc ?? '';
    case 'hgvsp':              return v.hgvsp ?? '';
    case 'clinical_nm':        return v.clinical_nm ?? v.transcript ?? '';
    case 'effect':             return v.effect ?? '';
    case 'zygosity':           return v.zygosity ?? '';
    case 'vaf':                return v.vaf ?? -1;
    case 'gnomad_af':          return v.gnomad_af ?? -1;
    case 'clinvar_sig_primary':return clinvarLabel(v);
    case 'acmg_classification':return v.acmg_classification ?? '';
    default:                   return '';
  }
}

function SortableTh({
  label, sortKey, current, dir, onSort, title, className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey | null;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  title?: string;
  className?: string;
}) {
  const active = current === sortKey;
  const arrow = active && dir === 'asc' ? ' ▲' : active && dir === 'desc' ? ' ▼' : '';
  return (
    <th
      className={`cursor-pointer select-none px-2.5 py-1.5 text-left text-[11px] uppercase tracking-wide text-muted hover:text-accent hover:underline ${active ? 'text-accent' : ''} ${className ?? ''}`}
      title={title}
      onClick={() => onSort(sortKey)}
    >
      {label}{arrow && <span className="ml-0.5 text-[9px] opacity-65">{arrow}</span>}
    </th>
  );
}

function VariantDetail({ variant: v, onClose }: { variant: Variant; onClose: () => void }) {
  return (
    <Card className="mb-3">
      <Card.Header className="flex-row items-start justify-between gap-2">
        <Card.Title className="text-[13px]">
          {v.gene} — {v.hgvsc ?? `${v.chrom}:${v.pos} ${v.ref}>${v.alt}`}
        </Card.Title>
        <Button type="button" variant="ghost" size="sm" isIconOnly onPress={onClose} aria-label="Close detail">
          <X size={15} strokeWidth={2} aria-hidden />
        </Button>
      </Card.Header>
      <Card.Content>
        <dl className="grid grid-cols-[minmax(10rem,auto)_1fr] items-baseline gap-x-4 gap-y-1.5 text-xs">
          {v.hgvsp && <><dt className="font-semibold text-muted">HGVSp</dt><dd className="m-0 font-mono"><code>{v.hgvsp}</code></dd></>}
          <dt className="font-semibold text-muted">Transcript (NM)</dt><dd className="m-0 font-mono"><code>{v.clinical_nm ?? v.transcript ?? '—'}</code></dd>
          <dt className="font-semibold text-muted">Canonical ENST</dt><dd className="m-0 font-mono"><code>{v.canonical_enst ?? '—'}</code></dd>
          <dt className="font-semibold text-muted">Effect</dt><dd className="m-0">{v.effect ?? '—'}</dd>
          <dt className="font-semibold text-muted">Zygosity</dt><dd className="m-0">{v.zygosity ?? '—'}</dd>
          <dt className="font-semibold text-muted">GT</dt><dd className="m-0">{v.gt ?? '—'}</dd>
          <dt className="font-semibold text-muted">DP / REF / ALT</dt><dd className="m-0">{v.dp ?? '—'} / {v.ref_depth ?? '—'} / {v.alt_depth ?? '—'}</dd>
          <dt className="font-semibold text-muted">VAF</dt><dd className="m-0">{v.vaf != null ? (v.vaf * 100).toFixed(1) + '%' : '—'}</dd>
          <dt className="font-semibold text-muted">gnomAD AF (exomes)</dt><dd className="m-0 font-mono">{fmtAf(v.gnomad_exomes_af)}</dd>
          <dt className="font-semibold text-muted">gnomAD AF (genomes)</dt><dd className="m-0 font-mono">{fmtAf(v.gnomad_genomes_af)}</dd>
          <dt className="font-semibold text-muted">ClinVar sig.</dt><dd className="m-0">{clinvarLabel(v) || '—'}</dd>
          <dt className="font-semibold text-muted">ClinVar ID</dt><dd className="m-0">{v.clinvar_variation_id ?? v.clinvar_id ?? '—'}</dd>
          <dt className="font-semibold text-muted">dbSNP</dt><dd className="m-0">{v.dbsnp_rsid ?? '—'}</dd>
          <dt className="font-semibold text-muted">HGMD class</dt><dd className="m-0">{v.hgmd_class ?? '—'}</dd>
          <dt className="font-semibold text-muted">ACMG</dt><dd className="m-0">{v.acmg_classification ?? '—'}</dd>
          {v.acmg_criteria && v.acmg_criteria.length > 0 && (
            <><dt className="font-semibold text-muted">ACMG criteria</dt><dd className="m-0">{v.acmg_criteria.join(', ')}</dd></>
          )}
          {v.acmg_reasoning && (
            <><dt className="font-semibold text-muted">ACMG reasoning</dt><dd className="m-0 whitespace-pre-wrap font-sans text-[11px] leading-snug text-muted">{v.acmg_reasoning}</dd></>
          )}
          <dt className="font-semibold text-muted">Diseases</dt><dd className="m-0">{v.diseases?.join('; ') ?? v.disease ?? '—'}</dd>
          <dt className="font-semibold text-muted">Inheritance</dt><dd className="m-0">{v.inheritance ?? '—'}</dd>
          {v.tags && v.tags.length > 0 && (
            <><dt className="font-semibold text-muted">Tags</dt><dd className="m-0">{v.tags.join(', ')}</dd></>
          )}
          {v.curated_classification && (
            <><dt className="font-semibold text-muted">Curated classification</dt><dd className="m-0">{v.curated_classification}</dd></>
          )}
          {v.curated_notes && (
            <><dt className="font-semibold text-muted">Curated notes</dt><dd className="m-0">{v.curated_notes}</dd></>
          )}
        </dl>
      </Card.Content>
    </Card>
  );
}

export function VariantTable({ orderId }: { orderId: string }) {
  const {
    reviewData, selectedVariants, toggleVariant, selectAll, clearSelection,
    setVariantComment, variantComments, setReviewData,
  } = useReviewStore();

  const [classifying, setClassifying] = useState(false);

  const [search, setSearch] = useState('');
  const [acmgFilter, setAcmgFilter] = useState('');
  const [geneFilter, setGeneFilter] = useState('');
  const [clinvarFilter, setClinvarFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [vafMode, setVafMode] = useState('');
  const [vafFrom, setVafFrom] = useState('');
  const [vafTo, setVafTo] = useState('');

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const [detailId, setDetailId] = useState<string | null>(null);

  const variants = reviewData?.variants ?? [];

  const geneOptions = useMemo(() => {
    const genes = [...new Set(variants.map((v) => v.gene).filter(Boolean))].sort();
    return [{ value: '', label: 'All Genes' }, ...genes.map((g) => ({ value: g!, label: g! }))];
  }, [variants]);

  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    variants.forEach((v) => v.tags?.forEach((t) => tags.add(t)));
    return [{ value: '', label: 'All tags' }, ...[...tags].sort().map((t) => ({ value: t, label: t }))];
  }, [variants]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev !== key) { setSortDir('asc'); return key; }
      setSortDir((d) => {
        if (d === 'asc') return 'desc';
        setSortKey(null);
        return null;
      });
      return key;
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const vafFromN = vafFrom ? parseFloat(vafFrom) / 100 : null;
    const vafToN   = vafTo   ? parseFloat(vafTo) / 100   : null;

    return variants.filter((v) => {
      if (q) {
        const searchable = [
          v.gene, v.hgvsc, v.hgvsp, v.chrom ? `${v.chrom}:${v.pos}` : '',
          v.effect, ...(v.diseases ?? [v.disease ?? '']),
          v.clinvar_sig_primary, v.acmg_classification,
        ].join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (acmgFilter && v.acmg_classification !== acmgFilter) return false;
      if (geneFilter && v.gene !== geneFilter) return false;
      if (clinvarFilter) {
        const cl = clinvarLabel(v).toLowerCase();
        if (!cl.includes(clinvarFilter.toLowerCase())) return false;
      }
      if (tagFilter && !(v.tags ?? []).includes(tagFilter)) return false;
      if (vafMode && v.vaf != null) {
        const inRange = (vafFromN == null || v.vaf >= vafFromN) && (vafToN == null || v.vaf <= vafToN);
        if (vafMode === 'include' && !inRange) return false;
        if (vafMode === 'exclude' && inRange) return false;
      }
      return true;
    });
  }, [variants, search, acmgFilter, geneFilter, clinvarFilter, tagFilter, vafMode, vafFrom, vafTo]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const handleClassify = async () => {
    const toClassify = filtered.slice(0, 200).map((v) => ({
      variant_id: v.variant_id, chrom: v.chrom, pos: v.pos,
      ref: v.ref, alt: v.alt, gene: v.gene,
    }));
    setClassifying(true);
    try {
      const res = await reviewApi.classify(orderId, { variants: toClassify });
      if (reviewData) {
        const updated = reviewData.variants.map((v) => {
          const r = res.results.find((r) => r.variant_id === v.variant_id);
          return r ? { ...v, ...r } : v;
        });
        setReviewData({ ...reviewData, variants: updated });
      }
    } finally {
      setClassifying(false);
    }
  };

  const autoSelectPathogenic = () => {
    const ids = variants
      .filter((v) => {
        const cls = v.acmg_classification ?? '';
        return cls === 'Pathogenic' || cls === 'Likely_pathogenic' || cls === 'Likely pathogenic';
      })
      .map((v) => v.variant_id);
    selectAll(ids);
  };

  const visibleIds = sorted.map((v) => v.variant_id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedVariants.has(id));

  const thProps = { current: sortKey, dir: sortDir, onSort: handleSort };

  const acmgOptions = [
    { value: '', label: 'All Classifications' },
    ...ACMG_CLASSES.map((c) => ({ value: c, label: c.replace(/_/g, ' ') })),
  ];

  const vafModeOptions = [
    { value: '', label: 'Any' },
    { value: 'include', label: 'Show range' },
    { value: 'exclude', label: 'Hide range' },
  ];

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search gene, position, disease…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[260px]"
          aria-label="Search variants"
        />
        <FilterSelect value={acmgFilter} onChange={setAcmgFilter} options={acmgOptions} ariaLabel="ACMG classification" />
        <FilterSelect value={geneFilter} onChange={setGeneFilter} options={geneOptions} ariaLabel="Gene filter" />
        <FilterSelect value={clinvarFilter} onChange={setClinvarFilter} options={CLINVAR_OPTIONS} ariaLabel="ClinVar filter" />
        {tagOptions.length > 1 && (
          <FilterSelect value={tagFilter} onChange={setTagFilter} options={tagOptions} ariaLabel="Tag filter" />
        )}

        <span className="text-[11px] font-semibold text-muted">VAF</span>
        <FilterSelect value={vafMode} onChange={setVafMode} options={vafModeOptions} ariaLabel="VAF mode" className="min-w-[100px]" />
        {vafMode && (
          <>
            <Input
              type="number" min={0} max={100} step={0.1} placeholder="from %"
              value={vafFrom} onChange={(e) => setVafFrom(e.target.value)}
              className="w-[72px]" aria-label="VAF from"
            />
            <span className="text-muted">–</span>
            <Input
              type="number" min={0} max={100} step={0.1} placeholder="to %"
              value={vafTo} onChange={(e) => setVafTo(e.target.value)}
              className="w-[72px]" aria-label="VAF to"
            />
          </>
        )}

        <span className="whitespace-nowrap text-[11px] text-muted">
          {sorted.length} variant{sorted.length !== 1 ? 's' : ''}
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
          <Button size="sm" variant="ghost" onPress={autoSelectPathogenic} className="gap-1.5">
            <ShieldAlert size={14} strokeWidth={2} aria-hidden />
            Select P/LP
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

      {detailId && (() => {
        const v = variants.find((x) => x.variant_id === detailId);
        return v ? <VariantDetail variant={v} onClose={() => setDetailId(null)} /> : null;
      })()}

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-muted">No variants match the current filters.</p>
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky top-0 z-10 w-10 bg-surface px-2.5 py-1.5 text-center">
                  <TableCheckbox
                    isSelected={allVisibleSelected}
                    aria-label="Select all visible variants"
                    onChange={(checked) => (checked ? selectAll(visibleIds) : clearSelection())}
                  />
                </th>
                <SortableTh label="Gene"         sortKey="gene"              {...thProps} />
                <SortableTh label="HGVSc"        sortKey="hgvsc"             {...thProps} />
                <SortableTh label="HGVSp"        sortKey="hgvsp"             {...thProps} />
                <SortableTh label="Transcript (NM)" sortKey="clinical_nm"    {...thProps} title="Clinical NM transcript" />
                <SortableTh label="Effect"       sortKey="effect"            {...thProps} />
                <SortableTh label="Zygosity"     sortKey="zygosity"          {...thProps} />
                <th className="sticky top-0 z-10 bg-surface px-2.5 py-1.5 text-left text-[11px] uppercase tracking-wide text-muted" title="REF/ALT depth">Allele depth</th>
                <SortableTh label="gnomAD AF"    sortKey="gnomad_af"         {...thProps} />
                <SortableTh label="ClinVar"      sortKey="clinvar_sig_primary" {...thProps} />
                <SortableTh label="ACMG"         sortKey="acmg_classification" {...thProps} />
                <th className="sticky top-0 z-10 bg-surface px-2.5 py-1.5 text-left text-[11px] uppercase tracking-wide text-muted">Tags</th>
                <th className="sticky top-0 z-10 bg-surface px-2.5 py-1.5 text-left text-[11px] uppercase tracking-wide text-muted">Disease</th>
                <th className="sticky top-0 z-10 bg-surface px-2.5 py-1.5 text-left text-[11px] uppercase tracking-wide text-muted">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((v) => (
                <VariantRow
                  key={v.variant_id}
                  variant={v}
                  selected={selectedVariants.has(v.variant_id)}
                  expanded={detailId === v.variant_id}
                  onToggle={() => toggleVariant(v.variant_id)}
                  onDetail={() => setDetailId((prev) => prev === v.variant_id ? null : v.variant_id)}
                  comment={variantComments[v.variant_id]}
                  onCommentChange={(c) => setVariantComment(v.variant_id, c)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VariantRow({
  variant: v, selected, expanded, onToggle, onDetail, comment, onCommentChange,
}: {
  variant: Variant;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDetail: () => void;
  comment?: { classification?: AcmgClass; comment?: string };
  onCommentChange: (c: { classification?: AcmgClass; comment?: string }) => void;
}) {
  const cvLabel = clinvarLabel(v);
  const rowClass = selected ? 'bg-accent/10' : expanded ? 'bg-accent/5' : 'hover:bg-accent/5';

  const overrideOptions = [
    { value: '', label: '— auto —' },
    ...ACMG_CLASSES.map((c) => ({ value: c, label: c.replace(/_/g, ' ') })),
  ];

  return (
    <tr className={`border-b border-border ${rowClass}`}>
      <td className="px-2.5 py-1 text-center">
        <TableCheckbox
          isSelected={selected}
          aria-label={`Select ${v.gene ?? 'variant'}`}
          onChange={() => onToggle()}
        />
      </td>
      <td className="whitespace-nowrap px-2.5 py-1"><strong>{v.gene}</strong></td>
      <td className="whitespace-nowrap px-2.5 py-1 font-mono"><code>{v.hgvsc ?? `${v.chrom}:${v.pos}`}</code></td>
      <td className="whitespace-nowrap px-2.5 py-1 font-mono">{v.hgvsp ? <code>{v.hgvsp}</code> : <span className="text-muted">—</span>}</td>
      <td className="whitespace-nowrap px-2.5 py-1 font-mono text-[11px]">
        <code>{v.clinical_nm ?? (v.transcript ? v.transcript.substring(0, 20) : '—')}</code>
      </td>
      <td className="max-w-[180px] truncate px-2.5 py-1 text-muted" title={v.effect ?? ''}>
        {v.effect ? v.effect.replace(/_variant/g, '').replace(/_/g, ' ').substring(0, 30) : '—'}
      </td>
      <td className="whitespace-nowrap px-2.5 py-1">
        {v.zygosity
          ? <span className="text-[11px] font-semibold">{v.zygosity}</span>
          : <span className="text-muted">—</span>
        }
      </td>
      <td className="whitespace-nowrap px-2.5 py-1 font-mono text-[11px]">{allelDepth(v)}</td>
      <td className="whitespace-nowrap px-2.5 py-1 font-mono text-[11px]">{fmtAf(v.gnomad_af)}</td>
      <td className="whitespace-nowrap px-2.5 py-1">
        {cvLabel
          ? (
            <Chip color={clinvarColor(cvLabel)} size="sm" variant="soft">
              <Chip.Label>{cvLabel}</Chip.Label>
            </Chip>
          )
          : <span className="text-muted">—</span>
        }
      </td>
      <td className="whitespace-nowrap px-2.5 py-1">
        {v.acmg_classification
          ? (
            <Chip color={ACMG_COLOR[v.acmg_classification] ?? 'default'} size="sm" variant="soft">
              <Chip.Label>{v.acmg_classification.replace(/_/g, ' ')}</Chip.Label>
            </Chip>
          )
          : <span className="text-muted">—</span>
        }
      </td>
      <td className="whitespace-nowrap px-2.5 py-1">
        {v.tags && v.tags.length > 0
          ? <span className="text-[11px] text-muted">{v.tags.join(', ')}</span>
          : <span className="text-muted">—</span>
        }
      </td>
      <td className="max-w-[180px] truncate px-2.5 py-1 text-[11px] text-muted" title={v.diseases?.join('; ') ?? v.disease ?? ''}>
        {diseasesLabel(v)}
      </td>
      <td className="whitespace-nowrap px-2.5 py-1">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            isIconOnly
            onPress={onDetail}
            aria-label={expanded ? 'Hide detail' : 'Show detail'}
          >
            {expanded
              ? <ChevronUp size={14} strokeWidth={2} aria-hidden />
              : <ChevronDown size={14} strokeWidth={2} aria-hidden />}
          </Button>
          <FilterSelect
            value={comment?.classification ?? ''}
            onChange={(val) => onCommentChange({ classification: (val || undefined) as AcmgClass })}
            options={overrideOptions}
            ariaLabel="Override ACMG classification"
            className="max-w-[110px]"
          />
        </div>
      </td>
    </tr>
  );
}
