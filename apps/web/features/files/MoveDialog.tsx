import { useMemo, useState } from 'react';
import { Folder, FolderOpen, Home } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { buildDestinationTree, type ArchiveData } from './archiveModel';

export function MoveDialog({
  open,
  onClose,
  data,
  exclude,
  count,
  onMove,
}: {
  open: boolean;
  onClose: () => void;
  data: ArchiveData;
  /** Cartelle da escludere come destinazione (la cartella spostata e i discendenti). */
  exclude?: Set<string>;
  /** Numero di elementi da spostare (per il titolo). */
  count: number;
  onMove: (targetLocationId: string) => Promise<void> | void;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const destinations = useMemo(
    () => (open ? buildDestinationTree(data, exclude ?? new Set()) : []),
    [open, data, exclude],
  );

  const submit = async () => {
    if (!target || saving) return;
    setSaving(true);
    try {
      await onMove(target);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sposta"
      description={`Scegli la cartella di destinazione per ${count} element${count === 1 ? 'o' : 'i'}.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={submit} loading={saving} disabled={!target}>Sposta qui</Button>
        </>
      }
    >
      <div className="max-h-80 space-y-0.5 overflow-y-auto">
        {destinations.map((node) => (
          <button
            key={node.id}
            onClick={() => setTarget(node.id)}
            style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
            className={cn(
              'flex w-full items-center gap-2 rounded-md py-2 pr-2 text-left text-sm transition-colors',
              target === node.id ? 'bg-accent/15 text-fg ring-1 ring-accent/40' : 'text-fg-subtle hover:bg-surface-2 hover:text-fg',
            )}
          >
            {node.depth === 0 ? (
              <Home className="h-4 w-4 shrink-0" />
            ) : target === node.id ? (
              <FolderOpen className="h-4 w-4 shrink-0" />
            ) : (
              <Folder className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
