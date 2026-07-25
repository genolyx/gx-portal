import { notFound } from 'next/navigation';
import { LabFormPage } from '../../../../../components/admin/labs/LabFormPage';

export const metadata = { title: 'Lab — Gx-Portal' };

export default async function LabDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <LabFormPage id={id} />;
}
