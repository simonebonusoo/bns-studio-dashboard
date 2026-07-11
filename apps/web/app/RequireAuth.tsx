import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/stores/auth';

/**
 * Guardia delle route applicative. Stati espliciti:
 *   A) non autenticato (no userId)            → /login
 *   B/D) autenticato senza membership         → /onboarding (la pagina distingue
 *        "bootstrap disponibile" da "account non associato")
 *   C) autenticato con membership             → applicazione
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const userId = useAuth((s) => s.userId);
  const memberId = useAuth((s) => s.memberId);
  const location = useLocation();

  if (!userId) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (!memberId) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
