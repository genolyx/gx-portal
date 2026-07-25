'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, toast } from '@heroui/react';
import { reviewApi } from '../../../lib/api/review';
import {
  darkGenesDisplayTitle,
  darkGenesRawDetails,
  darkGenesSectionVisualTarget,
  isDarkGenesApoePgxSection,
  normalizeDarkGenesSectionBody,
  padDarkGenesSectionReviews,
  parseDarkGenesDetailedToSections,
  parseDarkGenesTsvToTableHtml,
  renderCftrIvs9EhBannerFromPayload,
  tryRenderCahHotspotStandaloneSection,
  tryRenderCftrIvs9EhSection,
  tryRenderDosageAnalysisSection,
  tryRenderSmacaCheckSection,
  type SectionReviewEntry,
  type VisualEvidence,
} from '../../../lib/dark-genes';
import { useReviewStore } from '../../../lib/store/reviewStore';
import { ArtifactHtmlModal, RepeatPlotsModal } from '../ArtifactHtmlModal';

const CFTR_IVS9_LOCUS: Record<string, string> = {
  hg38: 'chr7:117,548,607-117,548,835',
  hg19: 'chr7:117,227,832-117,228,060',
  GRCh38: 'chr7:117,548,607-117,548,835',
  GRCh37: 'chr7:117,227,832-117,228,060',
};

interface DetailedSection {
  title?: string;
  body?: string;
  kind?: string;
  [key: string]: unknown;
}

function filterRepeatSvgRelPaths(rels: unknown, scope: string): string[] {
  const list = Array.isArray(rels) ? rels.map((r) => String(r)) : [];
  if (scope !== 'fragile') return list;
  const hit = list.filter((r) => /fmr1|fragile|fmr_1/i.test(r));
  return hit.length ? hit : list;
}

