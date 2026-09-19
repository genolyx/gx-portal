import { GX_SCHEMA_VERSION } from '@gx-portal/types';
import type { OrderCreateBody } from '@gx-portal/types';
import type { GxCreateOrderDto } from './dto/gx-create-order.dto';

const GENDER: Record<string, string> = {
  FEMALE: 'Female',
  MALE: 'Male',
  OTHER: 'Other',
  UNKNOWN: 'Unknown',
};
const YN: Record<string, string> = { YES: 'Yes', NO: 'No' };
const SPECIMEN: Record<string, string> = {
  BLOOD: 'Blood',
  SALIVA: 'Saliva',
  SWAB: 'Swab',
  CORD_BLOOD: 'Cord Blood',
  PLASMA: 'Plasma',
  OTHER: 'Other',
};
const REPORT_TYPE: Record<string, string> = {
  PRINTOUT: 'Printout',
  EMAIL: 'Email',
  PORTAL: 'Portal',
  PLATFORM: 'Platform',
};
const PREGNANCY: Record<string, string> = {
  SINGLETON: 'Singleton',
  TWIN: 'Twin',
  MULTIPLE: 'Multiple',
};
const PACKAGE: Record<string, string> = {
  BASIC: 'Basic',
  STANDARD: 'Standard',
  ULTIMATE_PLUS: 'Ultimate_Plus',
  OTHER: 'Other',
};
const INDICATION: Record<string, string> = {
  ADVANCED_MATERNAL_AGE: 'Advanced_maternal_age',
  ABNORMAL_ULTRASOUND: 'Abnormal_ultrasound',
  OTHER: 'Other',
};
const MEASURE: Record<string, string> = {
  LMP: 'LMP',
  US: 'US',
  IVF: 'IVF',
  CRL: 'CRL',
  OTHER: 'Other',
};
const CATEGORY: Record<string, string> = {
  DOMESTIC: 'Domestic',
  OVERSEAS: 'Overseas',
};
const PACKAGE_CODE: Record<string, string> = {
  carrier_screening: 'CarrierScreening',
  whole_exome: 'WholeExome',
  health_screening: 'HealthScreening',
};

function s(data: Record<string, unknown>, key: string, fallback = ''): string {
  const v = data[key];
  if (v === undefined || v === null) return fallback;
  return String(v).trim();
}

function enumVal(
  data: Record<string, unknown>,
  key: string,
  table: Record<string, string>,
  fallback = '',
): string {
  const raw = s(data, key).toUpperCase().replace(/[-\s]+/g, '_');
  return table[raw] || fallback || s(data, key);
}

function boolVal(data: Record<string, unknown>, key: string, fallback = false): boolean {
  const v = data[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'boolean') return v;
  return ['1', 'true', 'yes'].includes(String(v).trim().toLowerCase());
}

export function buildGxMeta(body: GxCreateOrderDto): Record<string, unknown> {
  return {
    source: 'gx-portal',
    gx_service_code: body.service_code,
    schema_version: body.schema_version || GX_SCHEMA_VERSION,
    report_url: body.callback.report_url,
    status_url: body.callback.status_url,
    organization: body.organization,
    sample: {
      sample_id: body.sample.sample_id,
      medical_record_id: body.sample.medical_record_id,
      sample_collected_at: body.sample.sample_collected_at,
    },
    service_data: body.service_data ?? {},
    fastq_downloaded: false,
  };
}

