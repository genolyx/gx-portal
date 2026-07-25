/**
 * Client-side sgNIPT helpers. Heavy normalization runs on the API
 * (`apps/api/.../sgnipt-normalize.ts`); the client only does a cheap pass
 * when the API payload was not yet slimmed.
 */
import type { ReviewData, Variant } from '@gx-portal/types';

function geneFromTarget(tn: unknown): string {
  if (!tn) return '';
  const first = String(tn).split('|')[0];
  return first.split('_')[0] || '';
}

function stripHgvsPrefix(s: string): string {
  return (s || '').replace(/^[A-Z0-9]+[\d._]*:/, '');
}

function clinSigNorm(raw: string): string {
  const map: Record<string, string> = {
    Pathogenic: 'Pathogenic',
    pathogenic: 'Pathogenic',
    Likely_pathogenic: 'Likely pathogenic',
    likely_pathogenic: 'Likely pathogenic',
    'Likely pathogenic': 'Likely pathogenic',
    Uncertain_significance: 'VUS',
    uncertain_significance: 'VUS',
    VUS: 'VUS',
    Likely_benign: 'Likely benign',
    likely_benign: 'Likely benign',
    'Likely benign': 'Likely benign',
    Benign: 'Benign',
    benign: 'Benign',
  };
  return map[raw] || raw || '';
}

function isPathogenicSig(s: string): boolean {
  const l = s.toLowerCase();
  return l.includes('pathogenic');
}

function isFetalOrigin(origin: string): boolean {
  return origin === 'fetal_specific' || origin === 'fetal';
}

function isMaternalOrigin(origin: string): boolean {
  return origin === 'maternal' || origin === 'maternal_het' || origin === 'maternal_hom';
}

export function isSgniptReviewData(rd: Record<string, unknown> | null | undefined): boolean {
  if (!rd || typeof rd !== 'object') return false;
  const svc = String(rd._service_code ?? rd.service_code ?? '').trim();
  if (svc === 'sgnipt') return true;
  if (Array.isArray(rd.clinical_findings) && (rd.panel != null || rd.fetal_fraction_detail != null || rd.sgnipt_status != null)) {
    return true;
  }
  return false;
}

function normalizeSgniptVariant(raw: Record<string, unknown>, idx: number): Variant {
  const vep = (raw.vep && typeof raw.vep === 'object' ? raw.vep : {}) as Record<string, unknown>;
  const cv = (vep.clinvar && typeof vep.clinvar === 'object' ? vep.clinvar : {}) as Record<string, unknown>;
  const clnsigRaw = String(cv.clnsig ?? raw.clinvar_sig_primary ?? '');
  const clnsig = clinSigNorm(clnsigRaw);
  const acmgFromPath = raw.pathogenic_variant ? 'Pathogenic' : '';
  const acmgCls = String(raw.acmg_classification || clnsig || acmgFromPath || '');
  const gene = String(vep.symbol || raw.gene || geneFromTarget(raw.target_name) || '');
  const hgvsc = stripHgvsPrefix(String(vep.hgvsc || raw.hgvsc || raw.pathogenic_variant || ''));
  const hgvsp = stripHgvsPrefix(String(vep.hgvsp || raw.hgvsp || ''));
  const conseq = String(vep.consequence || raw.effect || '')
    .replace(/_variant$/g, '')
    .replace(/_/g, ' ');
  const vaf = raw.vaf != null ? Number(raw.vaf) : undefined;
  const dep = raw.depth != null ? Number(raw.depth) : undefined;
  const altCnt = vaf != null && dep != null && !Number.isNaN(vaf) && !Number.isNaN(dep)
    ? Math.round(vaf * dep)
    : undefined;
  const refCnt = altCnt != null && dep != null ? dep - altCnt : undefined;
  const gnomad = vep.gnomad_af != null
    ? Number(vep.gnomad_af)
    : raw.gnomad_af != null
      ? Number(raw.gnomad_af)
      : undefined;
  const disease = String(raw.disease || '');

  return {
    variant_id: String(raw.variant_id || `NIPT_${String(idx + 1).padStart(4, '0')}`),
    gene,
    chrom: String(raw.chrom || ''),
    pos: raw.pos != null ? Number(raw.pos) : 0,
    ref: String(raw.ref || ''),
    alt: String(raw.alt || ''),
    disease,
    diseases: disease ? [disease] : [],
    vaf: Number.isFinite(vaf as number) ? vaf : undefined,
    dp: Number.isFinite(dep as number) ? dep : undefined,
    alt_depth: altCnt,
    ref_depth: refCnt,
    origin: String(raw.origin || ''),
    fetal_genotype: String(raw.fetal_genotype || ''),
    maternal_genotype: String(raw.maternal_genotype || ''),
    confidence: String(raw.confidence || ''),
    pathogenic_variant: !!raw.pathogenic_variant,
    target_name: String(raw.target_name || ''),
    in_zero_probe_region: !!raw.in_zero_probe_region,
    details: String(raw.details || '').slice(0, 500),
    acmg_classification: acmgCls,
    acmg_criteria: Array.isArray(raw.acmg_criteria) ? (raw.acmg_criteria as string[]) : [],
    acmg_reasoning: String(raw.acmg_reasoning || '').slice(0, 2000),
    clinvar_sig_primary: clnsig || String(raw.clinvar_sig_primary || ''),
    clinvar_sig: clnsig || String(raw.clinvar_sig || ''),
    clinvar_stars: Number(raw.clinvar_stars ?? cv.stars ?? 0) || undefined,
    clinvar_dn: String(raw.clinvar_dn || cv.clndn || ''),
    gnomad_af: Number.isFinite(gnomad as number) ? gnomad : undefined,
    hgvsc,
    hgvsp,
    effect: conseq,
    transcript: String(vep.mane || raw.transcript || ''),
    clinical_nm: String(vep.mane || raw.clinical_nm || ''),
  };
}

