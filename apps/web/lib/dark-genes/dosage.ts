import { escapeHtml } from './escape';
import type { DarkGenesSection } from './smaca';
import { darkGenesDisplayTitle } from './sections';

/* ------------------------------------------------------------------ */
/*  Title matchers                                                     */
/* ------------------------------------------------------------------ */

export function dosageAnalysisTitleMatches(t: unknown): boolean {
  const u = String(t || '').trim();
  if (!u) return false;
  if (/HBA\s+ANALYSIS/i.test(u)) return true;
  if (/CYP21A2\s+ANALYSIS/i.test(u)) return true;
  if (/Alpha\s*Thalassemia/i.test(u) && /Dosage/i.test(u)) return true;
  if (/CYP21A2/i.test(u) && /CAH/i.test(u)) return true;
  if (/CAH/i.test(u) && /Dosage/i.test(u) && /CYP21/i.test(u)) return true;
  if (/CYP21A2/i.test(u) && /hotspot/i.test(u)) return true;
  if (/CAH/i.test(u) && /hotspot/i.test(u)) return true;
  return false;
}

export function alphaThalassemiaDosageTitleMatches(t: unknown): boolean {
  const u = String(t || '').trim();
  if (!u) return false;
  if (/HBA\s+ANALYSIS/i.test(u)) return true;
  if (/Alpha\s*Thalassemia/i.test(u) && /Dosage/i.test(u)) return true;
  return darkGenesDisplayTitle(t) === 'Alpha Thalassemia';
}

export function cyp21CahDosageTitleMatches(t: unknown): boolean {
  if (alphaThalassemiaDosageTitleMatches(t)) return false;
  const u = String(t || '').trim();
  if (!u) return false;
  if (/CYP21A2\s+ANALYSIS/i.test(u)) return true;
  if (/CYP21A2/i.test(u) && /CAH/i.test(u)) return true;
  if (/CAH/i.test(u) && /Dosage/i.test(u) && /CYP21/i.test(u)) return true;
  if (/CYP21A2/i.test(u) && /hotspot/i.test(u)) return true;
  if (/CAH/i.test(u) && /hotspot/i.test(u)) return true;
  if (/\bCAH\b/i.test(u) && /Dosage/i.test(u)) return true;
  if (/congenital\s+adrenal\s+hyperplasia/i.test(u)) return true;
  return darkGenesDisplayTitle(t) === 'Congenital Adrenal Hyperplasia (CAH)';
}

/* ------------------------------------------------------------------ */
/*  Alpha thal key/value parsers                                       */
/* ------------------------------------------------------------------ */

