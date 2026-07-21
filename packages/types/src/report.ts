import type { AcmgClass, Variant } from './variant';

export interface ReviewerInfo {
  name: string;
  id?: string;
  institution?: string;
}

export interface PatientInfo {
  name?: string;
  dob?: string;
  gender?: string;
}

export interface ConfirmedVariant extends Variant {
  reviewer_classification?: AcmgClass;
  reviewer_comment?: string;
  gene_description?: string;
  variant_summary?: string;
  include_in_report?: boolean;
}

export interface ReportBody {
  confirmed_variants: ConfirmedVariant[];
  reviewer_info: ReviewerInfo;
  patient_info?: PatientInfo;
  partner_info?: PatientInfo;
  languages?: ('KO' | 'EN' | 'CN')[];
}

export interface ReportPreviewResponse {
  html: string;
}

export interface ReportFile {
  filename: string;
  path: string;
  created_at: string;
  size_bytes?: number;
}
