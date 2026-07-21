import { Injectable } from '@nestjs/common';
import { DaemonService } from '../daemon/daemon.service';
import type {
  ReviewData,
  CoverageContext,
  GeneKnowledge,
  VariantKnowledge,
  ClassifyRequest,
  ClassifyResponse,
} from '@gx-portal/types';

@Injectable()
export class ReviewService {
  constructor(private readonly daemon: DaemonService) {}

  getResult(orderId: string): Promise<ReviewData> {
    return this.daemon.get<ReviewData>(`/order/${orderId}/result`);
  }

  classifyVariants(orderId: string, body: ClassifyRequest): Promise<ClassifyResponse> {
    return this.daemon.post<ClassifyResponse>(`/order/${orderId}/classify-variants`, body);
  }

  getCoverageContext(orderId: string): Promise<CoverageContext> {
    return this.daemon.get<CoverageContext>(`/order/${orderId}/coverage-context`);
  }

  getGeneCoverage(orderId: string, gene: string): Promise<unknown> {
    return this.daemon.get(`/order/${orderId}/gene-coverage/${gene}`);
  }

  getGeneKnowledge(orderId: string): Promise<GeneKnowledge[]> {
    return this.daemon.get<GeneKnowledge[]>(`/order/${orderId}/gene-knowledge`);
  }

  putGeneKnowledge(orderId: string, knowledge: GeneKnowledge[]): Promise<GeneKnowledge[]> {
    return this.daemon.put<GeneKnowledge[]>(`/order/${orderId}/gene-knowledge`, knowledge);
  }

  getVariantKnowledge(orderId: string): Promise<VariantKnowledge[]> {
    return this.daemon.get<VariantKnowledge[]>(`/order/${orderId}/variant-knowledge`);
  }

  putVariantKnowledge(orderId: string, knowledge: VariantKnowledge[]): Promise<VariantKnowledge[]> {
    return this.daemon.put<VariantKnowledge[]>(`/order/${orderId}/variant-knowledge`, knowledge);
  }

  savePgxReview(orderId: string, body: unknown): Promise<unknown> {
    return this.daemon.post(`/order/${orderId}/pgx-review`, body);
  }

  saveDarkGenesReview(orderId: string, body: unknown): Promise<unknown> {
    return this.daemon.post(`/order/${orderId}/dark-genes-review`, body);
  }

  getVariantSets(): Promise<unknown> {
    return this.daemon.get('/api/portal/variant-sets');
  }
}
