'use client';

import { useEffect } from 'react';
import { StatusPage } from '../components/ui/StatusPage';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      fullScreen
      code="Error"
      title="Something went wrong"
      description="An unexpected error occurred while loading this page."
      detail={error.message || undefined}
      primaryLabel="Try again"
      onPrimary={reset}
      secondaryLabel="Go to Dashboard"
      onSecondary={() => {
        window.location.href = '/dashboard';
      }}
    />
  );
}
