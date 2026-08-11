import { cn } from '../../utils/cn';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-lg font-semibold text-ink', className)}>
      Market<span className="text-indigo-500">Sphere</span>
    </span>
  );
}
