import { useState } from 'react';
import { Download, Trash2, FileText } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useDetail, useList, useUpdate } from '@/hooks/useEntities';
import { useRemoveFile, useFileUrl } from '@/hooks/useFiles';
import { DOCUMENT_CATEGORIES, SOURCE_TYPES } from './documentCategories';
import { formatDate } from '@/lib/format';
import { saveUrlFile } from '@/services/downloadService';
import type { FileItem, Project, Client } from '@/types';
import { toast } from 'sonner';

const fmtSize = (bytes?: number | null) => {
  const safeBytes = bytes ?? 0;
  return safeBytes > 1e6 ? `${(safeBytes / 1e6).toFixed(1)} MB` : `${Math.round(safeBytes / 1000)} KB`;
};

export function FileDetailDrawer({ fileId, onClose }: { fileId: string | null; onClose: () => void }) {
  const { data: file } = useDetail<FileItem>('files', fileId ?? undefined);
  const { data: projects } = useList<Project>('projects');
  const { data: clients } = useList<Client>('clients');
  const update = useUpdate<FileItem>('files');
  const remove = useRemoveFile();
  const resolvedUrl = useFileUrl(file ?? undefined);
  const [confirmDel, setConfirmDel] = useState(false);

  if (!file) return null;
  const patch = (p: Partial<FileItem>) => update.mutate({ id: file.id, patch: p });
  const mime = file.mime ?? '';
  const tags = file.tags ?? [];
  const isImage = mime.startsWith('image') && !!resolvedUrl;
  const isPdf = mime.includes('pdf') && !!resolvedUrl;

  const del = async () => { await remove.mutateAsync(file); toast.success('File eliminato'); onClose(); };

  return (
    <>
      <Drawer
        open={!!fileId}
        onClose={onClose}
        width="md"
        title={
          <input defaultValue={file.name} onBlur={(e) => e.target.value !== file.name && patch({ name: e.target.value })} className="w-full rounded bg-transparent px-1 -mx-1 text-base font-semibold outline-none focus:bg-surface-2" />
        }
        subtitle={`${fmtSize(file.size)} · ${formatDate(file.createdAt)}`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)}><Trash2 className="h-4 w-4 text-danger" /> Elimina</Button>
            {resolvedUrl && (
              <Button variant="secondary" size="sm" onClick={() => void saveUrlFile(file.name, resolvedUrl, file.mime ?? undefined)}>
                <Download className="h-4 w-4" /> Scarica
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-5">
          {/* Anteprima */}
          <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2">
            {isImage && resolvedUrl ? (
              <img src={resolvedUrl} alt={file.name} className="max-h-64 w-full object-contain" />
            ) : isPdf && resolvedUrl ? (
              <iframe src={resolvedUrl} title={file.name} className="h-64 w-full" />
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-fg-faint">
                <FileText className="h-8 w-8" />
                <span className="text-xs">Anteprima non disponibile</span>
              </div>
            )}
          </div>

          <F label="Categoria documento">
            <Select value={file.documentCategory ?? 'Altro'} onChange={(e) => patch({ documentCategory: e.target.value as FileItem['documentCategory'] })}>
              {DOCUMENT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </Select>
          </F>
          <F label="Origine">
            <Select value={file.entityType ?? 'generic'} onChange={(e) => patch({ entityType: e.target.value as FileItem['entityType'] })}>
              {SOURCE_TYPES.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
            </Select>
          </F>
          <F label="Tag (separati da virgola)">
            <Input defaultValue={tags.join(', ')} onBlur={(e) => patch({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
          </F>
          <F label="Collega a progetto">
            <Select value={file.projectId ?? ''} onChange={(e) => patch({ projectId: e.target.value || null })}>
              <option value="">—</option>
              {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </F>
          <F label="Collega a cliente">
            <Select value={file.clientId ?? ''} onChange={(e) => patch({ clientId: e.target.value || null })}>
              <option value="">—</option>
              {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
            </Select>
          </F>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={file.clientVisible} onChange={(e) => patch({ clientVisible: e.target.checked })} className="accent-accent" />
            Visibile al cliente nel portale
          </label>
        </div>
      </Drawer>

      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={del} title="Elimina file" message={`Eliminare "${file.name}"?`} confirmLabel="Elimina" danger />
    </>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-medium text-fg-subtle">{label}</span>{children}</label>;
}
