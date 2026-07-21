import { ClientFormPage } from '../../../../../components/admin/clients/ClientFormPage';

export const metadata = { title: 'Client — Gx-Portal' };

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  return <ClientFormPage id={params.id} />;
}
