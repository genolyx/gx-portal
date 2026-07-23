import { ClientFormPage } from '../../../../../components/admin/clients/ClientFormPage';

export const metadata = { title: 'Client — Gx-Portal' };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientFormPage id={id} />;
}
