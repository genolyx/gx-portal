'use client';

import { useEffect, useState } from 'react';
import { getStoredTheme, setTheme, type Theme } from '../../lib/theme';
import { getStoredFontSize, setFontSize, type FontSize } from '../../lib/theme';
import { cn } from '../../lib/utils';

// ─── Font Size Toggle ─────────────────────────────────────────────────────────

const FONT_SIZES: { value: FontSize; label: string; title: string }[] = [
  { value: 'sm', label: 'S', title: 'Small'  },
  { value: 'md', label: 'M', title: 'Medium' },
  { value: 'lg', label: 'L', title: 'Large'  },
];

export function FontSizeToggle() {
  const [size, setSizeState] = useState<FontSize>('sm');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSizeState(getStoredFontSize());
  }, []);

  const select = (next: FontSize) => {
    setFontSize(next);
    setSizeState(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gx-muted px-1">
        Font Size
      </span>
      <div className="grid grid-cols-3 gap-1" suppressHydrationWarning>
        {FONT_SIZES.map(({ value, label, title }) => {
          const active = mounted && size === value;
          return (
            <button
              key={value}
              type="button"
              title={title}
              onClick={() => select(value)}
              suppressHydrationWarning
              className={cn(
                'py-1.5 rounded-gx-sm border text-xs font-semibold transition-colors',
                active
                  ? 'bg-gx-accent-dim text-gx-accent border-gx-accent'
                  : 'bg-gx-elevated text-gx-text-2 border-gx-border hover:border-gx-accent hover:text-gx-text',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setThemeState(getStoredTheme());
  }, []);

  const select = (next: Theme) => {
    setTheme(next);
    setThemeState(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gx-muted px-1">
        Theme
      </span>
      <div className="grid grid-cols-2 gap-1.5" suppressHydrationWarning>
        {(['light', 'dark'] as Theme[]).map((t) => {
          const active = mounted && theme === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => select(t)}
              suppressHydrationWarning
              className={cn(
                'py-1.5 rounded-gx-sm border text-xs font-semibold capitalize transition-colors',
                active
                  ? 'bg-gx-accent-dim text-gx-accent border-gx-accent'
                  : 'bg-gx-elevated text-gx-text-2 border-gx-border hover:border-gx-accent hover:text-gx-text',
              )}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}
