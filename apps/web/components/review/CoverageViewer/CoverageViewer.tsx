'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Eraser, MapPin, Navigation, RefreshCw, Search } from 'lucide-react';
import { Button, Input, ListBox, Radio, RadioGroup, Select } from '@heroui/react';
import { reviewApi } from '../../../lib/api/review';
import { useReviewStore } from '../../../lib/store/reviewStore';
import type { CoverageContext } from '@gx-portal/types';
import type { IgvBrowserHandle } from './IgvBrowser';

const IgvBrowser = dynamic(() => import('./IgvBrowser'), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-sm text-muted">Loading IGV browser…</div>,
});

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

  const [geneInput,    setGeneInput]    = useState('');
  const [locusInput,   setLocusInput]   = useState('');
  const [variantFilter, setVariantFilter] = useState<'all' | 'checked'>('all');
  const [selectedVarIdx, setSelectedVarIdx] = useState<number>(-1);
  const [cftrInfo,    setCftrInfo]     = useState(false);

  const igvRef = useRef<IgvBrowserHandle>(null);
  const [igvLoaded,   setIgvLoaded]   = useState(false);

  useEffect(() => {
    reviewApi.getCoverageContext(orderId)
      .then(setContext)
      .catch((e) => setCtxError(e instanceof Error ? e.message : 'Failed to load coverage context'))
      .finally(() => setLoadingCtx(false));
  }, [orderId]);

  const allVariants = reviewData?.variants ?? [];
  const filteredVariants = variantFilter === 'checked'
    ? allVariants.filter((v) => {
        const k = String(v.variant_id ?? v.id ?? variantKey(v));
        return selectedVariants.has(k);
      })
    : allVariants;

  const selectedVar = filteredVariants[selectedVarIdx] ?? null;

  useEffect(() => {
    if (!igvReady || !selectedVar) return;
    const locus = variantLocus(selectedVar);
    if (locus) igvRef.current?.navigateTo(locus);
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

  if (loadingCtx) return <p className="py-10 text-center text-sm text-muted">Loading coverage context…</p>;
  if (ctxError)   return <p className="py-10 text-center text-danger">{ctxError}</p>;

  const bamFile = context?.bam_tracks?.[context.bam_tracks.length - 1]?.label
    ?? context?.bam_path?.split('/').pop();

  const variantOptions = [
    { id: '-1', label: '— select variant —' },
    ...filteredVariants.map((v, i) => ({ id: String(i), label: variantKey(v) })),
  ];

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border bg-surface">
      {bamFile && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3.5 py-2 text-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">IGV BAM</span>
          <code className="text-xs text-accent">{bamFile}</code>
          <span className="text-[11px] text-muted">(auto)</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="ml-auto gap-1.5"
            onPress={() => {
              if (!igvLoaded) {
                setIgvLoaded(true);
              } else {
                igvRef.current?.navigateTo(context?.target_genes?.[0] ?? 'chr1');
              }
            }}
          >
            <RefreshCw size={14} strokeWidth={2} aria-hidden />
            Load / refresh IGV
          </Button>
        </div>
      )}

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
          isDisabled={!igvReady}
          onPress={handleLookupGene}
          className="gap-1.5"
        >
          <Search size={14} strokeWidth={2} aria-hidden />
          Lookup coverage
        </Button>
      </div>

      {allVariants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3.5 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Jump to variant</span>
          <RadioGroup
            value={variantFilter}
            onChange={(v) => { setVariantFilter(v as 'all' | 'checked'); setSelectedVarIdx(-1); }}
            orientation="horizontal"
            className="flex-row gap-3"
          >
            <Radio value="all">
              <Radio.Content className="text-xs">
                <Radio.Control><Radio.Indicator /></Radio.Control>
                All
              </Radio.Content>
            </Radio>
            <Radio value="checked">
              <Radio.Content className="text-xs">
                <Radio.Control><Radio.Indicator /></Radio.Control>
                Checked
              </Radio.Content>
            </Radio>
          </RadioGroup>
          <Select
            selectedKey={String(selectedVarIdx)}
            onSelectionChange={(key) => setSelectedVarIdx(parseInt(String(key), 10))}
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
          {selectedVar && (
            <span className="max-w-[500px] truncate rounded border border-border bg-surface px-2 py-0.5 text-[11px] text-muted">
              {selectedVar.ref && selectedVar.alt && (
                <strong className="text-foreground">{selectedVar.ref}→{selectedVar.alt}</strong>
              )}{' '}
              at {selectedVar.chrom}:{selectedVar.pos}
              {selectedVar.hgvsc && <> — pileup shows all bases</>}
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
          isDisabled={!igvReady || !locusInput.trim()}
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
          <strong className="text-foreground">CFTR IVS9:</strong> Click the button above (or open from a CFTR tract variant) to load a small BED track
          on <code className="text-[10px]">chr7:117,548,607-835</code> (FH-style span) with separate features for the TG and poly-T stretches
          (C(8)chr38, ref layout (T0)<sub>9</sub>(T1)y). The alignment track is set to show all bases (not only mismatches).
          Use the track&apos;s gear menu for &quot;full&quot; vs &quot;expanded&quot; if the pileup is dense.
          Homopolymer tracts may still appear as gaps/deletions in CIGAR — counts are best from Expansion Hunter
          REPCN when available.
        </div>
      )}

      {context?.bam_path ? (
        igvLoaded ? (
          <IgvBrowser
            ref={igvRef}
            context={context}
            orderId={orderId}
            onLoad={() => setIgvReady(true)}
          />
        ) : (
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 border-t border-border bg-surface px-5 py-10 text-[13px] text-muted">
            <p>Click <strong className="text-foreground">Load / refresh IGV</strong> above to start streaming the BAM file.</p>
            <p className="text-[11px]">BAM: <code>{bamFile}</code></p>
          </div>
        )
      ) : (
        <div className="py-10 text-center text-[13px] text-muted">
          <p>No BAM file available for this order.</p>
          <p className="mt-1.5 text-[0.8em]">
            IGV requires a BAM + BAI index. Check that the pipeline completed successfully.
          </p>
        </div>
      )}
    </div>
  );
}
