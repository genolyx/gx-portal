import { escapeHtml } from './escape';

export function extractSmacaSnpCtCounts(raw: unknown): [string, string] | null {
  const s = String(raw || '');
  let m = s.match(/CT_counts\s*=\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return [m[1], m[2]];
  m = s.match(/C_T\s*=\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return [m[1], m[2]];
  m = s.match(/SMN_C_T\s*=\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return [m[1], m[2]];
  const mc = s.match(/^\s*C_reads\s*=\s*(\d+)\s*$/im);
  const mt = s.match(/^\s*T_reads\s*=\s*(\d+)\s*$/im);
  if (mc && mt) return [mc[1], mt[1]];
  m = s.match(
    /27134[^\n]{0,220}?(?:AD|DP|depth|counts?)\s*[=:]\s*(\d+)\s*[,;/]\s*(\d+)/i,
  );
  return m ? [m[1], m[2]] : null;
}

export interface SmacaSnpVariantDepthResult {
  ref: unknown;
  alt: unknown;
  via: string;
}

export interface SmacaVariant {
  gene?: unknown;
  hgvsc?: unknown;
  chrom?: unknown;
  pos?: unknown;
  ref_depth?: unknown;
  alt_depth?: unknown;
  [k: string]: unknown;
}

export function findSmacaSnpVariantDepthsFromReview(
  variants: SmacaVariant[],
): SmacaSnpVariantDepthResult | null {
  if (!Array.isArray(variants) || !variants.length) return null;
  for (const v of variants) {
    const g = String(v.gene || '').toUpperCase();
    if (g !== 'SMN1' && g !== 'SMN2') continue;
    const h = String(v.hgvsc || '');
    if (/\*3\+80/i.test(h) || /c\.\*3\+80/i.test(h) || /27134/i.test(h)) {
      const rd = v.ref_depth;
      const ad = v.alt_depth;
      if (rd != null && ad != null) return { ref: rd, alt: ad, via: 'hgvsc' };
    }
  }
  for (const v of variants) {
    const c = String(v.chrom || '').replace(/^chr/i, '');
    if (c !== '5') continue;
    const p = parseInt(String(v.pos || ''), 10);
    if (Number.isNaN(p) || p < 70941970 || p > 70941995) continue;
    const rd = v.ref_depth;
    const ad = v.alt_depth;
    if (rd != null && ad != null)
      return { ref: rd, alt: ad, via: 'chr5:70941981±' };
  }
  return null;
}

export interface SmacaReviewMeta {
  review_build?: {
    smaca_snp_depths?: {
      ref_ad?: unknown;
      alt_ad?: unknown;
      chrom?: unknown;
      pos?: unknown;
    };
  };
  [k: string]: unknown;
}

export interface DarkGenesSection {
  title?: string;
  body?: string;
  kind?: string;
  [k: string]: unknown;
}

function parseC840Smn12HgvsNorm(rawStr: string) {
  const c1 = rawStr.match(/c840_SMN1_hgvs_norm_C=(NA|\d+)/i);
  const t1 = rawStr.match(/c840_SMN1_hgvs_norm_T=(NA|\d+)/i);
  const c2 = rawStr.match(/c840_SMN2_hgvs_norm_C=(NA|\d+)/i);
  const t2 = rawStr.match(/c840_SMN2_hgvs_norm_T=(NA|\d+)/i);
  if (!c1 || !t2 || c1[1] === 'NA' || t2[1] === 'NA') return null;
  const baseRatio = `${c1[1]}/${t2[1]}`;
  let combinedFrac: string | null = null;
  let combinedC: number | null = null;
  let combinedT: number | null = null;
  if (t1 && c2 && [c1, t1, c2, t2].every((m) => m[1] !== 'NA')) {
    const nc = parseInt(c1[1], 10) + parseInt(c2[1], 10);
    const nt = parseInt(t1[1], 10) + parseInt(t2[1], 10);
    const d = nc + nt;
    combinedC = nc;
    combinedT = nt;
    if (d > 0) combinedFrac = (nc / d).toFixed(3);
  }
  const ratioStr =
    combinedC != null && combinedT != null
      ? `${baseRatio} — C=${combinedC}, T=${combinedT}`
      : baseRatio;
  return { ratioStr, combinedFrac, combinedC, combinedT };
}

function fmtC840CtPair(s: unknown): string {
  const p = String(s || '').split(',');
  if (p.length !== 2) return String(s || '');
  return `C=${p[0].trim()}, T=${p[1].trim()}`;
}

function fmtC840HgvsNormSuffix(raw: string, tag: string): string {
  const nC = raw.match(new RegExp(`c840_${tag}_hgvs_norm_C=(NA|\\d+)`, 'i'));
  const nT = raw.match(new RegExp(`c840_${tag}_hgvs_norm_T=(NA|\\d+)`, 'i'));
  const nR = raw.match(
    new RegExp(`c840_${tag}_hgvs_norm_C_frac_CplusT=(NA|\\S+)`, 'i'),
  );
  if (nC && nT && nR) {
    return ` — normalized (G→C, A→T) HGVS: norm_C=${nC[1]} norm_T=${nT[1]}; C/(C+T)=${nR[1]}`;
  }
  const ha = raw.match(new RegExp(`c840_${tag}_hgvs_A=(NA|\\d+)`, 'i'));
  const hc = raw.match(new RegExp(`c840_${tag}_hgvs_C=(NA|\\d+)`, 'i'));
  const hg = raw.match(new RegExp(`c840_${tag}_hgvs_G=(NA|\\d+)`, 'i'));
  const ht = raw.match(new RegExp(`c840_${tag}_hgvs_T=(NA|\\d+)`, 'i'));
  if (!ha || !hc || !hg || !ht) return '';
  const a = parseInt(ha[1], 10);
  const c = parseInt(hc[1], 10);
  const g = parseInt(hg[1], 10);
  const t = parseInt(ht[1], 10);
  if ([a, c, g, t].some((x) => Number.isNaN(x))) return '';
  const nc = c + g;
  const nt = t + a;
  const ss = nc + nt;
  const ratio = ss > 0 ? (nc / ss).toFixed(3) : '?';
  return ` — normalized (G→C, A→T) HGVS: norm_C=${nc} norm_T=${nt}; C/(C+T)=${ratio}`;
}

function fmtC840LocusAcgtRow(raw: string, tag: string): string | null {
  const ma = raw.match(new RegExp(`c840_${tag}_fwd_A=(NA|\\d+)`, 'i'));
  const mc = raw.match(new RegExp(`c840_${tag}_fwd_C=(NA|\\d+)`, 'i'));
  const mg = raw.match(new RegExp(`c840_${tag}_fwd_G=(NA|\\d+)`, 'i'));
  const mt = raw.match(new RegExp(`c840_${tag}_fwd_T=(NA|\\d+)`, 'i'));
  const md = raw.match(new RegExp(`c840_${tag}_fwd_depth=(NA|\\d+)`, 'i'));
  const mr = raw.match(
    new RegExp(`c840_${tag}_fwd_C_frac_CplusT=(NA|\\S+)`, 'i'),
  );
  const ha = raw.match(new RegExp(`c840_${tag}_hgvs_A=(NA|\\d+)`, 'i'));
  const hc = raw.match(new RegExp(`c840_${tag}_hgvs_C=(NA|\\d+)`, 'i'));
  const hg = raw.match(new RegExp(`c840_${tag}_hgvs_G=(NA|\\d+)`, 'i'));
  const ht = raw.match(new RegExp(`c840_${tag}_hgvs_T=(NA|\\d+)`, 'i'));
  const hd = raw.match(new RegExp(`c840_${tag}_hgvs_depth=(NA|\\d+)`, 'i'));
  const hr = raw.match(
    new RegExp(`c840_${tag}_hgvs_C_frac_CplusT_coding=(NA|\\S+)`, 'i'),
  );
  if (!ma || !mc || !mg || !mt) return null;
  const fwd = `forward A/C/G/T: ${ma[1]}/${mc[1]}/${mg[1]}/${mt[1]}; depth=${md ? md[1] : '?'}; C/(C+T)=${mr ? mr[1] : '?'}`;
  if (ha && hc && hg && ht) {
    return `${fwd} — HGVS coding A/C/G/T: ${ha[1]}/${hc[1]}/${hg[1]}/${ht[1]}; depth=${hd ? hd[1] : '?'}; C/(C+T)=${hr ? hr[1] : '?'}${fmtC840HgvsNormSuffix(raw, tag)}`;
  }
  return fwd;
}

function fmtC840MergedExplanation(raw: string, pairCsv: string | null): string {
  const modeM = raw.match(/c840_pileup_mode=([^|]+)/i);
  const mode = modeM ? modeM[1].trim() : '';
  const p = String(pairCsv || '').split(',');
  const c = p[0] != null ? p[0].trim() : '';
  const t = p[1] != null ? p[1].trim() : '';
  const parts: string[] = [
    `Legacy HGVS line (C,T only): ${c}×C + ${t}×T. Prefer full HGVS A/C/G/T row when present.`,
  ];
  if (
    mode === 'hg38_two_positions_merged' ||
    mode === 'hg38_two_positions'
  ) {
    parts.push(
      'Per-locus SMN1/SMN2 rows (hg38): two genomic coordinates; c.840C>T is read at each alignment column separately.',
    );
  } else if (mode === 'unified_SMN1_ref') {
    parts.push(
      'Source: unified SMN realignment BAM — comparable to the IGV unified SMN pileup track.',
    );
  }
  return parts.join(' ');
}

export function tryRenderSmacaCheckSection(
  sec: DarkGenesSection,
  reviewVariants?: SmacaVariant[] | null,
  reviewMeta?: SmacaReviewMeta | null,
): string | null {
  const t = (sec.title || '').trim();
  if (!/SMAca\s*CHECK/i.test(t)) return null;
  const raw = String(sec.body || '');

  const m1e = raw.match(/SMN1_CN_est\s*=\s*(\S+)/i);
  const m2e = raw.match(/SMN2_CN_est\s*=\s*(\S+)/i);
  const m1 = raw.match(/SMN1_CN\s*=\s*(\S+)/i);
  const m2 = raw.match(/SMN2_CN\s*=\s*(\S+)/i);
  const mSilent = raw.match(
    /SilentCarrier\s*=\s*([^\s(]+)(?:\s*\([^)]*\))?/i,
  );
  const mCr = raw.match(/C_Ratio\s*=\s*(\S+)/i);
  const mCov = raw.match(/Cov\s*\(\s*1\s*,\s*2\s*\)\s*=\s*(.+)/i);
  const mCtRatio = raw.match(/CT_Ratio\s*=\s*(\S+)/i);
  const ctPair = extractSmacaSnpCtCounts(raw);

  let mC840Merged: [null, string] | null = null;
  {
    const cs = raw.match(/c840_merged_C=(\d+)/i);
    const ts = raw.match(/c840_merged_T=(\d+)/i);
    if (
      cs &&
      ts &&
      !/c840_merged_hgvs_C=/i.test(raw) &&
      !/c840_merged_fwd_A=/i.test(raw)
    ) {
      mC840Merged = [null, `${cs[1]},${ts[1]}`];
    }
  }
  const hasC840MergedFwd = /c840_merged_fwd_A=/i.test(raw);
  const hasC840MergedHgvs = /c840_merged_hgvs_C=/i.test(raw);
  const hasC840Smn1Locus =
    /c840_SMN1_fwd_A=/i.test(raw) || /c840_SMN1_hgvs_norm_C=/i.test(raw);

  let mC840S1 = raw.match(/c840_SMN1_C_and_T_coding=([^|]+)/i);
  if (!mC840S1) {
    const cs = raw.match(/c840_SMN1_C=(\d+)/i);
    const ts = raw.match(/c840_SMN1_T=(\d+)/i);
    if (cs && ts) mC840S1 = [null as unknown as string, `${cs[1]},${ts[1]}`] as unknown as RegExpMatchArray;
  }

  let mC840S2 = raw.match(/c840_SMN2_C_and_T_coding=([^|]+)/i);
  if (!mC840S2) {
    const cs = raw.match(/c840_SMN2_C=(\d+)/i);
    const ts = raw.match(/c840_SMN2_T=(\d+)/i);
    if (cs && ts) mC840S2 = [null as unknown as string, `${cs[1]},${ts[1]}`] as unknown as RegExpMatchArray;
  }

  let mC840U = raw.match(/c840_unified_C_and_T_coding=([^|]+)/i);
  if (!mC840U) {
    const cs = raw.match(/c840_unified_C=(\d+)/i);
    const ts = raw.match(/c840_unified_T=(\d+)/i);
    if (cs && ts) mC840U = [null as unknown as string, `${cs[1]},${ts[1]}`] as unknown as RegExpMatchArray;
  }

  if (
    !m1e &&
    !m2e &&
    !m1 &&
    !m2 &&
    !mSilent &&
    !mCr &&
    !mCov &&
    !mCtRatio &&
    !ctPair &&
    !mC840Merged &&
    !hasC840MergedFwd &&
    !hasC840MergedHgvs &&
    !hasC840Smn1Locus &&
    !mC840S1 &&
    !mC840S2 &&
    !mC840U
  ) {
    return null;
  }

  const rows: [string, string][] = [];
  if (m1e) rows.push(['SMN1 CNV (est.)', m1e[1]]);
  else if (m1) rows.push(['SMN1 CNV', m1[1]]);
  if (m2e) rows.push(['SMN2 CNV (est.)', m2e[1]]);
  else if (m2) rows.push(['SMN2 CNV', m2[1]]);
  if (mSilent) rows.push(['Silent Carrier', mSilent[1]]);
  if (mCr) rows.push(['SMN1 cov fraction', mCr[1]]);
  if (ctPair) rows.push(['SNP C,T counts', `${ctPair[0]} / ${ctPair[1]}`]);
  if (mCtRatio) rows.push(['SNP C/T ratio', mCtRatio[1]]);

  if (!ctPair && !mCtRatio) {
    const rb = reviewMeta && reviewMeta.review_build;
    const smVcf = rb && rb.smaca_snp_depths;
    if (smVcf && smVcf.ref_ad != null && smVcf.alt_ad != null) {
      rows.push([
        'SNP allele depths (main VCF)',
        `${smVcf.ref_ad} / ${smVcf.alt_ad} — AD at ${smVcf.chrom}:${smVcf.pos} (compare to IGV pileup; VCF ref/alt allele order may differ from IGV C/T colors)`,
      ]);
    } else if (reviewVariants && reviewVariants.length) {
      const vdep = findSmacaSnpVariantDepthsFromReview(reviewVariants);
      if (vdep) {
        rows.push([
          'SNP allele depths (panel VCF)',
          `${vdep.ref} / ${vdep.alt} — ref vs alt from variant table (compare to IGV at same site)`,
        ]);
      }
    }
  }
  if (mCov) rows.push(['Cov(1,2)', mCov[1].trim().replace(/\s+/g, ' ')]);

  if (hasC840Smn1Locus) {
    const smn12 = parseC840Smn12HgvsNorm(raw);
    if (smn12) {
      rows.push(['SMN1/2 C/T ratio', smn12.ratioStr]);
      if (
        smn12.combinedFrac != null &&
        smn12.combinedC != null &&
        smn12.combinedT != null
      ) {
        rows.push([
          'SMN1/2 C/(C+T) (hgvs norm)',
          `C=${smn12.combinedC}, T=${smn12.combinedT}; C/(C+T)=${smn12.combinedFrac}`,
        ]);
      }
    }
    const s1 = fmtC840LocusAcgtRow(raw, 'SMN1');
    const s2 = fmtC840LocusAcgtRow(raw, 'SMN2');
    if (s1) rows.push(['c.840 SMN1 locus (hg38)', s1]);
    if (s2) rows.push(['c.840 SMN2 locus (hg38)', s2]);
  }

  const c840UnifiedMode = /c840_pileup_mode=unified_SMN1_ref/i.test(raw);
  if (hasC840MergedFwd && c840UnifiedMode) {
    const ma2 = raw.match(/c840_merged_fwd_A=(NA|\d+)/i);
    const mc2 = raw.match(/c840_merged_fwd_C=(NA|\d+)/i);
    const mg2 = raw.match(/c840_merged_fwd_G=(NA|\d+)/i);
    const mt2 = raw.match(/c840_merged_fwd_T=(NA|\d+)/i);
    const md2 = raw.match(/c840_merged_fwd_depth=(NA|\d+)/i);
    const mr2 = raw.match(/c840_merged_fwd_C_frac_CplusT=(NA|\S+)/i);
    if (ma2 && mc2 && mg2 && mt2) {
      rows.push([
        'c.840 pileup (genome forward strand, merged)',
        `A=${ma2[1]}, C=${mc2[1]}, G=${mg2[1]}, T=${mt2[1]}; depth=${md2 ? md2[1] : '?'}; C/(C+T)=${mr2 ? mr2[1] : '?'}`,
      ]);
    }
  }
  if (hasC840MergedHgvs && c840UnifiedMode) {
    const hA = raw.match(/c840_merged_hgvs_A=(NA|\d+)/i);
    const hC = raw.match(/c840_merged_hgvs_C=(NA|\d+)/i);
    const hG = raw.match(/c840_merged_hgvs_G=(NA|\d+)/i);
    const hT = raw.match(/c840_merged_hgvs_T=(NA|\d+)/i);
    const hD = raw.match(/c840_merged_hgvs_depth=(NA|\d+)/i);
    const hr = raw.match(/c840_merged_hgvs_C_frac_CplusT_coding=(NA|\S+)/i);
    if (hA && hC && hG && hT) {
      const modeM = raw.match(/c840_pileup_mode=([^|]+)/i);
      const mode = modeM ? modeM[1].trim() : '';
      let note =
        'HGVS letters complement forward strand for minus-strand genes (e.g. many forward T → HGVS coding A). ';
      if (
        mode === 'hg38_two_positions_merged' ||
        mode === 'hg38_two_positions'
      ) {
        note +=
          ' (legacy merged row; use per-locus SMN1/SMN2 lines for hg38.)';
      }
      const mNc = raw.match(/c840_merged_hgvs_norm_C=(NA|\d+)/i);
      const mNt = raw.match(/c840_merged_hgvs_norm_T=(NA|\d+)/i);
      const mNr = raw.match(
        /c840_merged_hgvs_norm_C_frac_CplusT=(NA|\S+)/i,
      );
      let normSuf = '';
      if (mNc && mNt && mNr) {
        normSuf = ` — normalized (G→C, A→T): norm_C=${mNc[1]} norm_T=${mNt[1]}; C/(C+T)=${mNr[1]}`;
      } else {
        const a = parseInt(hA[1], 10);
        const c = parseInt(hC[1], 10);
        const g = parseInt(hG[1], 10);
        const tt = parseInt(hT[1], 10);
        if (![a, c, g, tt].some((x) => Number.isNaN(x))) {
          const nc = c + g;
          const nt = tt + a;
          const ss = nc + nt;
          const ratio = ss > 0 ? (nc / ss).toFixed(3) : '?';
          normSuf = ` — normalized (G→C, A→T): norm_C=${nc} norm_T=${nt}; C/(C+T)=${ratio}`;
        }
      }
      rows.push([
        'c.840 pileup (HGVS coding DNA, merged)',
        `A=${hA[1]}, C=${hC[1]}, G=${hG[1]}, T=${hT[1]}; depth=${hD ? hD[1] : '?'}; C/(C+T)=${hr ? hr[1] : '?'}. ${note}${normSuf}`,
      ]);
    }
  } else if (mC840Merged) {
    rows.push([
      'c.840 pileup (merged)',
      fmtC840MergedExplanation(raw, mC840Merged[1]),
    ]);
  }

  if (!hasC840MergedFwd && !hasC840MergedHgvs && !hasC840Smn1Locus) {
    if (mC840U)
      rows.push([
        'c.840 unified pileup C,T (coding)',
        fmtC840CtPair(mC840U[1]),
      ]);
    if (mC840S1)
      rows.push([
        'c.840 SMN1 locus C,T (coding)',
        fmtC840CtPair(mC840S1[1]),
      ]);
    if (mC840S2)
      rows.push([
        'c.840 SMN2 locus C,T (coding)',
        fmtC840CtPair(mC840S2[1]),
      ]);
  }

  const inner = rows
    .map(
      ([lab, val]) =>
        `<dt>${escapeHtml(lab)}</dt><dd>${escapeHtml(val)}</dd>`,
    )
    .join('');
  return `<dl class="dark-genes-kv">${inner}</dl>`;
}
