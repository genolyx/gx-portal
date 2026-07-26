'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Eraser, MapPin, Navigation, RefreshCw, Search } from 'lucide-react';
import { Button, Input, ListBox, Radio, RadioGroup, Select, Spinner } from '@heroui/react';
import { reviewApi } from '../../../lib/api/review';
import { isSgniptReviewData } from '../../../lib/sgnipt-normalize';
import { useReviewStore } from '../../../lib/store/reviewStore';
import type { CoverageContext } from '@gx-portal/types';
import type { IgvBrowserHandle } from './IgvBrowser';

const IgvBrowser = dynamic(() => import('./IgvBrowser'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 border-t border-border px-5 py-10 text-muted">
      <Spinner size="md" color="accent" />
      <span className="text-[13px]">Loading IGV…</span>
    </div>
  ),
});

/** Portal CFTR IVS9 pileup window (tighter than the EH BED span). */
const CFTR_IVS9_PILEUP: Record<string, string> = {
  hg38: 'chr7:117548560-117548680',
  GRCh38: 'chr7:117548560-117548680',
  hg19: 'chr7:117227785-117227905',
  GRCh37: 'chr7:117227785-117227905',
};

function variantKey(v: {
  gene?: string;
  hgvsc?: string;
  hgvsp?: string;
  chrom?: string;
  pos?: number;
  variant_id?: string;
  id?: string;
}) {
  return [v.gene, v.hgvsc ?? v.hgvsp ?? (v.chrom && v.pos ? `${v.chrom}:${v.pos}` : '')]
    .filter(Boolean)
    .join(' ');
}

function formatVariantBaseChange(v: { ref?: string; alt?: string }): string {
  const ref = String(v.ref || '').trim();
  const alt = String(v.alt || '').trim();
  if (ref && alt) return `${ref}→${alt}`;
  return '';
}

/**
 * Portal `variantToCoverageLocus`: carrier/exome pad=45 (±45bp), sgNIPT pad=2.
 * This is what makes Portal look more zoomed-in than a gene-level locus.
 */
function variantToCoverageLocus(
  v: { chrom?: string; pos?: number },
  pad = 45,
): string {
  const c = String(v.chrom || '').trim();
  const p = parseInt(String(v.pos ?? ''), 10);
  if (!c || Number.isNaN(p)) return '';
  const a = Math.max(1, p - pad);
  const b = p + pad;
  return `${c}:${a}-${b}`;
}

