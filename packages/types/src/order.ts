export type OrderStatus =
  | 'SAVED'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'REPORT_READY'
  | 'FAILED'
  | 'CANCELLED'
  | string;

export type ServiceCode =
  | 'carrier'
  | 'carrier_couples'
  | 'wes_panel'
  | 'health_snp'
  | 'sgnipt'
  | string;

export interface CarrierParams {
  patient_name?: string;
  patient_dob?: string;
  patient_gender?: string;
  wes_panel_id?: string;
  include_apoe_pgx?: boolean;
  partner_name?: string;
  partner_dob?: string;
  partner_gender?: string;
  is_couples?: boolean;
}

export interface NiptParams {
  patient_name?: string;
  patient_dob?: string;
  gestational_age_weeks?: number;
  gestational_age_days?: number;
  package_code?: string;
  report_language?: 'KO' | 'EN' | 'CN';
}

export interface WesParams {
  patient_name?: string;
  patient_dob?: string;
  patient_gender?: string;
  wes_panel_id?: string;
  backbone_bed?: string;
  input_bam?: string;
  input_bam_csv?: string;
}

export type OrderParams = CarrierParams | NiptParams | WesParams | Record<string, unknown>;

export interface Order {
  order_id: string;
  service_code: ServiceCode;
  status: OrderStatus;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  work_dir?: string;
  fastq_r1_path?: string;
  fastq_r2_path?: string;
  callback_url?: string;
  params?: OrderParams;
  error_message?: string;
  pipeline_step?: string;
}

export interface OrderListResponse {
  orders: Order[];
  total?: number;
}

export interface OrderCreateBody {
  service_code: ServiceCode;
  fastq_r1_path?: string;
  fastq_r2_path?: string;
  params?: OrderParams;
}

export interface OrderStartOptions {
  fresh?: boolean;
  force?: boolean;
}
