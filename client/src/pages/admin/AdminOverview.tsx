import { Users, Store, ShoppingCart, DollarSign } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';

const kpis = [
  { label: 'Gross revenue', value: '—', icon: DollarSign, tone: 'text-marigold-600 bg-marigold-100' },
  { label: 'Orders', value: '—', icon: ShoppingCart, tone: 'text-indigo-600 bg-indigo-50' },
  { label: 'Active vendors', value: '—', icon: Store, tone: 'text-emerald-600 bg-emerald-100' },
  { label: 'Customers', value: '—', icon: Users, tone: 'text-ink-soft bg-slate-100' },
];

export function AdminOverview() {
  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-slate">
          Live figures connect once analytics ships in Phase 10 — this is the layout, wired with real data later.
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

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-medium">Pending vendor approvals</h2>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-slate">Vendor approval queue is built in Phase 4.</p>
        </CardBody>
      </Card>
    </div>
  );
}
