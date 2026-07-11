import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Image, FileArchive, File, Upload, FolderPlus, X, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ContextMenu, type MenuItem } from '@/components/ui/ContextMenu';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { useList, useCreate, useRemove } from '@/hooks/useEntities';
import { useFolders } from './foldersStore';
import { FileDetailDrawer } from './FileDetailDrawer';
import { useAuth } from '@/stores/auth';
import { env } from '@/config/env';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import type { FileItem, Project } from '@/types';

function iconFor(mime: string) {
  if (mime.startsWith('image')) return <Image className="h-5 w-5 text-info" />;
  if (mime.includes('pdf')) return <FileText className="h-5 w-5 text-danger" />;
  if (mime.includes('zip')) return <FileArchive className="h-5 w-5 text-warning" />;
  return <File className="h-5 w-5 text-fg-subtle" />;
}
const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1000)} KB`);

export default function FilesPage() {
  const { data: files, isLoading } = useList<FileItem>('files');
  const { data: projects } = useList<Project>('projects');
  const create = useCreate<FileItem>('files');
  const remove = useRemove('files');
  const memberId = useAuth((s) => s.memberId);
  const { folders, add: addFolder, remove: removeFolder } = useFolders();
  const [params, setParams] = useSearchParams();
  const [folder, setFolder] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Apertura automatica del selettore file da ?upload=1
  useEffect(() => {
    if (params.get('upload') === '1') {
      const next = new URLSearchParams(params);
      next.delete('upload');
      setParams(next, { replace: true });
      const t = setTimeout(() => fileInput.current?.click(), 120);
      return () => clearTimeout(t);
    }
  }, [params, setParams]);

  if (isLoading) return <LoadingState />;

  const filtered = (files ?? []).filter((f) => folder === 'all' || f.folder === folder);
  const projectName = (id?: string | null) => (projects ?? []).find((p) => p.id === id)?.name ?? '—';

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    for (const file of selected) {
      if (file.size > env.maxUploadMb * 1024 * 1024) { toast.error(`${file.name}: max ${env.maxUploadMb}MB`); continue; }
      const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); });
      await create.mutateAsync({
        name: file.name, mime: file.type || 'application/octet-stream', size: file.size,
        folder: folder === 'all' ? undefined : folder, clientVisible: false, uploadedBy: memberId ?? undefined,
        url, tags: [],
      });
    }
    if (selected.length) toast.success(`${selected.length} file caricati`);
    if (fileInput.current) fileInput.current.value = '';
  };

  const newFolder = () => {
    const name = window.prompt('Nome della nuova cartella');
    if (name?.trim()) { addFolder(name.trim()); setFolder(name.trim()); toast.success('Cartella creata'); }
  };

  const fileMenu = (f: FileItem): MenuItem[] => [
    { label: 'Apri', icon: FileText, onClick: () => setOpenId(f.id) },
    { label: 'Elimina', icon: Trash2, danger: true, separatorBefore: true, onClick: async () => { await remove.mutateAsync(f.id); toast.success('File eliminato'); } },
  ];

  return (
    <div className="space-y-5">
      <input ref={fileInput} type="file" multiple className="hidden" onChange={onUpload} />
      <PageHeader
        title="File"
        description={`${(files ?? []).length} file · demo: salvati come data-URI in IndexedDB (Supabase Storage in produzione)`}
        actions={
          <>
            <Button variant="secondary" onClick={newFolder}><FolderPlus className="h-4 w-4" /> Cartella</Button>
            <Button onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" /> Carica</Button>
          </>
        }
      />

      {/* Chip cartelle */}
      <div className="flex flex-wrap gap-1.5">
        <FolderChip active={folder === 'all'} onClick={() => setFolder('all')} label={`Tutte (${(files ?? []).length})`} />
        {folders.map((f) => {
          const count = (files ?? []).filter((x) => x.folder === f).length;
          return (
            <FolderChip
              key={f}
              active={folder === f}
              onClick={() => setFolder(f)}
              label={`${f} (${count})`}
              onDelete={count === 0 ? () => { removeFolder(f); if (folder === f) setFolder('all'); } : undefined}
            />
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Upload className="h-8 w-8" />} title="Nessun file" description="Carica un file per iniziare." action={<Button onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" /> Carica</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <ContextMenu key={f.id} items={fileMenu(f)}>
              <Card onClick={() => setOpenId(f.id)} className="press flex cursor-pointer items-center gap-3 p-3 transition-colors hover:border-border-strong">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2">{iconFor(f.mime)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="truncate text-xs text-fg-subtle">{projectName(f.projectId)} · {fmtSize(f.size)}</p>
                </div>
                {f.clientVisible && <Badge tone="info">Cliente</Badge>}
              </Card>
            </ContextMenu>
          ))}
        </div>
      )}

      <FileDetailDrawer fileId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function FolderChip({ active, onClick, label, onDelete }: { active: boolean; onClick: () => void; label: string; onDelete?: () => void }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm transition-colors', active ? 'border-accent/40 bg-accent/10 text-fg' : 'border-border text-fg-subtle hover:bg-surface-2')}>
      <button onClick={onClick}>{label}</button>
      {onDelete && <button onClick={onDelete} aria-label="Elimina cartella"><X className="h-3 w-3 text-fg-faint hover:text-danger" /></button>}
    </span>
  );
}
