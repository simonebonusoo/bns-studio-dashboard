import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-fg-subtle border-border',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  info: 'bg-info/10 text-info border-info/20',
  accent: 'bg-accent/20 text-fg border-accent/30',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Mappa stati di dominio → etichetta italiana + tono colore. */
const STATUS_MAP: Record<string, { label: string; tone: Tone }> = {
  // progetti
  active: { label: 'Attivo', tone: 'success' },
  planned: { label: 'Pianificato', tone: 'info' },
  draft: { label: 'Bozza', tone: 'neutral' },
  review: { label: 'In revisione', tone: 'accent' },
  waiting_client: { label: 'Attesa cliente', tone: 'warning' },
  paused: { label: 'In pausa', tone: 'warning' },
  completed: { label: 'Completato', tone: 'success' },
  cancelled: { label: 'Annullato', tone: 'danger' },
  archived: { label: 'Archiviato', tone: 'neutral' },
  lead: { label: 'Lead', tone: 'info' },
  prospect: { label: 'Prospect', tone: 'info' },
  partner: { label: 'Partner', tone: 'accent' },
  past_client: { label: 'Ex cliente', tone: 'neutral' },
  inactive: { label: 'Inattivo', tone: 'neutral' },
  // task
  backlog: { label: 'Backlog', tone: 'neutral' },
  todo: { label: 'Da fare', tone: 'neutral' },
  in_progress: { label: 'In corso', tone: 'info' },
  internal_review: { label: 'Revisione interna', tone: 'accent' },
  client_review: { label: 'Revisione cliente', tone: 'warning' },
  blocked: { label: 'Bloccato', tone: 'danger' },
  // salute progetto
  on_track: { label: 'On track', tone: 'success' },
  attention: { label: 'Attenzione', tone: 'warning' },
  at_risk: { label: 'A rischio', tone: 'danger' },
  // fatture / preventivi
  paid: { label: 'Pagata', tone: 'success' },
  pending: { label: 'In attesa', tone: 'warning' },
  failed: { label: 'Fallito', tone: 'danger' },
  refunded: { label: 'Rimborsato', tone: 'neutral' },
  partially_paid: { label: 'Parziale', tone: 'warning' },
  overdue: { label: 'Scaduta', tone: 'danger' },
  issued: { label: 'Emessa', tone: 'info' },
  sent: { label: 'Inviata', tone: 'info' },
  viewed: { label: 'Vista', tone: 'accent' },
  accepted: { label: 'Accettato', tone: 'success' },
  rejected: { label: 'Rifiutato', tone: 'danger' },
  expired: { label: 'Scaduto', tone: 'neutral' },
  superseded: { label: 'Sostituito', tone: 'neutral' },
  credited: { label: 'Stornata', tone: 'neutral' },
  // priorità
  low: { label: 'Bassa', tone: 'neutral' },
  medium: { label: 'Media', tone: 'info' },
  high: { label: 'Alta', tone: 'warning' },
  urgent: { label: 'Urgente', tone: 'danger' },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, tone: 'neutral' as Tone };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}
