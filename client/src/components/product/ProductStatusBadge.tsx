import { Badge } from '../ui/Badge';
import type { ProductStatus } from '../../types/catalog';

const TONE: Record<ProductStatus, 'neutral' | 'emerald' | 'coral'> = {
  draft: 'neutral',
  active: 'emerald',
  archived: 'coral',
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <Badge tone={TONE[status]}>{status}</Badge>;
}
