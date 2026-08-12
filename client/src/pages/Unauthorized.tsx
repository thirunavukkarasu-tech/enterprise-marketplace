import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function Unauthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="rounded-full bg-coral-100 p-3 text-coral-600">
        <ShieldAlert size={22} />
      </div>
      <h1 className="text-xl font-semibold text-ink">You don't have access to this page</h1>
      <p className="max-w-sm text-sm text-slate">
        Your account doesn't have the right role for this section of MarketSphere.
      </p>
      <Link to="/">
        <Button variant="secondary" size="sm" className="mt-1">
          Back to shop
        </Button>
      </Link>
    </div>
  );
}
