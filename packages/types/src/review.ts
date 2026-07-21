import type { Variant } from './variant';

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

export interface DarkGenes {
  smn?: SmnResult;
  cftr?: CftrResult;
  apoe?: ApoeResult;
  sections?: DarkGeneSection[];
  visual_evidence?: {
    igv_report_html?: string;
    repeat_svgs?: Record<string, string>;
  };
}

export interface PgxGeneResult {
  gene: string;
  diplotype?: string;
  phenotype?: string;
  activity_score?: number;
  recommendations?: string[];
  reviewer_confirmed?: boolean;
}

export interface PgxResult {
  gene_results?: PgxGeneResult[];
  custom_gene_results?: PgxGeneResult[];
  summary?: string;
}

export interface CoverageContext {
  bam_path?: string;
  bam_index_path?: string;
  genome?: string;
  target_genes?: string[];
}

export interface ReviewData {
  order_id: string;
  service_code?: string;
  _service_code?: string;
  variants: Variant[];
  qc?: QcMetrics;
  dark_genes?: DarkGenes;
  pgx?: PgxResult;
  order_params?: Record<string, unknown>;
  variant_analysis?: {
    fetal_specific_detail?: unknown;
    pathogenic_details?: unknown;
  };
  [key: string]: unknown;
}
