'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Eye, FileDown } from 'lucide-react';
import { reportApi, reviewApi } from '../../../lib/api/review';
import { isSgniptReviewData } from '../../../lib/sgnipt-normalize';
import { useReviewStore } from '../../../lib/store/reviewStore';
import { Button, Card, Chip, Input, Label, Separator, TextArea } from '@heroui/react';
import { DatePickerField } from '../../ui/DatePickerField';
import type { ReviewerInfo, PatientInfo, GeneKnowledgeRow } from '@gx-portal/types';

type ReportTexts = Record<string, { gene_description: string; variant_summary: string }>;

function defaultGeneDescription(gene: string, gk?: GeneKnowledgeRow, disease?: string): string {
  const fromGk = (gk?.disease_association || gk?.function_summary || '').trim();
  if (fromGk) return fromGk;
  const dis = (disease || '').trim();
  if (dis) return `Pathogenic variants in the ${gene} gene are associated with ${dis}.`;
  return '';
}

export function ReportBuilder({ orderId }: { orderId: string }) {
  const { reviewData, selectedVariants, variantComments } = useReviewStore();
  const isSgnipt = isSgniptReviewData(reviewData as Record<string, unknown> | null);
  const [reviewer, setReviewer] = useState<ReviewerInfo>({ name: '' });
  const [patient, setPatient] = useState<PatientInfo>({});
  const [languages, setLanguages] = useState<('KO' | 'EN' | 'CN')[]>(['KO']);
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [reportTexts, setReportTexts] = useState<ReportTexts>({});
  const [genesMap, setGenesMap] = useState<Record<string, GeneKnowledgeRow>>({});
  const [writeupGene, setWriteupGene] = useState<string | null>(null);
  const [writeupMsg, setWriteupMsg] = useState('');

  // Old portal: sgNIPT report is EN / sgnipt_en.html
  useEffect(() => {
    if (isSgnipt) setLanguages(['EN']);
  }, [isSgnipt]);

  const variants = reviewData?.variants ?? [];
  const confirmedVariants = useMemo(
    () => variants.filter((v) => selectedVariants.has(v.variant_id)),
    [variants, selectedVariants],
  );

  const narrativeLang = languages.includes('EN')
    ? 'EN'
    : languages.includes('CN')
      ? 'CN'
      : languages.includes('KO')
        ? 'KO'
        : 'EN';

  // Seed narrative boxes from gene knowledge / variant fields
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!orderId || confirmedVariants.length === 0) return;
      try {
        const genes = [...new Set(confirmedVariants.map((v) => (v.gene || '').toUpperCase()).filter(Boolean))];
        const res = await reviewApi.getGeneKnowledge(orderId, {
          lang: narrativeLang,
          genes: genes.join(','),
        });
        if (cancelled) return;
        setGenesMap(res.genes ?? {});
        setReportTexts((prev) => {
          const next = { ...prev };
          for (const v of confirmedVariants) {
            if (next[v.variant_id]) continue;
            const g = (v.gene || '').toUpperCase();
            const gk = res.genes?.[g];
            const disease = Array.isArray(v.diseases)
              ? v.diseases.join('; ')
              : (v.disease ?? '');
            const geneDesc =
              (v.report_gene_description || '').trim() ||
              defaultGeneDescription(v.gene || g, gk, disease);
            const comment = (variantComments[v.variant_id]?.comment || '').trim();
            const parts: string[] = [];
            if (v.hgvsp) parts.push(`Protein: ${v.hgvsp}`);
            if (v.clinvar_sig_primary || v.clinvar_sig) {
              parts.push(`ClinVar: ${v.clinvar_sig_primary || v.clinvar_sig}`);
            }
            let varSum =
              (v.report_variant_summary || '').trim() || comment || parts.join(' ') || '';
            const inh = (gk?.inheritance || '').trim();
            if (inh && varSum && !varSum.toLowerCase().includes(inh.toLowerCase())) {
              varSum = `${varSum}\n\nTypical inheritance pattern: ${inh}.`;
            } else if (inh && !varSum) {
              varSum = `Typical inheritance pattern: ${inh}.`;
            }
            next[v.variant_id] = { gene_description: geneDesc, variant_summary: varSum };
          }
          return next;
        });
      } catch {
        /* ignore — boxes stay empty until write-up */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, confirmedVariants, narrativeLang, variantComments]);

  const refreshWriteup = useCallback(
    async (geneSymbol: string) => {
      const g = geneSymbol.trim();
      if (!g || !orderId) return;
      setWriteupGene(g);
      setWriteupMsg('Searching…');
      try {
        const res = await reviewApi.getGeneKnowledge(orderId, {
          gene: g,
          force: true,
          enrich: true,
          lang: narrativeLang,
        });
        if (res.error) {
          setWriteupMsg(res.error);
          return;
        }
        if (res.gene_knowledge_db_configured === false) {
          setWriteupMsg(res.message || 'gene_knowledge_db is not configured on the daemon.');
          return;
        }
        const gu = g.toUpperCase();
        const row = res.genes?.[gu] ?? {};
        setGenesMap((prev) => ({ ...prev, ...res.genes }));
        const hasLong =
          Boolean(String(row.function_summary || '').trim()) ||
          Boolean(String(row.disease_association || '').trim());
        if (!hasLong && !String(row.disorder || '').trim()) {
          setWriteupMsg(
            res.gemini_fetch_error ||
              'AI did not return usable text for this gene. Check AI provider settings.',
          );
          return;
        }
        setReportTexts((prev) => {
          const next = { ...prev };
          for (const v of confirmedVariants) {
            if ((v.gene || '').toUpperCase() !== gu) continue;
            const disease = Array.isArray(v.diseases)
              ? v.diseases.join('; ')
              : (v.disease ?? '');
            next[v.variant_id] = {
              gene_description: defaultGeneDescription(v.gene || gu, row, disease),
              variant_summary: next[v.variant_id]?.variant_summary ?? '',
            };
            const inh = String(row.inheritance || '').trim();
            if (inh) {
              const cur = next[v.variant_id].variant_summary;
              if (!cur) next[v.variant_id].variant_summary = `Typical inheritance pattern: ${inh}.`;
              else if (!cur.toLowerCase().includes(inh.toLowerCase())) {
                next[v.variant_id].variant_summary = `${cur}\n\nTypical inheritance pattern: ${inh}.`;
              }
            }
          }
          return next;
        });
        setWriteupMsg(
          hasLong
            ? `Gene write-up refreshed via ${res.ai_provider ?? 'AI'}.`
            : 'Gene cache updated (short disorder label only).',
        );
      } catch (e) {
        setWriteupMsg(e instanceof Error ? e.message : 'Gene search failed');
      } finally {
        setWriteupGene(null);
      }
    },
    [orderId, narrativeLang, confirmedVariants],
  );

  const toggleLang = (lang: 'KO' | 'EN' | 'CN') => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  };

  const buildBody = () => ({
    confirmed_variants: confirmedVariants.map((v) => {
      const rt = reportTexts[v.variant_id] ?? { gene_description: '', variant_summary: '' };
      return {
        ...v,
        reviewer_classification: variantComments[v.variant_id]?.classification,
        reviewer_comment: variantComments[v.variant_id]?.comment,
        include_in_report: true,
        gene_description: rt.gene_description,
        variant_summary: rt.variant_summary,
        report_gene_description: rt.gene_description,
        report_variant_summary: rt.variant_summary,
      };
    }),
    reviewer_info: reviewer,
    patient_info: patient,
    languages,
  });

  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await reportApi.preview(orderId, buildBody());
      setPreviewHtml(res.html ?? '');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await reportApi.generate(orderId, buildBody());
      setDone(true);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid min-h-[600px] grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
      <Card className="overflow-y-auto">
        <Card.Content className="flex flex-col gap-4">
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
              Selected Variants ({confirmedVariants.length})
            </h3>
            {confirmedVariants.length === 0 ? (
              <p className="text-xs text-muted">Go to Variants tab and select P/LP variants to include.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {confirmedVariants.map((v) => {
                  const rt = reportTexts[v.variant_id] ?? {
                    gene_description: '',
                    variant_summary: '',
                  };
                  const g = (v.gene || '').toUpperCase();
                  return (
                    <div key={v.variant_id} className="flex flex-col gap-2 rounded-md bg-surface px-2 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{v.gene}</strong>
                        <code className="font-mono text-muted">{v.hgvsc ?? `${v.chrom}:${v.pos}`}</code>
                        {v.reviewer_classification || variantComments[v.variant_id]?.classification ? (
                          <Chip color="warning" size="sm" variant="soft">
                            <Chip.Label>
                              {(
                                variantComments[v.variant_id]?.classification ??
                                v.reviewer_classification ??
                                ''
                              ).replace(/_/g, ' ')}
                            </Chip.Label>
                          </Chip>
                        ) : null}
                        <Button
                          size="sm"
                          variant="secondary"
                          className="ml-auto"
                          isDisabled={writeupGene === g}
                          onPress={() => void refreshWriteup(v.gene)}
                        >
                          {writeupGene === g ? 'Searching…' : 'New search / write-up'}
                        </Button>
                      </div>
                      {genesMap[g]?.inheritance ? (
                        <span className="text-[11px] text-muted">
                          Inheritance: {String(genesMap[g].inheritance)}
                        </span>
                      ) : null}
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px] uppercase text-muted">Gene description</Label>
                        <TextArea
                          rows={3}
                          value={rt.gene_description}
                          onChange={(e) =>
                            setReportTexts((prev) => ({
                              ...prev,
                              [v.variant_id]: {
                                ...rt,
                                gene_description: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px] uppercase text-muted">Variant summary</Label>
                        <TextArea
                          rows={3}
                          value={rt.variant_summary}
                          onChange={(e) =>
                            setReportTexts((prev) => ({
                              ...prev,
                              [v.variant_id]: {
                                ...rt,
                                variant_summary: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {writeupMsg && <p className="mt-2 text-xs text-muted">{writeupMsg}</p>}
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Reviewer</h3>
            <div className="mb-3 flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Name *</Label>
              <Input
                value={reviewer.name}
                onChange={(e) => setReviewer({ ...reviewer, name: e.target.value })}
                fullWidth
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Institution</Label>
              <Input
                value={reviewer.institution ?? ''}
                onChange={(e) => setReviewer({ ...reviewer, institution: e.target.value })}
                fullWidth
              />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Patient</h3>
            <div className="mb-3 flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Name</Label>
              <Input
                value={patient.name ?? ''}
                onChange={(e) => setPatient({ ...patient, name: e.target.value })}
                fullWidth
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted">DOB</Label>
              <DatePickerField
                aria-label="Patient date of birth"
                value={patient.dob ?? ''}
                onChange={(dob) => setPatient({ ...patient, dob })}
              />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Report Languages</h3>
            <div className="flex flex-wrap gap-2">
              {(['KO', 'EN', 'CN'] as const).map((lang) => (
                <Button
                  key={lang}
                  type="button"
                  size="sm"
                  variant={languages.includes(lang) ? 'primary' : 'secondary'}
                  onPress={() => toggleLang(lang)}
                >
                  {lang}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button
              variant="secondary"
              isDisabled={loading}
              onPress={() => void handlePreview()}
              className="gap-1.5"
            >
              <Eye size={15} strokeWidth={2} aria-hidden />
              {loading ? 'Loading…' : 'Preview'}
            </Button>
            <Button
              variant="primary"
              isDisabled={generating || !reviewer.name.trim()}
              onPress={() => void handleGenerate()}
              className="gap-1.5"
            >
              {done
                ? <Check size={15} strokeWidth={2} aria-hidden />
                : <FileDown size={15} strokeWidth={2} aria-hidden />}
              {generating ? 'Generating…' : done ? 'Generated' : 'Generate PDF'}
            </Button>
          </div>
        </Card.Content>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        <Card.Content className="flex flex-1 flex-col p-0">
          {previewHtml ? (
            <iframe srcDoc={previewHtml} className="min-h-[600px] flex-1 border-0 bg-white" title="Report Preview" />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
              <p>Click &quot;Preview&quot; to render the report.</p>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
