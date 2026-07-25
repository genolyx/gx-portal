'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StatusPage } from '../../components/ui/StatusPage';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      code="Error"
      title="Something went wrong"
      description="An unexpected error occurred while loading this page."
      detail={error.message || undefined}
      primaryLabel="Try again"
      onPrimary={reset}
      secondaryLabel="Go to Dashboard"
      onSecondary={() => router.push('/dashboard')}
    />
  );
}
