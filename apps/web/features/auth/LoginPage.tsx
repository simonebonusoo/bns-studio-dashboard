import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { brandConfig } from '@/config/brandConfig';
import { IS_DEMO } from '@/config/env';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { toast } from 'sonner';

const DEMO_ACCOUNTS = [
  { label: 'Proprietario', email: 'admin@bnsstudio.demo', password: 'admin1234' },
  { label: 'Project Manager', email: 'manager@bnsstudio.demo', password: 'manager1234' },
  { label: 'Designer', email: 'designer@bnsstudio.demo', password: 'designer1234' },
  { label: 'Collaboratore', email: 'collaborator@bnsstudio.demo', password: 'collaborator1234' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const loading = useAuth((s) => s.loading);
  const userId = useAuth((s) => s.userId);
  const memberId = useAuth((s) => s.memberId);
  // In demo precompiliamo l'account owner; in produzione i campi restano vuoti.
  const [email, setEmail] = useState(IS_DEMO ? 'admin@bnsstudio.demo' : '');
  const [password, setPassword] = useState(IS_DEMO ? 'admin1234' : '');

  if (memberId) return <Navigate to="/" replace />;
  // Autenticato ma senza organizzazione → onboarding (non ripresentare il login).
  if (userId) return <Navigate to="/onboarding" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const status = await login(email, password);
    if (status === 'ok') {
      toast.success('Accesso effettuato');
      navigate('/');
    } else if (status === 'onboarding') {
      // Sessione Supabase valida ma senza organizzazione → onboarding.
      navigate('/onboarding');
    } else {
      toast.error(useAuth.getState().error ?? 'Credenziali non valide');
    }
  };

  const quick = (acc: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(acc.email);
    setPassword(acc.password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <img src={brandConfig.logos.light} alt={brandConfig.name} className="h-7 dark:hidden" />
          <img src={brandConfig.logos.dark} alt={brandConfig.name} className="hidden h-7 dark:block" />
          <p className="text-sm text-fg-subtle">{brandConfig.description}</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-card border border-border bg-surface p-6 shadow-card">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </Field>
          <Button type="submit" className="w-full" loading={loading}>
            Accedi
          </Button>

          {IS_DEMO && (
            <div className="rounded-lg bg-accent/10 p-3 text-xs">
              <p className="mb-2 font-semibold">● Modalità demo locale — account rapidi:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => quick(a)}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-left hover:border-accent/50"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        <p className="mt-4 text-center text-xs text-fg-subtle">
          {IS_DEMO
            ? 'I dati demo sono salvati solo nel tuo browser (IndexedDB).'
            : 'Connesso a Supabase · autenticazione sicura.'}
        </p>
        <div className="mt-2 flex justify-center gap-3 text-xs text-fg-subtle">
          <a href="/forgot-password" className="hover:text-fg">Password dimenticata</a>
          <span>·</span>
          <a href="/legal/privacy" className="hover:text-fg">Privacy</a>
          <span>·</span>
          <a href="/legal/terms" className="hover:text-fg">Termini</a>
        </div>
      </div>
    </div>
  );
}
