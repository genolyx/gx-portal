'use client';

import { Card, Disclosure, Link } from '@heroui/react';
import { useReviewStore } from '../../../lib/store/reviewStore';

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

function sectionBorderClass(kind?: string) {
  if (!kind || kind === 'normal') return '';
  if (kind === 'warn')  return 'border-warning/50 bg-warning/5';
  if (kind === 'alert') return 'border-danger/50 bg-danger/5';
  if (kind === 'ok')    return 'border-success/50 bg-success/5';
  return '';
}

function riskTextClass(level?: string) {
  if (level === 'high') return 'text-danger font-bold';
  if (level === 'medium') return 'text-warning font-bold';
  return 'text-success font-bold';
}

export function DarkGenesPanel() {
  const { reviewData } = useReviewStore();

  const dark = reviewData?.dark_genes;

  if (!dark) {
    return <p className="py-8 text-center text-muted">No dark gene data available for this order.</p>;
  }

  const hasData = dark.status === 'found' || dark.summary_text || dark.detailed_sections?.length;
  if (!hasData && !dark.smn && !dark.cftr && !dark.apoe) {
    return (
      <div className="py-8 text-center text-muted">
        <p>Dark gene analysis was not performed or produced no results for this order.</p>
        {dark.status && <p className="mt-1 text-[11px]">Status: {String(dark.status)}</p>}
      </div>
    );
  }

  const sections  = (dark.detailed_sections ?? []) as DetailedSection[];
  const cftrEh    = dark.cftr_ivs9_eh as CftrIvs9Eh | undefined;
  const ve        = dark.visual_evidence ?? {};
  const igvHtml   = typeof ve.igv_report_html === 'string' ? ve.igv_report_html : undefined;

  const cftrCardClass = cftrEh?.risk_level === 'high'
    ? 'border-danger/50 bg-danger/5'
    : cftrEh?.risk_level === 'medium'
      ? 'border-warning/50 bg-warning/5'
      : 'border-success/50 bg-success/5';

  return (
    <div className="flex flex-col gap-3">
      {dark.summary_text && (
        <Card className="overflow-hidden">
          <Disclosure>
            <Disclosure.Heading>
              <Disclosure.Trigger className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left">
                <span className="text-xs font-semibold text-muted">Summary table</span>
                <Disclosure.Indicator />
              </Disclosure.Trigger>
            </Disclosure.Heading>
            <Disclosure.Content>
              <Disclosure.Body className="border-t border-border p-0">
                <pre className="m-0 overflow-x-auto whitespace-pre-wrap px-3.5 py-2.5 font-mono text-[11px] text-muted">
                  {String(dark.summary_text)}
                </pre>
              </Disclosure.Body>
            </Disclosure.Content>
          </Disclosure>
        </Card>
      )}

      {cftrEh && (
        <Card className={cftrCardClass}>
          <Card.Header>
            <Card.Title className="text-[13px]">CFTR IVS9 (poly-T / TG) — Expansion Hunter</Card.Title>
          </Card.Header>
          <Card.Content>
            <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] items-baseline gap-x-4 gap-y-1.5 text-xs">
              {cftrEh.display_t    && <><dt className="font-semibold text-muted">Poly-T</dt><dd className="m-0 font-mono">{cftrEh.display_t}</dd></>}
              {cftrEh.display_tg   && <><dt className="font-semibold text-muted">TG repeat</dt><dd className="m-0 font-mono">{cftrEh.display_tg}</dd></>}
              {cftrEh.per_allele_summary && <><dt className="font-semibold text-muted">Allele summary</dt><dd className="m-0 font-mono">{cftrEh.per_allele_summary}</dd></>}
              {cftrEh.risk_level   && (
                <>
                  <dt className="font-semibold text-muted">Risk level</dt>
                  <dd className={`m-0 font-mono ${riskTextClass(cftrEh.risk_level)}`}>{cftrEh.risk_level.toUpperCase()}</dd>
                </>
              )}
              {cftrEh.risk_reasons && cftrEh.risk_reasons.length > 0 && (
                <><dt className="font-semibold text-muted">Risk reasons</dt><dd className="m-0 font-mono">{cftrEh.risk_reasons.join('; ')}</dd></>
              )}
            </dl>
            {cftrEh.locus_note && <p className="mt-2 text-[11px] text-muted">{String(cftrEh.locus_note)}</p>}
          </Card.Content>
        </Card>
      )}

      {sections.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {sections.map((s, i) => (
            <Card key={i} className={`overflow-hidden ${sectionBorderClass(s.kind)}`}>
              <Disclosure defaultExpanded={i === 0}>
                <Disclosure.Heading className="bg-surface">
                  <Disclosure.Trigger className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
                    <span className="text-xs font-semibold">{s.title ?? `Section ${i + 1}`}</span>
                    <Disclosure.Indicator />
                  </Disclosure.Trigger>
                </Disclosure.Heading>
                {s.body && (
                  <Disclosure.Content>
                    <Disclosure.Body className="border-t border-border p-0">
                      <pre className="m-0 overflow-x-auto whitespace-pre-wrap px-3 py-2.5 font-mono text-[11px] leading-relaxed text-muted">
                        {String(s.body)}
                      </pre>
                    </Disclosure.Body>
                  </Disclosure.Content>
                )}
              </Disclosure>
            </Card>
          ))}
        </div>
      )}

      {igvHtml && (
        <div className="mt-1">
          <Link href={igvHtml} target="_blank" rel="noreferrer" className="text-xs">
            Open IGV Visual Evidence Report ↗
          </Link>
        </div>
      )}

      {dark.smn && !sections.length && (
        <LegacySmnSection smn={dark.smn as Record<string, unknown>} />
      )}
    </div>
  );
}

function LegacySmnSection({ smn }: { smn: Record<string, unknown> }) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-bold">SMN1 / SMN2 Copy Number</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        {Object.entries(smn).filter(([, v]) => typeof v !== 'object').map(([k, v]) => (
          <><dt key={`dt-${k}`} className="font-semibold text-muted">{k}</dt>
          <dd key={`dd-${k}`} className="m-0">{String(v)}</dd></>
        ))}
      </dl>
    </div>
  );
}
