'use client';

import { useState } from 'react';
import { Check, Eye, FileDown } from 'lucide-react';
import { reportApi } from '../../../lib/api/review';
import { useReviewStore } from '../../../lib/store/reviewStore';
import { Button, Card, Chip, Input, Label, Separator } from '@heroui/react';
import { DatePickerField } from '../../ui/DatePickerField';
import type { ReviewerInfo, PatientInfo } from '@gx-portal/types';

export function ReportBuilder({ orderId }: { orderId: string }) {
  const { reviewData, selectedVariants, variantComments } = useReviewStore();
  const [reviewer, setReviewer] = useState<ReviewerInfo>({ name: '' });
  const [patient, setPatient] = useState<PatientInfo>({});
  const [languages, setLanguages] = useState<('KO' | 'EN' | 'CN')[]>(['KO']);
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const variants = reviewData?.variants ?? [];
  const confirmedVariants = variants
    .filter((v) => selectedVariants.has(v.variant_id))
    .map((v) => ({
      ...v,
      reviewer_classification: variantComments[v.variant_id]?.classification,
      reviewer_comment: variantComments[v.variant_id]?.comment,
      include_in_report: true,
    }));

  const toggleLang = (lang: 'KO' | 'EN' | 'CN') => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  };

  const buildBody = () => ({
    confirmed_variants: confirmedVariants,
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
    <div className="grid min-h-[600px] grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
      <Card className="overflow-y-auto">
        <Card.Content className="flex flex-col gap-4">
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
              Selected Variants ({confirmedVariants.length})
            </h3>
            {confirmedVariants.length === 0 ? (
              <p className="text-xs text-muted">Go to Variants tab and select P/LP variants to include.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {confirmedVariants.map((v) => (
                  <div key={v.variant_id} className="flex flex-col gap-1 rounded-md bg-surface px-2 py-2 text-xs">
                    <strong>{v.gene}</strong>
                    <code className="font-mono text-muted">{v.hgvsc ?? `${v.chrom}:${v.pos}`}</code>
                    {v.reviewer_classification && (
                      <Chip color="warning" size="sm" variant="soft">
                        <Chip.Label>{v.reviewer_classification.replace(/_/g, ' ')}</Chip.Label>
                      </Chip>
                    )}
                  </div>
                ))}
              </div>
            )}
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
              isDisabled={generating}
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
