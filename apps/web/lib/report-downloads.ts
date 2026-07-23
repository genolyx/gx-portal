const STORAGE_KEY = 'portalReportDownloadedByOrder';

type DownloadMap = Record<string, Record<string, boolean>>;

function readMap(): DownloadMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : {};
    return parsed && typeof parsed === 'object' ? (parsed as DownloadMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: DownloadMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch { /* quota */ }
}

/** e.g. pdf-EN, html-CN — matches legacy Portal keys. */
export function reportDownloadKey(filename: string): string {
  const isPdf = /\.pdf$/i.test(filename);
  const langM = filename.match(/_([A-Z]{2,3})\.(pdf|html)$/i);
  const lang = langM ? langM[1].toUpperCase() : '';
  const kind = isPdf ? 'pdf' : 'html';
  return lang ? `${kind}-${lang}` : kind;
}

export function isReportDownloaded(orderId: string, key: string): boolean {
  const id = orderId.trim();
  if (!id || !key) return false;
  return !!readMap()[id]?.[key];
}

export function markReportDownloaded(orderId: string, key: string): void {
  const id = orderId.trim();
  if (!id || !key) return;
  const map = readMap();
  if (!map[id]) map[id] = {};
  map[id][key] = true;
  writeMap(map);
}

export function reportLangLabel(filename: string): string {
  const m = filename.match(/_([A-Z]{2,3})\.(pdf|html)$/i);
  return m ? m[1].toUpperCase() : 'FILE';
}
