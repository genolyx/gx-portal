import { ReviewPageClient } from '../../../../components/review/ReviewPageClient';

export default async function ReviewPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <ReviewPageClient orderId={orderId} />;
}
