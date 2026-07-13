import { ArrowRight, FileUp, PenLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';

export function CreateMethodDialog({
  open,
  onClose,
  entityLabel,
  title,
  description,
  onManual,
  onMarkdown,
}: {
  open: boolean;
  onClose: () => void;
  entityLabel: string;
  title?: string;
  description?: string;
  onManual: () => void;
  onMarkdown: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? `Nuovo ${entityLabel}`}
      description={description ?? `Scegli il metodo di creazione.`}
      size="sm"
    >
      <div className="grid gap-3">
        <ChoiceCard
          icon={<FileUp className="h-5 w-5" />}
          title="Importa Markdown"
          description="Carica un file .md e precompila i dati automaticamente."
          onClick={onMarkdown}
        />
        <ChoiceCard
          icon={<PenLine className="h-5 w-5" />}
          title="Crea manualmente"
          description="Inserisci le informazioni usando il modulo."
          onClick={onManual}
        />
      </div>
    </Modal>
  );
}

function ChoiceCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface"
    >
      <span className="rounded-lg bg-surface p-2 text-fg-subtle group-hover:text-fg">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-sm text-fg-subtle">{description}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-fg-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
    </button>
  );
}
