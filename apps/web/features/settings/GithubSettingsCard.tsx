import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Github, Check, Link2Off, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useList } from '@/hooks/useEntities';
import { useAuth } from '@/stores/auth';
import { githubService } from '@/services/githubService';
import { formatDate } from '@/lib/format';
import type { GithubConnection } from '@/types';
import { toast } from 'sonner';

/** Slug pubblico della GitHub App (safe nel frontend). L'utente lo imposta dopo aver creato l'App. */
const APP_SLUG = import.meta.env.VITE_GITHUB_APP_SLUG as string | undefined;

/**
 * Sezione Impostazioni → GitHub (§3-4). Gestisce gli stati non-configurato /
 * disconnesso / connesso / errore. Nessun secret nel frontend: la connessione
 * passa dall'Edge Function `github` (GitHub App). Solo gli admin collegano/scollegano.
 */
export function GithubSettingsCard() {
  const role = useAuth((s) => s.role);
  const isAdmin = role === 'owner' || role === 'admin';
  const qc = useQueryClient();
  const { data: connections } = useList<GithubConnection>('githubConnections', { retry: false });
  const connection = (connections ?? [])[0];
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  // Stato di configurazione dell'Edge Function (secret presenti?).
  useEffect(() => {
    githubService.isConfigured().then(setConfigured).catch(() => setConfigured(false));
  }, []);

  // Ritorno dall'installazione GitHub App: cattura installation_id e registra.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const installationId = params.get('installation_id');
    if (!installationId) return;
    setBusy(true);
    githubService
      .connect(Number(installationId))
      .then(() => {
        toast.success('GitHub collegato');
        qc.invalidateQueries({ queryKey: ['githubConnections'] });
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Connessione GitHub non riuscita'))
      .finally(() => {
        setBusy(false);
        window.history.replaceState({}, '', window.location.pathname);
      });
  }, [qc]);

  const connect = () => {
    if (!APP_SLUG) {
      toast.error('Slug GitHub App non configurato (VITE_GITHUB_APP_SLUG)');
      return;
    }
    window.location.href = `https://github.com/apps/${APP_SLUG}/installations/new`;
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await githubService.disconnect();
      toast.success('GitHub disconnesso');
      qc.invalidateQueries({ queryKey: ['githubConnections'] });
    } catch {
      toast.error('Disconnessione non riuscita');
    } finally {
      setBusy(false);
    }
  };

  const connected = connection?.status === 'connected';
  const hasError = connection?.status === 'error';

  return (
    <Card>
      <CardHeader
        title="GitHub"
        subtitle="Collega l'organizzazione GitHub per associare i repository ai progetti."
        icon={<Github className="h-4 w-4" />}
      />
      <div className="p-4">
        {configured === null ? (
          <div className="flex items-center gap-2 text-sm text-fg-subtle">
            <Loader2 className="h-4 w-4 animate-spin" /> Verifica configurazione…
          </div>
        ) : configured === false ? (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="font-medium">Integrazione non configurata</p>
              <p className="mt-0.5 text-fg-subtle">
                Un amministratore deve creare la GitHub App e impostare i secret dell'Edge Function
                (<code className="text-xs">GITHUB_APP_ID</code>, <code className="text-xs">GITHUB_APP_PRIVATE_KEY</code>),
                poi eseguire <code className="text-xs">supabase functions deploy github</code>.
              </p>
            </div>
          </div>
        ) : connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {connection?.accountAvatarUrl ? (
                <img src={connection.accountAvatarUrl} alt="" className="h-10 w-10 rounded-full" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2">
                  <Github className="h-5 w-5" />
                </div>
              )}
              <div>
                <p className="flex items-center gap-1.5 font-medium">
                  {connection?.accountLogin ?? 'GitHub'} <Badge tone="success"><Check className="h-3 w-3" /> Connesso</Badge>
                </p>
                <p className="text-xs text-fg-subtle">
                  {connection?.accountType ?? 'Account'}
                  {connection?.connectedAt ? ` · dal ${formatDate(connection.connectedAt)}` : ''}
                </p>
              </div>
            </div>
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={disconnect} loading={busy}>
                <Link2Off className="h-4 w-4" /> Disconnetti
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{hasError ? 'Connessione in errore' : 'Non connesso'}</p>
              <p className="text-xs text-fg-subtle">
                {hasError && connection?.errorMessage
                  ? connection.errorMessage
                  : 'Collega la tua organizzazione GitHub per usare i repository nei progetti.'}
              </p>
            </div>
            {isAdmin ? (
              <Button size="sm" onClick={connect} loading={busy}>
                <Github className="h-4 w-4" /> Collega GitHub <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Badge tone="neutral">Richiede un amministratore</Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
