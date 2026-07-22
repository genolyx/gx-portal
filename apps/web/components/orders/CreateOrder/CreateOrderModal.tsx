'use client';

import { useCallback, useEffect, useState } from 'react';
import { ordersApi } from '../../../lib/api/orders';
import { catalogApi } from '../../../lib/api/catalog';
import { Button } from '../../ui/Button';
import { FileBrowseModal } from './FileBrowseModal';
import type { PanelPackage } from '../../../lib/api/catalog';
import styles from './CreateOrder.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceCode = 'carrier_screening' | 'whole_exome' | 'health_screening' | 'sgnipt';

const SERVICES: { code: ServiceCode; label: string }[] = [
  { code: 'carrier_screening', label: 'Carrier Screening' },
  { code: 'whole_exome',       label: 'Whole Exome' },
  { code: 'health_screening',  label: 'Health Screening' },
  { code: 'sgnipt',            label: 'Single-gene NIPT' },
];

const GENDERS         = ['Female', 'Male', 'Unknown'];
const NIPT_GENDERS    = ['Female', 'Male', 'Other'];
const LANGUAGES       = ['EN', 'KO'];
const NIPT_LANGUAGES  = [
  { value: 'EN', label: 'English' },
  { value: 'KO', label: 'Korean' },
  { value: 'CN', label: 'Chinese' },
  { value: 'ID', label: 'Indonesian' },
  { value: 'Other', label: 'Other' },
];
const REPORT_TYPES    = ['Portal', 'Platform', 'Printout'];
const NIPT_REPORT_TYPES = [
  { value: 'Printout', label: 'Printout' },
  { value: 'Email', label: 'Email' },
  { value: 'Portal', label: 'Portal' },
];
const SPECIMEN_TYPES  = ['Blood', 'Saliva', 'Swab', 'Cord Blood', 'Other'];
const NIPT_SPECIMEN_TYPES = ['Blood', 'Plasma', 'Other'];
// Sequencing capture panel — hardcoded in original portal (not API-driven)
const CAPTURE_PANELS  = [{ value: 'twist-exome2', label: 'Twist Exome 2.0' }];
const PREGNANCY_TYPES = ['Singleton', 'Twin'];
const NIPT_PREGNANCY_TYPES = ['Singleton', 'Twin', 'Multiple'];
const MEAS_METHODS    = ['LMP', 'CRL'];
const NIPT_MEAS_METHODS = [
  { value: 'LMP', label: 'LMP' },
  { value: 'US', label: 'Ultrasound' },
  { value: 'IVF', label: 'IVF' },
  { value: 'Other', label: 'Other' },
];
const NIPT_PACKAGES = [
  { value: 'Basic', label: 'Basic' },
  { value: 'Standard', label: 'Standard' },
  { value: 'Ultimate_Plus', label: 'Ultimate Plus' },
  { value: 'Other', label: 'Other' },
];
const NIPT_INDICATIONS = [
  { value: 'Advanced_maternal_age', label: 'Advanced maternal age' },
  { value: 'Abnormal_ultrasound', label: 'Abnormal ultrasound' },
  { value: 'Other', label: 'Other' },
];

// report_mode for carrier/health: Single | Couples
const CARRIER_REPORT_MODES = [
  { value: 'single',  label: 'Single' },
  { value: 'couples', label: 'Couples' },
];

// package_code auto-derived from service
const PACKAGE_CODE: Record<ServiceCode, string> = {
  carrier_screening: 'CarrierScreening',
  health_screening:  'HealthScreening',
  whole_exome:       'WholeExome',
  sgnipt:            'Standard',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().split('T')[0]; }

function initCarrierSub(svc: ServiceCode) {
  return {
    test_category:                 'standard_carrier',
    package_code:                  PACKAGE_CODE[svc],
    patient_name:                  '',
    patient_birth:                 '',
    patient_gender:                'Female',
    hospital_name:                 '',
    doctor:                        '',
    affected:                      'No',
    sample_collection_date:        today(),
    report_language:               'EN',
    report_type:                   'Portal',
    sample_specimen_type:          'Blood',
    report_mode:                   'single',
    wes_panel_id:                  '',
    capture_panel_id:              'twist-exome2',
    reuse_prior_pipeline_outputs:  false,
    include_pgx:                   true,
  };
}

