'use client';

import { useState } from 'react';
import { reviewApi } from '../../../lib/api/review';
import { useReviewStore } from '../../../lib/store/reviewStore';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import type { Variant, AcmgClass } from '@gx-portal/types';
import styles from './VariantTable.module.css';

const ACMG_VARIANT: Record<string, 'danger' | 'warning' | 'default' | 'success'> = {
  Pathogenic: 'danger',
  Likely_pathogenic: 'warning',
  Uncertain_significance: 'default',
  Likely_benign: 'success',
  Benign: 'success',
};

const ACMG_CLASSES: AcmgClass[] = [
  'Pathogenic', 'Likely_pathogenic', 'Uncertain_significance', 'Likely_benign', 'Benign',
];

export function VariantTable({ orderId }: { orderId: string }) {
  const { reviewData, selectedVariants, toggleVariant, selectAll, clearSelection,
          setVariantComment, variantComments, setReviewData } = useReviewStore();
  const [classifying, setClassifying] = useState(false);
  const [geneFilter, setGeneFilter] = useState('');
  const [acmgFilter, setAcmgFilter] = useState('');

  const variants = reviewData?.variants ?? [];

  const filtered = variants.filter((v) => {
    if (geneFilter && !v.gene?.toLowerCase().includes(geneFilter.toLowerCase())) return false;
    if (acmgFilter && v.acmg_classification !== acmgFilter) return false;
    return true;
  });

  const handleClassify = async () => {
    const toClassify = filtered.slice(0, 200).map((v) => ({
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
        const updatedVariants = reviewData.variants.map((v) => {
          const r = res.results.find((r) => r.variant_id === v.variant_id);
          return r ? { ...v, ...r } : v;
        });
        setReviewData({ ...reviewData, variants: updatedVariants });
      }
    } finally {
      setClassifying(false);
    }
  };

  const autoSelectPathogenic = () => {
    const ids = variants
      .filter((v) => v.acmg_classification === 'Pathogenic' || v.acmg_classification === 'Likely_pathogenic')
      .map((v) => v.variant_id);
    selectAll(ids);
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <input
            placeholder="Filter gene…"
            value={geneFilter}
            onChange={(e) => setGeneFilter(e.target.value)}
            className={styles.filterInput}
          />
          <select value={acmgFilter} onChange={(e) => setAcmgFilter(e.target.value)} className={styles.filterInput}>
            <option value="">All ACMG</option>
            {ACMG_CLASSES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className={styles.actions}>
          <Button size="sm" variant="secondary" loading={classifying} onClick={handleClassify}>
            Classify All
          </Button>
          <Button size="sm" variant="ghost" onClick={autoSelectPathogenic}>
            Select P/LP
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            Clear
          </Button>
          <span className={styles.count}>
            {selectedVariants.size} / {filtered.length} selected
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.empty}>No variants.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" onChange={(e) => e.target.checked ? selectAll(filtered.map((v) => v.variant_id)) : clearSelection()} /></th>
                <th>Gene</th>
                <th>Variant</th>
                <th>Effect</th>
                <th>Zygosity</th>
                <th>ACMG</th>
                <th>ClinVar</th>
                <th>gnomAD AF</th>
                <th>Classification Override</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <VariantRow
                  key={v.variant_id}
                  variant={v}
                  selected={selectedVariants.has(v.variant_id)}
                  onToggle={() => toggleVariant(v.variant_id)}
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
  variant: v, selected, onToggle, comment, onCommentChange,
}: {
  variant: Variant;
  selected: boolean;
  onToggle: () => void;
  comment?: { classification?: AcmgClass; comment?: string };
  onCommentChange: (c: { classification?: AcmgClass; comment?: string }) => void;
}) {
  return (
    <tr className={selected ? styles.selected : ''}>
      <td><input type="checkbox" checked={selected} onChange={onToggle} /></td>
      <td><strong>{v.gene}</strong></td>
      <td className={styles.variant}>
        <code>{v.hgvsc ?? `${v.chrom}:${v.pos} ${v.ref}>${v.alt}`}</code>
        {v.hgvsp && <br />}
        {v.hgvsp && <code className={styles.hgvsp}>{v.hgvsp}</code>}
      </td>
      <td className={styles.muted}>{v.effect ?? '—'}</td>
      <td><Badge variant="default">{v.zygosity ?? '—'}</Badge></td>
      <td>
        {v.acmg_classification ? (
          <Badge variant={ACMG_VARIANT[v.acmg_classification] ?? 'default'}>
            {v.acmg_classification.replace(/_/g, ' ')}
          </Badge>
        ) : '—'}
      </td>
      <td className={styles.muted}>{v.clinvar_significance ?? '—'}</td>
      <td className={styles.muted}>
        {v.gnomad_af !== undefined ? v.gnomad_af.toExponential(2) : '—'}
      </td>
      <td>
        <select
          value={comment?.classification ?? ''}
          onChange={(e) => onCommentChange({ classification: (e.target.value || undefined) as AcmgClass })}
          className={styles.overrideSelect}
        >
          <option value="">— auto —</option>
          {ACMG_CLASSES.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </td>
    </tr>
  );
}
