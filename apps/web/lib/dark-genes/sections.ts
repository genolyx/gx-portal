import { escapeHtml } from './escape';
import type { DarkGenesSection } from './smaca';
import { darkGenesSectionIsCftrIvs9Relevant } from './cftr';
import {
  cyp21CahDosageTitleMatches,
  cahBodyImpliesHighPriority,
} from './dosage';

/* ------------------------------------------------------------------ */
/*  Display title mapping                                              */
/* ------------------------------------------------------------------ */

export function darkGenesDisplayTitle(raw: unknown): string {
  const t = String(raw || '').trim();
  if (!t) return 'Section';
  if (/^smaca\s+check\b/i.test(t)) return 'Spinal Muscular Atrophy';
  const k = t.toLowerCase().replace(/\s+/g, ' ').trim();
  const map: Record<string, string> = {
    'hba analysis (alpha thalassemia - dosage)': 'Alpha Thalassemia',
    'cyp21a2 analysis (cah - dosage)':
      'Congenital Adrenal Hyperplasia (CAH)',
    'expansion hunter (fragile x / fmr1)': 'Fragile X',
    'dmd analysis (chrx:31.1m-33.3m)':
      'Duchenne Muscular Dystrophy (DMD)',
    'large svs (manta/gcnv - rest)':
      'Large Structural Variants and Copy Number Variants',
  };
  return map[k] || t;
}

/* ------------------------------------------------------------------ */
/*  Always-on-PDF / auto-approve / APOE filters                       */
/* ------------------------------------------------------------------ */

const CORE_PDF_TITLES = new Set([
  'Spinal Muscular Atrophy',
  'Alpha Thalassemia',
  'Congenital Adrenal Hyperplasia (CAH)',
  'Fragile X',
  'Duchenne Muscular Dystrophy (DMD)',
]);

export function darkGenesSectionAlwaysOnCustomerPdf(
  sec: DarkGenesSection | null | undefined,
): boolean {
  const disp = darkGenesDisplayTitle(sec && sec?.title);
  return CORE_PDF_TITLES.has(disp);
}

export function darkGenesSectionExcludesLowRiskAutoApprove(
  sec: DarkGenesSection | null | undefined,
): boolean {
  if (!sec || typeof sec !== 'object') return false;
  const title = String(sec.title || '');
  const body = String(sec.body || '');
  if (/\bCFTR\b/i.test(title) || /cystic\s+fibrosis/i.test(title))
    return true;
  if (darkGenesSectionAlwaysOnCustomerPdf(sec)) return false;
  const blob = `${title}\n${body}`;
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
  if (/\bpoly_t\s*=/i.test(body) || /\bpoly[_\s]?tg\s*=/i.test(body))
    return true;
  if (/raw\s+eh\s+repcn/i.test(body)) return true;
  return false;
}

export function isDarkGenesApoePgxSection(
  sec: DarkGenesSection | null | undefined,
): boolean {
  if (!sec || typeof sec !== 'object') return false;
  if (/\bapoe\b/i.test(String(sec.title || ''))) return true;
  const head = String(sec.body || '')
    .split(/\n/)
    .slice(0, 8)
    .join('\n');
  return /^\s*apoe\s*[:=]/im.test(head);
}

/* ------------------------------------------------------------------ */
/*  Pipeline danger inference                                          */
/* ------------------------------------------------------------------ */

export function inferPipelineDangerForSection(
  sec: DarkGenesSection | null | undefined,
): boolean {
  if (!sec || typeof sec !== 'object') return false;
  const kind = sec.kind || 'normal';
  if (kind === 'warning') return true;
  const title = String(sec.title || '').toUpperCase();
  if (title.includes('WARNING') && !title.includes('QUALITY')) return true;
  const body = String(sec.body || '');
  if (/^\s*WARNING:\s*\S/im.test(body)) return true;
  if (/^\s*Status\s*:\s*WARNING\s*:/im.test(body)) return true;
  if (cyp21CahDosageTitleMatches(sec.title) && cahBodyImpliesHighPriority(body))
    return true;
  return false;
}

/* ------------------------------------------------------------------ */
/*  Pad / infer section reviews                                        */
/* ------------------------------------------------------------------ */

export interface SectionReviewEntry {
  approved: boolean;
  notes: string;
  risk: string;
  reviewer_set?: boolean;
}