export function CoverageViewer({ orderId }: { orderId: string }) {
  const reviewData = useReviewStore((s) => s.reviewData);
  const selectedVariants = useReviewStore((s) => s.selectedVariants);
  const isSgnipt = isSgniptReviewData(reviewData as Record<string, unknown> | null);
  const locusPad = isSgnipt ? 2 : 45;
  const coverageNav = useReviewStore((s) => s.coverageNav);
  const clearCoverageNav = useReviewStore((s) => s.clearCoverageNav);

  const [context, setContext] = useState<CoverageContext | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [ctxError, setCtxError] = useState('');
  const [igvReady, setIgvReady] = useState(false);
  /** Portal: IGV starts only after Load / refresh — do not auto-mount. */
  const [igvLoaded, setIgvLoaded] = useState(false);
  const [igvKey, setIgvKey] = useState(0);
  const [initialLocus, setInitialLocus] = useState('');

  const [geneInput, setGeneInput] = useState('');
  const [locusInput, setLocusInput] = useState('');
  const [variantFilter, setVariantFilter] = useState<'all' | 'checked'>('all');
  const [selectedVarIdx, setSelectedVarIdx] = useState<number>(-1);
  const [cftrInfo, setCftrInfo] = useState(false);
  const [variantHint, setVariantHint] = useState('');

  const igvRef = useRef<IgvBrowserHandle>(null);

  useEffect(() => {
    setLoadingCtx(true);
    setCtxError('');
    setIgvReady(false);
    setIgvLoaded(false);
    setSelectedVarIdx(-1);
    setVariantHint('');
    reviewApi
      .getCoverageContext(orderId)
      .then(setContext)
      .catch((e) =>
        setCtxError(e instanceof Error ? e.message : 'Failed to load coverage context'),
      )
      .finally(() => setLoadingCtx(false));
  }, [orderId]);

  const allVariants = reviewData?.variants ?? [];
  const filteredVariants =
    variantFilter === 'checked'
      ? allVariants.filter((v) => {
          const k = String(v.variant_id ?? v.id ?? variantKey(v));
          return selectedVariants.has(k);
        })
      : allVariants;

  const selectedVar = filteredVariants[selectedVarIdx] ?? null;
  const genes = context?.interpretation_genes ?? context?.target_genes ?? [];

  const defaultLocus = (): string => {
    for (const v of allVariants) {
      const z = variantToCoverageLocus(v, locusPad);
      if (z) return z;
      const g = String(v.gene || '').trim();
      if (g) return g;
    }
    return genes[0] || 'BRCA1';
  };

  const applyVariantJumpUi = (v: (typeof allVariants)[number]) => {
    const locus = variantToCoverageLocus(v, locusPad);
    if (locus) setLocusInput(locus);
    const ch = formatVariantBaseChange(v);
    const pos =
      v.chrom && v.pos != null && String(v.pos).trim() !== ''
        ? `${v.chrom}:${v.pos}`
        : '';
    if (ch && pos) {
      setVariantHint(
        isSgnipt
          ? `${ch} at ${pos} — pileup shows letters at the variant column (sgNIPT ±${locusPad}bp)`
          : `${ch} at ${pos} — pileup shows all bases (use CFTR IVS9 button for tract review)`,
      );
    } else if (pos) {
      setVariantHint(`Jumped to ${pos}`);
    } else {
      setVariantHint('');
    }
    return locus;
  };

  const startOrNavigate = async (locus: string, marker?: { chrom: string; pos: number }) => {
    const loc = locus.trim();
    if (!loc) return;

    if (!igvLoaded) {
      setInitialLocus(loc);
      setIgvLoaded(true);
      // Marker applied in onLoad via pending — store on ref through setTimeout after ready
      if (marker) {
        const apply = () => {
          if (igvRef.current) {
            igvRef.current.setPosMarker(marker.chrom, marker.pos);
          } else {
            setTimeout(apply, 100);
          }
        };
        setTimeout(apply, 300);
      }
      return;
    }

    if (igvReady && igvRef.current) {
      await igvRef.current.navigateTo(loc);
      if (marker) igvRef.current.setPosMarker(marker.chrom, marker.pos);
    }
  };

  // Dark genes → CFTR IGV jump: load if needed, then navigate
  useEffect(() => {
    if (!coverageNav) return;
    const genome = context?.genome ?? context?.genome_id ?? 'hg38';
    const locus =
      coverageNav.label === 'CFTR IVS9'
        ? (CFTR_IVS9_PILEUP[genome] ?? CFTR_IVS9_PILEUP.hg38)
        : coverageNav.locus;
    setCftrInfo(true);
    setLocusInput(locus);
    void startOrNavigate(locus);
    clearCoverageNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverageNav, context?.genome, context?.genome_id]);

  const handleSelectVariant = (idx: number) => {
    setSelectedVarIdx(idx);
    if (idx < 0) {
      setVariantHint('');
      igvRef.current?.clearPosMarker();
      return;
    }
    const v = filteredVariants[idx];
    if (!v) return;
    const locus = applyVariantJumpUi(v);
    const marker =
      v.chrom && v.pos != null
        ? { chrom: String(v.chrom), pos: Number(v.pos) }
        : undefined;
    void startOrNavigate(locus, marker);
  };

  const handleLoadRefresh = () => {
    const loc = locusInput.trim() || defaultLocus();
    setLocusInput(loc);
    if (!igvLoaded) {
      setInitialLocus(loc);
      setIgvLoaded(true);
      return;
    }
    // Hard refresh: remount browser (Portal disposes + recreate)
    setIgvReady(false);
    setInitialLocus(loc);
    setIgvKey((k) => k + 1);
  };

  const handleLookupGene = () => {
    const g = geneInput.trim();
    if (!g) return;
    setLocusInput(g);
    void startOrNavigate(g);
  };

  const handleGoLocus = () => {
    const l = locusInput.trim();
    if (!l) return;
    void startOrNavigate(l);
  };

  const handleCftrIvs9 = () => {
    const genome = context?.genome ?? context?.genome_id ?? 'hg38';
    const locus = CFTR_IVS9_PILEUP[genome] ?? CFTR_IVS9_PILEUP.hg38;
    setCftrInfo(true);
    setLocusInput(locus);
    void startOrNavigate(locus);
  };

  const handleClearMarker = () => {
    setCftrInfo(false);
    setVariantHint('');
    igvRef.current?.clearPosMarker();
  };

  if (loadingCtx) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-muted">
        <Spinner size="lg" color="accent" />
        <p className="text-sm">Loading coverage context…</p>
      </div>
    );
  }
  if (ctxError) {
    return <p className="py-10 text-center text-danger">{ctxError}</p>;
  }

  const hasBam = !!(
    context?.bam_rel_path ||
    context?.bam_path ||
    (context?.bam_tracks && context.bam_tracks.some((t) => t.has_index && t.rel_path))
  );
  const bamFile =
    context?.bam_label ||
    context?.bam_rel_path?.split('/').pop() ||
    context?.bam_path?.split('/').pop();

  const variantOptions = [
    { id: '-1', label: '— select variant —' },
    ...filteredVariants.map((v, i) => ({ id: String(i), label: variantKey(v) })),
  ];

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3.5 py-2 text-xs">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">IGV BAM</span>
        {context?.igv_bam_message ? (
          <span className="leading-snug text-muted">{context.igv_bam_message}</span>
        ) : bamFile ? (
          <>
            <code className="text-xs text-accent">{bamFile}</code>
            <span className="text-[11px] text-muted">(auto)</span>
          </>
        ) : (
          <span className="text-muted">
            No exome-style BAM found under this order’s analysis/output paths.
          </span>
        )}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="ml-auto gap-1.5"
          isDisabled={!hasBam}
          onPress={handleLoadRefresh}
        >
          <RefreshCw size={14} strokeWidth={2} aria-hidden />
          Load / refresh IGV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3.5 py-2">
        <Input
          type="text"
          value={geneInput}
          onChange={(e) => setGeneInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLookupGene()}
          placeholder="Gene symbol (e.g. BRCA1)"
          className="w-[220px]"
          aria-label="Gene symbol"
        />
        <Button
          type="button"
          size="sm"
          variant="primary"
          isDisabled={!hasBam}
          onPress={handleLookupGene}
          className="gap-1.5"
        >
          <Search size={14} strokeWidth={2} aria-hidden />
          Lookup coverage
        </Button>
      </div>

      {isSgnipt && (
        <div className="border-b border-border bg-surface px-3.5 py-2 text-[11px] leading-relaxed text-muted">
          <strong className="text-foreground">sgNIPT:</strong> Use <strong className="text-foreground">Jump to variant</strong>{' '}
          (Ref→Alt in each label). The pileup shows <strong className="text-foreground">letters at the variant column</strong>{' '}
          (±{locusPad}bp window).
        </div>
      )}

      {allVariants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3.5 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Jump to variant
          </span>
          <RadioGroup
            value={variantFilter}
            onChange={(v) => {
              setVariantFilter(v as 'all' | 'checked');
              setSelectedVarIdx(-1);
              setVariantHint('');
            }}
            orientation="horizontal"
            className="flex-row gap-3"
          >
            <Radio value="all">
              <Radio.Content className="text-xs">
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                All
              </Radio.Content>
            </Radio>
            <Radio value="checked">
              <Radio.Content className="text-xs">
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                Checked
              </Radio.Content>
            </Radio>
          </RadioGroup>
          <Select
            selectedKey={String(selectedVarIdx)}
            onSelectionChange={(key) => handleSelectVariant(parseInt(String(key), 10))}
            className="min-w-[260px]"
            aria-label="Select variant"
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox items={variantOptions}>
                {(item) => (
                  <ListBox.Item id={item.id} textValue={item.label}>
                    {item.label}
                  </ListBox.Item>
                )}
              </ListBox>
            </Select.Popover>
          </Select>
          {variantHint && (
            <span className="max-w-[520px] text-[11px] leading-snug text-muted">
              {selectedVar?.ref && selectedVar?.alt ? (
                <>
                  <strong className="text-foreground">
                    {selectedVar.ref}→{selectedVar.alt}
                  </strong>
                  {' at '}
                  <code className="text-[11px]">
                    {selectedVar.chrom}:{selectedVar.pos}
                  </code>
                  {' — pileup shows all bases'}
                </>
              ) : (
                variantHint
              )}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3.5 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Locus</span>
        <Input
          type="text"
          value={locusInput}
          onChange={(e) => setLocusInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGoLocus()}
          placeholder="e.g. chr1:55,058,519-55,058,609"
          className="w-[280px]"
          aria-label="Locus"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          isDisabled={!hasBam || !locusInput.trim()}
          onPress={handleGoLocus}
          className="gap-1.5"
        >
          <Navigation size={14} strokeWidth={2} aria-hidden />
          Go
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          isDisabled={!hasBam}
          onPress={handleCftrIvs9}
          className="gap-1.5"
        >
          <MapPin size={14} strokeWidth={2} aria-hidden />
          CFTR IVS9 (poly-T / TG)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onPress={handleClearMarker}
          className="gap-1.5"
        >
          <Eraser size={14} strokeWidth={2} aria-hidden />
          Clear marker
        </Button>
      </div>

      {cftrInfo && (
        <div className="border-b border-border bg-surface px-3.5 py-2.5 text-[11px] leading-relaxed text-muted">
          <strong className="text-foreground">CFTR IVS9:</strong> Jump to the Expansion Hunter
          poly-TG / poly-T pileup window. Alignment track shows all bases.
        </div>
      )}

      {hasBam && context ? (
        igvLoaded ? (
          <IgvBrowser
            key={igvKey}
            ref={igvRef}
            context={context}
            orderId={orderId}
            initialLocus={initialLocus || defaultLocus()}
            showAllBases={!isSgnipt}
            onLoad={() => {
              setIgvReady(true);
              // Re-apply marker if a variant is selected
              if (selectedVar?.chrom && selectedVar.pos != null) {
                igvRef.current?.setPosMarker(String(selectedVar.chrom), Number(selectedVar.pos));
              }
            }}
          />
        ) : (
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 border-t border-border bg-surface px-5 py-10 text-[13px] text-muted">
            <p>
              Click <strong className="text-foreground">Load / refresh IGV</strong> to open
              alignments for this order’s BAM, then lookup a gene or pick a variant.
            </p>
            {bamFile && (
              <p className="text-[11px]">
                BAM: <code>{bamFile}</code>
              </p>
            )}
          </div>
        )
      ) : (
        <div className="py-10 text-center text-[13px] text-muted">
          <p>No BAM file available for this order.</p>
          <p className="mt-1.5 text-[0.8em]">
            IGV requires a BAM + BAI index under analysis/output (or prior-reuse paths).
            Paraphase/SMN/FMR1 BAMs are not used for auto-IGV.
          </p>
        </div>
      )}
    </div>
  );
}
