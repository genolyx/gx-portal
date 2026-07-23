import { OrderDetailPage } from '../../../../components/orders/OrderDetail/OrderDetailPage';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailPage id={id} />;
}
