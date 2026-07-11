import { useState } from 'react';
import { Link } from 'react-router-dom';
import { brandConfig } from '@/config/brandConfig';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { ArrowLeft } from 'lucide-react';
import { authService } from '@/services/authService';
import { IS_DEMO } from '@/config/env';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authService.requestPasswordReset(email);
      setSent(true);
    } catch {
      // Per sicurezza non si rivela se l'email esiste: si mostra comunque conferma.
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <img src={brandConfig.logos.light} alt={brandConfig.name} className="h-7 dark:hidden" />
          <img src={brandConfig.logos.dark} alt={brandConfig.name} className="hidden h-7 dark:block" />
        </div>
        <div className="space-y-4 rounded-card border border-border bg-surface p-6 shadow-card">
          <h1 className="text-lg font-semibold">Recupera password</h1>
          {sent ? (
            <p className="text-sm text-fg-subtle">
              Se l'indirizzo è associato a un account, riceverai istruzioni via email.
              {IS_DEMO && (
                <>
                  <br />
                  <span className="text-xs">(In modalità demo l'invio email non è attivo; usa gli account rapidi dal login.)</span>
                </>
              )}
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Field label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
              {error && <p className="text-xs text-danger">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Invio…' : 'Invia istruzioni'}
              </Button>
            </form>
          )}
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
            <ArrowLeft className="h-4 w-4" /> Torna al login
          </Link>
        </div>
      </div>
    </div>
  );
}
