export type Theme = 'light' | 'dark';
export type FontSize = 'sm' | 'md' | 'lg';

export const THEME_STORAGE_KEY     = 'gx-portal-theme';
export const FONT_SIZE_STORAGE_KEY = 'gx-portal-font-size';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function getStoredFontSize(): FontSize {
  if (typeof window === 'undefined') return 'sm';
  try {
    const stored = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (stored === 'md' || stored === 'lg') return stored;
    return 'sm';
  } catch {
    return 'sm';
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function applyFontSize(size: FontSize) {
  document.documentElement.setAttribute('data-font-size', size);
}

export function setTheme(theme: Theme) {
  applyTheme(theme);
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* ignore */ }
}

export function setFontSize(size: FontSize) {
  applyFontSize(size);
  try { localStorage.setItem(FONT_SIZE_STORAGE_KEY, size); } catch { /* ignore */ }
}
