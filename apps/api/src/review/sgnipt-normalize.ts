/**
 * Normalize sgNIPT result.json into a slim Portal review payload.
 * Drops bulky duplicate arrays (clinical_findings / all_target_variants / VEP blobs)
 * after projecting into variants[] — this is the main Review enter latency fix.
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
  return s.toLowerCase().includes('pathogenic');
}

function isSgnipt(rd: Record<string, unknown>): boolean {
  const svc = String(rd._service_code ?? rd.service_code ?? '').trim();
  if (svc === 'sgnipt') return true;
  return Array.isArray(rd.clinical_findings) &&
    (rd.panel != null || rd.fetal_fraction_detail != null || rd.sgnipt_status != null);
}

/** Slim Portal variant — do NOT spread the raw clinical_finding (keeps VEP/details out of JSON). */
function normalizeVariant(raw: Record<string, unknown>, idx: number): Variant {
  const vep = (raw.vep && typeof raw.vep === 'object' ? raw.vep : {}) as Record<string, unknown>;
  const cv = (vep.clinvar && typeof vep.clinvar === 'object' ? vep.clinvar : {}) as Record<string, unknown>;
  const clnsig = clinSigNorm(String(cv.clnsig ?? raw.clinvar_sig_primary ?? ''));
  const acmgCls = String(raw.acmg_classification || clnsig || (raw.pathogenic_variant ? 'Pathogenic' : '') || '');
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
  const details = String(raw.details || '');

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
    // Keep short details only; truncate to avoid multi-KB blobs in the review payload
    details: details.length > 500 ? `${details.slice(0, 500)}…` : details,
    acmg_classification: acmgCls,
    acmg_criteria: Array.isArray(raw.acmg_criteria) ? (raw.acmg_criteria as string[]).slice(0, 20) : [],
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

export function normalizeSgniptReviewData(rd: ReviewData): ReviewData {
  const raw = rd as unknown as Record<string, unknown>;
  if (!isSgnipt(raw)) return rd;

  // Already slimmed by a previous pass — leave as-is
  if (
    Array.isArray(rd.variants) &&
    rd.variants.length > 0 &&
    raw._sgnipt_slim === true
  ) {
    return rd;
  }

  const clinical = Array.isArray(raw.clinical_findings)
    ? (raw.clinical_findings as Record<string, unknown>[])
    : Array.isArray(rd.variants)
      ? (rd.variants as unknown as Record<string, unknown>[])
      : [];

  const variants = clinical.map((v, i) => normalizeVariant(v, i));

  const fetal = variants.filter((v) => {
    const o = String(v.origin || '');
    return o === 'fetal_specific' || o === 'fetal';
  }).length;
  const plp = variants.filter((v) =>
    isPathogenicSig(String(v.clinvar_sig_primary || v.acmg_classification || '')),
  ).length;
  const vus = variants.filter((v) => {
    const s = String(v.clinvar_sig_primary || v.acmg_classification || '').toLowerCase();
    return s.includes('vus') || s.includes('uncertain');
  }).length;

  // Build a slim object — drop multi‑MB duplicate arrays
  const out: ReviewData = {
    order_id: rd.order_id,
    service_code: rd.service_code || 'sgnipt',
    _service_code: 'sgnipt',
    type: rd.type,
    status: rd.status,
    sample_name: rd.sample_name,
    generated_at: rd.generated_at,
    panel: rd.panel,
    summary: rd.summary,
    fetal_fraction_used: rd.fetal_fraction_used,
    fetal_fraction_detail: rd.fetal_fraction_detail,
    sgnipt_status: rd.sgnipt_status,
    sgnipt_status_flags: rd.sgnipt_status_flags,
    fastq_qc: rd.fastq_qc,
    bam_qc: rd.bam_qc,
    variant_analysis_summary: rd.variant_analysis_summary,
    gene_coverage_validation: (rd as Record<string, unknown>).gene_coverage_validation as ReviewData['gene_coverage_validation'],
    order_params: rd.order_params,
    qc_summary: rd.qc_summary,
    variants,
    variant_stats: {
      total: variants.length,
      pathogenic_or_likely: plp,
      vus,
      fetal_specific: fetal,
    },
    // Keep empty shell so UI code paths stay happy; no bulky detail arrays
    variant_analysis: {},
    _sgnipt_slim: true,
  } as ReviewData;

  return out;
}
