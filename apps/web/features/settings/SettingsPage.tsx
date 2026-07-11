import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { brandConfig } from '@/config/brandConfig';
import { useUI } from '@/stores/ui';
import { useAuth } from '@/stores/auth';
import { ROLE_LABELS } from '@/types/enums';
import { resetDemo } from '@/data/seed';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const role = useAuth((s) => s.role);
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);

  const handleReset = async () => {
    await resetDemo();
    await qc.invalidateQueries();
    toast.success('Dati demo ripristinati');
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Impostazioni" description="Configurazione organizzazione e preferenze" />

      <Card>
        <CardHeader title="Organizzazione" subtitle="Dati principali dello studio" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Nome"><Input defaultValue={brandConfig.name} readOnly /></Field>
          <Field label="Email"><Input defaultValue={brandConfig.contacts.email} readOnly /></Field>
          <Field label="P. IVA"><Input defaultValue={brandConfig.contacts.vat} readOnly /></Field>
          <Field label="Valuta"><Input defaultValue="EUR" readOnly /></Field>
          <Field label="Fuso orario"><Input defaultValue="Europe/Rome" readOnly /></Field>
          <Field label="Lingua"><Input defaultValue="it-IT" readOnly /></Field>
        </div>
        <p className="px-4 pb-4 text-xs text-fg-subtle">In produzione questi campi sono modificabili e persistiti su Supabase.</p>
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

      <Card>
        <CardHeader title="Ruolo corrente" subtitle="Permessi applicati in questa sessione" />
        <div className="flex items-center gap-2 p-4">
          <Badge tone="accent">{role ? ROLE_LABELS[role] : '—'}</Badge>
          <span className="text-sm text-fg-subtle">I permessi sono documentati in docs/PERMISSIONS.md</span>
        </div>
      </Card>

      <Card>
        <CardHeader title="Dati" subtitle="Modalità demo locale (IndexedDB)" />
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-fg-subtle">
            Ripristina i dati demo allo stato iniziale. Le modifiche locali andranno perse.
          </p>
          <Button variant="secondary" onClick={() => setConfirm(true)}>Ripristina demo</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Disclaimer" icon={<AlertTriangle className="h-4 w-4 text-warning" />} />
        <ul className="list-disc space-y-1.5 p-4 pl-8 text-sm text-fg-subtle">
          <li>BNS Studio OS è uno strumento gestionale interno; non sostituisce consulenza fiscale o legale.</li>
          <li>Le fatture generate devono essere verificate: il sistema non è un servizio certificato di fatturazione elettronica.</li>
          <li>I dati finanziari dipendono dalla correttezza dei dati inseriti.</li>
          <li>Preventivi e contratti vanno verificati prima dell'invio.</li>
        </ul>
      </Card>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={handleReset}
        title="Ripristina dati demo"
        message="Verranno cancellate tutte le modifiche locali e ricaricati i dati demo iniziali. Continuare?"
        confirmLabel="Ripristina"
        danger
      />
    </div>
  );
}
