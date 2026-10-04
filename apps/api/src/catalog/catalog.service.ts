import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DaemonService } from '../daemon/daemon.service';

const WES_PANELS_CUSTOM_PATH =
  process.env.WES_PANELS_CUSTOM_JSON ?? '/data/wes_panels/wes_panels_custom.json';

const CAPTURE_PANELS_PATH =
  process.env.CAPTURE_PANELS_PATH ??
  path.join(path.dirname(process.env.USERS_DB_PATH || '/data/users.db'), 'capture_panels.json');

export interface CapturePanelRecord {
  id: string;
  label: string;
  primary_bed?: string;
  capture_bed?: string;
  builtin?: boolean;
  /** True for the kit Create Order selects first. Not stored on each row. */
  default?: boolean;
}

const TWIST_EXOME2_PRIMARY_BED =
  '/home/ken/gx-exome/data/bed/twist-exome2/targets.bed';

const BUILTIN_CAPTURE_PANELS: CapturePanelRecord[] = [
  {
    id: 'twist-exome2',
    label: 'Twist Exome 2.0',
    primary_bed: TWIST_EXOME2_PRIMARY_BED,
    builtin: true,
  },
];

const CAPTURE_PANEL_ID_RE = /^[a-z][a-z0-9_-]{1,63}$/;

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
    const record = body && typeof body === 'object' ? { ...(body as Record<string, unknown>) } : {};
    if (record.interpretation_genes_only === true) record.skip_generated_bed = true;
    delete record.interpretation_genes_only;
    return this.daemon.post<unknown>('/api/portal/wes-panels/custom', record);
  }

  deletePanel(id: string) {
    return this.daemon.delete<unknown>(`/api/portal/wes-panels/custom/${encodeURIComponent(id)}`);
  }

  // ── Capture kits (Twist / Roche HyperExome, …) ─────────────────────
  listCapturePanels(): { panels: CapturePanelRecord[] } {
    const store = this.readCaptureStore();
    const byId = new Map<string, CapturePanelRecord>();
    for (const builtin of BUILTIN_CAPTURE_PANELS) byId.set(builtin.id, { ...builtin });
    for (const row of store.panels) {
      const base = byId.get(row.id);
      byId.set(row.id, {
        ...base,
        ...row,
        primary_bed: row.primary_bed || base?.primary_bed,
        capture_bed: row.capture_bed || base?.capture_bed,
        builtin: base?.builtin || undefined,
        default: undefined,
      });
    }
    const ids = [...byId.keys()];
    const fallback = ids.includes('twist-exome2') ? 'twist-exome2' : ids[0] ?? '';
    const defaultId = ids.includes(store.defaultId) ? store.defaultId : fallback;
    return {
      panels: [...byId.values()].map((panel) => ({
        ...panel,
        default: panel.id === defaultId,
      })),
    };
  }

  saveCapturePanel(body: unknown): CapturePanelRecord {
    const raw = (body ?? {}) as Record<string, unknown>;
    const id = String(raw.id ?? '').trim();
    const label = String(raw.label ?? '').trim();
    const primary = String(raw.primary_bed ?? '').trim();
    const capture = String(raw.capture_bed ?? '').trim();
    if (!CAPTURE_PANEL_ID_RE.test(id)) {
      throw new BadRequestException(
        'Panel ID must start with a letter and use lowercase letters, digits, _ or -.',
      );
    }
    if (!label) throw new BadRequestException('Display name is required.');
    const isBuiltin = BUILTIN_CAPTURE_PANELS.some((p) => p.id === id);
    if (!isBuiltin && !primary) {
      throw new BadRequestException('Primary BED is required. It is the calling target (primary.bed / targets.bed).');
    }
    const row: CapturePanelRecord = {
      id,
      label,
      ...(primary ? { primary_bed: primary } : {}),
      ...(capture ? { capture_bed: capture } : {}),
    };
    const store = this.readCaptureStore();
    const custom = store.panels.filter((p) => p.id !== id);
    custom.push(row);
    this.writeCaptureStore(custom, store.defaultId);
    return { ...row, ...(isBuiltin ? { builtin: true } : {}) };
  }

  setDefaultCapturePanel(id: string): { panels: CapturePanelRecord[] } {
    const known = this.listCapturePanels().panels.some((p) => p.id === id);
    if (!known) throw new BadRequestException(`Capture panel '${id}' was not found.`);
    const store = this.readCaptureStore();
    this.writeCaptureStore(store.panels, id);
    return this.listCapturePanels();
  }

  deleteCapturePanel(id: string): { ok: true } {
    const store = this.readCaptureStore();
    const next = store.panels.filter((p) => p.id !== id);
    if (next.length === store.panels.length && !BUILTIN_CAPTURE_PANELS.some((p) => p.id === id)) {
      throw new BadRequestException(`Capture panel '${id}' was not found.`);
    }
    const defaultId = store.defaultId === id ? 'twist-exome2' : store.defaultId;
    this.writeCaptureStore(next, defaultId);
    return { ok: true };
  }

  private readCaptureStore(): { defaultId: string; panels: CapturePanelRecord[] } {
    try {
      if (!fs.existsSync(CAPTURE_PANELS_PATH)) return { defaultId: '', panels: [] };
      const data = JSON.parse(fs.readFileSync(CAPTURE_PANELS_PATH, 'utf-8')) as {
        default_id?: string;
        panels?: CapturePanelRecord[];
      };
      return {
        defaultId: String(data.default_id ?? '').trim(),
        panels: Array.isArray(data.panels) ? data.panels : [],
      };
    } catch {
      return { defaultId: '', panels: [] };
    }
  }

  private writeCaptureStore(panels: CapturePanelRecord[], defaultId: string) {
    fs.mkdirSync(path.dirname(CAPTURE_PANELS_PATH), { recursive: true });
    const tmp = `${CAPTURE_PANELS_PATH}.tmp`;
    const body = {
      ...(defaultId ? { default_id: defaultId } : {}),
      panels: panels.map((row) => ({
        id: row.id,
        label: row.label,
        ...(row.primary_bed ? { primary_bed: row.primary_bed } : {}),
        ...(row.capture_bed ? { capture_bed: row.capture_bed } : {}),
      })),
    };
    fs.writeFileSync(tmp, JSON.stringify(body, null, 2));
    fs.renameSync(tmp, CAPTURE_PANELS_PATH);
  }

  // ── File browse (daemon server paths) ───────────────────────────────
  browseFastq(path: string, serviceCode: string) {
    return this.daemon.get<unknown>('/api/fastq/browse', { path, service_code: serviceCode });
  }

  pipeFastqUpload(serviceCode: string, filename: string, incoming: import('http').IncomingMessage) {
    const qs = new URLSearchParams({
      service_code: serviceCode,
      filename,
    });
    return this.daemon.pipeBody(`/api/fastq/upload?${qs.toString()}`, incoming);
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
