'use client';

import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';
import type { CoverageContext } from '@gx-portal/types';
import { orderArtifactUrl } from '../../../lib/api/review';
import { coverageBamIndexRel, pickCoverageBamTrack } from '../../../lib/coverage-bam';

declare global {
  interface Window {
    igv: {
      createBrowser: (container: HTMLElement, options: unknown) => Promise<IgvBrowserInstance>;
      removeBrowser: (browser: IgvBrowserInstance) => void;
    };
  }
}

interface IgvReferenceFrame {
  chr: string;
  start: number;
  bpPerPixel: number;
}

interface IgvBrowserInstance {
  search: (locus: string) => Promise<void>;
  loadTrack: (config: unknown) => Promise<unknown>;
  removeTrackByName: (name: string) => void;
  on?: (event: string, handler: () => void) => void;
  referenceFrameList?: IgvReferenceFrame[];
  dispose?: () => void;
}

export interface IgvBrowserHandle {
  navigateTo: (locus: string) => Promise<void>;
  loadBedTrack: (url: string, name?: string) => void;
  removeBedTrack: (name: string) => void;
  /** Portal-style dual red vertical lines at the variant base. */
  setPosMarker: (chrom: string, pos: number) => void;
  clearPosMarker: () => void;
}

interface Props {
  context: CoverageContext;
  orderId: string;
  /** Initial locus when creating the browser (Portal: variant ±45bp or gene). */
  initialLocus?: string;
  /** Portal: carrier true, sgNIPT false (letters only at variant column). */
  showAllBases?: boolean;
  onLoad?: () => void;
}

let igvScriptReady = false;

