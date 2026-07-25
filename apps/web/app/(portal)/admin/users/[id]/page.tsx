import { notFound } from 'next/navigation';
import { UserFormPage } from '../../../../../components/admin/users/UserFormPage';

export const metadata = { title: 'User — Gx-Portal' };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <UserFormPage id={id} />;
}
