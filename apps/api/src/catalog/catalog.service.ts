import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { DaemonService } from '../daemon/daemon.service';

const WES_PANELS_CUSTOM_PATH =
  process.env.WES_PANELS_CUSTOM_JSON ?? '/data/wes_panels/wes_panels_custom.json';

type LitQuery = Record<string, string | number | boolean | undefined>;

@Injectable()
export class CatalogService {
  constructor(private readonly daemon: DaemonService) {}

  // ── Variant Sets ────────────────────────────────────────────────────
  getVariantSets() {
    return this.daemon.get<unknown>('/api/portal/variant-sets');
  }

  getVariantSetEntries(id: string | number) {
    return this.daemon.get<unknown>(`/api/portal/variant-sets/${id}`);
  }

  uploadVariantSet(formData: FormData) {
    return this.daemon.post<unknown>('/api/portal/variant-sets', formData);
  }

  deleteVariantSet(id: string | number) {
    return this.daemon.delete<unknown>(`/api/portal/variant-sets/${id}`);
  }

  // ── Panels ──────────────────────────────────────────────────────────
  getPanels() {
    return this.daemon.get<unknown>('/api/portal/wes-panels');
  }

  /** Returns the full panel record including interpretation_genes by reading the custom JSON directly. */
  getPanelById(id: string): Record<string, unknown> | null {
    try {
      if (!fs.existsSync(WES_PANELS_CUSTOM_PATH)) return null;
      const raw = fs.readFileSync(WES_PANELS_CUSTOM_PATH, 'utf-8');
      const data = JSON.parse(raw) as { panels?: Record<string, unknown>[] };
      const panels = Array.isArray(data.panels) ? data.panels : [];
      const panel = panels.find((p) => p['id'] === id);
      return panel ?? null;
    } catch {
      return null;
    }
  }

  savePanel(body: unknown) {
    return this.daemon.post<unknown>('/api/portal/wes-panels/custom', body);
  }

  deletePanel(id: string) {
    return this.daemon.delete<unknown>(`/api/portal/wes-panels/custom/${encodeURIComponent(id)}`);
  }

  // ── File browse (daemon server paths) ───────────────────────────────
  browseFastq(path: string, serviceCode: string) {
    return this.daemon.get<unknown>('/api/fastq/browse', { path, service_code: serviceCode });
  }

  browseBamCsv(query: Record<string, string | undefined>) {
    return this.daemon.get<unknown>('/api/portal/bam-csv/browse', query);
  }

  // ── Literature ──────────────────────────────────────────────────────
  async getLiteratureStats() {
    try {
      const stats = await this.daemon.get<Record<string, unknown>>('/api/literature/articles/stats');
      if (stats?.enabled === false) {
        return {
          enabled: false,
          total: 0,
          total_articles: 0,
          unique_genes: 0,
          total_searches: 0,
          genes: [] as string[],
        };
      }
      const totalArticles = Number(stats.total_articles ?? 0);
      return {
        enabled: true,
        total: totalArticles,
        total_articles: totalArticles,
        unique_genes: Number(stats.unique_genes ?? 0),
        total_searches: Number(stats.total_searches ?? 0),
        genes: Array.isArray(stats.genes) ? stats.genes : [],
      };
    } catch {
      return {
        enabled: false,
        total: 0,
        total_articles: 0,
        unique_genes: 0,
        total_searches: 0,
        genes: [] as string[],
        db_missing: true,
      };
    }
  }

  async getLiteratureArticles(query: LitQuery) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const perPage = Math.min(200, Math.max(1, Number(query.per_page ?? 50) || 50));
    const cursor = (page - 1) * perPage;
    const daemonQuery = {
      cursor,
      count: perPage,
      search: typeof query.q === 'string' ? query.q : '',
      sort_by: typeof query.sort === 'string' && query.sort ? query.sort : 'cached_at',
    };
    try {
      const res = await this.daemon.get<Record<string, unknown>>('/api/literature/articles', daemonQuery);
      return {
        articles: Array.isArray(res.articles) ? res.articles : [],
        total: Number(res.total ?? 0),
        page,
        per_page: perPage,
        cursor: Number(res.cursor ?? cursor),
        next_cursor: res.next_cursor,
        has_more: Boolean(res.has_more),
      };
    } catch {
      return {
        articles: [],
        total: 0,
        page,
        per_page: perPage,
        db_missing: true,
      };
    }
  }

  getLiteratureArticle(pmid: string) {
    return this.daemon.get<unknown>(`/api/literature/articles/${pmid}`);
  }

  deleteLiteratureArticle(pmid: string) {
    return this.daemon.delete<unknown>(`/api/literature/articles/${pmid}`);
  }

  clearLiteratureCache() {
    return this.daemon.delete<unknown>('/api/literature/cache');
  }

  async searchLiterature(query: LitQuery) {
    try {
      const res = await this.daemon.get<Record<string, unknown>>('/api/literature/search', query);
      const totalFound = Number(res.total_found ?? res.total ?? 0);
      return {
        ...res,
        articles: Array.isArray(res.articles) ? res.articles : [],
        total: totalFound,
        total_found: totalFound,
      };
    } catch {
      return { articles: [], total: 0, total_found: 0, db_missing: true };
    }
  }
}
