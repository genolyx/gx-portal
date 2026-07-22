'use client';

import { useState } from 'react';
import { reviewApi } from '../../../lib/api/review';
import { useReviewStore } from '../../../lib/store/reviewStore';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import styles from './PgxReview.module.css';

interface PgxGene {
  gene: string;
  guideline_source?: string;
  diplotype?: string;
  phenotype?: string;
  activity_score?: number | string;
  allele1_function?: string;
  allele2_function?: string;
  call_source?: string;
  category?: string;
  reviewer_confirmed?: boolean;
  reviewer_comment?: string;
  recommendations?: string[];
  [key: string]: unknown;
}

const PHENOTYPE_VARIANT: Record<string, 'danger' | 'warning' | 'default' | 'success' | 'info'> = {
  'Poor Metabolizer':         'danger',
  'Ultrarapid Metabolizer':   'danger',
  'Intermediate Metabolizer': 'warning',
  'Normal Metabolizer':       'success',
  'Rapid Metabolizer':        'warning',
};

function phenotypeVariant(phenotype?: string): 'danger' | 'warning' | 'default' | 'success' | 'info' {
  if (!phenotype) return 'default';
  return PHENOTYPE_VARIANT[phenotype] ?? 'info';
}

export function PgxReview({ orderId }: { orderId: string }) {
  const { reviewData, setReviewData } = useReviewStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const pgx = reviewData?.pgx;

  if (!pgx) {
    return <p className={styles.empty}>No PGx data available for this order.</p>;
  }

  const geneResults: PgxGene[]        = (pgx.gene_results ?? []) as PgxGene[];
  const customResults: PgxGene[]      = (pgx.custom_gene_results ?? []) as PgxGene[];
  const allPharmcatGenes: PgxGene[]   = (pgx.all_pharmcat_genes ?? []) as PgxGene[];
  const apoe = pgx.apoe_diplotype_for_report as { report_key?: string; source?: string } | undefined;

  const actionable  = geneResults.filter((g) => g.category === 'actionable');
  const informative = geneResults.filter((g) => g.category !== 'actionable');

  const toggleConfirm = (gene: string, confirmed: boolean) => {
    if (!reviewData || !reviewData.pgx) return;
    const updateGenes = (list: PgxGene[]) =>
      list.map((g) => g.gene === gene ? { ...g, reviewer_confirmed: confirmed } : g);
    setReviewData({
      ...reviewData,
      pgx: {
        ...reviewData.pgx,
        gene_results:        updateGenes(geneResults) as typeof reviewData.pgx.gene_results,
        custom_gene_results: updateGenes(customResults) as typeof reviewData.pgx.custom_gene_results,
      },
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await reviewApi.savePgx(orderId, pgx);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* toolbar */}
      <div className={styles.toolbar}>
        <h3 className={styles.title}>PGx Pharmacogenomics Review</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {apoe && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              APOE: <strong>{apoe.report_key ?? '—'}</strong>
              {apoe.source && <span> ({apoe.source})</span>}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowSummary((s) => !s)}>
            {showSummary ? 'Hide' : 'Show'} summary text
          </Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            {saved ? '✓ Saved' : 'Save Review'}
          </Button>
        </div>
      </div>

      {/* summary text */}
      {showSummary && pgx.summary_text && (
        <pre style={{
          fontSize: 11, fontFamily: 'ui-monospace, Consolas, monospace',
          padding: '10px 14px', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)',
          marginBottom: 14,
        }}>
          {String(pgx.summary_text)}
        </pre>
      )}

      {/* Actionable genes */}
      {actionable.length > 0 && (
        <>
          <h4 className={styles.groupTitle}>Actionable genes ({actionable.length})</h4>
          <div className={styles.grid}>
            {actionable.map((g) => (
              <GeneCard key={g.gene} gene={g} onToggle={toggleConfirm} />
            ))}
          </div>
        </>
      )}

      {/* Informative genes */}
      {informative.length > 0 && (
        <>
          <h4 className={styles.groupTitle} style={{ marginTop: 16 }}>Informative genes ({informative.length})</h4>
          <div className={styles.grid}>
            {informative.map((g) => (
              <GeneCard key={g.gene} gene={g} onToggle={toggleConfirm} />
            ))}
          </div>
        </>
      )}

      {/* Custom / APOE */}
      {customResults.length > 0 && (
        <>
          <h4 className={styles.groupTitle} style={{ marginTop: 16 }}>Custom genes ({customResults.length})</h4>
          <div className={styles.grid}>
            {customResults.map((g) => (
              <GeneCard key={g.gene} gene={g} onToggle={toggleConfirm} />
            ))}
          </div>
        </>
      )}

      {/* All PharmCAT genes (if present and not already shown) */}
      {allPharmcatGenes.length > 0 && geneResults.length === 0 && (
        <>
          <h4 className={styles.groupTitle}>PharmCAT gene results</h4>
          <div className={styles.grid}>
            {allPharmcatGenes.map((g) => (
              <GeneCard key={g.gene} gene={g} onToggle={toggleConfirm} />
            ))}
          </div>
        </>
      )}

      {geneResults.length === 0 && customResults.length === 0 && allPharmcatGenes.length === 0 && (
        <p className={styles.empty}>No gene results available in PGx data.</p>
      )}
    </div>
  );
}

function GeneCard({ gene: g, onToggle }: { gene: PgxGene; onToggle: (gene: string, confirmed: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`${styles.card} ${g.reviewer_confirmed ? styles.confirmed : ''}`}>
      <div className={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong>{g.gene}</strong>
          {g.guideline_source && (
            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {g.guideline_source}
            </span>
          )}
        </div>
        <label className={styles.confirmToggle}>
          <input
            type="checkbox"
            checked={g.reviewer_confirmed ?? false}
            onChange={(e) => onToggle(g.gene, e.target.checked)}
          />
          Confirmed
        </label>
      </div>

      {g.diplotype && <p className={styles.diplotype}>{g.diplotype}</p>}

      {g.phenotype && (
        <Badge variant={phenotypeVariant(g.phenotype)}>
          {g.phenotype}
        </Badge>
      )}

      {g.activity_score !== undefined && (
        <p className={styles.detail}>Activity score: <strong>{g.activity_score}</strong></p>
      )}

      {(g.allele1_function || g.allele2_function) && (
        <p className={styles.detail} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {g.allele1_function}{g.allele2_function ? ` / ${g.allele2_function}` : ''}
        </p>
      )}

      {g.recommendations && g.recommendations.length > 0 && (
        <ul className={styles.recs}>
          {g.recommendations.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}

      {g.reviewer_comment && (
        <p className={styles.detail}><em>{g.reviewer_comment}</em></p>
      )}

      {/* expand for extra details */}
      {(g.call_source) && (
        <button type="button" className={styles.expandBtn} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Less ▲' : 'More ▼'}
        </button>
      )}
      {expanded && (
        <div className={styles.expandBody}>
          {g.call_source && <p className={styles.detail}>Call source: {g.call_source}</p>}
          {g.category    && <p className={styles.detail}>Category: {g.category}</p>}
        </div>
      )}
    </div>
  );
}
