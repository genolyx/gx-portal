import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex w-full rounded-gx-sm border border-gx-border bg-gx-elevated',
        'px-3 py-2 text-sm text-gx-text placeholder:text-gx-muted',
        'outline-none transition-colors',
        'focus:border-gx-accent',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
