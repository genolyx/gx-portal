import type { Order } from '@gx-portal/types';

type ServiceCode = 'carrier_screening' | 'whole_exome' | 'health_screening' | 'sgnipt';

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function bool(v: unknown, fallback = false): boolean {
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  return fallback;
}

export function resolveOrderServiceCode(order: Order): ServiceCode {
  const svc = order.service_code;
  const c = (order.params?.carrier ?? {}) as Record<string, unknown>;
  const pkg = str(c.package_code).trim();

  if (svc === 'whole_exome' || pkg === 'WholeExome') return 'whole_exome';
  if (svc === 'health_screening' || pkg === 'HealthScreening') return 'health_screening';
  if (svc === 'sgnipt') return 'sgnipt';
  return 'carrier_screening';
}

export interface PopulatedOrderForm {
  service: ServiceCode;
  description: string;
  workDir: string;
  fastqR1: string;
  fastqR2: string;
  inputBam: string;
  inputBamCsv: string;
  backboneBed: string;
  diseaseBed: string;
  maxAf: string;
  hpoTerms: string;
  geneFilter: string;
  wesPanel: string;
  capturePanel: string;
  includeApoePgx: boolean;
  panelFilterAfterAnalysis: boolean;
  interpretationGenesExtra: string;
  carrier: Record<string, unknown>;
  nipt: Record<string, unknown>;
}

export function populateOrderForm(order: Order, mode: 'edit' | 'followUp'): PopulatedOrderForm {
  const service = resolveOrderServiceCode(order);
  const p = (order.params ?? {}) as Record<string, unknown>;
  const c = (p.carrier ?? {}) as Record<string, unknown>;
  const n = (p.nipt ?? {}) as Record<string, unknown>;

  const carrier: Record<string, unknown> = {
    test_category: str(c.test_category) || 'standard_carrier',
    package_code: str(c.package_code) || '',
    patient_name: str(c.patient_name),
    patient_birth: str(c.patient_birth),
    patient_gender: str(c.patient_gender) || 'Female',
    patient2_name: str(c.patient2_name),
    patient2_birth: str(c.patient2_birth),
    patient2_gender: str(c.patient2_gender),
    patient2_affected: str(c.patient2_affected),
    patient3_name: str(c.patient3_name),
    patient3_birth: str(c.patient3_birth),
    patient3_gender: str(c.patient3_gender),
    patient3_affected: str(c.patient3_affected),
    hospital_name: str(c.hospital_name),
    doctor: str(c.doctor),
    medical_record_id: str(c.medical_record_id),
    sample_id: str(c.sample_id),
    affected: str(c.affected) || 'No',
    clinical_information: str(c.clinical_information),
    sample_collection_date: str(c.sample_collection_date),
    receipt_date: str(c.receipt_date),
    report_language: str(c.report_language) || 'EN',
    report_type: str(c.report_type) || 'Portal',
    sample_specimen_type: str(c.sample_specimen_type) || 'Blood',
    sample_barcode: str(c.sample_barcode),
    report_mode: c.report_mode === 'couples' ? 'couples' : 'single',
    partner_order_id: str(c.partner_order_id),
    prior_order_id: mode === 'followUp' ? order.order_id : str(c.prior_order_id),
    reuse_prior_pipeline_outputs: mode === 'followUp' ? true : bool(c.reuse_prior_pipeline_outputs),
    wes_panel_id: str(p.wes_panel_id || c.wes_panel_id),
    capture_panel_id: str(c.capture_panel_id) || 'twist-exome2',
    include_pgx: bool(c.include_pgx, true),
  };

  const nipt: Record<string, unknown> = {
    previous_order_id: mode === 'followUp' ? order.order_id : str(n.previous_order_id),
    patient_name: str(n.patient_name),
    patient_birth: str(n.patient_birth),
    patient_gender: str(n.patient_gender),
    gestational_age_weeks: n.gestational_age_weeks ?? '',
    gestational_age_days: n.gestational_age_days ?? '',
    height_cm: n.height_cm ?? '',
    weight_kg: n.weight_kg ?? '',
    pregnancy_type: str(n.pregnancy_type),
    estimated_delivery_date: str(n.estimated_delivery_date),
    hospital_name: str(n.hospital_name),
    doctor: str(n.doctor),
    medical_record_id: str(n.medical_record_id),
    sample_id: str(n.sample_id),
    indication_for_testing: str(n.indication_for_testing),
    sample_collection_date: str(n.sample_collection_date),
    receipt_date: str(n.receipt_date),
    package_code: str(n.package_code),
    report_language: str(n.report_language),
    report_type: str(n.report_type),
    sample_specimen_type: str(n.sample_specimen_type) || 'Blood',
    measurement_method: str(n.measurement_method) || 'LMP',
    sample_barcode: str(n.sample_barcode),
    category: str(n.category) || 'Domestic',
    nipt_kit_id: str(n.nipt_kit_id),
    sequencing_batch_id: str(n.sequencing_batch_id),
    control_sample: str(n.control_sample) || 'No',
    trf_consent: str(n.trf_consent) || 'Yes',
    show_fetal_gender: str(n.show_fetal_gender) || 'Yes',
    resample: str(n.resample) || 'No',
  };

  return {
    service,
    description: order.description ?? '',
    workDir: mode === 'followUp' ? '' : (order.work_dir ?? ''),
    fastqR1: order.fastq_r1_path ?? '',
    fastqR2: order.fastq_r2_path ?? '',
    inputBam: str(p.input_bam),
    inputBamCsv: str(p.input_bam_csv),
    backboneBed: str(p.backbone_bed),
    diseaseBed: str(p.disease_bed),
    maxAf: p.max_af != null ? String(p.max_af) : '',
    hpoTerms: str(p.hpo_terms),
    geneFilter: str(p.gene_filter),
    wesPanel: str(p.wes_panel_id || c.wes_panel_id),
    capturePanel: str(c.capture_panel_id) || 'twist-exome2',
    includeApoePgx: bool(p.include_apoe_pgx),
    panelFilterAfterAnalysis: bool(p.panel_filter_after_analysis, true),
    interpretationGenesExtra: str(p.interpretation_genes_extra || c.interpretation_genes_extra),
    carrier,
    nipt,
  };
}
