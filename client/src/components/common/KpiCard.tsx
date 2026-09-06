import type { LucideIcon } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: string;
}

export function KpiCard({ label, value, icon: Icon, tone = 'text-indigo-600 bg-indigo-50' }: KpiCardProps) {
  return (
    <Card>
      <CardBody className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate">{label}</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-ink">{value}</p>
        </div>
        <span className={`rounded-md p-2 ${tone}`}>
          <Icon size={18} />
        </span>
      </CardBody>
    </Card>
  );
}

