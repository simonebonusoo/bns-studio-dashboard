import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { GithubSettingsCard } from './GithubSettingsCard';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useUI } from '@/stores/ui';
import { useAuth } from '@/stores/auth';
import { IS_DEMO } from '@/config/env';
import { ROLE_LABELS } from '@/types/enums';
import { resetDemo } from '@/data/seed';
import { getCurrentOrganization, updateCurrentOrganization, type OrganizationSettingsPatch } from '@/services/organizationService';
import { LoadingState } from '@/components/ui/States';
import { toast } from 'sonner';

const organizationQueryKey = ['organization', 'current'] as const;

const CURRENCIES = ['EUR', 'USD', 'GBP'] as const;
const TIMEZONES = ['Europe/Rome', 'Europe/London', 'UTC', 'America/New_York'] as const;
const LOCALES = [
  { value: 'it-IT', label: 'Italiano' },
  { value: 'en-US', label: 'English (US)' },
] as const;

function emptyForm(): OrganizationSettingsPatch {
  return {
    name: '',
    email: '',
    vat: '',
    currency: 'EUR',
    timezone: 'Europe/Rome',
    locale: 'it-IT',
  };
}

export default function SettingsPage() {
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const role = useAuth((s) => s.role);
  const can = useAuth((s) => s.can);
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<OrganizationSettingsPatch>(emptyForm);

  const { data: organization, isLoading } = useQuery({
    queryKey: organizationQueryKey,
    queryFn: getCurrentOrganization,
  });

  useEffect(() => {
    if (!organization) return;
    setForm({
      name: organization.name,
      email: organization.email ?? '',
      vat: organization.vat ?? '',
      currency: organization.currency,
      timezone: organization.timezone,
      locale: organization.locale,
    });
    setSaved(false);
  }, [organization]);

  const canManageSettings = can('settings.manage');
  const dirty = useMemo(() => {
    if (!organization) return false;
    return (
      form.name !== organization.name ||
      form.email !== (organization.email ?? '') ||
      form.vat !== (organization.vat ?? '') ||
      form.currency !== organization.currency ||
      form.timezone !== organization.timezone ||
      form.locale !== organization.locale
    );
  }, [form, organization]);

  const saveOrganization = useMutation({
    mutationFn: () => updateCurrentOrganization({
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      vat: form.vat.trim(),
    }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: organizationQueryKey });
      setSaved(true);
      toast.success('Impostazioni organizzazione salvate');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Salvataggio impostazioni non riuscito');
    },
  });

  const handleReset = async () => {
    await resetDemo();
    await qc.invalidateQueries();
    toast.success('Dati di esempio ripristinati');
  };

  const set = (key: keyof OrganizationSettingsPatch, value: string) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const readOnly = !canManageSettings || saveOrganization.isPending;

  return (
    <div className="space-y-5">
      <PageHeader title="Impostazioni" description="Configurazione organizzazione e preferenze" />

      <Card>
        <CardHeader
          title="Organizzazione"
          subtitle="Queste informazioni vengono usate nei documenti e nelle impostazioni dello studio."
          action={
            canManageSettings ? (
              <Button
                size="sm"
                onClick={() => saveOrganization.mutate()}
                loading={saveOrganization.isPending}
                disabled={!dirty || !form.name.trim() || saveOrganization.isPending}
              >
                {saved && !dirty ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saveOrganization.isPending ? 'Salvataggio...' : saved && !dirty ? 'Salvato' : 'Salva modifiche'}
              </Button>
            ) : (
              <Badge tone="neutral">Sola lettura</Badge>
            )
          }
        />
        {isLoading ? (
          <LoadingState label="Caricamento impostazioni..." />
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Nome studio" required>
              <Input value={form.name} onChange={(event) => set('name', event.target.value)} readOnly={readOnly} />
            </Field>
            <Field label="Email studio">
              <Input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} readOnly={readOnly} />
            </Field>
            <Field label="P. IVA">
              <Input value={form.vat} onChange={(event) => set('vat', event.target.value)} readOnly={readOnly} />
            </Field>
            <Field label="Valuta">
              <Select value={form.currency} onChange={(event) => set('currency', event.target.value)} disabled={readOnly}>
                {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </Select>
            </Field>
            <Field label="Fuso orario">
              <Select value={form.timezone} onChange={(event) => set('timezone', event.target.value)} disabled={readOnly}>
                {TIMEZONES.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
              </Select>
            </Field>
            <Field label="Lingua">
              <Select value={form.locale} onChange={(event) => set('locale', event.target.value)} disabled={readOnly}>
                {LOCALES.map((locale) => <option key={locale.value} value={locale.value}>{locale.label}</option>)}
              </Select>
            </Field>
            {!canManageSettings && (
              <p className="sm:col-span-2 text-sm text-fg-subtle">
                Il tuo ruolo corrente permette di consultare queste informazioni, ma non di modificarle.
              </p>
            )}
            {saveOrganization.error && (
              <p className="sm:col-span-2 text-sm text-danger">
                {saveOrganization.error instanceof Error ? saveOrganization.error.message : 'Salvataggio non riuscito'}
              </p>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Aspetto" />
        <div className="p-4">
          <Field label="Tema">
            <Select value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')} className="sm:w-48">
              <option value="light">Chiaro</option>
              <option value="dark">Scuro</option>
              <option value="system">Sistema</option>
            </Select>
          </Field>
        </div>
      </Card>

      <GithubSettingsCard />

      <Card>
        <CardHeader title="Ruolo corrente" subtitle="Permessi applicati alla tua sessione" />
        <div className="flex items-center gap-2 p-4">
          <Badge tone="accent">{role ? ROLE_LABELS[role] : '-'}</Badge>
          <span className="text-sm text-fg-subtle">
            Alcune sezioni diventano modificabili solo per i ruoli autorizzati.
          </span>
        </div>
      </Card>

      {IS_DEMO && (
        <Card>
          <CardHeader title="Dati di esempio" subtitle="Ripristina il dataset locale allo stato iniziale." />
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-fg-subtle">
              Questa azione cancella le modifiche fatte in questa sessione di prova.
            </p>
            <Button variant="secondary" onClick={() => setConfirm(true)}>Ripristina dati</Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Disclaimer" icon={<AlertTriangle className="h-4 w-4 text-warning" />} />
        <ul className="list-disc space-y-1.5 p-4 pl-8 text-sm text-fg-subtle">
          <li>BnsStudio è uno strumento gestionale interno; non sostituisce consulenza fiscale o legale.</li>
          <li>Le fatture generate devono essere verificate: il sistema non è un servizio certificato di fatturazione elettronica.</li>
          <li>I dati finanziari dipendono dalla correttezza dei dati inseriti.</li>
          <li>Preventivi e contratti vanno verificati prima dell'invio.</li>
        </ul>
      </Card>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={handleReset}
        title="Ripristina dati di esempio"
        message="Verranno cancellate le modifiche locali e ricaricati i dati iniziali. Continuare?"
        confirmLabel="Ripristina"
        danger
      />
    </div>
  );
}