async function ensureIgv(): Promise<void> {
  if (igvScriptReady || typeof window.igv !== 'undefined') {
    igvScriptReady = true;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/igv@2.15.5/dist/igv.min.js';
    s.onload = () => {
      igvScriptReady = true;
      resolve();
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

const IgvBrowser = forwardRef<IgvBrowserHandle, Props>(function IgvBrowser(
  { context, orderId, initialLocus, showAllBases = true, onLoad },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const browserRef = useRef<IgvBrowserInstance | null>(null);
  const markerPosRef = useRef<{ chr: string; pos: number } | null>(null);
  const creatingRef = useRef(false);

  const clearMarkerDom = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    host.querySelectorAll('.igv-pos-marker-line, .igv-pos-marker-label').forEach((el) => el.remove());
  }, []);

  const redrawPosMarker = useCallback(() => {
    const host = hostRef.current;
    const browser = browserRef.current;
    clearMarkerDom();
    const mk = markerPosRef.current;
    if (!host || !browser || !mk) return;
    try {
      const refList = browser.referenceFrameList;
      if (!refList?.length) return;
      const frame = refList[0];
      if (!frame || frame.chr !== mk.chr) return;
      const vpEl =
        host.querySelector('.igv-viewport') ||
        host.querySelector('[class*="igv-viewport"]');
      const vpLeft = vpEl
        ? vpEl.getBoundingClientRect().left - host.getBoundingClientRect().left
        : 0;
      const bpp = frame.bpPerPixel;
      if (!bpp || bpp <= 0) return;
      // Portal: lines at (pos-1) and pos → highlight the single base column
      const leftPx = vpLeft + (mk.pos - 1 - frame.start) / bpp;
      const rightPx = vpLeft + (mk.pos - frame.start) / bpp;
      const midPx = (leftPx + rightPx) / 2;

      const mkLeft = document.createElement('div');
      mkLeft.className = 'igv-pos-marker-line';
      mkLeft.style.left = `${Math.round(leftPx)}px`;
      host.appendChild(mkLeft);

      const mkRight = document.createElement('div');
      mkRight.className = 'igv-pos-marker-line';
      mkRight.style.left = `${Math.round(rightPx)}px`;
      host.appendChild(mkRight);

      const label = document.createElement('div');
      label.className = 'igv-pos-marker-label';
      label.textContent = `${mk.chr}:${mk.pos.toLocaleString()}`;
      label.style.left = `${Math.round(midPx)}px`;
      host.appendChild(label);
    } catch {
      /* ignore layout errors */
    }
  }, [clearMarkerDom]);

  useImperativeHandle(
    ref,
    () => ({
      navigateTo: async (locus) => {
        const b = browserRef.current;
        if (!b) return;
        await b.search(locus);
        // Allow IGV to update reference frames before drawing markers
        requestAnimationFrame(() => redrawPosMarker());
        setTimeout(() => redrawPosMarker(), 200);
        setTimeout(() => redrawPosMarker(), 500);
      },
      loadBedTrack: (url, name = 'BED') => {
        browserRef.current?.loadTrack({
          type: 'annotation',
          format: 'bed',
          url,
          name,
          displayMode: 'EXPANDED',
        });
      },
      removeBedTrack: (name) => {
        try {
          browserRef.current?.removeTrackByName(name);
        } catch { /* ignore */ }
      },
      setPosMarker: (chrom, pos) => {
        markerPosRef.current = { chr: chrom, pos: Number(pos) };
        redrawPosMarker();
      },
      clearPosMarker: () => {
        markerPosRef.current = null;
        clearMarkerDom();
      },
    }),
    [clearMarkerDom, redrawPosMarker],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || creatingRef.current || browserRef.current) return;

    let active = true;
    creatingRef.current = true;

    (async () => {
      try {
        await ensureIgv();
        if (!active || !window.igv || browserRef.current) return;

        const primary =
          (context.bam_rel_path
            ? {
                rel_path: context.bam_rel_path,
                label: context.bam_label,
                index_rel_path: context.bam_index_rel_path,
                has_index: true,
              }
            : null) || pickCoverageBamTrack(context.bam_tracks);

        const bamRel = primary?.rel_path || context.bam_rel_path;
        const baiRel = coverageBamIndexRel(primary ?? undefined) || context.bam_index_rel_path;
        const bamLabel =
          primary?.label ||
          context.bam_label ||
          bamRel?.split('/').pop() ||
          context.bam_path?.split('/').pop() ||
          'Alignment';

        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '/api';
        const tracks: unknown[] = [];

        // Portal track height: fill host minus chrome (~220px reserved)
        const hostH = Math.max(host.getBoundingClientRect().height || 0, 560);
        const trackH = Math.min(1100, Math.max(320, Math.floor(hostH - 220)));

        if (bamRel && baiRel) {
          tracks.push({
            name: bamLabel,
            url: orderArtifactUrl(orderId, bamRel),
            indexURL: orderArtifactUrl(orderId, baiRel),
            format: /\.cram$/i.test(bamRel) ? 'cram' : 'bam',
            type: 'alignment',
            height: trackH,
            maxHeight: Math.max(trackH + 80, 720),
            displayMode: 'EXPANDED',
            showAllBases,
            showMismatches: true,
            showSoftClips: true,
            showInsertionText: true,
            showDeletionText: true,
            alignmentRowHeight: 15,
            samplingDepth: 400,
            samplingWindowSize: 100,
          });
        } else if (context.bam_path) {
          tracks.push({
            name: bamLabel,
            url: `${apiBase}/review/${orderId}/bam`,
            indexURL: `${apiBase}/review/${orderId}/bai`,
            format: context.bam_path.endsWith('.cram') ? 'cram' : 'bam',
            type: 'alignment',
            height: trackH,
            displayMode: 'EXPANDED',
            showAllBases,
            showSoftClips: true,
          });
        }

        if (!tracks.length) {
          host.innerHTML =
            '<p class="muted" style="padding:12px">No indexed BAM available for IGV.</p>';
          return;
        }

        const genes = context.interpretation_genes ?? context.target_genes ?? [];
        const locus = (initialLocus || '').trim() || genes[0] || 'BRCA1';

        host.innerHTML = '';
        const browser = await window.igv.createBrowser(host, {
          genome: context.genome ?? context.genome_id ?? 'hg38',
          locus,
          tracks,
        });

        if (!active) {
          try {
            if (typeof browser.dispose === 'function') browser.dispose();
            else window.igv.removeBrowser?.(browser);
          } catch { /* ignore */ }
          host.innerHTML = '';
          return;
        }

        browserRef.current = browser;
        try {
          browser.on?.('locuschange', () => {
            try {
              redrawPosMarker();
            } catch { /* ignore */ }
          });
        } catch { /* ignore */ }

        onLoad?.();
        setTimeout(() => redrawPosMarker(), 400);
      } catch (e) {
        console.error('IGV init error:', e);
        if (hostRef.current) {
          hostRef.current.innerHTML =
            '<p class="muted" style="padding:12px;color:var(--danger,#b91c1c)">IGV failed to start.</p>';
        }
      } finally {
        creatingRef.current = false;
      }
    })();

    return () => {
      active = false;
      creatingRef.current = false;
      markerPosRef.current = null;
      clearMarkerDom();
      const b = browserRef.current;
      browserRef.current = null;
      if (b) {
        try {
          if (typeof b.dispose === 'function') b.dispose();
          else window.igv?.removeBrowser?.(b);
        } catch { /* ignore */ }
      }
      if (hostRef.current) hostRef.current.innerHTML = '';
    };
    // Only recreate when order/BAM context identity changes — not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, context.bam_rel_path, context.bam_path, context.genome_id, context.genome]);

  return (
    <div
      id="coverageIgvHost"
      ref={hostRef}
      className="coverage-igv-host relative min-h-[560px] flex-1 overflow-hidden"
    />
  );
});

export default IgvBrowser;
