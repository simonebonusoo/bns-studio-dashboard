import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { brandConfig } from '@/config/brandConfig';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/States';
import { useAuth } from '@/stores/auth';
import { orgService } from '@/services/orgService';

type Phase = 'checking' | 'available' | 'locked' | 'check-error';

/**
 * Onboarding produzione per un utente Supabase autenticato SENZA membership.
 * Distingue lo stato B (bootstrap disponibile → primo setup) dallo stato D
 * (bootstrap non disponibile → account non ancora associato). Non effettua mai
 * insert diretti: il boundary è la RPC `bootstrap_owner` (auto-bloccante).
 */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const userId = useAuth((s) => s.userId);
  const memberId = useAuth((s) => s.memberId);
  const refresh = useAuth((s) => s.refresh);

  const [phase, setPhase] = useState<Phase>('checking');
  const [firstName, setFirstName] = useState('Simone');
  const [lastName, setLastName] = useState('Bonuso');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    orgService
      .isBootstrapAvailable()
      .then((available) => {
        if (active) setPhase(available ? 'available' : 'locked');
      })
      .catch(() => {
        if (active) setPhase('check-error');
      });
    return () => {
      active = false;
    };
  }, []);

  // Guardie di stato (A/C): l'onboarding vale solo per "autenticato senza org".
  if (!userId) return <Navigate to="/login" replace />;
  if (memberId) return <Navigate to="/" replace />;

  const configure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return; // niente doppio submit
    setSubmitting(true);
    try {
      await orgService.bootstrapOwner({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      // Ricarica profile/member/organization dalla sessione Supabase corrente.
      await refresh();
      const { role, memberId: newMemberId } = useAuth.getState();
      if (newMemberId && role === 'owner') {
        toast.success('BNS Studio configurato');
        navigate('/', { replace: true });
        return;
      }
      // Sessione valida ma ruolo inatteso: non forziamo l'accesso.
      toast.error('Configurazione completata ma ruolo non riconosciuto. Riprova ad accedere.');
      setSubmitting(false);
    } catch (error) {
      // La RPC è auto-bloccante: se un owner esiste già → passa allo stato D.
      const message = error instanceof Error ? error.message : 'Errore durante la configurazione';
      toast.error(message);
      setPhase('locked');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <img src={brandConfig.logos.light} alt={brandConfig.name} className="h-7 dark:hidden" />
          <img src={brandConfig.logos.dark} alt={brandConfig.name} className="hidden h-7 dark:block" />
        </div>

        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          {phase === 'checking' && <LoadingState label="Verifica configurazione…" />}

          {phase === 'check-error' && (
            <div className="space-y-4">
              <h1 className="text-lg font-semibold">Verifica non riuscita</h1>
              <p className="text-sm text-fg-subtle">
                Non è stato possibile verificare lo stato dell'organizzazione. Controlla la
                connessione e riprova.
              </p>
              <Button className="w-full" onClick={() => window.location.reload()}>
                Riprova
              </Button>
            </div>
          )}

          {phase === 'available' && (
            <form onSubmit={configure} className="space-y-5">
              <div className="space-y-1.5">
                <h1 className="text-lg font-semibold">Inizializza BNS Studio</h1>
                <p className="text-sm text-fg-subtle">
                  Il tuo account è autenticato. Completa la configurazione iniziale per creare
                  lo spazio operativo BNS Studio.
                </p>
              </div>
              <Field label="Nome">
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                />
              </Field>
              <Field label="Cognome">
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  required
                />
              </Field>
              <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
                Configura BNS Studio
              </Button>
            </form>
          )}

          {phase === 'locked' && (
            <div className="space-y-4">
              <h1 className="text-lg font-semibold">Account non associato</h1>
              <p className="text-sm text-fg-subtle">
                Il tuo account non è ancora associato a un'organizzazione. Contatta un
                amministratore.
              </p>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  useAuth.getState().logout();
                  navigate('/login', { replace: true });
                }}
              >
                Esci
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
