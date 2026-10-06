export interface GvcPanelRecord {
  code: string;
  name: string;
}

export const DEFAULT_GVC_PANELS: GvcPanelRecord[] = [
  { code: 'carrier-2000', name: 'Carrier 2000+' },
  { code: 'hereditary-cancer-71', name: 'Hereditary Cancer 71' },
];

const META_KEY = 'gvc_panels';

export function gvcPanelsMetaKey(): string {
  return META_KEY;
}

/** Comparison key. The stored code stays the text pasted from GVC. */
export function gvcPanelCodeKey(raw: string): string {
  return raw.trim().toLowerCase();
}

export function pastedGvcPanelCode(raw: string): string {
  return raw.trim();
}

/** Missing storage uses the two panels already shared with GVC. An empty list stays empty. */
export function parseGvcPanels(raw: string | null | undefined): GvcPanelRecord[] {
  if (raw == null || raw.trim() === '') {
    return DEFAULT_GVC_PANELS.map((panel) => ({ ...panel }));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_GVC_PANELS.map((panel) => ({ ...panel }));
  }
  if (!Array.isArray(parsed)) return DEFAULT_GVC_PANELS.map((panel) => ({ ...panel }));
  const panels: GvcPanelRecord[] = [];
  const seen = new Set<string>();
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue;
    const record = row as { code?: unknown; name?: unknown };
    const code = pastedGvcPanelCode(typeof record.code === 'string' ? record.code : '');
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const key = gvcPanelCodeKey(code);
    if (!key || code.length > 80 || !name || name.length > 200 || seen.has(key)) continue;
    seen.add(key);
    panels.push({ code, name });
  }
  return panels;
}

export function upsertGvcPanel(
  panels: GvcPanelRecord[],
  input: { code: string; name: string; previousCode?: string },
): { ok: true; panels: GvcPanelRecord[] } | { ok: false; message: string } {
  const code = pastedGvcPanelCode(input.code);
  const name = input.name.trim();
  const previous = input.previousCode ? gvcPanelCodeKey(input.previousCode) : '';
  const key = gvcPanelCodeKey(code);
  if (!name || name.length > 200) return { ok: false, message: 'Name is required.' };
  if (!key) return { ok: false, message: 'Code is required.' };
  if (code.length > 80) return { ok: false, message: 'Code must be 80 characters or fewer.' };
  const next = panels.map((panel) => ({ ...panel }));
  if (!previous) {
    if (next.some((panel) => gvcPanelCodeKey(panel.code) === key)) {
      return { ok: false, message: `Code ${code} is already used.` };
    }
    next.push({ code, name });
    return { ok: true, panels: next };
  }
  const index = next.findIndex((panel) => gvcPanelCodeKey(panel.code) === previous);
  if (index < 0) return { ok: false, message: `Panel ${input.previousCode} was not found.` };
  if (next.some((panel) => gvcPanelCodeKey(panel.code) === key && gvcPanelCodeKey(panel.code) !== previous)) {
    return { ok: false, message: `Code ${code} is already used.` };
  }
  next[index] = { code, name };
  return { ok: true, panels: next };
}

export function removeGvcPanel(panels: GvcPanelRecord[], code: string): GvcPanelRecord[] {
  const key = gvcPanelCodeKey(code);
  return panels.filter((panel) => gvcPanelCodeKey(panel.code) !== key);
}
