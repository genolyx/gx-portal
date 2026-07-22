'use client';

import { useState, useMemo, useCallback } from 'react';
import { reviewApi } from '../../../lib/api/review';
import { useReviewStore } from '../../../lib/store/reviewStore';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import type { Variant, AcmgClass } from '@gx-portal/types';
import styles from './VariantTable.module.css';

// ─── constants ────────────────────────────────────────────────────────────────

const ACMG_VARIANT: Record<string, 'danger' | 'warning' | 'default' | 'success'> = {
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

// ─── helpers ──────────────────────────────────────────────────────────────────

function clinvarLabel(v: Variant): string {
  return v.clinvar_sig_primary ?? v.clinvar_sig ?? v.clinvar_significance ?? '';
}

function clinvarVariant(label: string): 'danger' | 'warning' | 'default' | 'success' {
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

// ─── sub-components ───────────────────────────────────────────────────────────

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
      className={`${styles.sortable} ${active ? styles.sortActive : ''} ${className ?? ''}`}
      title={title}
      onClick={() => onSort(sortKey)}
    >
      {label}{arrow && <span className={styles.sortArrow}>{arrow}</span>}
    </th>
  );
}

function VariantDetail({ variant: v, onClose }: { variant: Variant; onClose: () => void }) {
  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailHeader}>
        <strong>{v.gene} — {v.hgvsc ?? `${v.chrom}:${v.pos} ${v.ref}>${v.alt}`}</strong>
        <button type="button" className={styles.detailClose} onClick={onClose}>✕</button>
      </div>
      <div className={styles.detailGrid}>
        {v.hgvsp && <><dt>HGVSp</dt><dd><code>{v.hgvsp}</code></dd></>}
        <dt>Transcript (NM)</dt><dd><code>{v.clinical_nm ?? v.transcript ?? '—'}</code></dd>
        <dt>Canonical ENST</dt><dd><code>{v.canonical_enst ?? '—'}</code></dd>
        <dt>Effect</dt><dd>{v.effect ?? '—'}</dd>
        <dt>Zygosity</dt><dd>{v.zygosity ?? '—'}</dd>
        <dt>GT</dt><dd>{v.gt ?? '—'}</dd>
        <dt>DP / REF / ALT</dt><dd>{v.dp ?? '—'} / {v.ref_depth ?? '—'} / {v.alt_depth ?? '—'}</dd>
        <dt>VAF</dt><dd>{v.vaf != null ? (v.vaf * 100).toFixed(1) + '%' : '—'}</dd>
        <dt>gnomAD AF (exomes)</dt><dd>{fmtAf(v.gnomad_exomes_af)}</dd>
        <dt>gnomAD AF (genomes)</dt><dd>{fmtAf(v.gnomad_genomes_af)}</dd>
        <dt>ClinVar sig.</dt><dd>{clinvarLabel(v) || '—'}</dd>
        <dt>ClinVar ID</dt><dd>{v.clinvar_variation_id ?? v.clinvar_id ?? '—'}</dd>
        <dt>dbSNP</dt><dd>{v.dbsnp_rsid ?? '—'}</dd>
        <dt>HGMD class</dt><dd>{v.hgmd_class ?? '—'}</dd>
        <dt>ACMG</dt><dd>{v.acmg_classification ?? '—'}</dd>
        {v.acmg_criteria && v.acmg_criteria.length > 0 && (
          <><dt>ACMG criteria</dt><dd>{v.acmg_criteria.join(', ')}</dd></>
        )}
        {v.acmg_reasoning && (
          <><dt>ACMG reasoning</dt><dd className={styles.detailPre}>{v.acmg_reasoning}</dd></>
        )}
        <dt>Diseases</dt><dd>{v.diseases?.join('; ') ?? v.disease ?? '—'}</dd>
        <dt>Inheritance</dt><dd>{v.inheritance ?? '—'}</dd>
        {v.tags && v.tags.length > 0 && (
          <><dt>Tags</dt><dd>{v.tags.join(', ')}</dd></>
        )}
        {v.curated_classification && (
          <><dt>Curated classification</dt><dd>{v.curated_classification}</dd></>
        )}
        {v.curated_notes && (
          <><dt>Curated notes</dt><dd>{v.curated_notes}</dd></>
        )}
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function VariantTable({ orderId }: { orderId: string }) {
  const {
    reviewData, selectedVariants, toggleVariant, selectAll, clearSelection,
    setVariantComment, variantComments, setReviewData,
  } = useReviewStore();

  const [classifying, setClassifying] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [acmgFilter, setAcmgFilter] = useState('');
  const [geneFilter, setGeneFilter] = useState('');
  const [clinvarFilter, setClinvarFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [vafMode, setVafMode] = useState('');
  const [vafFrom, setVafFrom] = useState('');
  const [vafTo, setVafTo] = useState('');

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Expanded detail
  const [detailId, setDetailId] = useState<string | null>(null);

  const variants = reviewData?.variants ?? [];

  // Build gene list for dropdown
  const geneOptions = useMemo(() => {
    const genes = [...new Set(variants.map((v) => v.gene).filter(Boolean))].sort();
    return genes;
  }, [variants]);

  // Build tag list
  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    variants.forEach((v) => v.tags?.forEach((t) => tags.add(t)));
    return [...tags].sort();
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

  return (
    <div>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <input
          placeholder="Search gene, position, disease…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.filterInput}
          style={{ maxWidth: 260 }}
        />
        <select value={acmgFilter} onChange={(e) => setAcmgFilter(e.target.value)} className={styles.filterInput}>
          <option value="">All Classifications</option>
          {ACMG_CLASSES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={geneFilter} onChange={(e) => setGeneFilter(e.target.value)} className={styles.filterInput}>
          <option value="">All Genes</option>
          {geneOptions.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={clinvarFilter} onChange={(e) => setClinvarFilter(e.target.value)} className={styles.filterInput}>
          {CLINVAR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {tagOptions.length > 0 && (
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={styles.filterInput}>
            <option value="">All tags</option>
            {tagOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        {/* VAF filter */}
        <span className={styles.muted} style={{ fontSize: 11, fontWeight: 600 }}>VAF</span>
        <select value={vafMode} onChange={(e) => setVafMode(e.target.value)} className={styles.filterInput}>
          <option value="">Any</option>
          <option value="include">Show range</option>
          <option value="exclude">Hide range</option>
        </select>
        {vafMode && (
          <>
            <input
              type="number" min={0} max={100} step={0.1} placeholder="from %"
              value={vafFrom} onChange={(e) => setVafFrom(e.target.value)}
              className={styles.filterInput} style={{ width: 72 }}
            />
            <span className={styles.muted}>–</span>
            <input
              type="number" min={0} max={100} step={0.1} placeholder="to %"
              value={vafTo} onChange={(e) => setVafTo(e.target.value)}
              className={styles.filterInput} style={{ width: 72 }}
            />
          </>
        )}

        <span className={styles.count}>{sorted.length} variant{sorted.length !== 1 ? 's' : ''}</span>

        <div className={styles.actions}>
          <Button size="sm" variant="secondary" loading={classifying} onClick={handleClassify}>
            🔍 Classify
          </Button>
          <Button size="sm" variant="ghost" onClick={autoSelectPathogenic}>Select P/LP</Button>
          <Button size="sm" variant="ghost" onClick={() => selectAll(visibleIds)}>Select All Visible</Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>Deselect All</Button>
          <span className={styles.count}>
            {selectedVariants.size} selected
          </span>
        </div>
      </div>

      {/* ── Detail panel ── */}
      {detailId && (() => {
        const v = variants.find((x) => x.variant_id === detailId);
        return v ? <VariantDetail variant={v} onClose={() => setDetailId(null)} /> : null;
      })()}

      {sorted.length === 0 ? (
        <p className={styles.empty}>No variants match the current filters.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => e.target.checked ? selectAll(visibleIds) : clearSelection()}
                  />
                </th>
                <SortableTh label="Gene"         sortKey="gene"              {...thProps} />
                <SortableTh label="HGVSc"        sortKey="hgvsc"             {...thProps} />
                <SortableTh label="HGVSp"        sortKey="hgvsp"             {...thProps} />
                <SortableTh label="Transcript (NM)" sortKey="clinical_nm"    {...thProps} title="Clinical NM transcript" />
                <SortableTh label="Effect"       sortKey="effect"            {...thProps} />
                <SortableTh label="Zygosity"     sortKey="zygosity"          {...thProps} />
                <th title="REF/ALT depth">Allele depth</th>
                <SortableTh label="gnomAD AF"    sortKey="gnomad_af"         {...thProps} />
                <SortableTh label="ClinVar"      sortKey="clinvar_sig_primary" {...thProps} />
                <SortableTh label="ACMG"         sortKey="acmg_classification" {...thProps} />
                <th>Tags</th>
                <th>Disease</th>
                <th>Action</th>
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

// ─── row ──────────────────────────────────────────────────────────────────────

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

  return (
    <tr className={`${selected ? styles.selected : ''} ${expanded ? styles.expanded : ''}`}>
      <td style={{ textAlign: 'center' }}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td><strong>{v.gene}</strong></td>
      <td className={styles.mono}><code>{v.hgvsc ?? `${v.chrom}:${v.pos}`}</code></td>
      <td className={styles.mono}>{v.hgvsp ? <code>{v.hgvsp}</code> : <span className={styles.muted}>—</span>}</td>
      <td className={styles.mono} style={{ fontSize: 11 }}>
        <code>{v.clinical_nm ?? (v.transcript ? v.transcript.substring(0, 20) : '—')}</code>
      </td>
      <td className={`${styles.muted} ${styles.effectCell}`} title={v.effect ?? ''}>
        {v.effect ? v.effect.replace(/_variant/g, '').replace(/_/g, ' ').substring(0, 30) : '—'}
      </td>
      <td>
        {v.zygosity
          ? <span className={styles.zyg}>{v.zygosity}</span>
          : <span className={styles.muted}>—</span>
        }
      </td>
      <td className={styles.mono} style={{ fontSize: 11 }}>{allelDepth(v)}</td>
      <td className={styles.mono} style={{ fontSize: 11 }}>{fmtAf(v.gnomad_af)}</td>
      <td>
        {cvLabel
          ? <Badge variant={clinvarVariant(cvLabel)} className={styles.badgeSm}>{cvLabel}</Badge>
          : <span className={styles.muted}>—</span>
        }
      </td>
      <td>
        {v.acmg_classification
          ? (
            <Badge variant={ACMG_VARIANT[v.acmg_classification] ?? 'default'} className={styles.badgeSm}>
              {v.acmg_classification.replace(/_/g, ' ')}
            </Badge>
          )
          : <span className={styles.muted}>—</span>
        }
      </td>
      <td>
        {v.tags && v.tags.length > 0
          ? <span className={styles.tags}>{v.tags.join(', ')}</span>
          : <span className={styles.muted}>—</span>
        }
      </td>
      <td className={styles.diseaseCell} title={v.diseases?.join('; ') ?? v.disease ?? ''}>
        {diseasesLabel(v)}
      </td>
      <td>
        <div className={styles.rowActions}>
          <button type="button" className={styles.detailBtn} onClick={onDetail} title="Show detail">
            {expanded ? '▲' : '▼'}
          </button>
          <select
            value={comment?.classification ?? ''}
            onChange={(e) => onCommentChange({ classification: (e.target.value || undefined) as AcmgClass })}
            className={styles.overrideSelect}
            title="Override ACMG classification"
          >
            <option value="">— auto —</option>
            {ACMG_CLASSES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </td>
    </tr>
  );
}
