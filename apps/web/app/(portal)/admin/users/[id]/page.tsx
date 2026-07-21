import { UserFormPage } from '../../../../../components/admin/users/UserFormPage';

export default function UserDetailPage({ params }: { params: { id: string } }) {
  return <UserFormPage id={params.id} />;
}
