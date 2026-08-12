import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppStore';
import type { Role } from '../types/role';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
  children: ReactNode;
}

/**
 * Wraps role-restricted route trees (admin/vendor/delivery). This is a UX
 * convenience, not the security boundary — the actual enforcement is
 * `requireAuth` + `requireRole` on the server, which is the only place
 * that can't be bypassed by editing client-side JavaScript. This
 * component's job is just to avoid flashing a dashboard shell at someone
 * who's about to get 401/403s from every request it makes.
 */
export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { status, user } = useAppSelector((state) => state.auth);
  const location = useLocation();

  // Session bootstrap (silent refresh) is still resolving — render
  // nothing rather than redirecting prematurely on a hard page load.
  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-500" />
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
