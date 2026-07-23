import { UserFormPage } from '../../../../../components/admin/users/UserFormPage';

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserFormPage id={id} />;
}
