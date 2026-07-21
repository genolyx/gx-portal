import { ReviewPageClient } from '../../../../components/review/ReviewPageClient';

export default function ReviewPage({ params }: { params: { orderId: string } }) {
  return <ReviewPageClient orderId={params.orderId} />;
}
