import * as path from 'path';
import * as fs from 'fs';
import { Injectable } from '@nestjs/common';
import { DaemonService } from '../daemon/daemon.service';
import { OrdersService } from '../orders/orders.service';
import { OrderRegistryService, RequestUser } from '../orders/order-registry.service';
import type {
  ReviewData,
  CoverageContext,
  BamTrack,
  GeneKnowledgeResponse,
  GeneKnowledgeSaveRequest,
  VariantKnowledgeSaveRequest,
  ClassifyRequest,
  ClassifyResponse,
} from '@gx-portal/types';
import { normalizeSgniptReviewData } from './sgnipt-normalize';

@Injectable()
export class ReviewService {
  constructor(
    private readonly daemon: DaemonService,
    private readonly ordersService: OrdersService,
    private readonly registry: OrderRegistryService,
  ) {}

  private guard(orderId: string, user?: RequestUser) {
    this.registry.assertCanAccess(orderId, user);
  }

  /**
   * Load result.json and ensure Portal-shaped fields used for Review tab kind:
   * `order_params` + `service_code` (daemon sometimes omits them on the result payload).
   */
  async getResult(orderId: string, user?: RequestUser): Promise<ReviewData> {
    this.guard(orderId, user);
    const result = await this.daemon.get<ReviewData>(`/order/${orderId}/result`);
    const needsParams = !result?.order_params || typeof result.order_params !== 'object';
    const needsService = !result?.service_code && !result?._service_code;

    let merged = result;
    if (needsParams || needsService) {
      try {
        const order = await this.daemon.get<Record<string, unknown>>(`/order/${orderId}`);
        const patch: Partial<ReviewData> = {};
        if (needsParams && order?.params && typeof order.params === 'object') {
          patch.order_params = order.params as Record<string, unknown>;
        }
        if (needsService && order?.service_code) {
          patch.service_code = String(order.service_code);
        }
        merged = { ...result, ...patch };
      } catch {
        merged = result;
      }
    }

    // sgNIPT: clinical_findings → variants (+ variant_analysis seed)
    return normalizeSgniptReviewData(merged);
  }

  classifyVariants(orderId: string, body: ClassifyRequest, user?: RequestUser): Promise<ClassifyResponse> {
    this.guard(orderId, user);
    return this.daemon.post<ClassifyResponse>(`/order/${orderId}/classify-variants`, body);
  }

  /**
   * Coverage / IGV context — mirrors Portal: use daemon bam_tracks (relative paths)
   * streamed via `/order/{id}/file/...`. Do not require local absolute path resolution
   * (prior-reuse BAMs often live under another order’s analysis tree).
   */
  async getCoverageContext(orderId: string, user?: RequestUser): Promise<CoverageContext> {
    this.guard(orderId, user);

    try {
      const raw = await this.daemon.get<Record<string, unknown>>(`/order/${orderId}/coverage-context`);
      const tracks = (raw['bam_tracks'] ?? []) as BamTrack[];
      const genomeId = String(raw['genome_id'] ?? raw['genome'] ?? 'hg38');
      const genes = (raw['interpretation_genes'] ?? []) as string[];
      const primary = prioritizeCoverageBamTracks(tracks)[0];

      let bamRel = primary?.rel_path;
      let baiRel = primary?.index_rel_path;
      if (bamRel && !baiRel && /\.bam$/i.test(bamRel)) {
        baiRel = `${bamRel.slice(0, -4)}.bai`;
      }

      // Optional: if API host can see the file locally, expose abs paths (legacy /bam endpoints).
      let bamAbs: string | undefined;
      let baiAbs: string | undefined;
      try {
        const order = await this.daemon.get<Record<string, unknown>>(`/order/${orderId}`);
        const analysisDir = this._resolveAnalysisDir(order, orderId);
        if (analysisDir && bamRel) {
          const candidate = path.join(analysisDir, bamRel);
          if (fs.existsSync(candidate)) {
            bamAbs = candidate;
            const baiCandidate = baiRel
              ? path.join(analysisDir, baiRel)
              : `${candidate}.bai`;
            if (fs.existsSync(baiCandidate)) baiAbs = baiCandidate;
          }
        }
      } catch { /* ignore local resolve */ }

      return {
        bam_path: bamAbs,
        bam_index_path: baiAbs,
        genome: genomeId,
        genome_id: genomeId,
        bam_tracks: tracks,
        target_genes: genes,
        interpretation_genes: genes,
        bam_rel_path: bamRel,
        bam_index_rel_path: baiRel,
        bam_label: primary?.label || (bamRel ? path.basename(bamRel) : undefined),
        igv_bam_message: raw['igv_bam_message'] != null ? String(raw['igv_bam_message']) : undefined,
        prior_reuse_order_id:
          raw['prior_reuse_order_id'] != null ? String(raw['prior_reuse_order_id']) : undefined,
      };
    } catch {
      const local = await this.ordersService.getBamContext(orderId, user);
      return local as CoverageContext;
    }
  }

