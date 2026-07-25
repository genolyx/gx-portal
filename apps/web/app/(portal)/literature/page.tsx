import { Suspense } from 'react';
import { LiteraturePageClient } from '../../../components/catalog/LiteraturePageClient';

export const metadata = { title: 'Literature' };

export default function LiteraturePage() {
  return (
    <Suspense fallback={<p className="text-muted p-4">Loading…</p>}>
      <LiteraturePageClient />
    </Suspense>
  );
}
