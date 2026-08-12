import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { authApi } from '../../features/auth/authApi';

type Status = 'verifying' | 'success' | 'error';

export function VerifyEmail() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing a token.');
      return;
    }

    authApi
      .verifyEmail(token)
      .then((msg) => {
        setStatus('success');
        setMessage(msg);
      })
      .catch((err) => {
        const anyErr = err as { response?: { data?: { message?: string } } };
        setStatus('error');
        setMessage(anyErr.response?.data?.message ?? 'This verification link is invalid or has expired.');
      });
  }, [token]);

  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      {status === 'verifying' && <Loader2 className="animate-spin text-indigo-500" size={28} />}
      {status === 'success' && <CheckCircle2 className="text-emerald-500" size={28} />}
      {status === 'error' && <XCircle className="text-coral-500" size={28} />}

      <h1 className="text-lg font-semibold text-ink">
        {status === 'verifying' ? 'Verifying your email…' : status === 'success' ? 'Email verified' : 'Verification failed'}
      </h1>
      {message && <p className="text-sm text-slate">{message}</p>}

      {status !== 'verifying' && (
        <Link to="/login" className="mt-2 text-sm font-medium text-indigo-600 hover:underline">
          Continue to sign in
        </Link>
      )}
    </div>
  );
}
