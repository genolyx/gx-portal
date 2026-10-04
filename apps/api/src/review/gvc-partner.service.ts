import { Injectable, Logger } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import type { GvcEvidence, ReviewData, ReviewInterpretation, ServiceParityReport } from '@gx-portal/types';
import { DaemonService } from '../daemon/daemon.service';
import { InterpretationSettingsService } from './interpretation-settings.service';
import {
  applyGvcClassifications,
  applyGvcDarkGenes,
  applyGvcPgx,
  classificationParity,
  classificationProgressMessage,
  waitForPartnerJob,
  curationEvidence,
  interpretationServiceKey,
  gvcFrequencyTrackForReview,
  partnerUrlForRuntime,
  gvcPanelCodeForReview,
  isFullWesReview,
  partnerJobRequest,
  partnerVariantKey,
  sha256Hex,
  variantsFromGvcSummaries,
  type GvcDarkGenes,
  type GvcVariantSummary,
} from './gvc-interpretation';

export interface ClassificationProgress {
  orderId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  classification?: { queued: number; running: number; succeeded: number; failed: number };
}

interface PartnerJob {
  id: string;
  externalOrderId?: string;
  referenceBuild?: 'GRCh37' | 'GRCh38';
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  track?: string;
  rulesetVersion?: string;
  error?: string;
  counts?: { kept: number; held: number };
  classification?: { queued: number; running: number; succeeded: number; failed: number };
  includePgx?: boolean;
  includeApoePgx?: boolean;
  panelCode?: string;
  vcfUpload?: { method: 'PUT'; path: string };
}

interface VcfFile {
  rel_path: string;
  name?: string;
}

const JSON_TIMEOUT_MS = 20_000;
const VCF_TIMEOUT_MS = 120_000;

@Injectable()
export class GvcPartnerService {
  private readonly logger = new Logger(GvcPartnerService.name);

  constructor(
    private readonly daemon: DaemonService,
    private readonly settings: InterpretationSettingsService,
  ) {}

  sourceFor(review: ReviewData) {
    return this.settings.sourceFor(review);
  }

  async attach(orderId: string, review: ReviewData): Promise<ReviewData> {
    if (!isFullWesReview(review) && this.sourceFor(review) !== 'gvc') return review;
    const ran = await this.classification(orderId, review);
    if (ran.state === 'skipped') return this.pipeline(review, 'skipped', ran.message);
    if (ran.state === 'failed') return this.pipeline(review, 'failed', ran.message);
    if (ran.state === 'pending') {
      const scoped = applyGvcPgx(review.pgx, ran.job);
      const rulesetVersion = ran.job.rulesetVersion || '';
      const variants = ran.summaries.length
        ? (review.variants ?? []).length
          ? applyGvcClassifications(review.variants ?? [], ran.summaries, rulesetVersion).variants
          : variantsFromGvcSummaries(ran.summaries, rulesetVersion)
        : review.variants;
      return {
        ...review,
        variants,
        pgx: scoped.pgx,
        interpretation: {
          source: 'gvc',
          status: ran.job.status,
          track: ran.job.track,
          rulesetVersion: ran.job.rulesetVersion,
          jobId: ran.job.id,
          message: classificationProgressMessage(ran.job),
        },
      };
    }
    const rulesetVersion = ran.job.rulesetVersion || '';
    const pipelineVariants = review.variants ?? [];
    const applied = pipelineVariants.length
      ? applyGvcClassifications(pipelineVariants, ran.summaries, rulesetVersion)
      : {
          variants: variantsFromGvcSummaries(ran.summaries, rulesetVersion),
          matched: ran.summaries.filter((summary) => summary.acmgClassification && !summary.heldReason).length,
          held: ran.summaries.filter((summary) => summary.heldReason).length,
        };
    const withVariants: ReviewData = { ...review, variants: applied.variants };
    const dark = await this.overlayDarkGenes(partnerUrlForRuntime(this.settings.partnerUrl()), this.settings.partnerToken(), ran.job.id, withVariants);
    const scoped = applyGvcPgx(dark.review.pgx, ran.job);
    return {
      ...dark.review,
      pgx: scoped.pgx,
      interpretation: {
        source: 'gvc',
        status: 'succeeded',
        track: ran.job.track,
        rulesetVersion: ran.job.rulesetVersion,
        jobId: ran.job.id,
      },
    };
  }

