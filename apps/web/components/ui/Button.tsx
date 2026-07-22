import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap',
    'rounded-gx-sm transition-colors',
    'disabled:opacity-50 disabled:pointer-events-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gx-accent focus-visible:ring-offset-1',
  ],
  {
    variants: {
      variant: {
        primary:   'bg-gx-accent text-white hover:bg-gx-accent-hover',
        accent:    'bg-gx-accent text-white hover:bg-gx-accent-hover',
        secondary: 'bg-gx-elevated text-gx-text border border-gx-border hover:bg-gx-border',
        danger:    'bg-gx-danger text-white hover:opacity-85',
        ghost:     'bg-transparent text-gx-text-2 hover:text-gx-text hover:bg-gx-elevated',
        outline:   'bg-transparent border border-gx-border text-gx-text hover:bg-gx-elevated',
      },
      size: {
        sm:      'px-2.5 py-1 text-xs',
        default: 'px-3.5 py-[7px] text-sm',
        md:      'px-3.5 py-[7px] text-sm',
        lg:      'px-5 py-2.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'default',
    },
  },
);

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize    = 'sm' | 'default' | 'md' | 'lg';

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading, className, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-gx-spin" />
      )}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
