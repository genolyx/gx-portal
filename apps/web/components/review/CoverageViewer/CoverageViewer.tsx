'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { reviewApi } from '../../../lib/api/review';
import { useReviewStore } from '../../../lib/store/reviewStore';
import type { CoverageContext } from '@gx-portal/types';
import type { IgvBrowserHandle } from './IgvBrowser';
import styles from './CoverageViewer.module.css';

const IgvBrowser = dynamic(() => import('./IgvBrowser'), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading IGV browser…</div>,
});

// CFTR IVS9 poly-T / TG loci by genome
const CFTR_IVS9: Record<string, string> = {
  hg38:  'chr7:117,548,607-117,548,835',
  hg19:  'chr7:117,227,832-117,228,060',
  GRCh38:'chr7:117,548,607-117,548,835',
  GRCh37:'chr7:117,227,832-117,228,060',
};

function variantKey(v: { gene?: string; hgvsc?: string; hgvsp?: string; chrom?: string; pos?: number }) {
  return [v.gene, v.hgvsc ?? v.hgvsp ?? (v.chrom && v.pos ? `${v.chrom}:${v.pos}` : '')].filter(Boolean).join(' ');
}

function variantLocus(v: { chrom?: string; pos?: number }, windowBp = 300): string {
  if (!v.chrom || !v.pos) return '';
  const half = Math.floor(windowBp / 2);
  return `${v.chrom}:${Math.max(1, v.pos - half)}-${v.pos + half}`;
}

