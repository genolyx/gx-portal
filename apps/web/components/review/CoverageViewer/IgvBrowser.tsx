'use client';

import { useEffect, useRef } from 'react';
import type { CoverageContext } from '@gx-portal/types';
import styles from './CoverageViewer.module.css';

declare global {
  interface Window {
    igv: {
      createBrowser: (container: HTMLElement, options: unknown) => Promise<unknown>;
    };
  }
}

interface Props {
  context: CoverageContext;
  orderId: string;
}

let igvLoaded = false;

async function ensureIgv(): Promise<void> {
  if (igvLoaded || typeof window.igv !== 'undefined') {
    igvLoaded = true;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/igv@2.15.5/dist/igv.min.js';
    s.onload = () => { igvLoaded = true; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function IgvBrowser({ context, orderId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    let cancelled = false;

    (async () => {
      await ensureIgv();
      if (cancelled || !window.igv) return;

      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

      const tracks: unknown[] = [
        {
          name: 'Coverage',
          url: `${apiBase}/orders/${orderId}/files/${encodeURIComponent(context.bam_path ?? '')}`,
          indexURL: context.bam_index_path
            ? `${apiBase}/orders/${orderId}/files/${encodeURIComponent(context.bam_index_path)}`
            : undefined,
          format: 'bam',
          type: 'alignment',
          height: 200,
        },
      ];

      await window.igv.createBrowser(container, {
        genome: context.genome ?? 'hg38',
        locus: context.target_genes?.[0] ? `${context.target_genes[0]}` : 'chr1:1-10000',
        tracks,
      });
    })();

    return () => { cancelled = true; };
  }, [context, orderId]);

  return <div ref={containerRef} className={styles.igvContainer} />;
}
