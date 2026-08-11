import { type HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type Tone = 'neutral' | 'indigo' | 'marigold' | 'emerald' | 'coral';

const toneStyles: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-ink-soft',
  indigo: 'bg-indigo-50 text-indigo-700',
  marigold: 'bg-marigold-100 text-marigold-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  coral: 'bg-coral-100 text-coral-600',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-medium uppercase tracking-wide',
        toneStyles[tone],
        className
      )}
      {...props}
    />
  );
}
