'use client';

import { useState } from 'react';
import { reportApi } from '../../../lib/api/review';
import { useReviewStore } from '../../../lib/store/reviewStore';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import type { ReviewerInfo, PatientInfo } from '@gx-portal/types';
import styles from './ReportBuilder.module.css';

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
    <div className={styles.wrap}>
      <div className={styles.sidebar}>
        <h3 className={styles.sectionTitle}>Selected Variants ({confirmedVariants.length})</h3>
        {confirmedVariants.length === 0 ? (
          <p className={styles.hint}>Go to Variants tab and select P/LP variants to include.</p>
        ) : (
          <div className={styles.variantList}>
            {confirmedVariants.map((v) => (
              <div key={v.variant_id} className={styles.variantItem}>
                <strong>{v.gene}</strong>
                <code className={styles.code}>{v.hgvsc ?? `${v.chrom}:${v.pos}`}</code>
                {v.reviewer_classification && (
                  <Badge variant="warning">{v.reviewer_classification.replace(/_/g, ' ')}</Badge>
                )}
              </div>
            ))}
          </div>
        )}

        <div className={styles.divider} />

        <h3 className={styles.sectionTitle}>Reviewer</h3>
        <div className={styles.field}>
          <label className={styles.label}>Name *</label>
          <input value={reviewer.name} onChange={(e) => setReviewer({ ...reviewer, name: e.target.value })} className={styles.input} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Institution</label>
          <input value={reviewer.institution ?? ''} onChange={(e) => setReviewer({ ...reviewer, institution: e.target.value })} className={styles.input} />
        </div>

        <div className={styles.divider} />

        <h3 className={styles.sectionTitle}>Patient</h3>
        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input value={patient.name ?? ''} onChange={(e) => setPatient({ ...patient, name: e.target.value })} className={styles.input} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>DOB</label>
          <input type="date" value={patient.dob ?? ''} onChange={(e) => setPatient({ ...patient, dob: e.target.value })} className={styles.input} />
        </div>

        <div className={styles.divider} />

        <h3 className={styles.sectionTitle}>Report Languages</h3>
        <div className={styles.langRow}>
          {(['KO', 'EN', 'CN'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              className={`${styles.langBtn} ${languages.includes(lang) ? styles.selected : ''}`}
              onClick={() => toggleLang(lang)}
            >
              {lang}
            </button>
          ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.actions}>
          <Button variant="secondary" loading={loading} onClick={handlePreview}>Preview</Button>
          <Button variant="primary" loading={generating} onClick={handleGenerate}>
            {done ? '✓ Generated' : 'Generate PDF'}
          </Button>
        </div>
      </div>

      <div className={styles.preview}>
        {previewHtml ? (
          <iframe srcDoc={previewHtml} className={styles.previewFrame} title="Report Preview" />
        ) : (
          <div className={styles.previewEmpty}>
            <p>Click "Preview" to render the report.</p>
          </div>
        )}
      </div>
    </div>
  );
}
