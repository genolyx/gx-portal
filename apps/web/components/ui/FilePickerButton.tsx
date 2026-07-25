'use client';

import { useEffect, useRef } from 'react';
import { FileUp, X } from 'lucide-react';
import { Button } from '@heroui/react';

interface Props {
  accept?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/** HeroUI-styled file picker: Button opens a hidden native file input. */
export function FilePickerButton({
  accept,
  file,
  onChange,
  label = 'Choose file',
  disabled,
  'aria-label': ariaLabel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = '';
  }, [file]);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        isDisabled={disabled}
        aria-label={ariaLabel ?? label}
        className="gap-1.5"
        onPress={() => inputRef.current?.click()}
      >
        <FileUp size={14} strokeWidth={2} aria-hidden />
        {file ? 'Change file' : label}
      </Button>
      {file && (
        <>
          <span className="max-w-[220px] truncate text-sm text-muted" title={file.name}>
            {file.name}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isIconOnly
            isDisabled={disabled}
            aria-label="Clear selected file"
            onPress={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
          >
            <X size={14} strokeWidth={2} aria-hidden />
          </Button>
        </>
      )}
    </div>
  );
}
