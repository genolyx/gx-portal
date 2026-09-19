/** GX order-schema — derived from gx-portal Create Order fields. */

export const GX_SCHEMA_VERSION = '2026-09-19';

export const GX_SERVICE_CODES = {
  carrier_screening: 'CARRIER',
  whole_exome: 'WHOLE_EXOME',
  health_screening: 'HEALTH_SCREENING',
  sgnipt: 'SGNIPT',
} as const;

export type GxDaemonService = keyof typeof GX_SERVICE_CODES;
export type GxServiceCode = (typeof GX_SERVICE_CODES)[GxDaemonService];

export interface GxOrderSchemaField {
  fieldKey: string;
  fieldLabel: string;
  fieldType: 'string' | 'number' | 'date' | 'enum' | 'boolean';
  isRequired: boolean;
  order: number;
  defaultValue: unknown;
  validation: Record<string, unknown> | null;
  enumValues: string[];
  enumLabels: string[];
}

export interface GxOrderSchema {
  service_code: GxServiceCode;
  version: string;
  fields: GxOrderSchemaField[];
}

const GX_TO_DAEMON: Record<string, GxDaemonService> = {
  CARRIER: 'carrier_screening',
  CARRIER_SCREENING: 'carrier_screening',
  WHOLE_EXOME: 'whole_exome',
  WES: 'whole_exome',
  HEALTH: 'health_screening',
  HEALTH_SCREENING: 'health_screening',
  SGNIPT: 'sgnipt',
  SG_NIPT: 'sgnipt',
};

export function resolveGxDaemonService(code: string | undefined | null): GxDaemonService | null {
  const raw = String(code ?? '').trim();
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/-/g, '_');
  if (upper in GX_TO_DAEMON) return GX_TO_DAEMON[upper];
  const lower = raw.toLowerCase().replace(/-/g, '_') as GxDaemonService;
  if (lower in GX_SERVICE_CODES) return lower;
  return null;
}

export function toGxServiceCode(daemon: GxDaemonService): GxServiceCode {
  return GX_SERVICE_CODES[daemon];
}

function field(
  fieldKey: string,
  fieldLabel: string,
  fieldType: GxOrderSchemaField['fieldType'],
  order: number,
  isRequired = false,
  extra?: Partial<Pick<GxOrderSchemaField, 'defaultValue' | 'validation' | 'enumValues' | 'enumLabels'>>,
): GxOrderSchemaField {
  return {
    fieldKey,
    fieldLabel,
    fieldType,
    isRequired,
    order,
    defaultValue: extra?.defaultValue ?? null,
    validation: extra?.validation ?? null,
    enumValues: extra?.enumValues ?? [],
    enumLabels: extra?.enumLabels ?? [],
  };
}

function enums(pairs: Array<{ value: string; label: string }>) {
  return {
    enumValues: pairs.map((p) => p.value),
    enumLabels: pairs.map((p) => p.label),
  };
}

