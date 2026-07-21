'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { reviewApi } from '../../../lib/api/review';
import type { CoverageContext } from '@gx-portal/types';
import styles from './CoverageViewer.module.css';

const IgvBrowser = dynamic(() => import('./IgvBrowser'), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading IGV browser…</div>,
});

export function CoverageViewer({ orderId }: { orderId: string }) {
  const [context, setContext] = useState<CoverageContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    reviewApi.getCoverageContext(orderId)
      .then(setContext)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load coverage context'))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <p className={styles.loading}>Loading coverage context…</p>;
  if (error)   return <p className={styles.error}>{error}</p>;
  if (!context?.bam_path) {
    return <p className={styles.empty}>No BAM file available for this order.</p>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.info}>
          Genome: <strong>{context.genome ?? 'hg38'}</strong> &nbsp;·&nbsp;
          BAM: <code>{context.bam_path.split('/').pop()}</code>
        </span>
      </div>
      <IgvBrowser context={context} orderId={orderId} />
    </div>
  );
}
