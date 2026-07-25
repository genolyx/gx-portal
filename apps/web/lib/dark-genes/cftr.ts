import { escapeHtml } from './escape';
import type { DarkGenesSection } from './smaca';

export interface CftrRisk {
  level: 'high' | 'low';
  reasons: string[];
}

export function cftrEhIvs9RiskFromCounts(
  pt: number[],
  tg: number[],
): CftrRisk {
  const reasons: string[] = [];
  for (const x of pt) {
    if (x === 5) reasons.push('5T allele (elevated CFTR-RD/CBAVD context)');
  }
  for (const x of tg) {
    if (x >= 13) reasons.push(`TG repeat ×${x} (high-penetrance context)`);
    else if (x === 12)
      reasons.push(
        `TG repeat ×${x} (low–moderate penetrance; flagged for review)`,
      );
  }
  return { level: reasons.length ? 'high' : 'low', reasons };
}

export function cftrEhSlashAllelesToInts(s: unknown): number[] {
  const out: number[] = [];
  if (!s || typeof s !== 'string') return out;
  for (const part of s.split(/\s*\/\s*/)) {
    const n = parseInt(part.trim(), 10);
    if (!Number.isNaN(n)) out.push(n);
  }
  return out;
}

export interface CftrIvs9EhPayload {
  raw_poly_t?: unknown;
  raw_tg?: unknown;
  display_t?: unknown;
  display_tg?: unknown;
  risk_level?: unknown;
  risk_reasons?: unknown;
  locus_note?: unknown;
  per_allele_summary?: unknown;
  [k: string]: unknown;
}

export function renderCftrIvs9EhBannerFromPayload(
  eh: CftrIvs9EhPayload | null | undefined,
): string {
  if (!eh || typeof eh !== 'object') return '';
  const rpt =
    eh.raw_poly_t != null ? String(eh.raw_poly_t).trim() : '';
  const rtg = eh.raw_tg != null ? String(eh.raw_tg).trim() : '';
  const dispT =
    eh.display_t != null ? String(eh.display_t).trim() : '';
  const dispG =
    eh.display_tg != null ? String(eh.display_tg).trim() : '';
  if (!rpt && !rtg && !dispT && !dispG) return '';

  const pt = cftrEhSlashAllelesToInts(rpt);
  const tg = cftrEhSlashAllelesToInts(rtg);
  const computed = cftrEhIvs9RiskFromCounts(pt, tg);

  let riskLevel: string =
    eh.risk_level === 'high'
      ? 'high'
      : eh.risk_level === 'low'
        ? 'low'
        : computed.level;
  let riskReasons: string[] = Array.isArray(eh.risk_reasons)
    ? (eh.risk_reasons as unknown[]).filter(Boolean).map(String)
    : [];
  if (riskLevel === 'high' && !riskReasons.length)
    riskReasons = computed.reasons;
  if (riskLevel !== 'high' && riskLevel !== 'low') {
    riskLevel = computed.level;
    riskReasons = computed.reasons;
  }

  if (riskLevel !== 'high') return '';

  const riskLabel =
    riskLevel === 'high'
      ? `High-risk context — ${riskReasons.join('; ') || 'Review IVS9 poly-T / TG together.'}`
      : 'No 5T / TG12 / TG13+ pattern on this call — commonly benign with 7T/9T + TG11 (confirm against lab SOP)';

  const rows: [string, string][] = [];
  const ln = eh.locus_note ? String(eh.locus_note).trim() : '';
  if (ln) rows.push(['Locus', ln.slice(0, 600)]);
  else
    rows.push([
      'Locus (typical IVS9 EH)',
      'chr7:117,548,607-117,548,635 (GRCh38) — ref (TG)11(T)7',
    ]);
  if (rpt)
    rows.push([
      'Poly-T (EH REPCN)',
      `${rpt} (T repeats per allele)${dispT ? ` — ${dispT}` : ''}`,
    ]);
  if (rtg)
    rows.push([
      'TG (EH REPCN)',
      `${rtg} (TG repeats per allele)${dispG ? ` — ${dispG}` : ''}`,
    ]);
  rows.push(['Risk assessment', riskLabel]);
  const pa = eh.per_allele_summary
    ? String(eh.per_allele_summary).trim()
    : '';
  if (pa) rows.push(['Per-allele', pa.slice(0, 600)]);

  const inner = rows
    .map(
      ([lab, val]) =>
        `<dt>${escapeHtml(lab)}</dt><dd>${escapeHtml(val)}</dd>`,
    )
    .join('');

  const badge =
    riskLevel === 'high'
      ? '<span class="badge err" style="margin-left:8px">Review IVS9 context</span>'
      : '<span class="badge done" style="margin-left:8px;opacity:0.85">Benign pattern likely</span>';

  return (
    `<div class="dark-genes-cftr-eh-banner" data-dg-cftr-eh-banner="1" style="margin:0 0 14px">` +
    `<div class="muted" style="font-size:11px;line-height:1.5;margin:0 0 10px;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:rgba(59,130,246,.08)"><strong>CFTR IVS9 (Expansion Hunter)</strong> — Poly-T and TG REPCN from pipeline summary (structured). Interpret per-allele haplotypes together. References: Cuppens 1998; Groman 2004; CFF/ACMG.${badge}</div>` +
    `<dl class="dark-genes-kv">${inner}</dl></div>`
  );
}

