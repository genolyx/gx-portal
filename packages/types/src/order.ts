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

export interface PortalOrderMeta {
  order_id: string;
  client_id: number;
  created_by?: number;
  service_code: string;
  legacy_order_id?: string;
  /** User-entered note at create time, or pre-migration order ID fallback in UI */
  description?: string;
  work_dir?: string;
  created_at: string;
}

export interface Order {
  order_id: string;
  service_code: ServiceCode;
  /** Original order ID when migrated to the new ID format */
  legacy_order_id?: string;
  description?: string;
  client_id?: number;
  status: OrderStatus;
  progress?: number;
  message?: string;
  sample_name?: string;
  created_at: string;
  started_at?: string;
  updated_at?: string;
  completed_at?: string;
  work_dir?: string;
  fastq_r1_path?: string;
  fastq_r2_path?: string;
  callback_url?: string;
  params?: OrderParams & {
    labcode?: string;
    lab_identifier?: string[];
    carrier?: Record<string, unknown>;
    nipt?: Record<string, unknown>;
    _pipeline_command?: string;
    [key: string]: unknown;
  };
  error_message?: string;
  error_log?: string;
  pipeline_step?: string;
  pid?: number;
  exit_code?: number;
}

export interface OrderListResponse {
  orders: Order[];
  total?: number;
}

export interface OrderCreateBody {
  order_id?: string;
  service_code?: ServiceCode;
  /** Admin-only: assign order to a specific client */
  client_id?: number;
  /** Optional label shown in Order detail (lab ref, prior ID, internal note) */
  description?: string;
  work_dir?: string;
  fastq_r1_path?: string;
  fastq_r2_path?: string;
  params?: OrderParams;
  [key: string]: unknown;
}

export interface OrderStartOptions {
  fresh?: boolean;
  force?: boolean;
}
