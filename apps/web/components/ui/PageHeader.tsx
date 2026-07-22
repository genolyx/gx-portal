import Link from 'next/link';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, backHref, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-7', className)}>
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="inline-block text-xs text-gx-text-2 hover:text-gx-text mb-1.5 transition-colors"
          >
            ← Go back
          </Link>
        )}
        <h1 className="text-2xl font-bold text-gx-text leading-tight">{title}</h1>
        {description && <p className="text-sm text-gx-text-2 mt-0.5">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
