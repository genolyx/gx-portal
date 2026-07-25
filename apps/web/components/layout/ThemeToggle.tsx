'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { ToggleButton, ToggleButtonGroup, type Key } from '@heroui/react';
import { getStoredFontSize, setFontSize, type FontSize } from '../../lib/theme';

const FONT_SIZES: { value: FontSize; label: string; title: string }[] = [
  { value: 'sm', label: 'S', title: 'Small' },
  { value: 'md', label: 'M', title: 'Medium' },
  { value: 'lg', label: 'L', title: 'Large' },
];

function SegmentTrack({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted px-0.5">
        {label}
      </span>
      <div className="rounded-full bg-default p-0.5">{children}</div>
    </div>
  );
}

export function FontSizeToggle() {
  const [size, setSizeState] = useState<FontSize>('md');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSizeState(getStoredFontSize());
  }, []);

  const onSelectionChange = (keys: Set<Key>) => {
    const next = [...keys][0] as FontSize | undefined;
    if (!next) return;
    setFontSize(next);
    setSizeState(next);
  };

  return (
    <SegmentTrack label="Font size">
      <ToggleButtonGroup
        aria-label="Font size"
        selectionMode="single"
        disallowEmptySelection
        isDetached
        fullWidth
        size="sm"
        selectedKeys={mounted ? new Set([size]) : new Set()}
        onSelectionChange={onSelectionChange}
      >
        {FONT_SIZES.map(({ value, label, title }) => (
          <ToggleButton
            key={value}
            id={value}
            aria-label={title}
            variant="ghost"
            className="flex-1"
          >
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </SegmentTrack>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = theme === 'dark' ? 'dark' : 'light';

  const onSelectionChange = (keys: Set<Key>) => {
    const next = [...keys][0];
    if (next === 'light' || next === 'dark') setTheme(next);
  };

  return (
    <SegmentTrack label="Theme">
      <ToggleButtonGroup
        aria-label="Theme"
        selectionMode="single"
        disallowEmptySelection
        isDetached
        fullWidth
        size="sm"
        selectedKeys={mounted ? new Set([active]) : new Set()}
        onSelectionChange={onSelectionChange}
      >
        <ToggleButton id="light" aria-label="Light" variant="ghost" className="flex-1 gap-1.5">
          <Sun size={14} strokeWidth={2} aria-hidden />
          Light
        </ToggleButton>
        <ToggleButton id="dark" aria-label="Dark" variant="ghost" className="flex-1 gap-1.5">
          <Moon size={14} strokeWidth={2} aria-hidden />
          Dark
        </ToggleButton>
      </ToggleButtonGroup>
    </SegmentTrack>
  );
}
