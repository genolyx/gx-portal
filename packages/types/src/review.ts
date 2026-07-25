import type { Variant } from './variant';

/** Legacy flat QC metrics */
export interface QcMetrics {
  total_reads?: number;
  mapped_reads?: number;
  mapping_rate?: number;
  mean_coverage?: number;
  coverage_20x?: number;
  coverage_30x?: number;
  duplicate_rate?: number;
  insert_size?: number;
  [key: string]: unknown;
}

/** Structured QC summary returned by the analysis pipeline */
export interface QcSummary {
  sample_name?: string;
  generated_at?: string;
  coverage?: {
    mean_coverage?: number;
    min_coverage?: number;
    max_coverage?: number;
    pct_bases_20x?: number;
    pct_bases_50x?: number;
    pct_bases_100x?: number;
    [key: string]: unknown;
  };
  alignment?: {
    total_reads?: number;
    mapped_reads?: number;
    mapping_rate?: number;
    raw_total_sequences?: number;
    properly_paired?: number;
    duplicates?: number;
    average_quality?: number;
    insert_size_avg?: number;
    insert_size_std?: number;
    properly_paired_rate?: number;
    [key: string]: unknown;
  };
  variant_stats?: Record<string, unknown>;
  metric_images?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface VariantStats {
  total?: number;
  pathogenic_or_likely?: number;
  vus?: number;
  benign_or_likely?: number;
  by_classification?: Record<string, number>;
  by_zygosity?: Record<string, number>;
  by_gene?: Record<string, number>;
  unique_genes?: number;
  [key: string]: unknown;
}

export interface SmnResult {
  smn1_copies?: number;
  smn2_copies?: number;
  smn1_confidence?: string;
  smn2_confidence?: string;
  igv_report_html?: string;
}

export interface CftrResult {
  variants?: Variant[];
  ivs9_result?: string;
  igv_report_html?: string;
}

export interface ApoeResult {
  genotype?: string;
  haplotype1?: string;
  haplotype2?: string;
  igv_report_html?: string;
}

export interface DarkGeneSection {
  gene: string;
  result?: unknown;
  visual_evidence?: {
    igv_report_html?: string;
    repeat_svgs?: Record<string, string>;
    cftr_eh?: unknown;
  };
}

export interface DarkGeneSectionReview {
  approved?: boolean;
  notes?: string;
  risk?: 'low' | 'high' | string;
  reviewer_set?: boolean;
}

/** DarkGenes as returned by the actual pipeline API */
export interface DarkGenes {
  status?: string;
  message?: string;
  sample_name?: string;
  summary_file?: string;
  detailed_file?: string;
  summary_paths?: Record<string, string>;
  detailed_paths?: Record<string, string>;
  summary_text?: string;
  detailed_text?: string;
  /** Array of gene-level sections parsed from the detailed output */
  detailed_sections?: DarkGeneDetailedSection[];
  /** Index-aligned reviewer approvals for detailed_sections */
  section_reviews?: DarkGeneSectionReview[];
  visual_evidence?: {
    igv_report_html?: string;
    repeat_svgs?: string[] | Record<string, string>;
    snapshots_png?: string[];
  };
  cftr_ivs9_eh?: unknown;
  /** Legacy sub-objects for backwards compatibility */
  smn?: SmnResult;
  cftr?: CftrResult;
  apoe?: ApoeResult;
  sections?: DarkGeneSection[];
  [key: string]: unknown;
}

export interface DarkGeneDetailedSection {
  gene?: string;
  title?: string;
  /** Pipeline severity — Portal uses `kind` (`alert` / `warning` / `normal`) */
  kind?: 'alert' | 'warning' | 'warn' | 'normal' | string;
  level?: 'warn' | 'alert' | 'info' | string;
  body?: string;
  kv?: Array<{ key: string; value: string }>;
  visual?: {
    igv_report_html?: string;
    svg_base64?: string;
  };
  [key: string]: unknown;
}

export interface PgxGeneResult {
  gene: string;
  diplotype?: string;
  phenotype?: string;
  activity_score?: number | string;
  recommendations?: string[];
  reviewer_confirmed?: boolean;
  reviewer_comment?: string;
  guideline_source?: string;
  allele1_function?: string;
  allele2_function?: string;
  call_source?: string;
  category?: string;
  /** Extended panel fields */
  rsid?: string;
  variant_name?: string;
  genotype?: string;
  zygosity?: string;
  clinical_significance?: string;
  drugs?: string;
  evidence_level?: string;
  is_variant?: boolean;
  [key: string]: unknown;
}

export interface PgxDrugRecommendation {
  drug?: string;
  gene?: string;
  implication?: string;
  recommendation?: string;
  classification?: string;
  [key: string]: unknown;
}

export interface PgxApoePhasing {
  show_alert?: boolean;
  short_warning?: string;
  detail?: string;
  status?: string;
}

export interface PgxApoeDiplotypeForReport {
  report_key?: string;
  source?: string;
  [key: string]: unknown;
}

export interface PgxPortalReview {
  reviewer_notes?: string;
  reviewed?: boolean;
  include_apoe_proactive_pdf?: boolean | string;
  gene_reviews?: Array<{ gene: string; reviewer_confirmed: boolean; reviewer_comment?: string }>;
  custom_gene_reviews?: Array<{ gene: string; rsid: string; reviewer_confirmed: boolean; reviewer_comment?: string }>;
  [key: string]: unknown;
}

export interface PgxMeta {
  tool_version?: string;
  genome_build?: string;
  exit_status?: string | number;
  [key: string]: unknown;
}

export interface PgxArtifacts {
  pgx_summary_txt?: string;
  reporter_html_basename?: string;
  pgx_meta_json?: string;
  pgx_result_json?: string;
  [key: string]: unknown;
}

export interface PgxResult {
  status?: string;
  message?: string;
  summary_text?: string;
  gene_results?: PgxGeneResult[];
  custom_gene_results?: PgxGeneResult[];
  all_pharmcat_genes?: PgxGeneResult[];
  drug_recommendations?: PgxDrugRecommendation[];
  apoe_diplotype_for_report?: PgxApoeDiplotypeForReport | string;
  apoe_phasing?: PgxApoePhasing;
  portal_review?: PgxPortalReview;
  meta?: PgxMeta;
  artifacts?: PgxArtifacts;
  pgx_dir?: string;
  summary?: string;
  [key: string]: unknown;
}

export interface BamTrack {
  rel_path: string;
  label?: string;
  has_index?: boolean;
  index_rel_path?: string;
}

export interface CoverageContext {
  /** Absolute path when API resolved a local file (optional; prefer bam_rel_path). */
  bam_path?: string;
  bam_index_path?: string;
  genome?: string;
  target_genes?: string[];
  interpretation_genes?: string[];
  /** Daemon bam_tracks (relative to analysis roots). */
  bam_tracks?: BamTrack[];
  genome_id?: string;
  /** Selected primary track for IGV (Portal prioritizeCoverageBamTracks). */
  bam_rel_path?: string;
  bam_index_rel_path?: string;
  bam_label?: string;
  igv_bam_message?: string;
  prior_reuse_order_id?: string;
}

export interface ReviewData {
  order_id: string;
  service_code?: string;
  _service_code?: string;
  type?: string;
  status?: string;
  sample_name?: string;
  generated_at?: string;
  variants: Variant[];
  /** Structured QC summary from pipeline */
  qc_summary?: QcSummary;
  /** Legacy flat QC */
  qc?: QcMetrics;
  variant_stats?: VariantStats;
  disease_variant_groups?: unknown[];
  disease_groups?: Record<string, unknown>;
  gene_variant_groups?: unknown[];
  disease_panel?: Record<string, unknown>;
  filter_summary?: Record<string, unknown>;
  igv_snapshots?: Record<string, unknown>;
  dark_genes?: DarkGenes;
  pgx?: PgxResult;
  order_params?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  variant_analysis?: {
    fetal_specific_detail?: unknown;
    pathogenic_details?: unknown;
  };
  /** sgNIPT-native fields from result.json */
  clinical_findings?: unknown[];
  summary?: Record<string, unknown>;
  fetal_fraction_detail?: Record<string, unknown>;
  fetal_fraction_used?: number;
  panel?: string;
  sgnipt_status?: string;
  sgnipt_status_flags?: string[];
  fastq_qc?: Record<string, unknown>;
  bam_qc?: Record<string, unknown>;
  variant_analysis_summary?: Record<string, unknown>;
  [key: string]: unknown;
}
