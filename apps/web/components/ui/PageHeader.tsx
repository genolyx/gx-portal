'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@heroui/react';

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, backHref, actions }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        {backHref && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit gap-1.5 px-2"
            onPress={() => router.push(backHref)}
          >
            <ArrowLeft size={14} strokeWidth={2} aria-hidden />
            Back
          </Button>
        )}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-base text-muted opacity-90">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
