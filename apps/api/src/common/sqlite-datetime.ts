const HAS_TZ = /[zZ]$|[+-]\d{2}:\d{2}$/;

/**
 * SQLite `datetime('now')` stores UTC without a timezone suffix.
 * Append `Z` so clients parse it as UTC (portal UI then shows Asia/Seoul).
 * Values that already have an offset / Z are left unchanged.
 * Daemon/KST-naive timestamps must not go through this helper.
 */
export function sqliteUtcToIso(value?: string | null): string {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  if (HAS_TZ.test(s)) return s;
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  // Drop fractional seconds SQLite may omit; keep as-is otherwise
  return `${normalized}Z`;
}