function exomeFields(service: GxDaemonService): GxOrderSchemaField[] {
  const fields: GxOrderSchemaField[] = [
    field('patientName', 'Patient Name', 'string', 1, false, { validation: { maxLength: 80 } }),
    field('patientBirth', 'Date of Birth', 'date', 2),
    field('patientGender', 'Gender', 'enum', 3, false, {
      ...enums([
        { value: 'FEMALE', label: 'Female' },
        { value: 'MALE', label: 'Male' },
        { value: 'UNKNOWN', label: 'Unknown' },
      ]),
      defaultValue: 'FEMALE',
    }),
    field('affected', 'Affected', 'enum', 4, false, {
      ...enums([
        { value: 'YES', label: 'Yes' },
        { value: 'NO', label: 'No' },
      ]),
      defaultValue: 'NO',
    }),
    field('wesPanelId', 'Primary (interpretation) panel', 'string', 5, true, {
      validation: { maxLength: 80 },
    }),
    field('reportLanguage', 'Report Language', 'enum', 6, false, {
      ...enums([
        { value: 'EN', label: 'EN' },
        { value: 'KO', label: 'KO' },
      ]),
      defaultValue: 'EN',
    }),
    field('reportType', 'Report Type', 'enum', 7, false, {
      ...enums([
        { value: 'PORTAL', label: 'Portal' },
        { value: 'PLATFORM', label: 'Platform' },
        { value: 'PRINTOUT', label: 'Printout' },
      ]),
      defaultValue: 'PORTAL',
    }),
    field('sampleSpecimenType', 'Specimen type', 'enum', 8, false, {
      ...enums([
        { value: 'BLOOD', label: 'Blood' },
        { value: 'SALIVA', label: 'Saliva' },
        { value: 'SWAB', label: 'Swab' },
        { value: 'CORD_BLOOD', label: 'Cord Blood' },
        { value: 'OTHER', label: 'Other' },
      ]),
      defaultValue: 'BLOOD',
    }),
    field('includePgx', 'Include PGx', 'boolean', 9, false, { defaultValue: true }),
    field('reportMode', 'Couples carrier report', 'enum', 10, false, {
      ...enums([
        { value: 'SINGLE', label: 'Single' },
        { value: 'COUPLES', label: 'Couples' },
      ]),
      defaultValue: 'SINGLE',
    }),
    field('partnerOrderId', 'Partner Order ID', 'string', 11, false, { validation: { maxLength: 64 } }),
  ];
  if (service === 'health_screening') {
    fields.push(field('includeApoePgx', 'Include APOE PGx', 'boolean', 12, false, { defaultValue: false }));
  }
  return fields;
}

