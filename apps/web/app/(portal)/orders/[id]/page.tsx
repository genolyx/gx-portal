import { OrderDetailPage } from '../../../../components/orders/OrderDetail/OrderDetailPage';

export default function OrderPage({ params }: { params: { id: string } }) {
  return <OrderDetailPage id={params.id} />;
}
