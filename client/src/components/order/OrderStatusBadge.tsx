import { Badge } from '../ui/Badge';
import type { OrderStatus } from '../../types/order';

const TONE: Record<OrderStatus, 'neutral' | 'indigo' | 'marigold' | 'emerald' | 'coral'> = {
  pending: 'neutral',
  confirmed: 'indigo',
  processing: 'marigold',
  shipped: 'indigo',
  delivered: 'emerald',
  cancelled: 'coral',
  refunded: 'coral',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={TONE[status]}>{status}</Badge>;
}
