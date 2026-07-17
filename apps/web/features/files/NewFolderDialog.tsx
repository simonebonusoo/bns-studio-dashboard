import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Field } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import type { NewFolderInput } from './useArchive';

const COLORS = ['#a3e635', '#38bdf8', '#f472b6', '#fbbf24', '#c084fc', '#34d399', '#f87171', '#94a3b8'];

export function NewFolderDialog({
  open,
  onClose,
  onCreate,
  locationName,
  parentLocationId,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: NewFolderInput) => Promise<void> | void;
  locationName: string;
  parentLocationId: string;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setColor(COLORS[0]);
      setSaving(false);
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onCreate({ name, description, color, parentLocationId });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuova cartella"
      description={`Verrà creata in: ${locationName}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={submit} loading={saving} disabled={!name.trim()}>
            Crea cartella
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome" required>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Es. Loghi, Contratti, Branding…"
          />
        </Field>
        <Field label="Colore">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Colore ${c}`}
                style={{ backgroundColor: c }}
                className={cn(
                  'h-7 w-7 rounded-full border-2 transition-transform',
                  color === c ? 'scale-110 border-fg' : 'border-transparent hover:scale-105',
                )}
              />
            ))}
          </div>
        </Field>
        <Field label="Descrizione" hint="Opzionale">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
      </div>
    </Modal>
  );
}
