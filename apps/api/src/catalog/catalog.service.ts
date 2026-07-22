import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { DaemonService } from '../daemon/daemon.service';

const WES_PANELS_CUSTOM_PATH =
  process.env.WES_PANELS_CUSTOM_JSON ?? '/data/wes_panels/wes_panels_custom.json';

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
  getLiteratureStats() {
    return this.daemon.get<unknown>('/api/literature/articles/stats').catch(() => ({ total: 0, by_gene: {} }));
  }

  getLiteratureArticles(query: Record<string, string | number | boolean | undefined>) {
    return this.daemon.get<unknown>('/api/literature/articles', query)
      .catch(() => ({ articles: [], total: 0, page: 1, per_page: 20, db_missing: true }));
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

  searchLiterature(query: Record<string, string | number | boolean | undefined>) {
    return this.daemon.get<unknown>('/api/literature/search', query)
      .catch(() => ({ articles: [], total: 0, db_missing: true }));
  }
}
