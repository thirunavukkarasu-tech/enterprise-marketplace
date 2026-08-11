import { Package, ShoppingCart, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';

const kpis = [
  { label: 'This month revenue', value: '—', icon: TrendingUp, tone: 'text-marigold-600 bg-marigold-100' },
  { label: 'Open orders', value: '—', icon: ShoppingCart, tone: 'text-indigo-600 bg-indigo-50' },
  { label: 'Products listed', value: '—', icon: Package, tone: 'text-emerald-600 bg-emerald-100' },
  { label: 'Low-stock alerts', value: '—', icon: AlertTriangle, tone: 'text-coral-600 bg-coral-100' },
];

export function VendorOverview() {
  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Vendor dashboard</h1>
        <p className="text-sm text-slate">
          Product, inventory, and order data connect in Phases 3, 4, and 7.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardBody className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate">{kpi.label}</p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-ink">{kpi.value}</p>
                </div>
                <span className={`rounded-md p-2 ${kpi.tone}`}>
                  <Icon size={18} />
                </span>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
