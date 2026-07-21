import { api } from './client';
import type {
  ReviewData, ClassifyRequest, ClassifyResponse,
  CoverageContext, GeneKnowledge, VariantKnowledge,
  ReportBody, ReportPreviewResponse,
} from '@gx-portal/types';

export const reviewApi = {
  getResult: (orderId: string) => api.get<ReviewData>(`/review/${orderId}/result`),
  classify: (orderId: string, body: ClassifyRequest) =>
    api.post<ClassifyResponse>(`/review/${orderId}/classify-variants`, body),
  getCoverageContext: (orderId: string) =>
    api.get<CoverageContext>(`/review/${orderId}/coverage-context`),
  getGeneCoverage: (orderId: string, gene: string) =>
    api.get<unknown>(`/review/${orderId}/gene-coverage/${gene}`),
  getGeneKnowledge: (orderId: string) =>
    api.get<GeneKnowledge[]>(`/review/${orderId}/gene-knowledge`),
  putGeneKnowledge: (orderId: string, data: GeneKnowledge[]) =>
    api.put<GeneKnowledge[]>(`/review/${orderId}/gene-knowledge`, data),
  getVariantKnowledge: (orderId: string) =>
    api.get<VariantKnowledge[]>(`/review/${orderId}/variant-knowledge`),
  putVariantKnowledge: (orderId: string, data: VariantKnowledge[]) =>
    api.put<VariantKnowledge[]>(`/review/${orderId}/variant-knowledge`, data),
  savePgx: (orderId: string, body: unknown) =>
    api.post<unknown>(`/review/${orderId}/pgx-review`, body),
  saveDarkGenes: (orderId: string, body: unknown) =>
    api.post<unknown>(`/review/${orderId}/dark-genes-review`, body),
  getVariantSets: () => api.get<unknown>('/review/variant-sets'),
};

export const reportApi = {
  generate: (orderId: string, body: ReportBody) =>
    api.post<unknown>(`/report/${orderId}/generate`, body),
  preview: (orderId: string, body: ReportBody) =>
    api.post<ReportPreviewResponse>(`/report/${orderId}/preview`, body),
  fromHtml: (orderId: string, html: string) =>
    api.post<unknown>(`/report/${orderId}/from-html`, { html }),
};