  /**
   * Resolve the true analysis directory from the order (best-effort local cache).
   */
  private _resolveAnalysisDir(order: Record<string, unknown>, orderId: string): string | undefined {
    const params = order['params'] as Record<string, unknown> | undefined;
    const pipelineCmd = (params?.['_pipeline_command'] ?? '') as string;
    const dataDirMatch = pipelineCmd.match(/--data-dir\s+(\S+)/);
    if (dataDirMatch) {
      const dataDir = dataDirMatch[1];
      const workDir = String(order['work_dir'] ?? '');
      const candidates = [
        path.join(dataDir, 'analysis', workDir, orderId),
        // prior-reuse: BAM may live under the prior sample/order id
        params?._prior_reuse_order_id
          ? path.join(dataDir, 'analysis', workDir, String(params._prior_reuse_order_id))
          : '',
        params?._prior_reuse_analysis_dir ? String(params._prior_reuse_analysis_dir) : '',
      ].filter(Boolean);
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
      }
    }

    const analysisDir = order['analysis_dir'] as string | undefined;
    if (analysisDir && fs.existsSync(analysisDir)) return analysisDir;

    return undefined;
  }

  /** Resolve absolute BAM/BAI path for streaming (legacy). Prefer daemon file proxy. */
  async getBamFilePath(orderId: string, user?: RequestUser): Promise<{ bamPath: string; baiPath?: string; label?: string }> {
    const ctx = await this.getCoverageContext(orderId, user);
    if (!ctx.bam_path) throw new Error('No BAM file found for this order');
    return {
      bamPath: ctx.bam_path,
      baiPath: ctx.bam_index_path,
      label:   ctx.bam_label,
    };
  }

  /** Encode relative analysis path for `/order/{id}/file/...`. */
  encodeArtifactPath(relPath: string): string {
    return String(relPath || '')
      .replace(/^\/+/, '')
      .split('/')
      .filter(Boolean)
      .map((seg) => encodeURIComponent(seg))
      .join('/');
  }

  /** Stream an order artifact from the daemon (Range/HEAD aware). */
  async streamOrderArtifact(
    orderId: string,
    relPath: string,
    opts: { method?: 'GET' | 'HEAD'; range?: string },
    user?: RequestUser,
  ): Promise<Response> {
    this.guard(orderId, user);
    const safe = String(relPath || '').replace(/^\/+/, '');
    if (!safe || safe.includes('..')) {
      throw new Error('Invalid artifact path');
    }
    const encoded = this.encodeArtifactPath(safe);
    return this.daemon.fetchStream(
      `/order/${encodeURIComponent(orderId)}/file/${encoded}`,
      { method: opts.method ?? 'GET', range: opts.range },
    );
  }

  getGeneCoverage(orderId: string, gene: string, user?: RequestUser): Promise<unknown> {
    this.guard(orderId, user);
    return this.daemon.get(`/order/${orderId}/gene-coverage/${gene}`);
  }

  getGeneKnowledge(
    orderId: string,
    query: {
      enrich?: boolean;
      gene?: string;
      force?: boolean;
      genes?: string;
      lang?: string;
    } = {},
    user?: RequestUser,
  ): Promise<GeneKnowledgeResponse> {
    this.guard(orderId, user);
    const params: Record<string, string | number | boolean | undefined> = {};
    if (query.enrich) params.enrich = true;
    if (query.force) params.force = true;
    if (query.gene) params.gene = query.gene;
    if (query.genes) params.genes = query.genes;
    if (query.lang) params.lang = query.lang;
    return this.daemon.get<GeneKnowledgeResponse>(`/order/${orderId}/gene-knowledge`, params);
  }

  putGeneKnowledge(
    orderId: string,
    body: GeneKnowledgeSaveRequest,
    genes?: string,
    user?: RequestUser,
  ): Promise<unknown> {
    this.guard(orderId, user);
    const path = genes
      ? `/order/${orderId}/gene-knowledge?genes=${encodeURIComponent(genes)}`
      : `/order/${orderId}/gene-knowledge`;
    return this.daemon.put(path, body);
  }

  putVariantKnowledge(
    orderId: string,
    body: VariantKnowledgeSaveRequest,
    genes?: string,
    user?: RequestUser,
  ): Promise<unknown> {
    this.guard(orderId, user);
    const path = genes
      ? `/order/${orderId}/variant-knowledge?genes=${encodeURIComponent(genes)}`
      : `/order/${orderId}/variant-knowledge`;
    return this.daemon.put(path, body);
  }

  savePgxReview(orderId: string, body: unknown, user?: RequestUser): Promise<unknown> {
    this.guard(orderId, user);
    return this.daemon.post(`/order/${orderId}/pgx-review`, body);
  }

  saveDarkGenesReview(orderId: string, body: unknown, user?: RequestUser): Promise<unknown> {
    this.guard(orderId, user);
    return this.daemon.post(`/order/${orderId}/dark-genes-review`, body);
  }

  /** Buffer an order artifact (small files: HTML/SVG/JSON). Prefer streamOrderArtifact for BAM. */
  async getOrderArtifact(
    orderId: string,
    relPath: string,
    user?: RequestUser,
  ): Promise<{ body: Buffer; contentType: string }> {
    const res = await this.streamOrderArtifact(orderId, relPath, { method: 'GET' }, user);
    if (!res.ok) {
      throw new Error(`Artifact not found (${res.status})`);
    }
    const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
    return { body: Buffer.from(await res.arrayBuffer()), contentType };
  }

  getVariantSets(): Promise<unknown> {
    return this.daemon.get('/api/portal/variant-sets');
  }
}

