import clsx from 'clsx';
import styles from './Badge.module.css';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={clsx(styles.badge, styles[variant], className)}>
      {children}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, BadgeVariant> = {
    COMPLETED: 'success',
    REPORT_READY: 'success',
    RUNNING: 'info',
    QUEUED: 'warning',
    FAILED: 'danger',
    CANCELLED: 'danger',
    SAVED: 'default',
  };
  const variant = variantMap[status] ?? 'default';
  return <Badge variant={variant}>{status}</Badge>;
}
