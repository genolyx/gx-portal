'use client';

import { useRouter } from 'next/navigation';
import { Button, Card } from '@heroui/react';

type StatusPageProps = {
  code: string;
  title: string;
  description: string;
  /** Shown under the description (e.g. error message). */
  detail?: string;
  /** Use full viewport height (root 404/error outside the app shell). */
  fullScreen?: boolean;
  primaryLabel?: string;
  primaryHref?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

/** Shared HeroUI layout for 404 / error surfaces. */
export function StatusPage({
  code,
  title,
  description,
  detail,
  fullScreen = false,
  primaryLabel = 'Go to Dashboard',
  primaryHref = '/dashboard',
  onPrimary,
  secondaryLabel,
  onSecondary,
}: StatusPageProps) {
  const router = useRouter();

  return (
    <div
      className={
        fullScreen
          ? 'min-h-screen flex items-center justify-center p-6'
          : 'min-h-[60vh] flex items-center justify-center py-10'
      }
    >
      <Card className="w-full max-w-md" variant="secondary">
        <Card.Header>
          <p className="text-sm font-medium text-muted tabular-nums tracking-wide">{code}</p>
          <Card.Title className="mt-1">{title}</Card.Title>
          <Card.Description>{description}</Card.Description>
        </Card.Header>
        {detail ? (
          <Card.Content>
            <p className="text-sm text-danger break-words">{detail}</p>
          </Card.Content>
        ) : null}
        <Card.Footer className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onPress={() => {
              if (onPrimary) onPrimary();
              else router.push(primaryHref);
            }}
          >
            {primaryLabel}
          </Button>
          {secondaryLabel && onSecondary ? (
            <Button variant="secondary" onPress={onSecondary}>
              {secondaryLabel}
            </Button>
          ) : null}
          <Button variant="ghost" onPress={() => router.back()}>
            Go back
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}
