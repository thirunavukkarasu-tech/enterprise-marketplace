import { type LucideIcon, Inbox } from 'lucide-react';
import { type ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 py-14 text-center">
      <Icon className="text-slate" size={22} />
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
