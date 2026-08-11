import { type LucideIcon, Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  phase: string;
  icon?: LucideIcon;
  description?: string;
}

export function PlaceholderPage({ title, phase, icon: Icon = Construction, description }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="rounded-full bg-indigo-50 p-3 text-indigo-500">
        <Icon size={22} />
      </div>
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="max-w-sm text-sm text-slate">
        {description ?? `This screen is scaffolded now and gets built out in ${phase}.`}
      </p>
    </div>
  );
}