function initNiptSub() {
  return {
    previous_order_id:       '',
    patient_name:            '',
    patient_birth:           '',
    patient_gender:          '',
    gestational_age_weeks:   '' as number | '',
    gestational_age_days:    '' as number | '',
    height_cm:               '',
    weight_kg:               '',
    pregnancy_type:          '',
    estimated_delivery_date: '',
    hospital_name:           '',
    doctor:                  '',
    medical_record_id:       '',
    sample_id:               '',
    indication_for_testing:  '',
    sample_collection_date:  today(),
    receipt_date:            '',
    package_code:            '',
    report_language:         '',
    report_type:             '',
    sample_specimen_type:    'Blood',
    measurement_method:      'LMP',
    sample_barcode:          '',
    category:                'Domestic',
    nipt_kit_id:             '',
    sequencing_batch_id:     '',
    control_sample:          'No',
    trf_consent:             'Yes',
    show_fetal_gender:       'Yes',
    resample:                'No',
  };
}

function validateNiptClinical(nipt: ReturnType<typeof initNiptSub>): string | null {
  const need: [keyof ReturnType<typeof initNiptSub>, string][] = [
    ['patient_name', 'Patient Name'],
    ['patient_birth', 'Patient Birth'],
    ['patient_gender', 'Patient Gender'],
    ['gestational_age_weeks', 'Gestational Age Weeks'],
    ['gestational_age_days', 'Gestational Age Days'],
    ['pregnancy_type', 'Pregnancy Type'],
    ['estimated_delivery_date', 'EDD'],
    ['hospital_name', 'Hospital Name'],
    ['doctor', 'Doctor'],
    ['sample_collection_date', 'Sample Collection Date'],
    ['package_code', 'Package Code'],
    ['report_language', 'Report Language'],
    ['report_type', 'Report Type'],
  ];
  for (const [k, label] of need) {
    const v = nipt[k];
    if (v === undefined || v === null || v === '') return `${label} is required`;
  }
  return null;
}

function buildNiptParams(nipt: ReturnType<typeof initNiptSub>) {
  const trim = (s: string) => s.trim() || undefined;
  return {
    previous_order_id:      trim(nipt.previous_order_id),
    patient_name:           nipt.patient_name.trim(),
    patient_birth:          nipt.patient_birth.trim(),
    patient_gender:         nipt.patient_gender.trim(),
    gestational_age_weeks:  nipt.gestational_age_weeks !== '' ? Number(nipt.gestational_age_weeks) : undefined,
    gestational_age_days:   nipt.gestational_age_days !== '' ? Number(nipt.gestational_age_days) : undefined,
    height_cm:              nipt.height_cm.trim() ? parseFloat(nipt.height_cm) : undefined,
    weight_kg:              nipt.weight_kg.trim() ? parseFloat(nipt.weight_kg) : undefined,
    pregnancy_type:         nipt.pregnancy_type.trim(),
    estimated_delivery_date: nipt.estimated_delivery_date.trim(),
    hospital_name:          nipt.hospital_name.trim(),
    doctor:                 nipt.doctor.trim(),
    medical_record_id:      trim(nipt.medical_record_id),
    sample_id:              trim(nipt.sample_id),
    indication_for_testing: trim(nipt.indication_for_testing),
    sample_collection_date: nipt.sample_collection_date.trim(),
    receipt_date:           trim(nipt.receipt_date),
    package_code:           nipt.package_code.trim(),
    report_language:        nipt.report_language.trim(),
    report_type:            nipt.report_type.trim(),
    sample_specimen_type:   nipt.sample_specimen_type || undefined,
    measurement_method:     nipt.measurement_method || undefined,
    sample_barcode:         trim(nipt.sample_barcode),
    category:               nipt.category || undefined,
    nipt_kit_id:            trim(nipt.nipt_kit_id),
    sequencing_batch_id:    trim(nipt.sequencing_batch_id),
    control_sample:         nipt.control_sample || undefined,
    trf_consent:            nipt.trf_consent || undefined,
    show_fetal_gender:      nipt.show_fetal_gender || undefined,
    resample:               nipt.resample || undefined,
  };
}

