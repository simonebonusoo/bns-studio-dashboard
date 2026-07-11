import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/stores/auth';

/** Protegge le route applicative: reindirizza al login se non autenticato. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const memberId = useAuth((s) => s.memberId);
  const location = useLocation();
  if (!memberId) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}
