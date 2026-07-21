'use client';

import { useState } from 'react';
import { useReviewStore } from '../../../lib/store/reviewStore';
import { Badge } from '../../ui/Badge';
import styles from './DarkGenesPanel.module.css';

type DarkGeneSection = 'smn' | 'cftr' | 'apoe' | 'other';

export function DarkGenesPanel() {
  const { reviewData } = useReviewStore();
  const [activeSection, setActiveSection] = useState<DarkGeneSection>('smn');
  const [igvUrl, setIgvUrl] = useState<string | null>(null);

  const dark = reviewData?.dark_genes;
  if (!dark) {
    return <p className={styles.empty}>No dark gene data available for this order.</p>;
  }

  const sections: { id: DarkGeneSection; label: string; available: boolean }[] = [
    { id: 'smn',   label: 'SMN (SMA)',  available: Boolean(dark.smn) },
    { id: 'cftr',  label: 'CFTR',       available: Boolean(dark.cftr) },
    { id: 'apoe',  label: 'APOE',       available: Boolean(dark.apoe) },
    { id: 'other', label: 'Other Genes', available: Boolean(dark.sections?.length) },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs}>
        {sections.map((s) => (
          <button
            key={s.id}
            className={`${styles.tab} ${activeSection === s.id ? styles.active : ''} ${!s.available ? styles.disabled : ''}`}
            onClick={() => s.available && setActiveSection(s.id)}
          >
            {s.label}
            {!s.available && <span className={styles.na}> N/A</span>}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeSection === 'smn' && dark.smn && (
          <SmnSection smn={dark.smn} onIgv={setIgvUrl} />
        )}
        {activeSection === 'cftr' && dark.cftr && (
          <CftrSection cftr={dark.cftr} onIgv={setIgvUrl} />
        )}
        {activeSection === 'apoe' && dark.apoe && (
          <ApoeSection apoe={dark.apoe} onIgv={setIgvUrl} />
        )}
        {activeSection === 'other' && dark.sections && (
          <OtherSection sections={dark.sections} onIgv={setIgvUrl} />
        )}
      </div>

      {igvUrl && (
        <div className={styles.igvOverlay}>
          <div className={styles.igvHeader}>
            <span>IGV Report</span>
            <button onClick={() => setIgvUrl(null)} className={styles.igvClose}>✕</button>
          </div>
          <iframe src={igvUrl} className={styles.igvFrame} title="IGV Report" />
        </div>
      )}
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className={styles.resultRow}>
      <span className={styles.resultLabel}>{label}</span>
      <span className={styles.resultValue}>{value ?? '—'}</span>
    </div>
  );
}

function IgvButton({ url, onClick }: { url?: string; onClick: (url: string) => void }) {
  if (!url) return null;
  return (
    <button className={styles.igvBtn} onClick={() => onClick(url)}>
      Open IGV Report
    </button>
  );
}

function SmnSection({ smn, onIgv }: { smn: NonNullable<ReturnType<typeof useReviewStore>['reviewData']>['dark_genes']['smn']; onIgv: (url: string) => void }) {
  if (!smn) return null;
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>SMN1 / SMN2 Copy Number</h3>
      <div className={styles.resultGrid}>
        <ResultRow label="SMN1 copies" value={smn.smn1_copies} />
        <ResultRow label="SMN1 confidence" value={smn.smn1_confidence} />
        <ResultRow label="SMN2 copies" value={smn.smn2_copies} />
        <ResultRow label="SMN2 confidence" value={smn.smn2_confidence} />
      </div>
      <IgvButton url={smn.igv_report_html} onClick={onIgv} />
    </div>
  );
}

function CftrSection({ cftr, onIgv }: { cftr: NonNullable<ReturnType<typeof useReviewStore>['reviewData']>['dark_genes']['cftr']; onIgv: (url: string) => void }) {
  if (!cftr) return null;
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>CFTR Analysis</h3>
      {cftr.ivs9_result && <ResultRow label="IVS9 Result" value={cftr.ivs9_result} />}
      {cftr.variants && cftr.variants.length > 0 && (
        <div className={styles.variantList}>
          {cftr.variants.map((v, i) => (
            <Badge key={i} variant="warning">{v.gene} {v.hgvsc ?? `${v.ref}>${v.alt}`}</Badge>
          ))}
        </div>
      )}
      <IgvButton url={cftr.igv_report_html} onClick={onIgv} />
    </div>
  );
}

function ApoeSection({ apoe, onIgv }: { apoe: NonNullable<ReturnType<typeof useReviewStore>['reviewData']>['dark_genes']['apoe']; onIgv: (url: string) => void }) {
  if (!apoe) return null;
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>APOE Genotyping</h3>
      <div className={styles.resultGrid}>
        <ResultRow label="Genotype" value={apoe.genotype} />
        <ResultRow label="Haplotype 1" value={apoe.haplotype1} />
        <ResultRow label="Haplotype 2" value={apoe.haplotype2} />
      </div>
      <IgvButton url={apoe.igv_report_html} onClick={onIgv} />
    </div>
  );
}

function OtherSection({ sections, onIgv }: { sections: unknown[]; onIgv: (url: string) => void }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Other Dark Gene Sections</h3>
      {sections.map((s, i) => {
        const section = s as { gene?: string; result?: unknown; visual_evidence?: { igv_report_html?: string } };
        return (
          <div key={i} className={styles.otherSection}>
            <h4 className={styles.geneTitle}>{section.gene ?? `Section ${i + 1}`}</h4>
            <pre className={styles.pre}>{JSON.stringify(section.result, null, 2)}</pre>
            {section.visual_evidence?.igv_report_html && (
              <IgvButton url={section.visual_evidence.igv_report_html} onClick={onIgv} />
            )}
          </div>
        );
      })}
    </div>
  );
}