export function padDarkGenesSectionReviews(
  rev: unknown[] | null | undefined,
  n: number,
  sections: DarkGenesSection[] | null | undefined,
): SectionReviewEntry[] {
  const o: Record<string, unknown>[] = Array.isArray(rev)
    ? (rev.slice() as Record<string, unknown>[])
    : [];
  while (o.length < n) o.push({ approved: false, notes: '' });
  return o.slice(0, n).map((e, i) => {
    const sec = sections && sections[i];
    const notes = String((e && e.notes) || '');
    if (e && e.reviewer_set) {
      const risk: string =
        e.risk === 'low'
          ? 'low'
          : e.risk === 'high'
            ? 'high'
            : inferPipelineDangerForSection(sec)
              ? 'high'
              : 'low';
      return { approved: !!e.approved, notes, risk, reviewer_set: true };
    }
    const inferred = inferPipelineDangerForSection(sec);
    const hasTier =
      e &&
      Object.prototype.hasOwnProperty.call(e, 'risk') &&
      e.risk != null &&
      e.risk !== '';
    let risk: string;
    if (hasTier) {
      risk = e.risk === 'low' ? 'low' : 'high';
    } else if (inferred) {
      risk = 'high';
    } else {
      risk = 'low';
    }
    let approved = !!e.approved;
    if (inferred && risk === 'low') {
      risk = 'high';
      approved = false;
    } else if (inferred && hasTier && e.risk !== 'high') {
      approved = false;
    } else if (inferred && !hasTier) {
      approved = false;
    }
    const explicitlyUnapproved = e && e.reviewer_set && e.approved === false;
    if (
      risk === 'low' &&
      darkGenesSectionAlwaysOnCustomerPdf(sec) &&
      !darkGenesSectionExcludesLowRiskAutoApprove(sec) &&
      !explicitlyUnapproved
    ) {
      approved = true;
    }
    return { approved, notes, risk };
  });
}

/* ------------------------------------------------------------------ */
/*  Visual target mapping                                              */
/* ------------------------------------------------------------------ */

export interface VisualEvidence {
  igv_report_html?: string | null;
  repeat_svgs?: string[] | null;
  snapshots_png?: string[] | null;
  [k: string]: unknown;
}

export interface VisualTarget {
  target: string;
  label: string;
  igvHint?: string;
  repeatFilter?: string;
}

export function darkGenesSectionVisualTarget(
  sec: DarkGenesSection,
  ve?: VisualEvidence | null,
): VisualTarget | null {
  const veObj = ve || ({} as VisualEvidence);
  const kind = sec.kind || 'normal';
  if (kind === 'alert') return null;
  const raw = String(sec.title || '');
  if (/^overview$/i.test(raw.trim())) return null;

  if (darkGenesSectionIsCftrIvs9Relevant(sec)) {
    return { target: 'cftr_coverage', label: 'CFTR IGV (BAM)', igvHint: 'cftr' };
  }

  const hasIgv = !!veObj.igv_report_html;
  const hasRep = !!(veObj.repeat_svgs && veObj.repeat_svgs.length);
  const hasPng = !!(veObj.snapshots_png && veObj.snapshots_png.length);
  if (!hasIgv && !hasRep && !hasPng) return null;

  const tl = raw.toLowerCase();

  if (/expansion\s*hunter|fragile|fmr1/i.test(raw)) {
    if (hasRep)
      return {
        target: 'repeat',
        label: 'Repeat plots',
        repeatFilter: 'fragile',
      };
    if (hasIgv)
      return { target: 'igv', label: 'FMR1 IGV', igvHint: 'generic' };
    return null;
  }
  if (/smaca|smn|paraphase/i.test(tl)) {
    if (hasIgv)
      return { target: 'igv', label: 'SMN / SMA IGV', igvHint: 'smn' };
    return null;
  }
  if (/hba|alpha\s*thal/i.test(tl)) {
    if (hasIgv)
      return { target: 'igv', label: 'HBA IGV', igvHint: 'generic' };
    return null;
  }
  if (/cyp21|ca\s*h/i.test(tl)) {
    if (hasIgv)
      return { target: 'igv', label: 'CYP21A2 IGV', igvHint: 'generic' };
    return null;
  }
  if (/\bdmd\b/i.test(tl)) {
    if (hasIgv)
      return { target: 'igv', label: 'DMD IGV', igvHint: 'generic' };
    return null;
  }
  if (/large\s*sv|manta|gcnv/i.test(tl)) {
    if (hasPng) return { target: 'png', label: 'SV images' };
    if (hasIgv)
      return { target: 'igv', label: 'IGV', igvHint: 'generic' };
    return null;
  }
  if (hasIgv)
    return { target: 'igv', label: 'IGV report', igvHint: 'generic' };
  if (hasRep)
    return { target: 'repeat', label: 'Repeat plots', repeatFilter: 'all' };
  if (hasPng) return { target: 'png', label: 'Images' };
  return null;
}

/* ------------------------------------------------------------------ */
/*  TSV → HTML table                                                   */
/* ------------------------------------------------------------------ */

