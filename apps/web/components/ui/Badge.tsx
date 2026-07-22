import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-gx-sm px-2 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-gx-elevated text-gx-text-2',
        success: 'bg-gx-success/15 text-gx-success',
        warning: 'bg-gx-warning/15 text-gx-warning',
        danger:  'bg-gx-danger/15  text-gx-danger',
        info:    'bg-gx-info/15    text-gx-info',
        accent:  'bg-gx-accent-dim text-gx-accent',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, className, children }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  );
}

type StatusVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, StatusVariant> = {
    COMPLETED:    'success',
    REPORT_READY: 'success',
    RUNNING:      'info',
    QUEUED:       'warning',
    FAILED:       'danger',
    CANCELLED:    'danger',
    SAVED:        'default',
  };
  return <Badge variant={map[status] ?? 'default'}>{status}</Badge>;
}
