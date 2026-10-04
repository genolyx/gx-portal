import { createHash } from 'crypto';
import { existsSync } from 'fs';
import type {
  DarkGenes,
  GvcEvidence,
  InterpretationServiceName,
  InterpretationServiceSources,
  PgxResult,
  ReviewData,
  Variant,
} from '@gx-portal/types';

export const INTERPRETATION_SERVICES = ['carrier_screening', 'whole_exome', 'hereditary_cancer', 'health_screening'] as const;

/** Inside the production container, localhost is the container. GVC stays on the host. */
export function partnerUrlForRuntime(url: string, inDocker = existsSync('/.dockerenv')): string {
  const trimmed = url.trim().replace(/\/$/, '');
  if (!trimmed || !inDocker) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      parsed.hostname = 'host.docker.internal';
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

export type InterpretationSource = 'pipeline' | 'gvc';

export interface GvcVariantSummary {
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  gene?: string;
  hgvsc?: string | null;
  transcript?: string | null;
  zygosity?: string | null;
  acmgClassification: string | null;
  acmgCriteria: string[];
  heldReason: string | null;
}

export function classificationProgressMessage(job: {
  status?: string;
  counts?: { kept: number; held: number };
  classification?: { queued: number; running: number; succeeded: number; failed: number };
}): string {
  const progress = job.classification;
  const total = progress
    ? progress.queued + progress.running + progress.succeeded + progress.failed
    : 0;
  if (progress && progress.queued > 0 && progress.running === 0) {
    return `Classification is queued. ${progress.succeeded} of ${total} classified, ${progress.queued} waiting.`;
  }
  if (progress && progress.running > 0) {
    return `Classification in progress. ${progress.succeeded} of ${total} classified, ${progress.running} running.`;
  }
  if (job.status === 'queued') return 'Classification is queued.';
  const listed = (job.counts?.kept ?? 0) + (job.counts?.held ?? 0);
  if (listed === 0) return 'Reading the annotated VCF.';
  return 'Classification is still running.';
}

/** Local workers finish before the review is returned, so the opened page already has labels. */
export async function waitForPartnerJob<T extends { status: string }>(
  current: T,
  read: () => Promise<T>,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
  },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const intervalMs = options?.intervalMs ?? 500;
  const sleep = options?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options?.now ?? Date.now;
  const deadline = now() + timeoutMs;
  let job = current;
  while (job.status === 'queued' || job.status === 'running') {
    if (now() >= deadline) return job;
    await sleep(intervalMs);
    job = await read();
  }
  return job;
}

export function gvcHeldLabel(reason: string): string {
  if (reason === 'vus') return 'ClinVar VUS';
  if (reason === 'benign') return 'Homozygous benign';
  if (reason === 'lab') return 'Major-lab benign';
  return reason;
}

export function configuredInterpretationSource(raw: string | undefined): InterpretationSource {
  return raw?.trim().toLowerCase() === 'gvc' ? 'gvc' : 'pipeline';
}

/** A saved Config value wins. An empty value uses INTERPRETATION_SOURCE, which defaults to the portal. */
export function resolveInterpretationSource(
  stored: string | null | undefined,
  envValue: string | undefined,
): InterpretationSource {
  if (stored?.trim()) return configuredInterpretationSource(stored);
  return configuredInterpretationSource(envValue);
}

export function variantLocusKey(input: {
  chrom?: string;
  pos?: number;
  ref?: string;
  alt?: string;
}): string {
  const chrom = String(input.chrom ?? '').replace(/^chr/i, '');
  return `${chrom}:${input.pos}:${String(input.ref ?? '').toUpperCase()}:${String(input.alt ?? '').toUpperCase()}`;
}

