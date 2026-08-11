import { Package } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export function DeliveryActive() {
  return (
    <div className="p-4">
      <h1 className="mb-4 text-lg font-semibold">Active deliveries</h1>

      <Card>
        <CardBody className="flex flex-col items-center gap-2 py-10 text-center">
          <Package className="text-slate" size={22} />
          <p className="text-sm font-medium text-ink">No assignments yet</p>
          <p className="max-w-[220px] text-xs text-slate">
            Shipment assignment and live tracking are built in Phase 8.
          </p>
          <Badge tone="neutral" className="mt-1">
            Phase 8
          </Badge>
        </CardBody>
      </Card>
    </div>
  );
}