export function CoverageViewer({ orderId }: { orderId: string }) {
  const reviewData       = useReviewStore((s) => s.reviewData);
  const selectedVariants = useReviewStore((s) => s.selectedVariants);

  const [context,     setContext]     = useState<CoverageContext | null>(null);
  const [loadingCtx,  setLoadingCtx]  = useState(true);
  const [ctxError,    setCtxError]    = useState('');
  const [igvReady,    setIgvReady]    = useState(false);

  // Controls
  const [geneInput,    setGeneInput]    = useState('');
  const [locusInput,   setLocusInput]   = useState('');
  const [variantFilter, setVariantFilter] = useState<'all' | 'checked'>('all');
  const [selectedVarIdx, setSelectedVarIdx] = useState<number>(-1);
  const [cftrInfo,    setCftrInfo]     = useState(false);

  const igvRef = useRef<IgvBrowserHandle>(null);
  const [igvLoaded,   setIgvLoaded]   = useState(false);  // true after button click

  useEffect(() => {
    reviewApi.getCoverageContext(orderId)
      .then(setContext)
      .catch((e) => setCtxError(e instanceof Error ? e.message : 'Failed to load coverage context'))
      .finally(() => setLoadingCtx(false));
  }, [orderId]);

  // Build variant list for "Jump to variant"
  const allVariants = reviewData?.variants ?? [];
  const filteredVariants = variantFilter === 'checked'
    ? allVariants.filter((v) => {
        const k = v.id ?? variantKey(v);
        return selectedVariants.has(k);
      })
    : allVariants;

  const selectedVar = filteredVariants[selectedVarIdx] ?? null;

  // Navigate IGV to selected variant + load position marker
  useEffect(() => {
    if (!igvReady || !selectedVar) return;
    const locus = variantLocus(selectedVar);
    if (locus) igvRef.current?.navigateTo(locus);
    // Load red marker at exact variant position
    if (selectedVar.chrom && selectedVar.pos) {
      const markerName = [selectedVar.gene, selectedVar.hgvsc ?? selectedVar.hgvsp].filter(Boolean).join(' ');
      igvRef.current?.loadMarker(selectedVar.chrom, selectedVar.pos, markerName);
    }
  }, [selectedVarIdx, igvReady, selectedVar]);

  const handleLookupGene = () => {
    const g = geneInput.trim();
    if (!g || !igvReady) return;
    igvRef.current?.navigateTo(g);
  };

  const handleGoLocus = () => {
    const l = locusInput.trim();
    if (!l || !igvReady) return;
    igvRef.current?.navigateTo(l);
  };

  const handleCftrIvs9 = () => {
    const genome = context?.genome ?? 'hg38';
    const locus  = CFTR_IVS9[genome] ?? CFTR_IVS9.hg38;
    setCftrInfo(true);
    if (igvReady) igvRef.current?.navigateTo(locus);
    else setLocusInput(locus);
  };

  const handleClearMarker = () => {
    setCftrInfo(false);
    igvRef.current?.removeBedTrack('CFTR IVS9');
    igvRef.current?.clearMarker();
  };

  if (loadingCtx) return <p className={styles.loading}>Loading coverage context…</p>;
  if (ctxError)   return <p className={styles.error}>{ctxError}</p>;

      const bamFile = context.bam_tracks?.[context.bam_tracks.length - 1]?.label
        ?? context.bam_path?.split('/').pop();

  return (
    <div className={styles.wrap}>
      {/* ── BAM info bar ── */}
      {bamFile && (
        <div className={styles.bamBar}>
          <span className={styles.bamLabel}>IGV BAM</span>
          <code className={styles.bamName}>{bamFile}</code>
          <span className={styles.bamMeta}>(auto)</span>
          <button
            type="button"
            className={styles.reloadBtn}
            onClick={() => {
              if (!igvLoaded) {
                // First click: mount the IGV browser
                setIgvLoaded(true);
              } else {
                // Subsequent clicks: navigate to initial locus
                igvRef.current?.navigateTo(context?.target_genes?.[0] ?? 'chr1');
              }
            }}
          >
            Load / refresh IGV
          </button>
        </div>
      )}

      {/* ── Gene lookup ── */}
      <div className={styles.controlRow}>
        <input
          type="text"
          value={geneInput}
          onChange={(e) => setGeneInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLookupGene()}
          placeholder="Gene symbol (e.g. BRCA1)"
          className={styles.input}
          style={{ width: 220 }}
        />
        <button type="button" className={styles.btnPrimary} onClick={handleLookupGene} disabled={!igvReady}>
          Lookup coverage
        </button>
      </div>

      {/* ── Jump to variant ── */}
      {allVariants.length > 0 && (
        <div className={styles.controlRow}>
          <span className={styles.label}>Jump to variant</span>
          <label className={styles.radioLabel}>
            <input type="radio" name="vfilter" value="all" checked={variantFilter === 'all'}
              onChange={() => { setVariantFilter('all'); setSelectedVarIdx(-1); }} /> All
          </label>
          <label className={styles.radioLabel}>
            <input type="radio" name="vfilter" value="checked" checked={variantFilter === 'checked'}
              onChange={() => { setVariantFilter('checked'); setSelectedVarIdx(-1); }} /> Checked
          </label>
          <select
            className={styles.input}
            style={{ minWidth: 260 }}
            value={selectedVarIdx}
            onChange={(e) => setSelectedVarIdx(parseInt(e.target.value, 10))}
          >
            <option value={-1}>— select variant —</option>
            {filteredVariants.map((v, i) => (
              <option key={i} value={i}>{variantKey(v)}</option>
            ))}
          </select>
          {selectedVar && (
            <span className={styles.varInfo}>
              {selectedVar.ref && selectedVar.alt && (
                <strong>{selectedVar.ref}→{selectedVar.alt}</strong>
              )}{' '}
              at {selectedVar.chrom}:{selectedVar.pos}
              {selectedVar.hgvsc && <> — pileup shows all bases</>}
            </span>
          )}
        </div>
      )}

      {/* ── Locus / CFTR row ── */}
      <div className={styles.controlRow}>
        <span className={styles.label}>Locus</span>
        <input
          type="text"
          value={locusInput}
          onChange={(e) => setLocusInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGoLocus()}
          placeholder="e.g. chr1:55,058,519-55,058,609"
          className={styles.input}
          style={{ width: 280 }}
        />
        <button type="button" className={styles.btnSecondary} onClick={handleGoLocus} disabled={!igvReady || !locusInput.trim()}>
          Go
        </button>
        <button type="button" className={styles.btnSecondary} onClick={handleCftrIvs9}>
          CFTR IVS9 (poly-T / TG)
        </button>
        <button type="button" className={styles.btnGhost} onClick={handleClearMarker}>
          Clear marker
        </button>
      </div>

      {/* ── CFTR IVS9 info ── */}
      {cftrInfo && (
        <div className={styles.cftrInfo}>
          <strong>CFTR IVS9:</strong> Click the button above (or open from a CFTR tract variant) to load a small BED track
          on <code>chr7:117,548,607-835</code> (FH-style span) with separate features for the TG and poly-T stretches
          (C(8)chr38, ref layout (T0)<sub>9</sub>(T1)y). The alignment track is set to show all bases (not only mismatches).
          Use the track&apos;s gear menu for &quot;full&quot; vs &quot;expanded&quot; if the pileup is dense.
          Homopolymer tracts may still appear as gaps/deletions in CIGAR — counts are best from Expansion Hunter
          REPCN when available.
        </div>
      )}

      {/* ── IGV Browser ── */}
      {context?.bam_path ? (
        igvLoaded ? (
          <IgvBrowser
            ref={igvRef}
            context={context}
            orderId={orderId}
            onLoad={() => setIgvReady(true)}
          />
        ) : (
          <div className={styles.igvPlaceholder}>
            <p>Click <strong>Load / refresh IGV</strong> above to start streaming the BAM file.</p>
            <p className={styles.igvPlaceholderHint}>BAM: <code>{bamFile}</code></p>
          </div>
        )
      ) : (
        <div className={styles.empty}>
          <p>No BAM file available for this order.</p>
          <p style={{ fontSize: '0.8em', marginTop: 6 }}>
            IGV requires a BAM + BAI index. Check that the pipeline completed successfully.
          </p>
        </div>
      )}
    </div>
  );
}
