import { Badge } from '../ui/Badge';
import type { ProductStatus } from '../../types/catalog';

const toneByStatus: Record<ProductStatus, 'emerald' | 'neutral' | 'marigold'> = {
  active: 'emerald',
  draft: 'neutral',
  archived: 'marigold',
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  return <Badge tone={toneByStatus[status]}>{status}</Badge>;
}