export function DarkGenesPanel({
  orderId,
  onJumpCoverage,
}: {
  orderId: string;
  onJumpCoverage?: () => void;
}) {
  const { reviewData, patchReviewData, requestCoverageNav } = useReviewStore();
  const dark = reviewData?.dark_genes;

  const [reviews, setReviews] = useState<SectionReviewEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [igvOpen, setIgvOpen] = useState(false);
  const [igvHint, setIgvHint] = useState<'smn' | 'generic'>('generic');
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatRels, setRepeatRels] = useState<string[]>([]);

  // Soft-refresh dark_genes when panel mounts (parity with Portal tab focus).
  useEffect(() => {
    let cancelled = false;
    reviewApi
      .getResult(orderId)
      .then((data) => {
        if (cancelled || !data?.dark_genes) return;
        patchReviewData({ dark_genes: data.dark_genes });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orderId, patchReviewData]);

  const sections = useMemo(() => {
    if (!dark) return [] as DetailedSection[];
    let detSec = Array.isArray(dark.detailed_sections)
      ? (dark.detailed_sections as DetailedSection[])
      : [];
    const det = String(dark.detailed_text || '').trim();
    if (det && !detSec.length) {
      detSec = parseDarkGenesDetailedToSections(det) as DetailedSection[];
    }
    return detSec;
  }, [dark]);

  useEffect(() => {
    if (!sections.length) {
      setReviews([]);
      return;
    }
    const srv = Array.isArray(dark?.section_reviews) ? (dark!.section_reviews as unknown[]) : [];
    setReviews(padDarkGenesSectionReviews(srv, sections.length, sections));
  }, [sections, dark?.section_reviews]);

  if (!dark) {
    return (
      <p className="py-8 text-center text-muted">
        No dark-gene summary on disk. Run the pipeline, then reprocess.
      </p>
    );
  }

  const dgMissing =
    dark.status === 'not_found' ||
    (!dark.status && !dark.summary_text && !dark.summary_file);
  if (dgMissing) {
    return (
      <p className="py-8 text-center text-muted">
        {(dark.message && String(dark.message)) ||
          'No dark-gene summary on disk. Run the pipeline, then reprocess.'}
      </p>
    );
  }

  const files = [dark.summary_file, dark.detailed_file].filter(Boolean) as string[];
  const ve = (dark.visual_evidence || {}) as VisualEvidence;
  const cftrEh = dark.cftr_ivs9_eh && typeof dark.cftr_ivs9_eh === 'object' ? dark.cftr_ivs9_eh : null;
  const cftrBannerHtml = cftrEh ? renderCftrIvs9EhBannerFromPayload(cftrEh as Record<string, unknown>) : '';
  const suppressCftrEhInSections = !!cftrBannerHtml;
  const txt = String(dark.summary_text || '').trim();
  const det = String(dark.detailed_text || '').trim();
  const variants = reviewData?.variants ?? [];
  const metadata = (reviewData?.metadata ?? {}) as Record<string, unknown>;

  const updateReview = (idx: number, patch: Partial<SectionReviewEntry>) => {
    setReviews((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch, reviewer_set: true } : r)),
    );
  };

  const handleVisual = (target: string, opts?: { igvHint?: string; repeatFilter?: string }) => {
    if (target === 'cftr_coverage') {
      requestCoverageNav({
        locus: CFTR_IVS9_LOCUS.hg38,
        label: 'CFTR IVS9',
      });
      onJumpCoverage?.();
      return;
    }
    if (target === 'igv') {
      setIgvHint(opts?.igvHint === 'smn' ? 'smn' : 'generic');
      setIgvOpen(true);
      return;
    }
    if (target === 'repeat') {
      setRepeatRels(filterRepeatSvgRelPaths(ve.repeat_svgs, opts?.repeatFilter || 'all'));
      setRepeatOpen(true);
    }
  };

  const handleSave = async () => {
    if (!sections.length) {
      toast.danger('No detailed sections to save');
      return;
    }
    setSaving(true);
    try {
      const section_reviews = sections.map((sec, i) => {
        const kind = sec.kind || 'normal';
        if (kind === 'alert') return { approved: false, notes: '', risk: 'low' as const };
        const r = reviews[i] || { approved: false, notes: '', risk: 'low' };
        return {
          approved: !!r.approved,
          notes: String(r.notes || '').trim(),
          risk: r.risk === 'low' ? 'low' : 'high',
        };
      });
      const res = await reviewApi.saveDarkGenes(orderId, { section_reviews });
      if (res?.dark_genes) patchReviewData({ dark_genes: res.dark_genes });
      toast.success('Section reviews saved.');
    } catch (e) {
      toast.danger(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const igvHelp =
    igvHint === 'smn'
      ? 'Interactive igv-reports bundle. Default locus: SMA_c840_SNP_Zoom (exon 7 c.840 SNP). Use the locus table inside the report to jump tracks.'
      : 'Interactive igv-reports HTML for this order. Use the locus table inside the report to select regions and tracks.';

  return (
    <div className="dark-genes-panel">
      {files.length > 0 && (
        <p className="mb-2.5 text-[11px] text-muted">Sources: {files.join(', ')}</p>
      )}
      <p className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="inline-block rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
          {String(dark.status || '')}
        </span>
        <span className="text-[11px] text-muted">Dark genes</span>
      </p>
      {dark.message && <p className="mb-2 text-xs text-muted">{String(dark.message)}</p>}

      {cftrBannerHtml && (
        <div
          className="mb-3"
          dangerouslySetInnerHTML={{ __html: cftrBannerHtml }}
        />
      )}

      {(det || sections.length > 0) && (
        <details className="dg-report-details" open>
          <summary className="dg-report-summary">Detailed report</summary>
          <div className="dg-report-details-body">
            {sections.length > 0 ? (
              <>
                <div className="dark-genes-stack">
                  {(() => {
                    const nodes: React.ReactNode[] = [];
                    let firstRendered = true;
                    sections.forEach((sec, i) => {
                      const rawTitle = String(sec.title || '').trim();
                      if (/^overview$/i.test(rawTitle)) return;
                      if (isDarkGenesApoePgxSection(sec)) return;

                      const kind = sec.kind || 'normal';
                      const cls =
                        kind === 'alert'
                          ? 'dark-genes-sec dark-genes-sec--alert'
                          : kind === 'warning' || kind === 'warn'
                            ? 'dark-genes-sec dark-genes-sec--warn'
                            : 'dark-genes-sec';
                      const bodyNorm = normalizeDarkGenesSectionBody(sec.body || '');
                      const kv =
                        tryRenderSmacaCheckSection(
                          { ...sec, body: bodyNorm },
                          variants,
                          metadata,
                        ) ||
                        (suppressCftrEhInSections
                          ? null
                          : tryRenderCftrIvs9EhSection(
                              { ...sec, body: bodyNorm },
                              { suppressBenignCftrEh: true },
                            )) ||
                        tryRenderDosageAnalysisSection({ ...sec, body: bodyNorm }) ||
                        tryRenderCahHotspotStandaloneSection({ ...sec, body: bodyNorm });
                      const r = reviews[i] || { approved: false, notes: '', risk: 'low' };
                      const risk = r.risk === 'low' ? 'low' : 'high';
                      const skipReviewUi = kind === 'alert';
                      const vis = darkGenesSectionVisualTarget(sec, ve);

                      nodes.push(
                        <div key={i} className={cls} data-dg-idx={i}>
                          <div
                            className={`dark-genes-sec-title-wrap ${
                              risk === 'low'
                                ? 'dark-genes-sec-title-wrap--low'
                                : 'dark-genes-sec-title-wrap--high'
                            }`}
                          >
                            <div className="dark-genes-sec-title-row">
                              <div className="dark-genes-sec-title">
                                {darkGenesDisplayTitle(sec.title)}
                              </div>
                              {vis && (
                                <button
                                  type="button"
                                  className="dg-sec-visual"
                                  title={
                                    vis.target === 'cftr_coverage'
                                      ? 'Open Coverage tab — IGV.js BAM + CFTR IVS9'
                                      : vis.target === 'igv'
                                        ? 'Open unified IGV report (popup)'
                                        : vis.target === 'repeat'
                                          ? 'Open repeat expansion plots'
                                          : 'Visual evidence'
                                  }
                                  onClick={() =>
                                    handleVisual(vis.target, {
                                      igvHint: vis.igvHint,
                                      repeatFilter: vis.repeatFilter,
                                    })
                                  }
                                >
                                  {vis.label}
                                </button>
                              )}
                            </div>
                          </div>
                          {kv ? (
                            <div
                              className="dark-genes-sec-body dark-genes-sec-body--kv"
                              dangerouslySetInnerHTML={{ __html: kv }}
                            />
                          ) : (
                            <pre className="dark-genes-sec-body">{bodyNorm}</pre>
                          )}
                          {!skipReviewUi && (
                            <div className="dark-genes-sec-actions">
                              <div className="dg-actions-toolbar">
                                <div className="dg-risk-approve-group">
                                  <select
                                    className="dg-sec-risk"
                                    aria-label="PDF section title color"
                                    value={risk}
                                    onChange={(e) =>
                                      updateReview(i, {
                                        risk: e.target.value === 'low' ? 'low' : 'high',
                                      })
                                    }
                                  >
                                    <option value="low">Low</option>
                                    <option value="high">High</option>
                                  </select>
                                  <button
                                    type="button"
                                    className={`btn dg-approve-btn${r.approved ? ' dg-approved' : ''}`}
                                    onClick={() => updateReview(i, { approved: !r.approved })}
                                  >
                                    {r.approved ? 'Approved ✓' : 'Approve for report'}
                                  </button>
                                </div>
                                <div className="dg-notes-wrap">
                                  <label className="dg-notes-label" htmlFor={`dg-sec-notes-${i}`}>
                                    Notes
                                  </label>
                                  <textarea
                                    id={`dg-sec-notes-${i}`}
                                    className="dg-sec-notes"
                                    rows={6}
                                    placeholder="Optional — shown in PDF when section is approved"
                                    value={r.notes || ''}
                                    onChange={(e) => updateReview(i, { notes: e.target.value })}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>,
                      );

                      if (firstRendered && kind === 'alert') {
                        nodes.push(
                          <div key="dg-spacer" className="dark-genes-stack-spacer" aria-hidden="true" />,
                        );
                      }
                      firstRendered = false;
                    });
                    return nodes;
                  })()}
                </div>
                <div className="dark-genes-save-row">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    isDisabled={saving}
                    onPress={() => void handleSave()}
                  >
                    {saving ? 'Saving…' : 'Save section reviews'}
                  </Button>
                  <span className="max-w-[52rem] text-[11px] leading-snug text-muted">
                    Saves section approval and notes for the report.
                  </span>
                </div>
                {det && (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: darkGenesRawDetails(
                        'Raw detailed text (full, for audit)',
                        det,
                        120000,
                      ),
                    }}
                  />
                )}
              </>
            ) : (
              (() => {
                const table = parseDarkGenesTsvToTableHtml(det);
                if (table) {
                  return (
                    <>
                      <div dangerouslySetInnerHTML={{ __html: table }} />
                      <div
                        dangerouslySetInnerHTML={{
                          __html: darkGenesRawDetails(
                            'Raw detailed text (excerpt)',
                            det,
                            120000,
                          ),
                        }}
                      />
                    </>
                  );
                }
                return (
                  <pre className="m-0 max-h-[45vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-surface p-3 text-[11px] leading-snug">
                    {det.slice(0, 120000)}
                  </pre>
                );
              })()
            )}
          </div>
        </details>
      )}

      {txt && (
        <div
          dangerouslySetInnerHTML={{
            __html: darkGenesRawDetails('Raw summary text (pipeline TSV, audit)', txt),
          }}
        />
      )}

      {!det && !txt && dark.status !== 'error' && (
        <p className="text-muted">Summary files were located but text was empty.</p>
      )}

      <ArtifactHtmlModal
        open={igvOpen}
        orderId={orderId}
        relPath={ve.igv_report_html ? String(ve.igv_report_html) : null}
        title={igvHint === 'smn' ? 'SMN / SMA — IGV report' : 'IGV report'}
        help={igvHelp}
        stripFragileX
        onClose={() => setIgvOpen(false)}
      />
      <RepeatPlotsModal
        open={repeatOpen}
        orderId={orderId}
        relPaths={repeatRels}
        onClose={() => setRepeatOpen(false)}
      />
    </div>
  );
}
