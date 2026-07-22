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
  GeneKnowledge,
  VariantKnowledge,
  ClassifyRequest,
  ClassifyResponse,
} from '@gx-portal/types';

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

  getResult(orderId: string, user?: RequestUser): Promise<ReviewData> {
    this.guard(orderId, user);
    return this.daemon.get<ReviewData>(`/order/${orderId}/result`);
  }

  classifyVariants(orderId: string, body: ClassifyRequest, user?: RequestUser): Promise<ClassifyResponse> {
    this.guard(orderId, user);
    return this.daemon.post<ClassifyResponse>(`/order/${orderId}/classify-variants`, body);
  }

  async getCoverageContext(orderId: string, user?: RequestUser): Promise<CoverageContext> {
    this.guard(orderId, user);
    // Get order to extract data_dir from pipeline command
    const order = await this.daemon.get<Record<string, unknown>>(`/order/${orderId}`);
    const analysisDir = this._resolveAnalysisDir(order, orderId);

    // Call daemon's coverage-context endpoint
    try {
      const raw = await this.daemon.get<Record<string, unknown>>(`/order/${orderId}/coverage-context`);
      const tracks = (raw['bam_tracks'] ?? []) as BamTrack[];
      const genomeId = (raw['genome_id'] ?? raw['genome'] ?? 'hg38') as string;

      if (tracks.length > 0 && analysisDir) {
        // Use the last track (final/merged BAM in pipeline)
        const track = tracks[tracks.length - 1];
        const bamAbsPath = path.join(analysisDir, track.rel_path);
        const baiAbsPath = track.index_rel_path
          ? path.join(analysisDir, track.index_rel_path)
          : bamAbsPath + '.bai';

        return {
          bam_path:       fs.existsSync(bamAbsPath) ? bamAbsPath : undefined,
          bam_index_path: fs.existsSync(baiAbsPath) ? baiAbsPath : undefined,
          genome:         genomeId,
          bam_tracks:     tracks,
          genome_id:      genomeId,
        };
      }
    } catch { /* fall through */ }

    // Fallback: scan output_dir
    const local = await this.ordersService.getBamContext(orderId, user);
    return local as CoverageContext;
  }

  /**
   * Resolve the true analysis directory from the order.
   *
   * The daemon stores paths with a "virtual" prefix (e.g. /data/gx-exome)
   * but the actual files live under the --data-dir argument in the pipeline
   * command (e.g. /home/ken/gx-exome).
   *
   * Structure: {data_dir}/analysis/{work_dir}/{order_id}/
   */
  private _resolveAnalysisDir(order: Record<string, unknown>, orderId: string): string | undefined {
    // Try to parse --data-dir from the pipeline command first (most reliable)
    const params = order['params'] as Record<string, unknown> | undefined;
    const pipelineCmd = (params?.['_pipeline_command'] ?? '') as string;
    const dataDirMatch = pipelineCmd.match(/--data-dir\s+(\S+)/);
    if (dataDirMatch) {
      const dataDir = dataDirMatch[1];
      const workDir = String(order['work_dir'] ?? '');
      const candidate = path.join(dataDir, 'analysis', workDir, orderId);
      if (fs.existsSync(candidate)) return candidate;
    }

    // Fallback: use daemon-provided analysis_dir as-is
    const analysisDir = order['analysis_dir'] as string | undefined;
    if (analysisDir && fs.existsSync(analysisDir)) return analysisDir;

    return undefined;
  }

  /** Resolve absolute BAM/BAI path for streaming */
  async getBamFilePath(orderId: string, user?: RequestUser): Promise<{ bamPath: string; baiPath?: string; label?: string }> {
    const ctx = await this.getCoverageContext(orderId, user);
    if (!ctx.bam_path) throw new Error('No BAM file found for this order');
    return {
      bamPath: ctx.bam_path,
      baiPath: ctx.bam_index_path,
      label:   ctx.bam_tracks?.[ctx.bam_tracks.length - 1]?.label,
    };
  }

  getGeneCoverage(orderId: string, gene: string, user?: RequestUser): Promise<unknown> {
    this.guard(orderId, user);
    return this.daemon.get(`/order/${orderId}/gene-coverage/${gene}`);
  }

  getGeneKnowledge(orderId: string, user?: RequestUser): Promise<GeneKnowledge[]> {
    this.guard(orderId, user);
    return this.daemon.get<GeneKnowledge[]>(`/order/${orderId}/gene-knowledge`);
  }

  putGeneKnowledge(orderId: string, knowledge: GeneKnowledge[], user?: RequestUser): Promise<GeneKnowledge[]> {
    this.guard(orderId, user);
    return this.daemon.put<GeneKnowledge[]>(`/order/${orderId}/gene-knowledge`, knowledge);
  }

  getVariantKnowledge(orderId: string, user?: RequestUser): Promise<VariantKnowledge[]> {
    this.guard(orderId, user);
    return this.daemon.get<VariantKnowledge[]>(`/order/${orderId}/variant-knowledge`);
  }

  putVariantKnowledge(orderId: string, knowledge: VariantKnowledge[], user?: RequestUser): Promise<VariantKnowledge[]> {
    this.guard(orderId, user);
    return this.daemon.put<VariantKnowledge[]>(`/order/${orderId}/variant-knowledge`, knowledge);
  }

  savePgxReview(orderId: string, body: unknown, user?: RequestUser): Promise<unknown> {
    this.guard(orderId, user);
    return this.daemon.post(`/order/${orderId}/pgx-review`, body);
  }

  saveDarkGenesReview(orderId: string, body: unknown, user?: RequestUser): Promise<unknown> {
    this.guard(orderId, user);
    return this.daemon.post(`/order/${orderId}/dark-genes-review`, body);
  }

  getVariantSets(): Promise<unknown> {
    return this.daemon.get('/api/portal/variant-sets');
  }
}