export function mapGxToCreateBody(
  serviceCode: string,
  body: GxCreateOrderDto,
  gxMeta: Record<string, unknown>,
  fastqR1?: string,
  fastqR2?: string,
): OrderCreateBody {
  const data = (body.service_data ?? {}) as Record<string, unknown>;
  const org = (body.organization ?? {}) as unknown as Record<string, unknown>;
  const samp = (body.sample ?? {}) as unknown as Record<string, unknown>;
  const hospital = s(org, 'hospital_name') || s(org, 'name');
  const doctor = s(org, 'doctor');
  const sampleId = s(samp, 'sample_id');
  const mrn = s(samp, 'medical_record_id');
  const collected = s(samp, 'sample_collected_at');

  if (serviceCode === 'sgnipt') {
    return {
      order_id: body.order_id.trim(),
      fastq_r1_path: fastqR1,
      fastq_r2_path: fastqR2,
      params: {
        nipt: {
          patient_name: s(data, 'patientName'),
          patient_birth: s(data, 'patientBirth'),
          patient_gender: enumVal(data, 'patientGender', GENDER, 'Female'),
          gestational_age_weeks: data.gestationalAgeWeeks,
          gestational_age_days: data.gestationalAgeDays,
          pregnancy_type: enumVal(data, 'pregnancyType', PREGNANCY),
          estimated_delivery_date: s(data, 'estimatedDeliveryDate'),
          height_cm: data.height,
          weight_kg: data.weight,
          hospital_name: hospital,
          doctor,
          medical_record_id: mrn,
          sample_id: sampleId,
          sample_collection_date: collected,
          indication_for_testing: enumVal(data, 'indication', INDICATION),
          package_code: enumVal(data, 'packageCode', PACKAGE),
          report_language: s(data, 'reportLanguage').toUpperCase() || 'EN',
          report_type: enumVal(data, 'reportType', REPORT_TYPE, 'Portal'),
          sample_specimen_type: enumVal(data, 'sampleSpecimenType', SPECIMEN, 'Blood'),
          receipt_date: s(data, 'receiptDate') || undefined,
          measurement_method: enumVal(data, 'measurementMethod', MEASURE, 'LMP'),
          sample_barcode: s(data, 'sampleBarcode') || undefined,
          category: enumVal(data, 'category', CATEGORY, 'Domestic'),
          previous_order_id: s(data, 'previousOrderId') || undefined,
          nipt_kit_id: s(data, 'niptKitId') || undefined,
          sequencing_batch_id: s(data, 'sequencingBatchId') || undefined,
          control_sample: enumVal(data, 'controlSample', YN, 'No'),
          trf_consent: enumVal(data, 'trfConsent', YN, 'Yes'),
          show_fetal_gender: enumVal(data, 'showFetalGender', YN, 'Yes'),
          resample: enumVal(data, 'resample', YN, 'No'),
        },
        _gx: gxMeta,
      },
    };
  }

  const wes = s(data, 'wesPanelId');
  const reportMode = s(data, 'reportMode').toUpperCase();
  return {
    order_id: body.order_id.trim(),
    fastq_r1_path: fastqR1,
    fastq_r2_path: fastqR2,
    params: {
      wes_panel_id: wes || undefined,
      panel_filter_after_analysis: true,
      include_apoe_pgx: boolVal(data, 'includeApoePgx', false),
      carrier: {
        test_category: 'standard_carrier',
        package_code: PACKAGE_CODE[serviceCode],
        patient_name: s(data, 'patientName'),
        patient_birth: s(data, 'patientBirth'),
        patient_gender: enumVal(data, 'patientGender', GENDER, 'Female'),
        affected: enumVal(data, 'affected', YN, 'No'),
        hospital_name: hospital,
        doctor,
        medical_record_id: mrn,
        sample_id: sampleId,
        sample_collection_date: collected,
        report_language: s(data, 'reportLanguage').toUpperCase() || 'EN',
        report_type: enumVal(data, 'reportType', REPORT_TYPE, 'Portal'),
        sample_specimen_type: enumVal(data, 'sampleSpecimenType', SPECIMEN, 'Blood'),
        wes_panel_id: wes,
        include_pgx: boolVal(data, 'includePgx', true),
        report_mode: reportMode === 'COUPLES' ? 'couples' : 'single',
        partner_order_id: s(data, 'partnerOrderId') || undefined,
        capture_panel_id: 'twist-exome2',
        reuse_prior_pipeline_outputs: false,
      },
      _gx: gxMeta,
      _gx_submit: true,
    },
  };
}