  async parity(orderId: string): Promise<ServiceParityReport> {
    const review = await this.daemon.get<ReviewData>(`/order/${encodeURIComponent(orderId)}/result`);
    const service = interpretationServiceKey(review);
    const blank = (message: string, eligible = false): ServiceParityReport => ({
      orderId,
      service,
      eligible,
      agreed: false,
      comparable: 0,
      matched: 0,
      mismatched: 0,
      held: 0,
      examples: [],
      message,
    });
    if (!service) {
      return blank('This order is not a carrier, whole exome, hereditary cancer, or health screening review.');
    }
    const ran = await this.classification(orderId, review);
    if (ran.state === 'skipped' || ran.state === 'failed') return blank(ran.message, true);
    if (ran.state === 'pending') {
      return blank('GVC classification is still running. Compare again when it finishes.', true);
    }
    const result = classificationParity(review.variants ?? [], ran.summaries);
    return {
      orderId,
      service,
      eligible: true,
      ...result,
      message: result.agreed
        ? `${result.matched} classifications match. This service can use GVC.`
        : result.comparable === 0
          ? 'No classified variants overlapped, so this service stays on the portal.'
          : `${result.mismatched} of ${result.comparable} classifications differ.`,
    };
  }

  private async classification(
    orderId: string,
    review: ReviewData,
  ): Promise<
    | { state: 'skipped'; message: string }
    | { state: 'failed'; message: string }
    | { state: 'pending'; job: PartnerJob; summaries: GvcVariantSummary[] }
    | { state: 'succeeded'; job: PartnerJob; summaries: GvcVariantSummary[] }
  > {
    const baseUrl = partnerUrlForRuntime(this.settings.partnerUrl());
    const token = this.settings.partnerToken();
    if (!baseUrl || token.length < 32) {
      return { state: 'skipped', message: 'GVC partner API is not configured' };
    }

    try {
      const current = await this.jobByOrder(baseUrl, token, orderId);
      const wantedPanel = gvcPanelCodeForReview(review);
      const wantedTrack = gvcFrequencyTrackForReview(review);
      if (
        current &&
        !current.vcfUpload &&
        current.status !== 'failed' &&
        (current.panelCode ?? '') === wantedPanel &&
        (!wantedTrack || current.track === wantedTrack)
      ) {
        return this.outcomeFromJob(baseUrl, token, current);
      }
      const vcf = await this.loadAnnotatedVcf(orderId);
      if (!vcf) return { state: 'skipped', message: 'Annotated VCF is not available yet' };
      const sha256 = sha256Hex(vcf.body);
      const request = partnerJobRequest(orderId, review, {
        sha256,
        uri: `daemon://${orderId}/${vcf.relPath}`,
      });
      if (!request.ok) return { state: 'skipped', message: request.reason };

      const created = await this.postJob(baseUrl, token, request.body);
      if (!created.accepted) return { state: 'skipped', message: created.reason };
      if (created.job.vcfUpload) {
        await this.putVcf(baseUrl, token, created.job.vcfUpload.path, vcf.body);
      }
      const posted = created.job.vcfUpload ? await this.getJob(baseUrl, token, created.job.id) : created.job;
      const fullWes = isFullWesReview(review);
      const job = await waitForPartnerJob(posted, () => this.getJob(baseUrl, token, posted.id), fullWes
        ? { timeoutMs: 0 }
        : undefined);
      return this.outcomeFromJob(baseUrl, token, job);
    } catch (error) {
      const current = await this.jobByOrder(baseUrl, token, orderId).catch(() => null);
      if (current && current.status !== 'failed') {
        return this.outcomeFromJob(baseUrl, token, current);
      }
      const message = error instanceof Error ? error.message : 'GVC request failed';
      this.logger.warn(`GVC interpretation fell back to the pipeline for ${orderId}: ${message}`);
      return { state: 'failed', message };
    }
  }

  private async outcomeFromJob(
    baseUrl: string,
    token: string,
    job: PartnerJob,
  ): Promise<
    | { state: 'failed'; message: string }
    | { state: 'pending'; job: PartnerJob; summaries: GvcVariantSummary[] }
    | { state: 'succeeded'; job: PartnerJob; summaries: GvcVariantSummary[] }
  > {
    if (job.status === 'failed') {
      return { state: 'failed', message: job.error || 'GVC classification failed' };
    }
    if (job.status !== 'succeeded') {
      const listed = (job.counts?.kept ?? 0) + (job.counts?.held ?? 0);
      const summaries = listed > 0 ? await this.getVariants(baseUrl, token, job.id) : [];
      return { state: 'pending', job, summaries };
    }
    const summaries = await this.getVariants(baseUrl, token, job.id);
    return { state: 'succeeded', job, summaries };
  }

