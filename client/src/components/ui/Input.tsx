import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <input
          ref={ref}
          className={cn(
            'h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-ink placeholder:text-slate',
            'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100',
            error && 'border-coral-500 focus:border-coral-500 focus:ring-coral-100',
            className
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {error && <p className="text-xs text-coral-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