/**
 * Cheap client pass: skip if API already slimmed (`_sgnipt_slim`).
 * Only rebuilds variants when clinical_findings is still present (legacy / direct daemon).
 */
export function normalizeSgniptReviewData(rd: ReviewData): ReviewData {
  const raw = rd as unknown as Record<string, unknown>;
  if (!isSgniptReviewData(raw)) return rd;
  if (raw._sgnipt_slim === true && Array.isArray(rd.variants) && rd.variants.length > 0) {
    return rd;
  }
  // Already has variants and no bulky clinical_findings — treat as ready
  if (Array.isArray(rd.variants) && rd.variants.length > 0 && !Array.isArray(raw.clinical_findings)) {
    return { ...rd, _service_code: 'sgnipt', service_code: rd.service_code || 'sgnipt' };
  }

  const clinical = Array.isArray(raw.clinical_findings)
    ? (raw.clinical_findings as Record<string, unknown>[])
    : [];
  const variants = (clinical.length ? clinical : (rd.variants as unknown as Record<string, unknown>[]))
    .map((v, i) => normalizeSgniptVariant(v, i));

  const fetal = variants.filter((v) => isFetalOrigin(String(v.origin || ''))).length;
  const plp = variants.filter((v) =>
    isPathogenicSig(String(v.clinvar_sig_primary || v.acmg_classification || '')),
  ).length;
  const vus = variants.filter((v) => {
    const s = String(v.clinvar_sig_primary || v.acmg_classification || '').toLowerCase();
    return s.includes('vus') || s.includes('uncertain');
  }).length;

  return {
    ...rd,
    _service_code: 'sgnipt',
    service_code: rd.service_code || 'sgnipt',
    variants,
    clinical_findings: undefined,
    all_target_variants: undefined,
    variant_analysis: {},
    variant_stats: {
      total: variants.length,
      pathogenic_or_likely: plp,
      vus,
      fetal_specific: fetal,
    },
    _sgnipt_slim: true,
  } as ReviewData;
}

export function sgniptOriginLabel(origin: string): string {
  const o = (origin || '').toLowerCase();
  if (o === 'fetal_specific' || o === 'fetal') return 'Fetal';
  if (o === 'maternal_het') return 'MatHet';
  if (o === 'maternal_hom') return 'MatHom';
  if (o === 'maternal') return 'Maternal';
  return origin || '—';
}

export { isFetalOrigin, isMaternalOrigin, isPathogenicSig };