// ─── Field primitives ──────────────────────────────────────────────────────────

function Field({ label, required, wide, children }: {
  label: string; required?: boolean; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`${styles.field} ${wide ? styles.fieldWide : ''}`}>
      <label className={styles.label}>{label}{required && <span className={styles.req}>*</span>}</label>
      {children}
    </div>
  );
}

function Inp({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} className={styles.input} />
  );
}

function Sel({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={styles.input}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Chk({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className={styles.toggleLabel}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

function Sec({ title, desc, children }: { title?: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      {title && <h4 className={styles.sectionTitle}>{title}</h4>}
      {desc && <p className={styles.sectionDesc}>{desc}</p>}
      <div className={styles.grid}>{children}</div>
    </div>
  );
}

function assignFastqPair(paths: string[]): [string, string] {
  if (paths.length === 0) return ['', ''];
  if (paths.length === 1) return [paths[0], ''];
  const r1 = paths.find((p) => /[_\.-]R1/i.test(p)) ?? paths[0];
  const r2 = paths.find((p) => /[_\.-]R2/i.test(p) && p !== r1) ?? paths.find((p) => p !== r1) ?? '';
  return [r1, r2];
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateOrderModal({ onClose, onCreated }: Props) {
  const [step,    setStep]    = useState<'service' | 'form'>('service');
  const [service, setService] = useState<ServiceCode>('carrier_screening');
  const [panels,  setPanels]  = useState<PanelPackage[]>([]);

  // Common
  const [description, setDescription] = useState('');
  const [workDir,     setWorkDir]     = useState('');
  const [fastqR1,     setFastqR1]     = useState('');
  const [fastqR2,     setFastqR2]     = useState('');
  const [inputBam,    setInputBam]    = useState('');
  const [inputBamCsv, setInputBamCsv] = useState('');

  // Advanced pipeline overrides
  const [backboneBed, setBackboneBed] = useState('');
  const [diseaseBed,  setDiseaseBed]  = useState('');
  const [maxAf,       setMaxAf]       = useState('');
  const [hpoTerms,    setHpoTerms]    = useState('');
  const [geneFilter,  setGeneFilter]  = useState('');

  // File browse modal
  const [browse, setBrowse] = useState<null | 'fastq' | 'bam' | 'bam-csv'>(null);

  // Exome / Carrier / Health top-level params
  const [wesPanel,                  setWesPanel]                  = useState('');
  const [capturePanel,              setCapturePanel]              = useState('twist-exome2');
  const [includeApoePgx,            setIncludeApoePgx]            = useState(false);
  const [panelFilterAfterAnalysis,  setPanelFilterAfterAnalysis]  = useState(true);
  const [interpretationGenesExtra,  setInterpretationGenesExtra]  = useState('');

  // Carrier sub-params
  const [carrier, setCarrier] = useState(initCarrierSub('carrier_screening'));
  // NIPT sub-params
  const [nipt, setNipt] = useState(initNiptSub());

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    catalogApi.getPanels().then((r) => {
      const all = r.panels ?? [];
      setPanels(all);
      // Default to first exome-compatible panel
      const exomePanels = all.filter((p) => !p.category || ['carrier_screening','whole_exome','health_screening','proactive_health'].includes(p.category));
      if (exomePanels.length > 0 && !wesPanel) setWesPanel(exomePanels[0].id);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When service changes, reset relevant defaults
  useEffect(() => {
    if (service === 'sgnipt') setNipt(initNiptSub());
    else setCarrier(initCarrierSub(service));
  }, [service]);

  // Group panels by category for optgroup display
  const CATEGORY_LABELS: Record<string, string> = {
    carrier_screening: 'Carrier screening',
    proactive_health:  'Proactive health',
    pgx:               'Pharmacogenomics (PGx)',
    other:             'Other',
  };
  const panelsByCategory = panels.reduce<Record<string, PanelPackage[]>>((acc, p) => {
    const cat = p.category ?? 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const setC = useCallback((k: string, v: unknown) => setCarrier((c) => ({ ...c, [k]: v })), []);
  const setN = useCallback((k: string, v: unknown) => setNipt((n)    => ({ ...n, [k]: v })), []);

  const handleSubmit = async () => {
    if (service !== 'sgnipt' && !wesPanel) { setError('Primary (interpretation) panel is required.'); return; }
    if (service === 'sgnipt') {
      const vErr = validateNiptClinical(nipt);
      if (vErr) { setError(vErr); return; }
    }
    setSaving(true); setError('');

    try {
      let params: Record<string, unknown> = {};

      if (service === 'carrier_screening' || service === 'whole_exome' || service === 'health_screening') {
        const carrierSub = {
          ...carrier,
          package_code:  PACKAGE_CODE[service],
          wes_panel_id:  wesPanel,
          capture_panel_id: capturePanel,
        };
        params = {
          wes_panel_id:                wesPanel,
          input_bam:                   inputBam.trim() || undefined,
          input_bam_csv:               inputBamCsv.trim() || undefined,
          backbone_bed:                backboneBed.trim() || undefined,
          disease_bed:                 diseaseBed.trim() || undefined,
          max_af:                      maxAf.trim() ? parseFloat(maxAf) : undefined,
          hpo_terms:                   hpoTerms.trim() || undefined,
          gene_filter:                 geneFilter.trim() || undefined,
          panel_filter_after_analysis: panelFilterAfterAnalysis,
          include_apoe_pgx:            includeApoePgx,
          interpretation_genes_extra:  interpretationGenesExtra.trim() || undefined,
          carrier:                     carrierSub,
        };
      } else if (service === 'sgnipt') {
        params = {
          input_bam_csv: inputBamCsv.trim() || undefined,
          nipt: buildNiptParams(nipt),
        };
      }

      await ordersApi.create(service, {
        description: description.trim() || undefined,
        work_dir: workDir.trim() || undefined,
        fastq_r1_path: fastqR1.trim() || undefined,
        fastq_r2_path: fastqR2.trim() || undefined,
        params,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create order');
    } finally { setSaving(false); }
  };

  const isExome = service !== 'sgnipt';
  const formTitle = service === 'sgnipt'
    ? 'Create Single-gene NIPT Order'
    : `New ${SERVICES.find((s) => s.code === service)?.label} Order`;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {step === 'service' ? 'Create an Order' : formTitle}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          {/* ── Step 1: Service selection ── */}
          {step === 'service' && (
            <div>
              <p className={styles.hint}>Select the service type:</p>
              <div className={styles.serviceGrid}>
                {SERVICES.map((s) => (
                  <button key={s.code} type="button"
                    className={`${styles.serviceCard} ${service === s.code ? styles.serviceCardActive : ''}`}
                    onClick={() => setService(s.code)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Form ── */}
          {step === 'form' && (
            <div className={styles.formBody}>
              {!isExome && (
                <p className={styles.sectionDesc} style={{ marginTop: 0 }}>
                  Clinical fields → <code>params.nipt</code>. <strong>Save order</strong> stores a draft;
                  queue from the list <strong>⋯ → Submit</strong>.
                </p>
              )}

              {/* ── Order / Sample ── */}
              <Sec title={isExome ? 'Order / Sample' : undefined}>
                <Field label="Order ID" wide>
                  <p className={styles.sectionDesc} style={{ margin: 0 }}>
                    Assigned automatically on save
                    {isExome ? ' (e.g. CSGX26070001).' : ' (e.g. SNGX26070001).'}
                  </p>
                </Field>
                <Field label="Description" wide>
                  <Inp value={description} onChange={setDescription}
                    placeholder="Optional — lab reference, prior ID, internal note" />
                </Field>
                <Field label="Work Directory">
                  <Inp value={workDir} onChange={setWorkDir}
                    placeholder={isExome ? 'e.g. 2603 (auto if empty)' : 'YYMM, auto if empty'} />
                </Field>
              </Sec>

              {/* ── Pipeline (exome only) ── */}
              {isExome && (
                <Sec title="Pipeline Options">
                  <Field label="Primary (interpretation)" required>
                    <select
                      value={wesPanel}
                      onChange={(v) => { setWesPanel(v.target.value); setC('wes_panel_id', v.target.value); }}
                      className={styles.input}
                    >
                      <option value="">— Select interpretation panel (required) —</option>
                      {Object.entries(panelsByCategory).map(([cat, ps]) => (
                        <optgroup key={cat} label={CATEGORY_LABELS[cat] ?? cat}>
                          {ps.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label ?? p.id}{p.gene_count ? ` (~${p.gene_count} genes)` : ''}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Field>
                  <Field label="Extra interpretation genes" wide>
                    <Inp value={interpretationGenesExtra} onChange={setInterpretationGenesExtra}
                      placeholder="Comma-separated gene symbols (optional)" />
                  </Field>
                  <Field label="Flags">
                    <div className={styles.flagsGroup}>
                      <Chk value={carrier.include_pgx} onChange={(v) => setC('include_pgx', v)} label="Include PGx" />
                      {service === 'health_screening' && (
                        <Chk value={includeApoePgx} onChange={setIncludeApoePgx} label="Include APOE PGx" />
                      )}
                      <Chk value={panelFilterAfterAnalysis} onChange={setPanelFilterAfterAnalysis} label="Panel filter after analysis" />
                      <Chk value={carrier.reuse_prior_pipeline_outputs}
                        onChange={(v) => setC('reuse_prior_pipeline_outputs', v)} label="Reuse prior pipeline outputs" />
                    </div>
                  </Field>
                </Sec>
              )}

              {/* ── Carrier / Exome clinical sections ── */}
              {isExome && (
              <>
              <Sec title="Patient Information">
                <Field label="Patient name">
                  <Inp value={carrier.patient_name} onChange={(v) => setC('patient_name', v)} placeholder="Full name" />
                </Field>
                <Field label="Date of birth">
                  <Inp type="date" value={carrier.patient_birth} onChange={(v) => setC('patient_birth', v)} />
                </Field>
                <Field label="Gender">
                  <Sel value={carrier.patient_gender} onChange={(v) => setC('patient_gender', v)}
                    options={GENDERS.map((g) => ({ value: g, label: g }))} />
                </Field>
                <Field label="Hospital name">
                  <Inp value={carrier.hospital_name} onChange={(v) => setC('hospital_name', v)}
                    placeholder="Hospital / Institution" />
                </Field>
                <Field label="Doctor">
                  <Inp value={carrier.doctor} onChange={(v) => setC('doctor', v)} placeholder="Ordering physician" />
                </Field>
                <Field label="Affected">
                  <Sel value={carrier.affected} onChange={(v) => setC('affected', v)}
                    options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                </Field>
                <Field label="Sample collection date">
                  <Inp type="date" value={carrier.sample_collection_date}
                    onChange={(v) => setC('sample_collection_date', v)} />
                </Field>
                <Field label="Specimen type">
                  <Sel value={carrier.sample_specimen_type} onChange={(v) => setC('sample_specimen_type', v)}
                    options={SPECIMEN_TYPES.map((t) => ({ value: t, label: t }))} />
                </Field>
              </Sec>

              <Sec title="Report Options">
                <Field label="Report language">
                  <Sel value={carrier.report_language} onChange={(v) => setC('report_language', v)}
                    options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
                </Field>
                <Field label="Report type">
                  <Sel value={carrier.report_type} onChange={(v) => setC('report_type', v)}
                    options={REPORT_TYPES.map((t) => ({ value: t, label: t }))} />
                </Field>
                <Field label="Couples carrier report">
                  <Sel value={carrier.report_mode} onChange={(v) => setC('report_mode', v)}
                    options={CARRIER_REPORT_MODES} />
                </Field>
              </Sec>
              </>
              )}

              {/* ── Single-gene NIPT clinical sections ── */}
              {!isExome && (
              <>
              <Sec title="Patient and Pregnancy Information">
                <Field label="Previous Order" wide>
                  <Inp value={nipt.previous_order_id} onChange={(v) => setN('previous_order_id', v)}
                    placeholder="Optional — link to prior order ID" />
                </Field>
                <Field label="Patient Name" required>
                  <Inp value={nipt.patient_name} onChange={(v) => setN('patient_name', v)} />
                </Field>
                <Field label="Patient Birth" required>
                  <Inp type="date" value={nipt.patient_birth} onChange={(v) => setN('patient_birth', v)} />
                </Field>
                <Field label="Patient Gender" required>
                  <Sel value={nipt.patient_gender} onChange={(v) => setN('patient_gender', v)}
                    placeholder="Select…"
                    options={NIPT_GENDERS.map((g) => ({ value: g, label: g }))} />
                </Field>
                <Field label="GA Weeks" required>
                  <Inp type="number" value={String(nipt.gestational_age_weeks)}
                    onChange={(v) => setN('gestational_age_weeks', v === '' ? '' : parseInt(v, 10))} />
                </Field>
                <Field label="GA Days" required>
                  <Inp type="number" value={String(nipt.gestational_age_days)}
                    onChange={(v) => setN('gestational_age_days', v === '' ? '' : parseInt(v, 10))} />
                </Field>
                <Field label="Height (cm)">
                  <Inp type="number" value={nipt.height_cm} onChange={(v) => setN('height_cm', v)} />
                </Field>
                <Field label="Weight (kg)">
                  <Inp type="number" value={nipt.weight_kg} onChange={(v) => setN('weight_kg', v)} />
                </Field>
                <Field label="Pregnancy Type" required>
                  <Sel value={nipt.pregnancy_type} onChange={(v) => setN('pregnancy_type', v)}
                    placeholder="Select…"
                    options={NIPT_PREGNANCY_TYPES.map((t) => ({ value: t, label: t }))} />
                </Field>
                <Field label="Estimated Delivery Date (EDD)" required>
                  <Inp type="date" value={nipt.estimated_delivery_date}
                    onChange={(v) => setN('estimated_delivery_date', v)} />
                </Field>
              </Sec>

              <Sec title="Hospital and Identifier Information">
                <Field label="Hospital Name" required>
                  <Inp value={nipt.hospital_name} onChange={(v) => setN('hospital_name', v)} />
                </Field>
                <Field label="Doctor" required>
                  <Inp value={nipt.doctor} onChange={(v) => setN('doctor', v)} />
                </Field>
                <Field label="Medical Record ID">
                  <Inp value={nipt.medical_record_id} onChange={(v) => setN('medical_record_id', v)} />
                </Field>
                <Field label="Sample ID">
                  <Inp value={nipt.sample_id} onChange={(v) => setN('sample_id', v)} placeholder="Lab sample ID" />
                </Field>
                <Field label="Indication for Testing" wide>
                  <Sel value={nipt.indication_for_testing} onChange={(v) => setN('indication_for_testing', v)}
                    placeholder="Select…" options={NIPT_INDICATIONS} />
                </Field>
              </Sec>

              <Sec title="Sample and Test Details">
                <Field label="Sample Collection Date" required>
                  <Inp type="date" value={nipt.sample_collection_date}
                    onChange={(v) => setN('sample_collection_date', v)} />
                </Field>
                <Field label="Receipt Date">
                  <Inp type="date" value={nipt.receipt_date} onChange={(v) => setN('receipt_date', v)} />
                </Field>
                <Field label="Package Code" required>
                  <Sel value={nipt.package_code} onChange={(v) => setN('package_code', v)}
                    placeholder="Select…" options={NIPT_PACKAGES} />
                </Field>
                <Field label="Report Language" required>
                  <Sel value={nipt.report_language} onChange={(v) => setN('report_language', v)}
                    placeholder="Select…" options={NIPT_LANGUAGES} />
                </Field>
                <Field label="Report Type" required>
                  <Sel value={nipt.report_type} onChange={(v) => setN('report_type', v)}
                    placeholder="Select…" options={NIPT_REPORT_TYPES} />
                </Field>
                <Field label="Sample Specimen Type">
                  <Sel value={nipt.sample_specimen_type} onChange={(v) => setN('sample_specimen_type', v)}
                    options={NIPT_SPECIMEN_TYPES.map((t) => ({ value: t, label: t }))} />
                </Field>
                <Field label="Measurement Method">
                  <Sel value={nipt.measurement_method} onChange={(v) => setN('measurement_method', v)}
                    options={NIPT_MEAS_METHODS} />
                </Field>
                <Field label="Sample Barcode">
                  <Inp value={nipt.sample_barcode} onChange={(v) => setN('sample_barcode', v)} />
                </Field>
                <Field label="Category">
                  <Sel value={nipt.category} onChange={(v) => setN('category', v)}
                    options={[{ value: 'Domestic', label: 'Domestic' }, { value: 'Overseas', label: 'Overseas' }]} />
                </Field>
                <Field label="NIPT Kit ID">
                  <Inp value={nipt.nipt_kit_id} onChange={(v) => setN('nipt_kit_id', v)} />
                </Field>
                <Field label="Sequencing Batch ID">
                  <Inp value={nipt.sequencing_batch_id} onChange={(v) => setN('sequencing_batch_id', v)} />
                </Field>
                <Field label="Control Sample" required>
                  <Sel value={nipt.control_sample} onChange={(v) => setN('control_sample', v)}
                    options={[{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }]} />
                </Field>
                <Field label="TRF Consent" required>
                  <Sel value={nipt.trf_consent} onChange={(v) => setN('trf_consent', v)}
                    options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                </Field>
                <Field label="Show Fetal Gender" required>
                  <Sel value={nipt.show_fetal_gender} onChange={(v) => setN('show_fetal_gender', v)}
                    options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                </Field>
                <Field label="Resample" required>
                  <Sel value={nipt.resample} onChange={(v) => setN('resample', v)}
                    options={[{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }]} />
                </Field>
              </Sec>
              </>
              )}

              {/* ── FASTQ ── */}
              <Sec title="FASTQ (server local paths)"
                desc={isExome
                  ? 'Use Browse FASTQ (R1+R2)… on the daemon server to pick two files (R1 + R2). Paths are editable below. Roots depend on service (SGNIPT_FASTQ_DIR / CARRIER_SCREENING_FASTQ_DIR in daemon .env).'
                  : 'Use Browse FASTQ (R1+R2)… on the daemon server to pick two files (Ctrl+click up to two, or click one then Shift+click another if only those two lie in range). Paths still editable below. Roots: Single-gene NIPT / Carrier Screening (see SGNIPT_FASTQ_DIR / CARRIER_SCREENING_FASTQ_DIR in daemon .env).'}>
                <div className={styles.fieldWide}>
                  <Button size="sm" variant="ghost" onClick={() => setBrowse('fastq')}>
                    Browse FASTQ (R1+R2)…
                  </Button>
                </div>
                <Field label="R1 FASTQ">
                  <Inp value={fastqR1} onChange={setFastqR1} placeholder="From browse or paste absolute path" />
                </Field>
                <Field label="R2 FASTQ">
                  <Inp value={fastqR2} onChange={setFastqR2} placeholder="From browse or paste absolute path" />
                </Field>
              </Sec>

              {/* ── BAM Direct Input (carrier flow only) ── */}
              {isExome && (
                <Sec title="BAM Direct Input (optional — skips alignment)"
                  desc="Pre-aligned, sorted, duplicate-marked BAM (--input-bam mode). FASTQ → alignment → MarkDup steps are skipped. When specified, FASTQ fields are ignored.">
                  <div className={styles.fieldWide}>
                    <div className={styles.inlineRow}>
                      <Button size="sm" variant="ghost" onClick={() => setBrowse('bam')}>Browse BAM…</Button>
                      <Inp value={inputBam} onChange={setInputBam}
                        placeholder="e.g. /data/gx-exome/data/test/sim_bam/carrier_spiked_NA12878.bam" />
                      {inputBam && (
                        <Button size="sm" variant="ghost" onClick={() => setInputBam('')}>Clear</Button>
                      )}
                    </div>
                  </div>
                </Sec>
              )}

              {/* ── BAM Simulation ── */}
              <Sec title="BAM Simulation (optional)"
                desc={isExome
                  ? 'BAM samplesheet CSV starts the pipeline from BAM instead of FASTQ. CSV format: sample_id,bam,bai. If not specified, the pipeline runs in FASTQ mode.'
                  : 'Specifying a BAM samplesheet CSV starts the pipeline from BAM instead of FASTQ (--input-bam mode). CSV format: sample_id,bam,bai — paths must be container-internal paths (/Work/SgNIPT/data/…) and files must reside under the data root (SGNIPT_WORK_ROOT/data/). If not specified, the pipeline runs in FASTQ mode.'}>
                <div className={styles.fieldWide}>
                  <div className={styles.inlineRow}>
                    <Button size="sm" variant="ghost" onClick={() => setBrowse('bam-csv')}>Browse BAM CSV…</Button>
                    <Inp value={inputBamCsv} onChange={setInputBamCsv} placeholder="Select or enter absolute path" />
                    {inputBamCsv && (
                      <Button size="sm" variant="ghost" onClick={() => setInputBamCsv('')}>Clear</Button>
                    )}
                  </div>
                </div>
              </Sec>

              {/* ── Capture Panel (carrier flow only) ── */}
              {isExome && (
                <Sec title="Capture Panel"
                  desc="Sequencing capture panel passed to run_analysis.sh --panel. Determines the target BED used for alignment and variant calling.">
                  <Field label="Capture panel">
                    <Sel value={capturePanel} onChange={(v) => { setCapturePanel(v); setC('capture_panel_id', v); }}
                      options={CAPTURE_PANELS} />
                  </Field>
                </Sec>
              )}

              {/* ── Advanced pipeline overrides (carrier flow only) ── */}
              {isExome && (
                <Sec title="Advanced pipeline overrides"
                  desc="Optional paths and filters for the analysis pipeline. Leave blank to use server defaults and the panel selected above.">
                  <Field label="Backbone BED">
                    <Inp value={backboneBed} onChange={setBackboneBed} placeholder="Path to backbone.bed" />
                  </Field>
                  <Field label="Disease BED">
                    <Inp value={diseaseBed} onChange={setDiseaseBed} placeholder="Path to disease.bed" />
                  </Field>
                  <Field label="Max AF Filter">
                    <Inp type="number" value={maxAf} onChange={setMaxAf} placeholder="e.g. 0.05" />
                  </Field>
                  <Field label="HPO Terms" wide>
                    <Inp value={hpoTerms} onChange={setHpoTerms} placeholder="e.g. HP:0001250,HP:0001263" />
                  </Field>
                  <Field label="Gene Filter" wide>
                    <Inp value={geneFilter} onChange={setGeneFilter} placeholder="e.g. CFTR,SMN1,GJB2" />
                  </Field>
                </Sec>
              )}

            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          {step === 'service' ? (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => setStep('form')}>
                Next — {SERVICES.find((s) => s.code === service)?.label}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setStep('service')}>← Back</Button>
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button variant="primary" size="sm" loading={saving} onClick={handleSubmit}>
                Save order
              </Button>
            </>
          )}
        </div>
      </div>

      {browse === 'fastq' && (
        <FileBrowseModal
          mode="fastq-pair"
          title="Browse FASTQ (R1 + R2)"
          serviceCode={service}
          onClose={() => setBrowse(null)}
          onSelect={(paths) => {
            const [r1, r2] = assignFastqPair(paths);
            setFastqR1(r1);
            setFastqR2(r2);
          }}
        />
      )}
      {browse === 'bam' && (
        <FileBrowseModal
          mode="file"
          title="Browse BAM file"
          serviceCode={service}
          fileExt="bam"
          onClose={() => setBrowse(null)}
          onSelect={(paths) => setInputBam(paths[0] ?? '')}
        />
      )}
      {browse === 'bam-csv' && (
        <FileBrowseModal
          mode="file"
          title="Browse BAM CSV samplesheet"
          serviceCode={service}
          fileExt="csv"
          onClose={() => setBrowse(null)}
          onSelect={(paths) => setInputBamCsv(paths[0] ?? '')}
        />
      )}
    </div>
  );
}
