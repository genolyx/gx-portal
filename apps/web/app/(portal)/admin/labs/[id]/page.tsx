import { LabFormPage } from '../../../../../components/admin/labs/LabFormPage';

export default async function LabDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LabFormPage id={id} />;
}
