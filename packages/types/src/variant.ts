export type AcmgClass =
  | 'Pathogenic'
  | 'Likely_pathogenic'
  | 'Uncertain_significance'
  | 'Likely_benign'
  | 'Benign'
  | string;

export interface ClinVarData {
  clinvar_id?: string;
  clinvar_significance?: string;
  clinvar_review_status?: string;
  clinvar_conditions?: string[];
}

export interface GnomadData {
  gnomad_af?: number;
  gnomad_af_popmax?: number;
  gnomad_nhomalt?: number;
}

export interface VepAnnotation {
  consequence?: string;
  impact?: string;
  symbol?: string;
  biotype?: string;
  sift?: string;
  polyphen?: string;
  cadd_phred?: number;
}

export interface Variant {
  variant_id: string;
  gene: string;
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  hgvsc?: string;
  hgvsp?: string;
  /** ENST canonical transcript */
  transcript?: string;
  canonical_enst?: string;
  /** Clinical NM transcript (NM_xxxxx.x) */
  clinical_nm?: string;
  effect?: string;
  zygosity?: 'HET' | 'HOM' | 'HEMI' | 'Hom' | 'Het' | string;
  /** Legacy combined allele depth string */
  allele_depth?: string;
  /** Read depth */
  dp?: number;
  ref_depth?: number;
  alt_depth?: number;
  /** Variant allele frequency (0–1) */
  vaf?: number;
  /** GT genotype string */
  gt?: string;
  acmg_classification?: AcmgClass;
  acmg_criteria?: string[];
  acmg_reasoning?: string;
  acmg_rule_based?: unknown;
  acmg_ai?: unknown;
  /** Legacy single disease string */
  disease?: string;
  /** Array of disease associations */
  diseases?: string[];
  inheritance?: string;
  hpo_phenotypes?: string[];
  tags?: string[];
  gnomad_af?: number;
  gnomad_af_popmax?: number;
  gnomad_exomes_af?: number;
  gnomad_genomes_af?: number | null;
  gnomad_source?: string;
  /** Primary ClinVar significance (human-readable) */
  clinvar_sig_primary?: string;
  /** Full ClinVar significance string */
  clinvar_sig?: string;
  /** Legacy field alias */
  clinvar_significance?: string;
  clinvar_id?: string;
  clinvar_variation_id?: string;
  clinvar_conditions?: string[];
  clinvar_revstat?: string;
  clinvar_stars?: number;
  clinvar_conflicting?: boolean;
  clinvar_conflict_detail?: string;
  clinvar_dn?: string;
  dbsnp_rsid?: string;
  dbsnp_url?: string;
  hgmd_class?: string;
  hgmd_disease?: string;
  hgmd_pmid?: string;
  clingen_hi_score?: string;
  clingen_ts_score?: string;
  curated_classification?: string;
  curated_source?: string;
  curated_notes?: string;
  literature?: unknown[];
  /** Reviewer override */
  reviewer_classification?: AcmgClass;
  reviewer_comment?: string;
  reviewer_confirmed?: boolean;
  include_in_report?: boolean;
  vep?: VepAnnotation;
  // sgNIPT specific
  origin?: string;
  confidence?: number;
  fetal_fraction?: number;
  [key: string]: unknown;
}

export interface ClassifyRequest {
  variants: Array<{
    variant_id: string;
    chrom: string;
    pos: number;
    ref: string;
    alt: string;
    gene: string;
  }>;
}

export interface ClassifyResult {
  variant_id: string;
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  acmg_classification?: AcmgClass;
  acmg_criteria?: string[];
  acmg_reasoning?: string;
  clinvar_significance?: string;
  clinvar_id?: string;
  gnomad_af?: number;
}

export interface ClassifyResponse {
  results: ClassifyResult[];
}

export interface GeneKnowledge {
  gene: string;
  function_summary?: string;
  disease_association?: string;
  disorder?: string;
  omim?: string;
  inheritance?: string;
  notes?: string;
  updated_at?: string;
}

export interface VariantKnowledge {
  key: string; // "GENE|HGVSc"
  notes?: string;
  updated_at?: string;
}
