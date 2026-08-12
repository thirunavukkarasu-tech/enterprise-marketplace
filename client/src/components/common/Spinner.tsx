import { cn } from '../../utils/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-500', className)}
    />
  );
}