  async progress(orderIds: string[]): Promise<ClassificationProgress[]> {
    const ids = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))].slice(0, 100);
    const baseUrl = partnerUrlForRuntime(this.settings.partnerUrl());
    const token = this.settings.partnerToken();
    if (!ids.length || !baseUrl || token.length < 32) return [];
    const response = await fetch(`${baseUrl}/api/partner/v1/interpretation-jobs/progress`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ externalOrderIds: ids }),
      signal: AbortSignal.timeout(JSON_TIMEOUT_MS),
    });
    if (!response.ok) return [];
    const body = await response.json() as { jobs?: PartnerJob[] };
    return (body.jobs ?? []).map((job) => ({
      orderId: job.externalOrderId || '',
      status: job.status,
      classification: job.classification,
    })).filter((job) => job.orderId);
  }

  async stop(orderId: string): Promise<{ cancelled: number }> {
    const baseUrl = partnerUrlForRuntime(this.settings.partnerUrl());
    const token = this.settings.partnerToken();
    if (!baseUrl || token.length < 32) {
      throw new BadRequestException('GVC partner API is not configured');
    }
    const current = await this.jobByOrder(baseUrl, token, orderId);
    if (!current) throw new BadRequestException('This order has no GVC classification to stop');
    const response = await fetch(
      `${baseUrl}/api/partner/v1/interpretation-jobs/${current.id}/cancel`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(JSON_TIMEOUT_MS),
      },
    );
    if (!response.ok) throw new BadRequestException(`GVC stop failed (${response.status})`);
    const body = await response.json() as { cancelled?: number };
    return { cancelled: body.cancelled ?? 0 };
  }

  private async jobByOrder(baseUrl: string, token: string, orderId: string): Promise<PartnerJob | null> {
    const response = await fetch(
      `${baseUrl}/api/partner/v1/interpretation-jobs/by-order/${encodeURIComponent(orderId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(JSON_TIMEOUT_MS),
      },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GVC job lookup failed (${response.status})`);
    return response.json() as Promise<PartnerJob>;
  }

  async variantEvidence(
    orderId: string,
    query: { jobId?: string; chrom?: string; pos?: string; ref?: string; alt?: string },
  ): Promise<GvcEvidence> {
    const none = (reason: GvcEvidence['reason']): GvcEvidence => ({ available: false, reason, criteria: [], pmids: [] });
    const jobId = query.jobId?.trim() ?? '';
    const pos = Number(query.pos);
    if (!/^[a-f0-9]{64}$/.test(jobId) || !query.chrom?.trim() || !Number.isInteger(pos) || pos <= 0 || !query.ref || !query.alt) {
      throw new BadRequestException('jobId, chrom, pos, ref, and alt are required');
    }
    const baseUrl = partnerUrlForRuntime(this.settings.partnerUrl());
    const token = this.settings.partnerToken();
    if (!baseUrl || token.length < 32) return none('unavailable');
    const locus = { chrom: query.chrom, pos, ref: query.ref, alt: query.alt };
    try {
      const job = await this.getJob(baseUrl, token, jobId);
      if (job.externalOrderId !== orderId || !job.referenceBuild) return none('unavailable');
      const key = partnerVariantKey(job.referenceBuild, locus);
      const response = await fetch(
        `${baseUrl}/api/partner/v1/interpretation-jobs/${jobId}/variants/${encodeURIComponent(key)}/document`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(JSON_TIMEOUT_MS) },
      );
      if (response.status === 409) return none('not_ready');
      if (response.status === 404) return none('not_found');
      if (!response.ok) return none('unavailable');
      const payload = await response.json() as { document?: unknown };
      return curationEvidence(payload.document, locus);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GVC evidence failed';
      this.logger.warn(`GVC evidence unavailable for ${orderId}: ${message}`);
      return none('unavailable');
    }
  }

  async checkConnection(): Promise<{ ok: boolean; message: string }> {
    const url = partnerUrlForRuntime(this.settings.partnerUrl());
    const token = this.settings.partnerToken();
    if (!url || token.length < 32) {
      return { ok: false, message: 'Save the GVC URL and a token first.' };
    }
    try {
      const response = await fetch(`${url}/api/partner/v1/health`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 200) return { ok: true, message: 'Connected. GVC accepted this token.' };
      if (response.status === 401) return { ok: false, message: 'GVC refused this token.' };
      if (response.status === 503) return { ok: false, message: 'GVC has no partner token saved.' };
      return { ok: false, message: `GVC responded with status ${response.status}.` };
    } catch {
      return { ok: false, message: 'GVC did not respond.' };
    }
  }

  private pipeline(review: ReviewData, status: ReviewInterpretation['status'], message: string): ReviewData {
    return { ...review, interpretation: { source: 'pipeline', status, message } };
  }

  private async loadAnnotatedVcf(orderId: string): Promise<{ relPath: string; body: Buffer } | null> {
    const listed = await this.daemon.get<{
      annotated_vcf?: VcfFile | null;
      called_vcf?: VcfFile | null;
    }>(`/order/${encodeURIComponent(orderId)}/vcf-downloads`);
    const file = listed.annotated_vcf?.rel_path ? listed.annotated_vcf : listed.called_vcf;
    if (!file?.rel_path) return null;
    const encoded = file.rel_path
      .replace(/^\/+/, '')
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const response = await this.daemon.fetchRaw(
      `/order/${encodeURIComponent(orderId)}/file/${encoded}`,
    );
    if (response.status >= 400 || !response.body.length) return null;
    return { relPath: file.rel_path, body: response.body };
  }

  private async postJob(
    baseUrl: string,
    token: string,
    body: unknown,
  ): Promise<{ accepted: true; job: PartnerJob } | { accepted: false; reason: string }> {
    const response = await fetch(`${baseUrl}/api/partner/v1/interpretation-jobs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(JSON_TIMEOUT_MS),
    });
    const payload = await response.json().catch(() => ({})) as { reason?: string };
    if (response.status === 422) {
      return { accepted: false, reason: payload.reason || 'rejected' };
    }
    if (!response.ok) throw new Error(`GVC job request failed (${response.status})`);
    return { accepted: true, job: payload as PartnerJob };
  }

  private async putVcf(baseUrl: string, token: string, path: string, body: Buffer) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body,
      signal: AbortSignal.timeout(VCF_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`GVC VCF upload failed (${response.status})`);
  }

  private async getJob(baseUrl: string, token: string, id: string): Promise<PartnerJob> {
    const response = await fetch(`${baseUrl}/api/partner/v1/interpretation-jobs/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(JSON_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`GVC job status failed (${response.status})`);
    return response.json() as Promise<PartnerJob>;
  }

  private async overlayDarkGenes(
    baseUrl: string,
    token: string,
    id: string,
    review: ReviewData,
  ): Promise<{ review: ReviewData; applied: boolean }> {
    if (interpretationServiceKey(review) === 'health_screening') return { review, applied: false };
    const summaryText = String(review.dark_genes?.summary_text ?? '');
    const detailedText = String(review.dark_genes?.detailed_text ?? '');
    if (!summaryText.trim() && !detailedText.trim()) return { review, applied: false };
    try {
      const response = await fetch(`${baseUrl}/api/partner/v1/interpretation-jobs/${id}/dark-genes`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ summaryText, detailedText }),
        signal: AbortSignal.timeout(JSON_TIMEOUT_MS),
      });
      if (response.status === 422) return { review, applied: false };
      if (!response.ok) throw new Error(`GVC dark genes failed (${response.status})`);
      const block = await response.json() as GvcDarkGenes;
      const next = applyGvcDarkGenes(review.dark_genes, block);
      if (!next || next === review.dark_genes) return { review, applied: false };
      return { review: { ...review, dark_genes: next }, applied: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GVC dark genes failed';
      this.logger.warn(`GVC dark genes stayed on the pipeline result for ${id}: ${message}`);
      return { review, applied: false };
    }
  }

  private async getVariants(baseUrl: string, token: string, id: string): Promise<GvcVariantSummary[]> {
    const response = await fetch(`${baseUrl}/api/partner/v1/interpretation-jobs/${id}/variants`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(JSON_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`GVC variants failed (${response.status})`);
    const payload = await response.json() as { variants?: GvcVariantSummary[] };
    return payload.variants ?? [];
  }
}
