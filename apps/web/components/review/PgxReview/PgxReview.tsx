'use client';

import { useState } from 'react';
import { reviewApi } from '../../../lib/api/review';
import { useReviewStore } from '../../../lib/store/reviewStore';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import styles from './PgxReview.module.css';

export function PgxReview({ orderId }: { orderId: string }) {
  const { reviewData, setReviewData } = useReviewStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const pgx = reviewData?.pgx;

  if (!pgx) {
    return <p className={styles.empty}>No PGx data available for this order.</p>;
  }

  const allGenes = [
    ...(pgx.gene_results ?? []),
    ...(pgx.custom_gene_results ?? []),
  ];

  const toggleConfirm = (gene: string, confirmed: boolean) => {
    if (!reviewData || !reviewData.pgx) return;
    const updatedResults = (reviewData.pgx.gene_results ?? []).map((g) =>
      g.gene === gene ? { ...g, reviewer_confirmed: confirmed } : g,
    );
    const updatedCustom = (reviewData.pgx.custom_gene_results ?? []).map((g) =>
      g.gene === gene ? { ...g, reviewer_confirmed: confirmed } : g,
    );
    setReviewData({
      ...reviewData,
      pgx: { ...reviewData.pgx, gene_results: updatedResults, custom_gene_results: updatedCustom },
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
      <div className={styles.toolbar}>
        <h3 className={styles.title}>PGx Review</h3>
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Review'}
        </Button>
      </div>

      <div className={styles.grid}>
        {allGenes.map((g) => (
          <div key={g.gene} className={`${styles.card} ${g.reviewer_confirmed ? styles.confirmed : ''}`}>
            <div className={styles.cardHeader}>
              <strong>{g.gene}</strong>
              <label className={styles.confirmToggle}>
                <input
                  type="checkbox"
                  checked={g.reviewer_confirmed ?? false}
                  onChange={(e) => toggleConfirm(g.gene, e.target.checked)}
                />
                Confirmed
              </label>
            </div>
            {g.diplotype && <p className={styles.diplotype}>{g.diplotype}</p>}
            {g.phenotype && <Badge variant="info">{g.phenotype}</Badge>}
            {g.activity_score !== undefined && (
              <p className={styles.detail}>Activity score: {g.activity_score}</p>
            )}
            {g.recommendations && g.recommendations.length > 0 && (
              <ul className={styles.recs}>
                {g.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
