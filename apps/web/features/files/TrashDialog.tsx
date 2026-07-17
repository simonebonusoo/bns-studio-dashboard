import { useState } from 'react';
import { File as FileIcon, Folder, RotateCcw, Trash2 } from 'lucide-react';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/States';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { useDeletedArchive } from './useArchive';
import type { ArchiveFolder, FileItem } from '@/types';

type PurgeTarget = { kind: 'file'; item: FileItem } | { kind: 'folder'; item: ArchiveFolder };

export function TrashDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { files, folders, isLoading, restoreFile, purgeFile, restoreFolder, purgeFolder } = useDeletedArchive();
  const [purgeTarget, setPurgeTarget] = useState<PurgeTarget | null>(null);

  const isEmpty = files.length === 0 && folders.length === 0;

  const doPurge = async () => {
    if (!purgeTarget) return;
    if (purgeTarget.kind === 'file') await purgeFile(purgeTarget.item);
    else await purgeFolder(purgeTarget.item);
    toast.success('Eliminato definitivamente');
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Cestino" description="Elementi eliminati. Ripristinali o rimuovili definitivamente." size="lg">
        {isLoading ? (
          <LoadingState />
        ) : isEmpty ? (
          <div className="py-10 text-center text-sm text-fg-subtle">Il cestino è vuoto.</div>
        ) : (
          <div className="space-y-4">
            {folders.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="text-xs font-medium uppercase tracking-wide text-fg-faint">Cartelle</h3>
                {folders.map((folder) => (
                  <TrashRow
                    key={folder.id}
                    icon={<Folder className="h-4 w-4" style={{ color: folder.color ?? undefined }} />}
                    name={folder.name}
                    meta={folder.deletedAt ? `Eliminata il ${formatDate(folder.deletedAt)}` : undefined}
                    onRestore={async () => {
                      await restoreFolder(folder);
                      toast.success('Cartella ripristinata');
                    }}
                    onPurge={() => setPurgeTarget({ kind: 'folder', item: folder })}
                  />
                ))}
              </section>
            )}
            {files.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="text-xs font-medium uppercase tracking-wide text-fg-faint">File</h3>
                {files.map((file) => (
                  <TrashRow
                    key={file.id}
                    icon={<FileIcon className="h-4 w-4 text-fg-subtle" />}
                    name={file.name}
                    meta={file.deletedAt ? `Eliminato il ${formatDate(file.deletedAt)}` : undefined}
                    onRestore={async () => {
                      await restoreFile(file);
                      toast.success('File ripristinato');
                    }}
                    onPurge={() => setPurgeTarget({ kind: 'file', item: file })}
                  />
                ))}
              </section>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!purgeTarget}
        onClose={() => setPurgeTarget(null)}
        onConfirm={doPurge}
        title="Elimina definitivamente"
        message={
          purgeTarget
            ? `"${purgeTarget.item.name}" verrà eliminato definitivamente e non potrà essere recuperato.`
            : ''
        }
        confirmLabel="Elimina per sempre"
        danger
      />
    </>
  );
}

function TrashRow({
  icon,
  name,
  meta,
  onRestore,
  onPurge,
}: {
  icon: React.ReactNode;
  name: string;
  meta?: string;
  onRestore: () => void;
  onPurge: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={name}>{name}</p>
        {meta && <p className="truncate text-xs text-fg-subtle">{meta}</p>}
      </div>
      <Button variant="ghost" size="sm" onClick={onRestore}><RotateCcw className="h-4 w-4" /> Ripristina</Button>
      <button
        onClick={onPurge}
        aria-label="Elimina definitivamente"
        title="Elimina definitivamente"
        className="press rounded-md p-1.5 text-fg-subtle hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
