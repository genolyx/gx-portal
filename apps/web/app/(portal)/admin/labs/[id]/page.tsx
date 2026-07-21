import { LabFormPage } from '../../../../../components/admin/labs/LabFormPage';

export default function LabDetailPage({ params }: { params: { id: string } }) {
  return <LabFormPage id={params.id} />;
}