export function parseDarkGenesTsvToTableHtml(txt: unknown): string | null {
  const raw = String(txt || '').trim();
  if (!raw) return null;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length);
  if (lines.length < 2) return null;
  if (!lines[0].includes('\t')) return null;
  const rows = lines.map((line) => line.split('\t'));
  const maxCols = Math.max(...rows.map((r) => r.length), 0);
  if (maxCols < 2) return null;
  const norm = rows.map((r) => {
    const x = r.slice();
    while (x.length < maxCols) x.push('');
    return x;
  });

  function cellInner(t: string): string {
    const s = String(t).trim();
    let inner = escapeHtml(s);
    if (/WARNING:/i.test(s))
      inner = `<span class="dark-genes-warn">${inner}</span>`;
    else if (/^Error:/i.test(s) || /^ERROR\b/i.test(s))
      inner = `<span class="dark-genes-err">${inner}</span>`;
    return inner;
  }

  const thHtml = norm[0]
    .map((c) => `<th scope="col">${escapeHtml(String(c).trim())}</th>`)
    .join('');
  const trHtml = norm
    .slice(1)
    .map(
      (tr) =>
        `<tr>${tr.map((c) => `<td title="${escapeHtml(String(c).trim())}">${cellInner(c)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<div class="dark-genes-table-wrap"><table class="dark-genes-matrix" role="grid"><thead><tr>${thHtml}</tr></thead><tbody>${trHtml}</tbody></table></div>`;
}

/* ------------------------------------------------------------------ */
/*  Raw details (collapsible <details>)                                */
/* ------------------------------------------------------------------ */

export function darkGenesRawDetails(
  label: string,
  rawText: unknown,
  maxPre?: number,
): string {
  const t = String(rawText || '');
  const clipped = maxPre ? t.slice(0, maxPre) : t;
  const more =
    maxPre && t.length > maxPre
      ? `\n\n[… ${t.length - maxPre} more characters …]`
      : '';
  return `<details class="dark-genes-raw-details"><summary>${escapeHtml(label)}</summary><pre>${escapeHtml(clipped + more)}</pre></details>`;
}

/* ------------------------------------------------------------------ */
/*  Normalize / parse section body + headers                           */
/* ------------------------------------------------------------------ */

export function normalizeDarkGenesSectionBody(text: unknown): string {
  return String(text || '')
    .split(/\r?\n/)
    .filter((line) => !/^[\s\-_–—]+$/.test(line))
    .join('\n')
    .trim();
}

export interface ParsedSection {
  title: string;
  body: string;
  kind: string;
}

export function parseDarkGenesDetailedToSections(
  text: unknown,
): ParsedSection[] {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);
  const buf: string[] = [];
  let title = 'Overview';
  const sections: ParsedSection[] = [];

  const flush = () => {
    const body = normalizeDarkGenesSectionBody(buf.join('\n').trim());
    buf.length = 0;
    if (!body) return;
    const tl = title.toUpperCase();
    let kind = 'normal';
    if (tl.includes('QUALITY') && tl.includes('WARNING')) kind = 'alert';
    else if (tl.includes('WARNING')) kind = 'warning';
    sections.push({ title: title.trim(), body, kind });
  };

  const isBanner = (line: string) => {
    const s = line.trim();
    return s && s.startsWith('!!!') && s.endsWith('!!!') && s.length < 160;
  };

  const isSectionHeader = (line: string) => {
    const s = line.trim();
    if (!s || s.length > 130) return false;
    if (isBanner(line)) return true;
    if (line.startsWith('  ') || line.startsWith('\t')) return false;
    if (!s.endsWith(':')) return false;
    if (/^[A-Za-z0-9_]+\s*:\s*\S/.test(s)) return false;
    return true;
  };

  for (const line of lines) {
    const st = line.trim();
    if (st.startsWith('=') && /^=+$/.test(st)) continue;
    if (isSectionHeader(line)) {
      flush();
      const t = line.trim();
      if (isBanner(line)) {
        title = t.replace(/^!+/, '').replace(/!+$/, '').trim();
      } else {
        title = t.replace(/:\s*$/, '').trim();
      }
      continue;
    }
    buf.push(line);
  }
  flush();
  return sections;
}

/* ------------------------------------------------------------------ */
/*  Strip Fragile X FMR1 block from igv-reports HTML (DOMParser)       */
/* ------------------------------------------------------------------ */

export function stripFragileXFmr1BlockFromVisualReportHtml(
  html: string,
): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (doc.querySelector('parsererror')) return html;
    let marker: Element | null = null;
    for (const h of Array.from(
      doc.querySelectorAll('h1, h2, h3, h4, h5, h6'),
    )) {
      const text = (h.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/fragile\s*x/i.test(text)) continue;
      if (!/fmr1|\(cgg\)/i.test(text)) continue;
      marker = h;
      break;
    }
    if (!marker) return html;
    let el: Element | null =
      marker.closest('section') ||
      marker.closest(
        '[class*="fragile" i], [id*="fragile" i], [class*="fmr1" i], [id*="fmr1" i]',
      );
    if (!el) {
      el = marker;
      while (el.parentElement && el.parentElement !== doc.body) {
        el = el.parentElement;
      }
    }
    if (!el || !el.parentElement) return html;
    const body = doc.body;
    const fullLen = (body && body.textContent && body.textContent.length) || 0;
    const chunkLen = (el.textContent || '').length;
    if (fullLen > 200 && chunkLen > fullLen * 0.55) return html;
    const chunk = (el.textContent || '').slice(0, 12000);
    if (/\bVARIANTS\b/i.test(chunk) && /\b(chrom|chr[\dXY]+)\b/i.test(chunk))
      return html;
    el.remove();
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  } catch {
    return html;
  }
}