export function splitAlphaThalKvSegments(raw: unknown): string[] {
  return String(raw || '')
    .split(/[\r\n|;\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function alphaThalPickScalar(
  raw: unknown,
  keyNames: string | string[],
): string | null {
  const s = String(raw || '');
  const names = Array.isArray(keyNames) ? keyNames : [keyNames];
  for (const name of names) {
    const re = new RegExp(`^\\s*${name}\\s*=\\s*(\\S+)`, 'im');
    const m = s.match(re);
    if (m) return m[1];
  }
  for (const seg of splitAlphaThalKvSegments(s)) {
    for (const name of names) {
      const re = new RegExp(`^${name}\\s*=\\s*(\\S+)$`, 'i');
      const m = re.exec(seg);
      if (m) return m[1];
    }
  }
  return null;
}

export function alphaThalPickScalarAnywhere(
  raw: unknown,
  keyNames: string | string[],
): string | null {
  const s = String(raw || '');
  const names = Array.isArray(keyNames) ? keyNames : [keyNames];
  for (const name of names) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `(?:^|[\\s|;,\t])${esc}\\s*=\\s*([^\\s|;,\t]+)`,
      'i',
    );
    const m = s.match(re);
    if (m) return m[1];
  }
  return null;
}

export function alphaThalPickResultFromFormulaLine(
  raw: unknown,
  formulaKey: string,
): string | null {
  const esc = String(formulaKey).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(?:^|[\\s|;,\t])${esc}\\s*=\\s*(.+)$`,
    'im',
  );
  const m = String(raw || '').match(re);
  if (!m) return null;
  const rhs = m[1].trim();
  const i = rhs.lastIndexOf('=');
  const tail = i < 0 ? rhs : rhs.slice(i + 1).trim();
  return /^[\d.eE+-]+$/.test(tail) ? tail : null;
}

/* ------------------------------------------------------------------ */
/*  CAH hotspot helpers                                                */
/* ------------------------------------------------------------------ */

export function normalizeCahHotspotToken(tok: unknown): string | null {
  const t = String(tok || '')
    .trim()
    .toLowerCase();
  if (!t) return null;
  if (
    /^(positive|pos|yes|y|true|1|detected|variant|mut|mutation|variants|present)$/.test(
      t,
    )
  ) {
    return 'Positive';
  }
  if (
    /^(negative|neg|no|n|false|0|undetected|wild-type|wildtype|wt|normal|clear|absent|none)$/.test(
      t,
    )
  ) {
    return 'Negative';
  }
  if (t === 'pass') return 'Negative';
  if (/^(fail|failed)$/.test(t)) return 'Positive';
  if (
    /^(not_detected|no_variant|no_variants|novariant|no_variant_detected|neg_result)$/.test(
      t,
    )
  ) {
    return 'Negative';
  }
  if (
    /^(variant_found|variantfound|pathogenic_hit|mutation_detected)$/.test(t)
  ) {
    return 'Positive';
  }
  return null;
}

export function cyp21InferHotspotFromNmScreening(
  raw: unknown,
): string | null {
  const lines = String(raw || '').split(/\r?\n/);
  let inBlock = false;
  const site: string[] = [];
  for (const ln of lines) {
    if (
      /NM_000500\s+hotspot screening/i.test(ln) ||
      /hotspot screening\s*\([^)]*variant caller/i.test(ln)
    ) {
      inBlock = true;
      continue;
    }
    if (inBlock && /^\s*BAM pileup\b/i.test(ln)) break;
    if (!inBlock) continue;
    const t = ln.trim();
    if (!/^\[[^\]]+\]/.test(t)) continue;
    const m = t.match(/^\[[^\]]+\]\s+[^:]+:\s*(.+)$/);
    if (!m) continue;
    const rest = String(m[1] || '').trim();
    if (!rest) continue;
    if (/^not_detected\b/i.test(rest)) site.push('neg');
    else site.push('pos');
  }
  if (!site.length) return null;
  if (site.some((x) => x === 'pos')) return 'Positive';
  if (site.every((x) => x === 'neg')) return 'Negative';
  return null;
}

export function cyp21PickHotspotCall(raw: unknown): string | null {
  const s = String(raw || '');
  const keys = [
    'hotspot_result',
    'hotspot_mutations_result',
    'hotspot_mutations',
    'cah_hotspot_result',
    'cyp21_hotspot_result',
    'hotspot_7_result',
    'hotspot_7_mutations',
    'hotspot_panel_result',
    'cyp21_hotspot',
    'mutations_hotspot_7',
    'hotspot_7',
    'hotspot_status',
    'cyp21_hotspot_status',
    'cah_7hotspot_result',
    'cyp21_7hotspot_result',
    'cyp21_hotspot_mutations',
    'hotspot_screening',
    'cah_hotspot_screening',
    'hs7_result',
    'HS7_RESULT',
    'seven_hotspot_result',
    'hotspot_hit',
    'hotspot_variants_found',
    'n_hotspot_variants',
    'hotspot_n_variants',
  ];
  for (const k of keys) {
    const v =
      alphaThalPickScalar(s, [k]) || alphaThalPickScalarAnywhere(s, [k]);
    if (v) {
      const n = normalizeCahHotspotToken(v);
      if (n) return n;
    }
  }

  const lineRes: RegExp[] = [
    /^\s*Hotspot(?:\s+mutations)?(?:\s*\(7\))?\s*:\s*(positive|negative|pos|neg)\s*$/im,
    /^\s*(?:7\s+)?hotspot(?:\s+mutations)?\s*:\s*(positive|negative|pos|neg)\s*$/im,
    /^\s*CYP21\s+hotspot[^\n:]{0,80}:\s*(positive|negative|pos|neg)\s*$/im,
  ];
  for (const re of lineRes) {
    const m = s.match(re);
    if (m) {
      const n = normalizeCahHotspotToken(m[1]);
      if (n) return n;
    }
  }

  const inlineRes: RegExp[] = [
    /\bCYP21_HOTSPOT(?:_RESULT)?\s*=\s*(positive|negative|pos|neg)\b/i,
    /\bhotspot(?:_7)?_result\s*=\s*(positive|negative|pos|neg)\b/i,
    /\bhotspot(?:_mutations)?_call\s*=\s*(positive|negative|pos|neg)\b/i,
    /\bCYP21_HOTSPOT_MUTATIONS\s*=\s*(\S+)/i,
  ];
  for (const re of inlineRes) {
    const m = s.match(re);
    if (m) {
      const n = normalizeCahHotspotToken(m[1]);
      if (n) return n;
    }
  }

  for (const ln of s.split(/\r?\n/)) {
    const eq = ln.match(/^([^=]+)=(.+)$/);
    if (!eq || !/hotspot/i.test(eq[1])) continue;
    const first = String(eq[2]).trim().split(/[\s,|;]/)[0];
    const n = normalizeCahHotspotToken(first);
    if (n) return n;
  }

  const loose = s.match(
    /\bhotspot(?:\s+mutations)?(?:\s*\(7\))?\s*:\s*(positive|negative|pos|neg)\b/i,
  );
  if (loose) {
    const n = normalizeCahHotspotToken(loose[1]);
    if (n) return n;
  }

  const mCnt = s.match(
    /\b(?:n_)?hotspot(?:_variants|_var|s)?(?:_found|_called)?\s*=\s*(\d+)\b/i,
  );
  if (mCnt) {
    const k = parseInt(mCnt[1], 10);
    if (!Number.isNaN(k)) return k === 0 ? 'Negative' : 'Positive';
  }
  const mHs = s.match(/\b(?:hs7|7hs|7_hs)[\w_]*\s*=\s*(\d+)\b/i);
  if (mHs) {
    const k = parseInt(mHs[1], 10);
    if (!Number.isNaN(k)) return k === 0 ? 'Negative' : 'Positive';
  }

  const mSpan = s.match(
    /\bhotspot\b[\s\S]{0,400}?\b(positive|negative|pos|neg)\b/i,
  );
  if (mSpan) {
    const n = normalizeCahHotspotToken(mSpan[1]);
    if (n) return n;
  }

  const mHit = s.match(/\bhotspot_(?:hit|detected|called)\s*=\s*(\S+)/i);
  if (mHit) {
    const n = normalizeCahHotspotToken(mHit[1]);
    if (n) return n;
  }

  const nm = cyp21InferHotspotFromNmScreening(s);
  if (nm) return nm;
  return null;
}

/* ------------------------------------------------------------------ */
/*  CAH high-priority inference                                        */
/* ------------------------------------------------------------------ */

export function cahParalogDeletionKvActionable(body: unknown): boolean {
  const raw = String(body || '');
  if (!raw.trim()) return false;
  const keys = [
    'paralog_deletion',
    'cyp21_paralog_deletion',
    'paralog_deletion_call',
    'deletion_paralog',
  ];
  const neg = new Set([
    'no',
    'none',
    'false',
    '0',
    'negative',
    'absent',
    'undetected',
    'normal',
    'wt',
    'wildtype',
    'na',
    'n/a',
    'neg',
  ]);
  for (const key of keys) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`^\\s*${esc}\\s*[:=]\\s*(.+)$`, 'im'),
      new RegExp(`\\b${esc}\\s*[:=]\\s*(.+)`, 'i'),
    ];
    for (const re of patterns) {
      const m = raw.match(re);
      if (!m) continue;
      const val = String(m[1] || '')
        .trim()
        .toLowerCase();
      if (!val) continue;
      const tok0 = val.split(/[,\s]+/)[0];
      if (neg.has(val) || neg.has(tok0)) continue;
      if (/^no\b/.test(val) || /^not\s/.test(val)) continue;
      return true;
    }
  }
  return false;
}

export function cahBodyImpliesHighPriority(body: unknown): boolean {
  const raw = String(body || '');
  if (!raw.trim()) return false;
  if (cahParalogDeletionKvActionable(raw)) return true;
  if (
    /\b(not|without)\s+(\S+\s+){0,3}(possible|likely|suspected)\s+deletion\b/i.test(
      raw,
    )
  ) {
    return false;
  }
  if (
    /\b(not|without)\s+(\S+\s+){0,2}(possible|likely|suspected)\s+gene\s+deletion\b/i.test(
      raw,
    )
  ) {
    return false;
  }
  const prose: RegExp[] = [
    /\b(possible|likely|suspected)\s+deletion\b/i,
    /\b(possible|likely|suspected)\s+gene\s+deletion\b/i,
    /\bpossible\b[\s.,:;()—–\-]{0,24}\bdeletion\b/i,
    /\b(possible|likely|suspected)\b[\s\S]{0,72}\bdeletion\b/i,
    /\bpossible\s+partial\s+deletion\b/i,
    /\bdeletion\s+(cannot\s+be\s+ruled\s+out|cannot\s+be\s+excluded)\b/i,
    /\bcannot\s+(exclude|rule\s+out)\b[\s\S]{0,120}\bdeletion\b/i,
    /\bindicat(es|ing|ed)\b[\s\S]{0,80}\b(possible|likely|suspected)\s+deletion\b/i,
  ];
  return prose.some((re) => re.test(raw));
}

/* ------------------------------------------------------------------ */
/*  Dosage section renderer                                            */
/* ------------------------------------------------------------------ */

export function tryRenderDosageAnalysisSection(
  sec: DarkGenesSection,
): string | null {
  const t = (sec.title || '').trim();
  if (!dosageAnalysisTitleMatches(t)) return null;
  const raw = String(sec.body || '');
  const isAlpha = alphaThalassemiaDosageTitleMatches(t);
  const isCyp21Title = cyp21CahDosageTitleMatches(t);

  const mEst = raw.match(/^\s*Est_CN\s*=\s*(\S+)/im);
  const mRatio = raw.match(/^\s*Ratio\s*=\s*(\S+)/im);
  const mWarn = raw.match(/^\s*WARNING:\s*(.+)/im);
  const mWarnStatus = raw.match(/^\s*Status\s*:\s*WARNING\s*:\s*(.+)$/im);
  const mCypIntDepth = raw.match(
    /CYP21A2\s+Interval\s+Mean\s+Depth\s*:\s*(\S+)/i,
  );
  const mChr6Med = raw.match(/Chr6\s+Median\s+Target\s+Depth\s*:\s*(\S+)/i);
  const mDepthRatio = raw.match(
    /Ratio\s*\(\s*CYP21A2\s*\/\s*Median\s+Chr6\s*\)\s*:\s*(\S+)/i,
  );

  const hba1Keys = [
    'est_copies_hba1',
    'hba1',
    'paralog_hba1',
    'hba1_paralog',
    'HBA1_paralog',
    'HBA1',
  ];
  const hba2Keys = [
    'est_copies_hba2',
    'hba2',
    'paralog_hba2',
    'hba2_paralog',
    'HBA2_paralog',
    'HBA2',
  ];

  let hba1Val: string | null = isAlpha
    ? alphaThalPickScalar(raw, hba1Keys) ||
      alphaThalPickScalarAnywhere(raw, hba1Keys)
    : null;
  let hba2Val: string | null = isAlpha
    ? alphaThalPickScalar(raw, hba2Keys) ||
      alphaThalPickScalarAnywhere(raw, hba2Keys)
    : null;
  if (isAlpha && hba1Val == null)
    hba1Val = alphaThalPickResultFromFormulaLine(raw, 'formula_est_hba1');
  if (isAlpha && hba2Val == null)
    hba2Val = alphaThalPickResultFromFormulaLine(raw, 'formula_est_hba2');

  const cyp21a2Keys = [
    'est_copies_cyp21a2',
    'cyp21a2',
    'paralog_cyp21a2',
    'est_copies_21oh_gene',
    'gene_copies',
  ];
  const cyp21a1pKeys = [
    'est_copies_cyp21a1p',
    'est_copies_cyp21a1p_arm',
    'cyp21a1p',
    'paralog_cyp21a1p',
    'est_copies_21oh_pseudogene',
    'pseudogene_copies',
  ];
  const cyp21DeletionKeys = [
    'paralog_deletion',
    'cyp21_paralog_deletion',
    'paralog_deletion_call',
    'deletion_paralog',
  ];

  let cyp21a2Val: string | null = null;
  let cyp21a1pVal: string | null = null;
  let paralogDeletionVal: string | null = null;

  const hotspotCall =
    !isAlpha && dosageAnalysisTitleMatches(t)
      ? cyp21PickHotspotCall(raw)
      : null;
  const isCyp21 = isCyp21Title || hotspotCall != null;

  if (isCyp21) {
    cyp21a2Val =
      alphaThalPickScalar(raw, cyp21a2Keys) ||
      alphaThalPickScalarAnywhere(raw, cyp21a2Keys);
    cyp21a1pVal =
      alphaThalPickScalar(raw, cyp21a1pKeys) ||
      alphaThalPickScalarAnywhere(raw, cyp21a1pKeys);
    if (cyp21a2Val == null)
      cyp21a2Val = alphaThalPickResultFromFormulaLine(
        raw,
        'formula_est_cyp21a2',
      );
    if (cyp21a1pVal == null)
      cyp21a1pVal = alphaThalPickResultFromFormulaLine(
        raw,
        'formula_est_cyp21a1p',
      );
    if (cyp21a1pVal == null)
      cyp21a1pVal = alphaThalPickResultFromFormulaLine(
        raw,
        'formula_est_cyp21a1p_arm',
      );
    paralogDeletionVal =
      alphaThalPickScalar(raw, cyp21DeletionKeys) ||
      alphaThalPickScalarAnywhere(raw, cyp21DeletionKeys);
  }

  if (!isCyp21) {
    if (!mEst && !mRatio && !mWarn) return null;
  } else {
    const hasCahBody =
      mEst ||
      mRatio ||
      mWarn ||
      mWarnStatus ||
      mCypIntDepth ||
      mChr6Med ||
      mDepthRatio ||
      cyp21a2Val != null ||
      cyp21a1pVal != null ||
      paralogDeletionVal != null ||
      hotspotCall != null;
    if (!hasCahBody) return null;
  }

  const rows: [string, string][] = [];
  if (isCyp21) {
    if (mCypIntDepth) rows.push(['CYP21A2 interval mean depth', mCypIntDepth[1]]);
    if (mChr6Med) rows.push(['Chr6 median target depth', mChr6Med[1]]);
    if (mDepthRatio) rows.push(['Depth ratio (CYP21/Chr6)', mDepthRatio[1]]);
    if (mEst) rows.push(['Estimated CNV', mEst[1]]);
    if (mRatio) rows.push(['Ratio', mRatio[1]]);
    let warnText: string | null = null;
    if (mWarn) warnText = mWarn[1].trim().replace(/\s+/g, ' ');
    else if (mWarnStatus) warnText = mWarnStatus[1].trim().replace(/\s+/g, ' ');
    if (warnText) rows.push(['Warning', warnText]);
    if (hotspotCall != null) rows.push(['Hotspot mutations (7)', hotspotCall]);
    if (cyp21a2Val != null) rows.push(['cyp21a2', cyp21a2Val]);
    if (cyp21a1pVal != null) rows.push(['cyp21a1p', cyp21a1pVal]);
    if (paralogDeletionVal != null) rows.push(['Paralog deletion', paralogDeletionVal]);
  } else {
    if (mEst) rows.push(['Estimated CNV', mEst[1]]);
    if (mRatio) rows.push(['Ratio', mRatio[1]]);
    if (mWarn) rows.push(['Warning', mWarn[1].trim().replace(/\s+/g, ' ')]);
    if (hba1Val != null) rows.push(['hba1', hba1Val]);
    if (hba2Val != null) rows.push(['hba2', hba2Val]);
  }

  const inner = rows
    .map(
      ([lab, val]) =>
        `<dt>${escapeHtml(lab)}</dt><dd>${escapeHtml(val)}</dd>`,
    )
    .join('');
  return `<dl class="dark-genes-kv">${inner}</dl>`;
}

/* ------------------------------------------------------------------ */
/*  CAH hotspot standalone section                                     */
/* ------------------------------------------------------------------ */

export function tryRenderCahHotspotStandaloneSection(
  sec: DarkGenesSection,
): string | null {
  const t = (sec.title || '').trim();
  if (/^overview$/i.test(t)) return null;
  if (alphaThalassemiaDosageTitleMatches(t)) return null;
  const raw = String(sec.body || '');
  if (
    !/(hotspot_|cyp21_hotspot|hotspot_mutations|7\s*hotspot|\bhotspot\b)/i.test(
      raw,
    )
  )
    return null;
  const h = cyp21PickHotspotCall(raw);
  if (!h) return null;
  const titleOk =
    /cyp21|CAH|hotspot|21oh|congenital adrenal|adrenal hyperplasia/i.test(t) ||
    darkGenesDisplayTitle(t) === 'Congenital Adrenal Hyperplasia (CAH)';
  if (!titleOk) return null;
  return `<dl class="dark-genes-kv"><dt>Hotspot mutations (7)</dt><dd>${escapeHtml(h)}</dd></dl>`;
}
