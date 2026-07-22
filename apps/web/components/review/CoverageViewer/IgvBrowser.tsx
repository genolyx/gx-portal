'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { CoverageContext } from '@gx-portal/types';
import styles from './CoverageViewer.module.css';

declare global {
  interface Window {
    igv: {
      createBrowser: (container: HTMLElement, options: unknown) => Promise<IgvBrowserInstance>;
      removeBrowser: (browser: IgvBrowserInstance) => void;
    };
  }
}

interface IgvBrowserInstance {
  search: (locus: string) => Promise<void>;
  loadTrack: (config: unknown) => Promise<unknown>;
  removeTrackByName: (name: string) => void;
}

export interface IgvBrowserHandle {
  navigateTo: (locus: string) => void;
  loadBedTrack: (url: string, name?: string) => void;
  removeBedTrack: (name: string) => void;
  loadMarker: (chrom: string, pos: number, name?: string) => void;
  clearMarker: () => void;
}

interface Props {
  context: CoverageContext;
  orderId: string;
  onLoad?: () => void;
}

let igvLoaded = false;

async function ensureIgv(): Promise<void> {
  if (igvLoaded || typeof window.igv !== 'undefined') { igvLoaded = true; return; }
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/igv@2.15.5/dist/igv.min.js';
    s.onload = () => { igvLoaded = true; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

const IgvBrowser = forwardRef<IgvBrowserHandle, Props>(function IgvBrowser({ context, orderId, onLoad }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const browserRef   = useRef<IgvBrowserInstance | null>(null);

  const MARKER_TRACK = 'Position Marker';

  useImperativeHandle(ref, () => ({
    navigateTo: (locus) => { browserRef.current?.search(locus); },
    loadBedTrack: (url, name = 'BED') => {
      browserRef.current?.loadTrack({ type: 'annotation', format: 'bed', url, name, displayMode: 'EXPANDED' });
    },
    removeBedTrack: (name) => { browserRef.current?.removeTrackByName(name); },
    loadMarker: (chrom, pos, name = '') => {
      const b = browserRef.current;
      if (!b) return;
      // Remove existing marker first
      try { b.removeTrackByName(MARKER_TRACK); } catch { /* ignore */ }
      // BED is 0-based half-open: pos-1 to pos marks the base at pos
      const label = name || `${chrom}:${pos}`;
      const bedContent = `${chrom}\t${pos - 1}\t${pos}\t${label}`;
      const url = `data:text/plain,${encodeURIComponent(bedContent)}`;
      b.loadTrack({
        type: 'annotation',
        format: 'bed',
        url,
        name: MARKER_TRACK,
        color: 'red',
        altColor: 'red',
        displayMode: 'SQUISHED',
        height: 20,
        showGenomicNumberLine: false,
      });
    },
    clearMarker: () => {
      try { browserRef.current?.removeTrackByName(MARKER_TRACK); } catch { /* ignore */ }
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Guard against React StrictMode double-mount: if a browser already exists, skip
    if (browserRef.current) return;

    let active = true;

    (async () => {
      await ensureIgv();
      if (!active || !window.igv || browserRef.current) return;

      const bamLabel = context.bam_tracks?.[context.bam_tracks.length - 1]?.label
        ?? context.bam_path?.split('/').pop()
        ?? 'Alignment';

      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '/api';

      const tracks: unknown[] = [];
      if (context.bam_path) {
        tracks.push({
          name: bamLabel,
          // Use dedicated /review/:orderId/bam endpoint (supports range requests + absolute path)
          url:      `${apiBase}/review/${orderId}/bam`,
          indexURL: `${apiBase}/review/${orderId}/bai`,
          format: context.bam_path.endsWith('.cram') ? 'cram' : 'bam',
          type: 'alignment',
          height: 200,
          showSoftClips: true,
          colorBy: 'strand',
        });
      }

      const initialLocus = context.target_genes?.[0] ?? 'chr1:1-10000';

      try {
        const browser = await window.igv.createBrowser(container, {
          genome: context.genome ?? context.genome_id ?? 'hg38',
          locus: initialLocus,
          tracks,
        });
        if (active) {
          browserRef.current = browser;
          onLoad?.();
        } else {
          // Cleaned up while browser was being created — remove it immediately
          window.igv.removeBrowser?.(browser);
          container.innerHTML = '';
        }
      } catch (e) {
        console.error('IGV init error:', e);
      }
    })();

    return () => {
      active = false;
      if (browserRef.current) {
        try { window.igv?.removeBrowser?.(browserRef.current); } catch { /* ignore */ }
        container.innerHTML = '';
        browserRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, orderId]);

  return <div ref={containerRef} className={styles.igvContainer} />;
});

export default IgvBrowser;