function sgniptFields(): GxOrderSchemaField[] {
  return [
    field('patientName', 'Patient Name', 'string', 1, true, { validation: { maxLength: 80 } }),
    field('patientBirth', 'Date of Birth', 'date', 2, true),
    field('patientGender', 'Gender', 'enum', 3, true, {
      ...enums([
        { value: 'FEMALE', label: 'Female' },
        { value: 'MALE', label: 'Male' },
        { value: 'OTHER', label: 'Other' },
      ]),
    }),
    field('gestationalAgeWeeks', 'GA Weeks', 'number', 4, true, { validation: { min: 0, max: 45 } }),
    field('gestationalAgeDays', 'GA Days', 'number', 5, true, { validation: { min: 0, max: 6 } }),
    field('pregnancyType', 'Pregnancy Type', 'enum', 6, true, enums([
      { value: 'SINGLETON', label: 'Singleton' },
      { value: 'TWIN', label: 'Twin' },
      { value: 'MULTIPLE', label: 'Multiple' },
    ])),
    field('estimatedDeliveryDate', 'Estimated Delivery Date', 'date', 7, true),
    field('height', 'Height (cm)', 'number', 8, false, { validation: { min: 0, max: 300 } }),
    field('weight', 'Weight (kg)', 'number', 9, false, { validation: { min: 0, max: 300 } }),
    field('packageCode', 'Package Code', 'enum', 10, true, enums([
      { value: 'BASIC', label: 'Basic' },
      { value: 'STANDARD', label: 'Standard' },
      { value: 'ULTIMATE_PLUS', label: 'Ultimate Plus' },
      { value: 'OTHER', label: 'Other' },
    ])),
    field('reportLanguage', 'Report Language', 'enum', 11, true, enums([
      { value: 'EN', label: 'English' },
      { value: 'KO', label: 'Korean' },
      { value: 'CN', label: 'Chinese' },
      { value: 'ID', label: 'Indonesian' },
      { value: 'OTHER', label: 'Other' },
    ])),
    field('reportType', 'Report Type', 'enum', 12, true, enums([
      { value: 'PRINTOUT', label: 'Printout' },
      { value: 'EMAIL', label: 'Email' },
      { value: 'PORTAL', label: 'Portal' },
    ])),
    field('indication', 'Indication for Testing', 'enum', 13, false, enums([
      { value: 'ADVANCED_MATERNAL_AGE', label: 'Advanced maternal age' },
      { value: 'ABNORMAL_ULTRASOUND', label: 'Abnormal ultrasound' },
      { value: 'OTHER', label: 'Other' },
    ])),
    field('sampleSpecimenType', 'Sample Specimen Type', 'enum', 14, false, {
      ...enums([
        { value: 'BLOOD', label: 'Blood' },
        { value: 'PLASMA', label: 'Plasma' },
        { value: 'OTHER', label: 'Other' },
      ]),
      defaultValue: 'BLOOD',
    }),
    field('receiptDate', 'Receipt Date', 'date', 15),
    field('measurementMethod', 'Measurement Method', 'enum', 16, false, {
      ...enums([
        { value: 'LMP', label: 'LMP' },
        { value: 'US', label: 'Ultrasound' },
        { value: 'IVF', label: 'IVF' },
        { value: 'OTHER', label: 'Other' },
      ]),
      defaultValue: 'LMP',
    }),
    field('sampleBarcode', 'Sample Barcode', 'string', 17, false, { validation: { maxLength: 80 } }),
    field('category', 'Category', 'enum', 18, false, {
      ...enums([
        { value: 'DOMESTIC', label: 'Domestic' },
        { value: 'OVERSEAS', label: 'Overseas' },
      ]),
      defaultValue: 'DOMESTIC',
    }),
    field('previousOrderId', 'Previous Order', 'string', 19, false, { validation: { maxLength: 64 } }),
    field('niptKitId', 'NIPT Kit ID', 'string', 20, false, { validation: { maxLength: 80 } }),
    field('sequencingBatchId', 'Sequencing Batch ID', 'string', 21, false, { validation: { maxLength: 80 } }),
    field('controlSample', 'Control Sample', 'enum', 22, true, {
      ...enums([
        { value: 'NO', label: 'No' },
        { value: 'YES', label: 'Yes' },
      ]),
      defaultValue: 'NO',
    }),
    field('trfConsent', 'TRF Consent', 'enum', 23, true, {
      ...enums([
        { value: 'YES', label: 'Yes' },
        { value: 'NO', label: 'No' },
      ]),
      defaultValue: 'YES',
    }),
    field('showFetalGender', 'Show Fetal Gender', 'enum', 24, true, {
      ...enums([
        { value: 'YES', label: 'Yes' },
        { value: 'NO', label: 'No' },
      ]),
      defaultValue: 'YES',
    }),
    field('resample', 'Resample', 'enum', 25, true, {
      ...enums([
        { value: 'NO', label: 'No' },
        { value: 'YES', label: 'Yes' },
      ]),
      defaultValue: 'NO',
    }),
  ];
}

export function buildGxOrderSchema(service: GxDaemonService): GxOrderSchema {
  return {
    service_code: toGxServiceCode(service),
    version: GX_SCHEMA_VERSION,
    fields: service === 'sgnipt' ? sgniptFields() : exomeFields(service),
  };
}

export function getGxOrderSchema(serviceCode: string): GxOrderSchema | null {
  const daemon = resolveGxDaemonService(serviceCode);
  if (!daemon) return null;
  return buildGxOrderSchema(daemon);
}

export function listGxSchemaCodes(): GxServiceCode[] {
  return Object.values(GX_SERVICE_CODES);
}

export function gxPortalMeta(order: { params?: unknown } | null | undefined): Record<string, unknown> | null {
  const params = order?.params;
  if (!params || typeof params !== 'object') return null;
  const gx = (params as Record<string, unknown>)._gx;
  return gx && typeof gx === 'object' && !Array.isArray(gx) ? (gx as Record<string, unknown>) : null;
}