function text(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function orderParams(review: ReviewData): Record<string, unknown> {
  const params = review.order_params;
  if (!params || typeof params !== 'object') return {};
  const carrier = params.carrier;
  if (carrier && typeof carrier === 'object') return { ...params, ...carrier };
  return params;
}

function geneList(review: ReviewData, params: Record<string, unknown>): string {
  if (Array.isArray(review.interpretation_genes) && review.interpretation_genes.length) {
    return review.interpretation_genes.join(',');
  }
  const summary = review.filter_summary;
  if (summary && Array.isArray(summary.genes)) return summary.genes.map(String).join(',');
  return text(params.gene_filter);
}

function flag(value: unknown, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const textValue = String(value).trim().toLowerCase();
  if (textValue === '1' || textValue === 'true' || textValue === 'yes' || textValue === 'on') return true;
  if (textValue === '0' || textValue === 'false' || textValue === 'no' || textValue === 'off') return false;
  return fallback;
}

function genesWithApoe(genes: string, includeApoe: boolean): string {
  if (!includeApoe) return genes;
  const list = genes.split(',').map((gene) => gene.trim()).filter(Boolean);
  if (list.some((gene) => gene.toUpperCase() === 'APOE')) return list.join(',');
  return [...list, 'APOE'].join(',');
}

function maxAf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** A blank order field is omitted. GVC then skips that quality limit. */
function qualityLimit(value: unknown, whole: boolean): number | null {
  const parsed = maxAf(value);
  if (parsed == null || parsed < 0) return null;
  if (whole && !Number.isInteger(parsed)) return null;
  return parsed;
}

function referenceBuild(review: ReviewData): 'GRCh37' | 'GRCh38' {
  const summary = review.filter_summary ?? {};
  const raw = `${text(summary.reference_build)} ${text(summary.genome)}`.toUpperCase();
  return raw.includes('37') ? 'GRCh37' : 'GRCh38';
}

const SERVICE_ALIASES: Record<string, string> = {
  carrier: 'carrier_screening',
  carrier_couples: 'carrier_screening',
  carrier_screening: 'carrier_screening',
  wes_panel: 'whole_exome',
  whole_exome: 'whole_exome',
  health_snp: 'health_screening',
  health_screening: 'health_screening',
  sgnipt: 'sgnipt',
};

/** Product key for a per-service source. sgNIPT and PGx-only panels stay off this list. */
export function interpretationServiceKey(review: ReviewData): InterpretationServiceName | null {
  const params = orderParams(review);
  const service = SERVICE_ALIASES[text(review.service_code || review._service_code).toLowerCase()] ?? '';
  const panel = text(review.filter_summary?.panel_category || review.filter_summary?.category).toLowerCase();
  const packageCode = text(params.package_code);
  const program = text(params.other_test_type) || packageCode;
  if (service === 'sgnipt' || panel === 'pgx') return null;
  if (panel === 'proactive_health' || panel === 'health_screening') return 'health_screening';
  if (panel === 'carrier_screening') return 'carrier_screening';
  if (panel === 'hereditary_cancer' || program === 'HereditaryCancer' || packageCode === 'HereditaryCancer') {
    return 'hereditary_cancer';
  }
  if (
    panel === 'whole_exome'
    || service === 'whole_exome'
    || packageCode === 'WholeExome'
    || program === 'WGS'
    || program.startsWith('Exome')
  ) {
    return 'whole_exome';
  }
  if (
    service === 'health_screening'
    || packageCode === 'HealthScreening'
    || packageCode === 'Proactive'
    || program === 'Proactive'
  ) {
    return 'health_screening';
  }
  if (
    service === 'carrier_screening'
    || packageCode === 'CarrierScreening'
    || packageCode === 'CouplesCarrier'
    || program === 'CouplesCarrier'
  ) {
    return 'carrier_screening';
  }
  return null;
}

export function parseServiceSources(raw: string | null | undefined): InterpretationServiceSources {
  if (!raw?.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object') return {};
  const sources: InterpretationServiceSources = {};
  for (const service of INTERPRETATION_SERVICES) {
    const value = (parsed as Record<string, unknown>)[service];
    if (value === 'pipeline' || value === 'gvc') sources[service] = value;
  }
  return sources;
}

/** A saved service choice wins. Otherwise the global source applies. Other products stay on the portal. */
export function sourceForService(
  globalSource: InterpretationSource,
  services: InterpretationServiceSources,
  service: InterpretationServiceName | null,
): InterpretationSource {
  if (!service) return 'pipeline';
  const chosen = services[service];
  if (chosen === 'pipeline' || chosen === 'gvc') return chosen;
  return globalSource;
}

function acmgKey(label: string): string {
  return label.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Compare pipeline ACMG labels with GVC labels on the same locus. Held rows are not a mismatch. */
export function classificationParity(
  variants: Variant[],
  summaries: GvcVariantSummary[],
): {
  agreed: boolean;
  comparable: number;
  matched: number;
  mismatched: number;
  held: number;
  examples: Array<{ locus: string; pipeline: string; gvc: string }>;
} {
  const byLocus = new Map(summaries.map((summary) => [variantLocusKey(summary), summary]));
  let comparable = 0;
  let matched = 0;
  let mismatched = 0;
  let held = 0;
  const examples: Array<{ locus: string; pipeline: string; gvc: string }> = [];
  for (const variant of variants) {
    const summary = byLocus.get(variantLocusKey(variant));
    if (!summary) continue;
    if (summary.heldReason) {
      held += 1;
      continue;
    }
    const pipeline = String(variant.acmg_classification ?? '').trim();
    const gvc = String(summary.acmgClassification ?? '').trim();
    if (!pipeline || !gvc) continue;
    comparable += 1;
    if (acmgKey(pipeline) === acmgKey(gvc)) {
      matched += 1;
    } else {
      mismatched += 1;
      if (examples.length < 5) {
        examples.push({ locus: variantLocusKey(variant), pipeline, gvc });
      }
    }
  }
  return { agreed: comparable > 0 && mismatched === 0, comparable, matched, mismatched, held, examples };
}

export function partnerJobRequest(orderId: string, review: ReviewData, vcf: { sha256: string; uri: string }) {
  const params = orderParams(review);
  const genes = geneList(review, params);
  const hpo = text(params.hpo_terms);
  const fullWes = text(params.wes_panel_id) === 'full_wes';
  if (!genes.trim() && !hpo && !fullWes) {
    return { ok: false as const, reason: 'gene_scope_required' };
  }
  const panelCategory = text(review.filter_summary?.panel_category || review.filter_summary?.category);
  const includePgx = flag(params.include_pgx, true);
  const includeApoePgx = flag(params.include_apoe_pgx, false);
  const panelCode = gvcPanelCodeForReview(review);
  const frequencyTrack = gvcFrequencyTrackForReview(review);
  return {
    ok: true as const,
    body: {
      contractVersion: '1' as const,
      externalOrderId: orderId,
      serviceCode: text(review.service_code || review._service_code),
      ...(panelCategory ? { panelCategory } : {}),
      ...(text(params.package_code) ? { packageCode: text(params.package_code) } : {}),
      ...(text(params.other_test_type) ? { otherTestType: text(params.other_test_type) } : {}),
      ...(text(params.wes_panel_id) ? { wesPanelId: text(params.wes_panel_id) } : {}),
      ...(panelCode ? { panelCode } : {}),
      ...(frequencyTrack ? { frequencyTrack } : {}),
      referenceBuild: referenceBuild(review),
      vcf,
      genes: genesWithApoe(genes, includeApoePgx),
      hpo,
      maxAf: maxAf(params.max_af),
      ...(qualityLimit(params.min_qual, false) != null
        ? { minQual: qualityLimit(params.min_qual, false) }
        : {}),
      ...(qualityLimit(params.min_gq, true) != null
        ? { minGenotypeQuality: qualityLimit(params.min_gq, true) }
        : {}),
      ...(qualityLimit(params.min_depth, true) != null
        ? { minDepth: qualityLimit(params.min_depth, true) }
        : {}),
      ...(flag(params.pass_only, true) ? {} : { passOnly: false }),
      includePgx,
      includeApoePgx,
    },
  };
}

function isApoe(gene: unknown): boolean {
  return String(gene ?? '').trim().toUpperCase() === 'APOE';
}

/** GVC decides whether the pipeline PGx table stays on this order. */
export function applyGvcPgx(
  pgx: PgxResult | undefined,
  flags: { includePgx?: boolean; includeApoePgx?: boolean },
): { pgx: PgxResult | undefined; note: string | null } {
  if (!pgx || flags.includePgx == null) return { pgx, note: null };
  if (!flags.includePgx) {
    return {
      pgx: {
        ...pgx,
        gene_results: [],
        custom_gene_results: [],
        all_pharmcat_genes: [],
        drug_recommendations: [],
        apoe_diplotype_for_report: undefined,
        apoe_phasing: undefined,
        gvc_scope: 'excluded',
        message: 'PGx is not included for this order.',
      },
      note: 'PGx left out by GVC',
    };
  }
  if (flags.includeApoePgx !== false) {
    return { pgx: { ...pgx, gvc_scope: 'included' }, note: 'PGx included by GVC' };
  }
  const portal = { ...(pgx.portal_review ?? {}) };
  if (portal.include_apoe_proactive_pdf == null || portal.include_apoe_proactive_pdf === '') {
    portal.include_apoe_proactive_pdf = false;
  }
  return {
    pgx: {
      ...pgx,
      gene_results: (pgx.gene_results ?? []).filter((row) => !isApoe(row.gene)),
      custom_gene_results: (pgx.custom_gene_results ?? []).filter((row) => !isApoe(row.gene)),
      all_pharmcat_genes: (pgx.all_pharmcat_genes ?? []).filter((row) => !isApoe(row.gene)),
      apoe_diplotype_for_report: undefined,
      apoe_phasing: undefined,
      portal_review: portal,
      gvc_scope: 'apoe_excluded',
    },
    note: 'APOE PGx left out by GVC',
  };
}

export interface GvcDarkGenes {
  status: 'ready' | 'absent' | 'deferred';
  detailed_sections: Array<{ title: string; body: string; kind: string }>;
  cftr_ivs9_eh?: Record<string, unknown> | null;
}

/** Replace pipeline dark-gene sections with GVC sections. Reviewer approvals stay put. */
export function applyGvcDarkGenes(
  existing: DarkGenes | undefined,
  block: GvcDarkGenes,
): DarkGenes | undefined {
  if (block.status !== 'ready' || block.detailed_sections.length === 0) return existing;
  return {
    ...(existing ?? {}),
    detailed_sections: block.detailed_sections,
    cftr_ivs9_eh: block.cftr_ivs9_eh ?? existing?.cftr_ivs9_eh,
    section_reviews: existing?.section_reviews,
  };
}

export function partnerVariantKey(
  referenceBuild: string,
  variant: { chrom?: string; pos?: number; ref?: string; alt?: string },
): string {
  const chrom = String(variant.chrom ?? '').replace(/^chr/i, '');
  return `${referenceBuild}:${chrom}:${variant.pos}:${String(variant.ref ?? '').toUpperCase()}:${String(variant.alt ?? '').toUpperCase()}`;
}

function plainText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}

function pmidList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter((item) => /^\d+$/.test(item));
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

/** Project criterion rationale and literature out of a CurationDocument. Engine HTML is flattened to text. */
export function curationEvidence(document: unknown, locus: { chrom?: string; pos?: number; ref?: string; alt?: string }): GvcEvidence {
  const empty = (reason: GvcEvidence['reason']): GvcEvidence => ({ available: false, reason, criteria: [], pmids: [] });
  const doc = record(document);
  const variant = record(doc?.variant);
  const acmg = record(doc?.acmg);
  if (!doc || doc.contractVersion !== '1.0' || !variant || !acmg) return empty('unavailable');
  const documentLocus = variantLocusKey({
    chrom: String(variant.chromosome ?? ''),
    pos: typeof variant.start === 'number' ? variant.start : undefined,
    ref: String(variant.referenceAllele ?? ''),
    alt: String(variant.alternateAllele ?? ''),
  });
  if (documentLocus !== variantLocusKey(locus)) return empty('mismatch');

  const criteria = Array.isArray(acmg.criteria)
    ? acmg.criteria.flatMap((item) => {
        const row = record(item);
        if (!row || typeof row.code !== 'string' || typeof row.rationale !== 'string') return [];
        return [{
          code: row.code,
          strength: String(row.strength ?? ''),
          direction: String(row.direction ?? ''),
          rationale: plainText(row.rationale),
        }];
      })
    : [];
  const classification = record(acmg.classification);
  const scores = record(doc.scores);
  const highlights = record(doc.highlights);
  const engine = record(doc.engine);
  const literature = record(engine?.literature);
  const parsedData = record(engine?.parsedData);
  const index = record(literature?.local_index);
  const pmids = [...new Set([
    ...pmidList(index?.pmids),
    ...pmidList(parsedData?.hgmd_excel_pmids),
  ])];
  const clinicalSummary = plainText(literature?.clinical_summary);
  const functionalSummary = plainText(literature?.functional_summary);
  return {
    available: true,
    classification: typeof classification?.label === 'string' ? classification.label : null,
    criteria,
    gnomadAf: typeof scores?.gnomadAf === 'number' ? scores.gnomadAf : null,
    caddPhred: typeof scores?.caddPhred === 'number' ? scores.caddPhred : null,
    revelScore: typeof scores?.revelScore === 'number' ? scores.revelScore : null,
    clinvarSignificance: typeof highlights?.clinvarSignificance === 'string' ? highlights.clinvarSignificance : null,
    hgmdMatch: typeof highlights?.hgmdMatch === 'string' ? highlights.hgmdMatch : null,
    literatureStatus: typeof literature?.status === 'string' ? literature.status : typeof highlights?.literatureStatus === 'string' ? highlights.literatureStatus : null,
    literatureError: typeof literature?.error === 'string' ? plainText(literature.error) : null,
    pmids,
    ...(clinicalSummary ? { clinicalSummary } : {}),
    ...(functionalSummary ? { functionalSummary } : {}),
  };
}

export function sha256Hex(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

/** GVC saved panel applied to Whole Exome (vcf only) orders. */
export const FULL_WES_GVC_PANEL_CODE = 'carrier-2000';

export function isFullWesReview(review: ReviewData): boolean {
  return text(orderParams(review).wes_panel_id) === 'full_wes';
}

const GVC_FREQUENCY_TRACKS = new Set(['carrier', 'rare_disease', 'hereditary_cancer']);

/** Saved GVC panel. Whole Exome (vcf only) stays on Carrier 2000+ until an order sets another code. */
export function gvcPanelCodeForReview(review: ReviewData): string {
  const explicit = text(orderParams(review).gvc_panel_code);
  if (explicit === 'none') return '';
  if (explicit) return explicit;
  return isFullWesReview(review) ? FULL_WES_GVC_PANEL_CODE : '';
}

/** Saved frequency track. Empty means GVC keeps the track mapped from the service. */
export function gvcFrequencyTrackForReview(review: ReviewData): string {
  const track = text(orderParams(review).gvc_frequency_track);
  return GVC_FREQUENCY_TRACKS.has(track) ? track : '';
}

/** Rows for a review that has no pipeline variant list. */
export function variantsFromGvcSummaries(
  summaries: GvcVariantSummary[],
  rulesetVersion: string,
): Variant[] {
  return summaries.map((summary) => {
    if (summary.heldReason) return heldVariant(summary);
    return {
      variant_id: `gvc:${variantLocusKey(summary)}`,
      gene: summary.gene || '',
      chrom: summary.chrom,
      pos: summary.pos,
      ref: summary.ref,
      alt: summary.alt,
      hgvsc: summary.hgvsc || undefined,
      transcript: summary.transcript || undefined,
      zygosity: summary.zygosity || undefined,
      ...(summary.acmgClassification
        ? {
            acmg_classification: summary.acmgClassification,
            acmg_criteria: summary.acmgCriteria,
            acmg_reasoning: rulesetVersion ? `GVC ${rulesetVersion}` : undefined,
          }
        : {}),
    };
  });
}

function heldVariant(summary: GvcVariantSummary): Variant {
  return {
    variant_id: `gvc-held:${variantLocusKey(summary)}`,
    gene: summary.gene || '',
    chrom: summary.chrom,
    pos: summary.pos,
    ref: summary.ref,
    alt: summary.alt,
    hgvsc: summary.hgvsc || undefined,
    transcript: summary.transcript || undefined,
    zygosity: summary.zygosity || undefined,
    acmg_reasoning: `GVC held this variant (${gvcHeldLabel(summary.heldReason || '')}) and did not classify it.`,
    gvc_held_reason: summary.heldReason || undefined,
  };
}

/**
 * Overlay a finished GVC classification onto the pipeline variant row.
 * A held row keeps the pipeline label and is marked so the review table can show it.
 * Held variants that the pipeline list omitted are appended.
 */
export function applyGvcClassifications<T extends Variant>(
  variants: T[],
  summaries: GvcVariantSummary[],
  rulesetVersion: string,
): { variants: T[]; matched: number; held: number } {
  const byLocus = new Map(summaries.map((summary) => [variantLocusKey(summary), summary]));
  const seen = new Set<string>();
  let matched = 0;
  let held = 0;
  const next = variants.map((variant) => {
    const key = variantLocusKey(variant);
    seen.add(key);
    const summary = byLocus.get(key);
    if (!summary) return variant;
    if (summary.heldReason) {
      held += 1;
      return { ...variant, gvc_held_reason: summary.heldReason };
    }
    if (!summary.acmgClassification) return variant;
    matched += 1;
    return {
      ...variant,
      acmg_classification: summary.acmgClassification,
      acmg_criteria: summary.acmgCriteria,
      acmg_reasoning: `GVC ${rulesetVersion}`,
    };
  });
  const added = summaries
    .filter((summary) => summary.heldReason && !seen.has(variantLocusKey(summary)))
    .map((summary) => heldVariant(summary) as T);
  held += added.length;
  return { variants: [...next, ...added], matched, held };
}
