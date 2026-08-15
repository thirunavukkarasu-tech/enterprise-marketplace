import { useState } from 'react';
import { X } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

interface ReasonDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  reasonLabel?: string;
  reasonRequired?: boolean;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

/**
 * One reusable dialog backs both "reject" (reason required) and
 * "suspend" (reason optional) — same shape, different copy and
 * requiredness, rather than two near-duplicate components.
 */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  reasonLabel = 'Reason',
  reasonRequired = false,
  destructive = false,
  onCancel,
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (reasonRequired && reason.trim().length < 10) {
      setError('Please provide a reason of at least 10 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setError(anyErr.response?.data?.message ?? 'Something went wrong.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex items-center justify-between">
          <h2 className="font-medium text-ink">{title}</h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="text-slate hover:text-ink">
            <X size={16} />
          </button>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm text-slate">{description}</p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="reason-dialog-input" className="text-sm font-medium text-ink-soft">
              {reasonLabel} {reasonRequired ? '' : '(optional)'}
            </label>
            <textarea
              id="reason-dialog-input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {error && <p className="text-xs text-coral-600">{error}</p>}

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={destructive ? 'danger' : 'primary'}
              size="sm"
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
