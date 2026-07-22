'use client';

import { useState } from 'react';
import { useReviewStore } from '../../../lib/store/reviewStore';
import styles from './DarkGenesPanel.module.css';

interface DetailedSection {
  title?: string;
  body?: string;
  kind?: string;
  [key: string]: unknown;
}

interface CftrIvs9Eh {
  display_t?: string;
  display_tg?: string;
  per_allele_summary?: string;
  risk_level?: string;
  risk_reasons?: string[];
  locus_note?: string;
  [key: string]: unknown;
}

export function DarkGenesPanel() {
  const { reviewData } = useReviewStore();
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  const dark = reviewData?.dark_genes;

  if (!dark) {
    return <p className={styles.empty}>No dark gene data available for this order.</p>;
  }

  const hasData = dark.status === 'found' || dark.summary_text || dark.detailed_sections?.length;
  if (!hasData && !dark.smn && !dark.cftr && !dark.apoe) {
    return (
      <div className={styles.noData}>
        <p>Dark gene analysis was not performed or produced no results for this order.</p>
        {dark.status && <p className={styles.hint}>Status: {String(dark.status)}</p>}
      </div>
    );
  }

  const sections  = (dark.detailed_sections ?? []) as DetailedSection[];
  const cftrEh    = dark.cftr_ivs9_eh as CftrIvs9Eh | undefined;
  const ve        = dark.visual_evidence ?? {};
  const igvHtml   = typeof ve.igv_report_html === 'string' ? ve.igv_report_html : undefined;

  const toggleSection = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const kindClass = (kind?: string) => {
    if (!kind || kind === 'normal') return '';
    if (kind === 'warn')  return styles.secWarn;
    if (kind === 'alert') return styles.secAlert;
    if (kind === 'ok')    return styles.secOk;
    return '';
  };

  return (
    <div className={styles.wrap}>
      {/* Summary header */}
      {dark.summary_text && (
        <details className={styles.summaryDetails}>
          <summary className={styles.summarySummary}>Summary table</summary>
          <pre className={styles.summaryPre}>{String(dark.summary_text)}</pre>
        </details>
      )}

      {/* CFTR IVS9 EH result */}
      {cftrEh && (
        <div className={`${styles.cftrCard} ${cftrEh.risk_level === 'high' ? styles.secAlert : cftrEh.risk_level === 'medium' ? styles.secWarn : styles.secOk}`}>
          <h3 className={styles.sectionTitle}>CFTR IVS9 (poly-T / TG) — Expansion Hunter</h3>
          <div className={styles.kvGrid}>
            {cftrEh.display_t    && <><dt>Poly-T</dt><dd>{cftrEh.display_t}</dd></>}
            {cftrEh.display_tg   && <><dt>TG repeat</dt><dd>{cftrEh.display_tg}</dd></>}
            {cftrEh.per_allele_summary && <><dt>Allele summary</dt><dd>{cftrEh.per_allele_summary}</dd></>}
            {cftrEh.risk_level   && <><dt>Risk level</dt><dd className={cftrEh.risk_level === 'high' ? styles.textErr : cftrEh.risk_level === 'medium' ? styles.textWarn : styles.textOk}>{cftrEh.risk_level.toUpperCase()}</dd></>}
            {cftrEh.risk_reasons && cftrEh.risk_reasons.length > 0 && (
              <><dt>Risk reasons</dt><dd>{cftrEh.risk_reasons.join('; ')}</dd></>
            )}
          </div>
          {cftrEh.locus_note && <p className={styles.hint}>{String(cftrEh.locus_note)}</p>}
        </div>
      )}

      {/* Detailed sections */}
      {sections.length > 0 && (
        <div className={styles.sectionsStack}>
          {sections.map((s, i) => (
            <div key={i} className={`${styles.secCard} ${kindClass(s.kind)}`}>
              <div
                className={styles.secHeader}
                onClick={() => toggleSection(i)}
              >
                <span className={styles.secTitleText}>{s.title ?? `Section ${i + 1}`}</span>
                <span className={styles.secToggle}>{expanded.has(i) ? '▲' : '▼'}</span>
              </div>
              {expanded.has(i) && s.body && (
                <pre className={styles.secBody}>{String(s.body)}</pre>
              )}
            </div>
          ))}
        </div>
      )}

      {/* IGV report link */}
      {igvHtml && (
        <div style={{ marginTop: 16 }}>
          <a
            href={igvHtml}
            target="_blank"
            rel="noreferrer"
            className={styles.igvLink}
          >
            Open IGV Visual Evidence Report ↗
          </a>
        </div>
      )}

      {/* Legacy support: smn/cftr/apoe objects */}
      {dark.smn && !sections.length && (
        <LegacySmnSection smn={dark.smn as Record<string, unknown>} />
      )}
    </div>
  );
}

function LegacySmnSection({ smn }: { smn: Record<string, unknown> }) {
  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>SMN1 / SMN2 Copy Number</h3>
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px', fontSize: 12 }}>
        {Object.entries(smn).filter(([, v]) => typeof v !== 'object').map(([k, v]) => (
          <><dt key={`dt-${k}`} style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{k}</dt>
          <dd key={`dd-${k}`} style={{ margin: 0 }}>{String(v)}</dd></>
        ))}
      </dl>
    </div>
  );
}
