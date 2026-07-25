import { api } from './client';
import type {
  ReviewData, ClassifyRequest, ClassifyResponse,
  CoverageContext, GeneKnowledgeResponse,
  GeneKnowledgeSaveRequest, VariantKnowledgeSaveRequest,
  ReportBody, ReportPreviewResponse,
} from '@gx-portal/types';

/** Relative analysis artifact URL (HTML IGV reports, SVGs, PGx files). */
export function orderArtifactUrl(orderId: string, relPath: string): string {
  const safe = String(relPath || '').replace(/^\/+/, '');
  if (!orderId || !safe) return '';
  const encoded = safe
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `/api/review/${encodeURIComponent(orderId)}/file/${encoded}`;
}

export type GeneKnowledgeQuery = {
  enrich?: boolean;
  gene?: string;
  force?: boolean;
  genes?: string;
  lang?: string;
};

export const reviewApi = {
  getResult: (orderId: string) => api.get<ReviewData>(`/review/${orderId}/result`),
  classify: (orderId: string, body: ClassifyRequest) =>
    api.post<ClassifyResponse>(`/review/${orderId}/classify-variants`, body),
  getCoverageContext: (orderId: string) =>
    api.get<CoverageContext>(`/review/${orderId}/coverage-context`),
  getGeneCoverage: (orderId: string, gene: string) =>
    api.get<unknown>(`/review/${orderId}/gene-coverage/${gene}`),
  getGeneKnowledge: (orderId: string, query: GeneKnowledgeQuery = {}) => {
    const qs = new URLSearchParams();
    if (query.enrich) qs.set('enrich', '1');
    if (query.force) qs.set('force', '1');
    if (query.gene) qs.set('gene', query.gene);
    if (query.genes) qs.set('genes', query.genes);
    if (query.lang) qs.set('lang', query.lang);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<GeneKnowledgeResponse>(`/review/${orderId}/gene-knowledge${suffix}`);
  },
  putGeneKnowledge: (orderId: string, body: GeneKnowledgeSaveRequest, genes?: string) => {
    const suffix = genes ? `?genes=${encodeURIComponent(genes)}` : '';
    return api.put<unknown>(`/review/${orderId}/gene-knowledge${suffix}`, body);
  },
  putVariantKnowledge: (orderId: string, body: VariantKnowledgeSaveRequest, genes?: string) => {
    const suffix = genes ? `?genes=${encodeURIComponent(genes)}` : '';
    return api.put<unknown>(`/review/${orderId}/variant-knowledge${suffix}`, body);
  },
  savePgx: (orderId: string, body: unknown) =>
    api.post<{ pgx?: ReviewData['pgx'] }>(`/review/${orderId}/pgx-review`, body),
  saveDarkGenes: (orderId: string, body: unknown) =>
    api.post<{ dark_genes?: ReviewData['dark_genes'] }>(`/review/${orderId}/dark-genes-review`, body),
  getVariantSets: () => api.get<unknown>('/review/variant-sets'),
  /** Fetch artifact text (IGV HTML) with credentials. */
  getArtifactText: async (orderId: string, relPath: string): Promise<string> => {
    const url = orderArtifactUrl(orderId, relPath);
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`Artifact fetch failed (${res.status})`);
    return res.text();
  },
  /** Fetch artifact as Blob (SVGs/images). */
  getArtifactBlob: async (orderId: string, relPath: string): Promise<Blob> => {
    const url = orderArtifactUrl(orderId, relPath);
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`Artifact fetch failed (${res.status})`);
    return res.blob();
  },
};

export const reportApi = {
  generate: (orderId: string, body: ReportBody) =>
    api.post<unknown>(`/report/${orderId}/generate`, body),
  preview: (orderId: string, body: ReportBody) =>
    api.post<ReportPreviewResponse>(`/report/${orderId}/preview`, body),
  fromHtml: (orderId: string, html: string) =>
    api.post<unknown>(`/report/${orderId}/from-html`, { html }),
};