/** Prefer alignment/*.md.bam — matches Portal prioritizeCoverageBamTracks / daemon ranking. */
function prioritizeCoverageBamTracks(tracks: BamTrack[]): BamTrack[] {
  const isSpurious = (rel: string) =>
    [
      'paraphase',
      '/smn',
      'fmr1',
      'tests/resources',
      '/aldy/',
      'node_modules',
      '/.local/lib/',
      '/.venv/',
    ].some((m) => rel.toLowerCase().includes(m));

  let pool = (tracks || []).filter((t) => t && t.has_index && !isSpurious(String(t.rel_path || '')));
  const nonWork = pool.filter((t) => !String(t.rel_path || '').toLowerCase().includes('/work/'));
  if (nonWork.length) pool = nonWork;
  const list = pool.length ? pool : (tracks || []).filter((t) => t && t.has_index);
  return list.slice().sort((a, b) => {
    const score = (rel: string) => {
      const r = String(rel || '').toLowerCase();
      let s = 50;
      if (r.startsWith('alignment/') || r.includes('/alignment/')) s -= 30;
      if (r.endsWith('.md.bam')) s -= 25;
      else if (r.endsWith('.pb.bam')) s -= 20;
      if (r.includes('/work/')) s += 40;
      return s;
    };
    const d = score(a.rel_path) - score(b.rel_path);
    return d !== 0 ? d : String(a.rel_path).localeCompare(String(b.rel_path));
  });
}
