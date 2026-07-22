import { api } from './client';

export interface VariantSet {
  id: number;
  tag_name: string;
  created_at: string;
  updated_at: string;
  entry_count: number;
}

export interface VariantSetResponse {
  sets: VariantSet[];
  lookup?: unknown;
  entries_by_tag?: unknown;
}

export interface PanelPackage {
  id: string;
  label: string;
  category?: string;
  description?: string;
  gene_count?: number;
  source?: string;
  genes?: string[];
  disease_bed?: string;
  backbone_bed?: string;
  interpretation_genes_only?: boolean;
}

export interface PanelsResponse {
  version?: number;
  panels: PanelPackage[];
}

export interface LiteratureArticle {
  pmid: string;
  title?: string;
  journal?: string;
  pub_date?: string;
  cached_at?: string;
  abstract?: string;
  authors?: string[];
  genes?: string[];
  [key: string]: unknown;
}

export interface LiteratureResponse {
  articles: LiteratureArticle[];
  total: number;
  page?: number;
  per_page?: number;
  db_missing?: boolean;
}

export interface VariantSetEntry {
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  gene?: string;
  label?: string;
}

export interface VariantSetEntriesResponse {
  id: number;
  tag_name: string;
  entries: VariantSetEntry[];
  entry_count?: number;
}

export const catalogApi = {
  // Variant Sets
  getVariantSets: () => api.get<VariantSetResponse>('/variant-sets'),
  getVariantSetEntries: (id: number) => api.get<VariantSetEntriesResponse>(`/variant-sets/${id}`),
  deleteVariantSet: (id: number) => api.delete(`/variant-sets/${id}`),

  // Panels
  getPanels: () => api.get<PanelsResponse>('/panels'),
  getPanel: (id: string) => api.get<PanelPackage & { interpretation_genes?: string[] }>(`/panels/${encodeURIComponent(id)}`),
  savePanel: (body: unknown) => api.post<unknown>('/panels', body),
  deletePanel: (id: string) => api.delete(`/panels/${encodeURIComponent(id)}`),

  // Literature
  getStats: () => api.get<{ total?: number; by_gene?: Record<string, number> }>('/literature/stats'),
  getArticles: (params: { page?: number; per_page?: number; q?: string; sort?: string }) => {
    const qs = new URLSearchParams();
    if (params.page)     qs.set('page',     String(params.page));
    if (params.per_page) qs.set('per_page', String(params.per_page));
    if (params.q)        qs.set('q',        params.q);
    if (params.sort)     qs.set('sort',     params.sort);
    return api.get<LiteratureResponse>(`/literature/articles?${qs.toString()}`);
  },
  getArticle: (pmid: string) => api.get<LiteratureArticle>(`/literature/articles/${pmid}`),
  deleteArticle: (pmid: string) => api.delete(`/literature/articles/${pmid}`),
  clearCache: () => api.delete('/literature/cache'),
  search: (params: { gene?: string; hgvsc?: string; hgvsp?: string; force_refresh?: boolean }) => {
    const qs = new URLSearchParams();
    if (params.gene)          qs.set('gene',          params.gene);
    if (params.hgvsc)         qs.set('hgvsc',         params.hgvsc);
    if (params.hgvsp)         qs.set('hgvsp',         params.hgvsp);
    if (params.force_refresh) qs.set('force_refresh', 'true');
    return api.get<LiteratureResponse>(`/literature/search?${qs.toString()}`);
  },
};
