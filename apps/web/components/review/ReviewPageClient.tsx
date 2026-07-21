'use client';

import { useEffect, useState } from 'react';
import { reviewApi } from '../../lib/api/review';
import { useReviewStore } from '../../lib/store/reviewStore';
import { PageHeader } from '../ui/PageHeader';
import { VariantTable } from './VariantTable/VariantTable';
import { DarkGenesPanel } from './DarkGenesPanel/DarkGenesPanel';
import { PgxReview } from './PgxReview/PgxReview';
import { CoverageViewer } from './CoverageViewer/CoverageViewer';
import { ReportBuilder } from './ReportBuilder/ReportBuilder';
import styles from './Review.module.css';

type Tab = 'variants' | 'dark_genes' | 'pgx' | 'coverage' | 'report';

const TABS: { id: Tab; label: string }[] = [
  { id: 'variants', label: 'Variants' },
  { id: 'dark_genes', label: 'Dark Genes' },
  { id: 'pgx', label: 'PGx' },
  { id: 'coverage', label: 'Coverage / IGV' },
  { id: 'report', label: 'Report' },
];

export function ReviewPageClient({ orderId }: { orderId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('variants');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { setReviewData, reviewData, reset } = useReviewStore();

  useEffect(() => {
    reset();
    reviewApi.getResult(orderId)
      .then(setReviewData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load review data'))
      .finally(() => setLoading(false));
  }, [orderId, reset, setReviewData]);

  if (loading) return <p className={styles.center}>Loading review data…</p>;
  if (error)   return <p className={styles.center} style={{ color: 'var(--danger)' }}>{error}</p>;
  if (!reviewData) return null;

  const serviceCode = reviewData.service_code ?? reviewData._service_code ?? '';

  return (
    <div>
      <PageHeader
        title="Review"
        description={`Order: ${orderId} · Service: ${serviceCode}`}
        backHref="/orders"
      />

      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.active : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.panel}>
        {activeTab === 'variants'   && <VariantTable orderId={orderId} />}
        {activeTab === 'dark_genes' && <DarkGenesPanel />}
        {activeTab === 'pgx'        && <PgxReview orderId={orderId} />}
        {activeTab === 'coverage'   && <CoverageViewer orderId={orderId} />}
        {activeTab === 'report'     && <ReportBuilder orderId={orderId} />}
      </div>
    </div>
  );
}
