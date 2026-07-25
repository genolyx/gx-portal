export type FontSize = 'sm' | 'md' | 'lg';

export const FONT_SIZE_STORAGE_KEY = 'gx-portal-font-size';

export function getStoredFontSize(): FontSize {
  if (typeof window === 'undefined') return 'md';
  try {
    const stored = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (stored === 'sm' || stored === 'lg') return stored;
    return 'md';
  } catch {
    return 'md';
  }
}

export function applyFontSize(size: FontSize) {
  document.documentElement.setAttribute('data-font-size', size);
}

export function setFontSize(size: FontSize) {
  applyFontSize(size);
  try { localStorage.setItem(FONT_SIZE_STORAGE_KEY, size); } catch { /* ignore */ }
}
