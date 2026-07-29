/** Shared Admin preference: show non-portal services (e.g. nipt) on Orders / Dashboard. */
export const INCLUDE_EXTERNAL_KEY = 'gx-portal.orders.includeExternal';

export function readIncludeExternalPreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(INCLUDE_EXTERNAL_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeIncludeExternalPreference(value: boolean): void {
  try {
    localStorage.setItem(INCLUDE_EXTERNAL_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}