export interface CftrEhSectionOpts {
  suppressBenignCftrEh?: boolean;
}

export function tryRenderCftrIvs9EhSection(
  sec: DarkGenesSection,
  ehOpts?: CftrEhSectionOpts | null,
): string | null {
  const raw = String(sec.body || '');
  const mpt =
    raw.match(/\bCFTR_polyT\s*=\s*(\d+)\s*\/\s*(\d+)/i) ||
    raw.match(/\bCFTR\s+poly[-_\s]*T\s*=\s*(\d+)\s*\/\s*(\d+)/i);
  const mtg =
    raw.match(/\bCFTR_TG\s*=\s*(\d+)\s*\/\s*(\d+)/i) ||
    raw.match(/\bCFTR\s+_?\s*TG\s*=\s*(\d+)\s*\/\s*(\d+)/i);
  if (!mpt && !mtg) return null;

  const pt: number[] = [];
  const tg: number[] = [];
  if (mpt) {
    pt.push(parseInt(mpt[1], 10), parseInt(mpt[2], 10));
  }
  if (mtg) {
    tg.push(parseInt(mtg[1], 10), parseInt(mtg[2], 10));
  }
  const risk = cftrEhIvs9RiskFromCounts(pt, tg);
  if (ehOpts && ehOpts.suppressBenignCftrEh && risk.level !== 'high')
    return null;

  const pa = raw.match(/^\s*Per-allele\s*:\s*(.+)$/im);
  const rows: [string, string][] = [];
  const locHint = raw.match(/117[\s,]*548[\s,]*607|117548607/i);
  if (locHint)
    rows.push([
      'Locus (typical IVS9 EH)',
      'chr7:117,548,607-117,548,635 (GRCh38) — ref (TG)11(T)7',
    ]);
  if (mpt)
    rows.push([
      'Poly-T (EH REPCN)',
      `${mpt[1]} / ${mpt[2]} (T repeats per allele)`,
    ]);
  if (mtg)
    rows.push([
      'TG (EH REPCN)',
      `${mtg[1]} / ${mtg[2]} (TG repeats per allele)`,
    ]);

  const riskLabel =
    risk.level === 'high'
      ? `High-risk context — ${risk.reasons.join('; ')}`
      : 'No 5T / TG12 / TG13+ pattern on this call — commonly benign with 7T/9T + TG11 (confirm against lab SOP)';
  rows.push(['Risk assessment', riskLabel]);
  if (pa) rows.push(['Per-allele', pa[1].trim().slice(0, 600)]);

  const inner = rows
    .map(
      ([lab, val]) =>
        `<dt>${escapeHtml(lab)}</dt><dd>${escapeHtml(val)}</dd>`,
    )
    .join('');

  const badge =
    risk.level === 'high'
      ? '<span class="badge err" style="margin-left:8px">Review IVS9 context</span>'
      : '<span class="badge done" style="margin-left:8px;opacity:0.85">Benign pattern likely</span>';

  return (
    `<div class="muted" style="font-size:11px;line-height:1.5;margin:0 0 10px;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:rgba(59,130,246,.08)"><strong>CFTR IVS9 (Expansion Hunter)</strong> — Interpret poly-T and TG REPCN together (per-allele haplotypes). References: Cuppens 1998; Groman 2004; CFF/ACMG (pipeline text).${badge}</div>` +
    `<dl class="dark-genes-kv">${inner}</dl>`
  );
}

export function darkGenesSectionIsCftrIvs9Relevant(
  sec: DarkGenesSection | null | undefined,
): boolean {
  if (!sec || typeof sec !== 'object') return false;
  const title = String(sec.title || '');
  const blob = `${title}\n${String(sec.body || '')}`;
  if (/\bCFTR\b/i.test(title)) return true;
  if (/\bCFTR_(polyT|TG)\s*=/i.test(blob)) return true;
  if (/\bCFTR\s+poly/i.test(blob)) return true;
  if (/CFTR_IVS9|\(TG\)11\(T\)7|EH locus[^\n]{0,60}CFTR/i.test(blob))
    return true;
  if (/IVS\s*9.*\bCFTR\b|\bCFTR\b.*IVS\s*9/i.test(blob)) return true;
  if (
    /expansion\s*hunter[^\n]{0,80}CFTR|CFTR[^\n]{0,80}expansion\s*hunter/i.test(
      blob,
    )
  )
    return true;
  return false;
}
