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
  transcript?: string;
  effect?: string;
  zygosity?: 'HET' | 'HOM' | 'HEMI' | string;
  allele_depth?: string;
  acmg_classification?: AcmgClass;
  acmg_criteria?: string[];
  acmg_reasoning?: string;
  disease?: string;
  inheritance?: string;
  tags?: string[];
  gnomad_af?: number;
  gnomad_af_popmax?: number;
  clinvar_significance?: string;
  clinvar_id?: string;
  clinvar_conditions?: string[];
  vep?: VepAnnotation;
  // sgNIPT specific
  origin?: string;
  confidence?: number;
  fetal_fraction?: number;
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
  updated_at?: string;
}

export interface VariantKnowledge {
  key: string; // "GENE|HGVSc"
  notes?: string;
  updated_at?: string;
}
