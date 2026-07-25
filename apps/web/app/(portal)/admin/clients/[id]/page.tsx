import { notFound } from 'next/navigation';
import { ClientFormPage } from '../../../../../components/admin/clients/ClientFormPage';

export const metadata = { title: 'Client — Gx-Portal' };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <ClientFormPage id={id} />;
}
