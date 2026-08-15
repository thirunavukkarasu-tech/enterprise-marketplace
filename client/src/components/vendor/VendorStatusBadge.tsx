import { Badge } from '../ui/Badge';
import type { VendorStatus } from '../../types/vendor';

const TONE: Record<VendorStatus, 'neutral' | 'emerald' | 'coral' | 'marigold'> = {
  pending: 'marigold',
  approved: 'emerald',
  rejected: 'coral',
  suspended: 'coral',
};

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  return <Badge tone={TONE[status]}>{status}</Badge>;
}
