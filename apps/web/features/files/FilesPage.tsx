import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  File,
  FileArchive,
  FileText,
  FolderPlus,
  Grid2x2,
  Image,
  List,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ContextMenu, type MenuItem } from '@/components/ui/ContextMenu';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { useList } from '@/hooks/useEntities';
import { useUploadFile, useRemoveFile } from '@/hooks/useFiles';
import { useFolders } from './foldersStore';
import { DOCUMENT_CATEGORIES } from './documentCategories';
import { FileDetailDrawer } from './FileDetailDrawer';
import { useUI } from '@/stores/ui';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import type { Client, FileItem, Project } from '@/types';

function iconFor(mime: string) {
  if (mime.startsWith('image')) return <Image className="h-5 w-5 text-info" />;
  if (mime.includes('pdf')) return <FileText className="h-5 w-5 text-danger" />;
  if (mime.includes('zip')) return <FileArchive className="h-5 w-5 text-warning" />;
  return <File className="h-5 w-5 text-fg-subtle" />;
}

const formatSize = (bytes: number) => (bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`);

export default function FilesPage() {
  const { data: files, isLoading } = useList<FileItem>('files');
  const { data: projects } = useList<Project>('projects');
  const { data: clients } = useList<Client>('clients');
  const upload = useUploadFile();
  const remove = useRemoveFile();
  const { folders, add: addFolder, remove: removeFolder } = useFolders();
  const filesView = useUI((state) => state.filesView);
  const setFilesView = useUI((state) => state.setFilesView);
  const [params, setParams] = useSearchParams();
  const projectFilter = params.get('projectId');
  const [folder, setFolder] = useState('all');
  const [category, setCategory] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.get('upload') === '1') {
      const next = new URLSearchParams(params);
      next.delete('upload');
      setParams(next, { replace: true });
      const timeout = setTimeout(() => fileInput.current?.click(), 120);
      return () => clearTimeout(timeout);
    }
  }, [params, setParams]);

  const projectName = (id?: string | null) => (projects ?? []).find((project) => project.id === id)?.name ?? '—';
  const clientName = (id?: string | null) => (clients ?? []).find((client) => client.id === id)?.displayName ?? '—';

  const filtered = useMemo(
    () =>
      (files ?? []).filter((file) => {
        const matchesFolder = folder === 'all' || file.folder === folder;
        const matchesProject = !projectFilter || file.projectId === projectFilter;
        const matchesCategory = category === 'all' || (file.documentCategory ?? 'Altro') === category;
        return matchesFolder && matchesProject && matchesCategory;
      }),
    [category, files, folder, projectFilter],
  );

  const clearProjectFilter = () => {
    const next = new URLSearchParams(params);
    next.delete('projectId');
    setParams(next, { replace: true });
  };

  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    let uploaded = 0;
    for (const file of selected) {
      try {
        await upload.mutateAsync({
          file,
          folder: folder === 'all' ? undefined : folder,
          projectId: projectFilter,
          documentCategory: category === 'all' ? undefined : category as FileItem['documentCategory'],
          clientVisible: false,
          tags: [],
        });
        uploaded += 1;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Errore nel caricamento di ${file.name}`);
      }
    }
    if (uploaded) toast.success(`${uploaded} file caricati`);
    if (fileInput.current) fileInput.current.value = '';
  };

  const newFolder = () => {
    const name = window.prompt('Nome della nuova cartella');
    if (name?.trim()) {
      addFolder(name.trim());
      setFolder(name.trim());
      toast.success('Cartella creata');
    }
  };

  const fileMenu = (file: FileItem): MenuItem[] => [
    { label: 'Apri', icon: FileText, onClick: () => setOpenId(file.id) },
    {
      label: 'Elimina',
      icon: Trash2,
      danger: true,
      separatorBefore: true,
      onClick: async () => {
        await remove.mutateAsync(file);
        toast.success('File eliminato');
      },
    },
  ];

  const columns: Column<FileItem>[] = [
    {
      key: 'name',
      header: 'Nome',
      sortValue: (file) => file.name.toLowerCase(),
      render: (file) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2">{iconFor(file.mime)}</div>
          <div className="min-w-0">
            <p className="truncate font-medium">{file.name}</p>
            <p className="truncate text-xs text-fg-subtle">{file.mime || 'File'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Categoria',
      sortValue: (file) => file.documentCategory ?? 'Altro',
      render: (file) => <Badge tone="neutral">{file.documentCategory ?? 'Altro'}</Badge>,
    },
    {
      key: 'project',
      header: 'Progetto / cliente',
      sortValue: (file) => `${projectName(file.projectId)}${clientName(file.clientId)}`,
      render: (file) => (
        <div className="space-y-0.5">
          <p>{projectName(file.projectId)}</p>
          <p className="text-xs text-fg-subtle">{clientName(file.clientId)}</p>
        </div>
      ),
    },
    {
      key: 'size',
      header: 'Dimensione',
      sortValue: (file) => file.size,
      render: (file) => <span>{formatSize(file.size)}</span>,
    },
    {
      key: 'date',
      header: 'Data',
      sortValue: (file) => file.createdAt,
      render: (file) => <span>{formatDate(file.createdAt)}</span>,
    },
    {
      key: 'visibility',
      header: 'Visibilità',
      render: (file) => <Badge tone={file.clientVisible ? 'info' : 'neutral'}>{file.clientVisible ? 'Cliente' : 'Interno'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Azioni',
      className: 'text-right',
      render: (file) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            setOpenId(file.id);
          }}
        >
          Apri
        </Button>
      ),
    },
  ];

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <input ref={fileInput} type="file" multiple className="hidden" onChange={onUpload} />
      <PageHeader
        title="File"
        description={`${(files ?? []).length} file · demo: salvati come data-URI in IndexedDB (Supabase Storage in produzione)`}
        actions={
          <>
            <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
              <button
                onClick={() => setFilesView('list')}
                className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors', filesView === 'list' ? 'bg-surface-2 text-fg' : 'text-fg-subtle hover:text-fg')}
              >
                <List className="h-4 w-4" /> List
              </button>
              <button
                onClick={() => setFilesView('grid')}
                className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors', filesView === 'grid' ? 'bg-surface-2 text-fg' : 'text-fg-subtle hover:text-fg')}
              >
                <Grid2x2 className="h-4 w-4" /> Grid
              </button>
            </div>
            <Button variant="secondary" onClick={newFolder}><FolderPlus className="h-4 w-4" /> Cartella</Button>
            <Button onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" /> Carica</Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <FolderChip active={folder === 'all'} onClick={() => setFolder('all')} label={`Tutte (${(files ?? []).length})`} />
        {folders.map((item) => {
          const count = (files ?? []).filter((file) => file.folder === item).length;
          return (
            <FolderChip
              key={item}
              active={folder === item}
              onClick={() => setFolder(item)}
              label={`${item} (${count})`}
              onDelete={count === 0 ? () => {
                removeFolder(item);
                if (folder === item) setFolder('all');
              } : undefined}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FolderChip active={category === 'all'} onClick={() => setCategory('all')} label="Tutte le categorie" />
        {DOCUMENT_CATEGORIES.map((item) => (
          <FolderChip
            key={item}
            active={category === item}
            onClick={() => setCategory(item)}
            label={`${item} (${(files ?? []).filter((file) => (file.documentCategory ?? 'Altro') === item).length})`}
          />
        ))}
      </div>

      {projectFilter && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <div className="text-fg-subtle">Archivio filtrato sul progetto selezionato. I nuovi upload saranno collegati automaticamente a questo progetto.</div>
          <Button variant="ghost" size="sm" onClick={clearProjectFilter}>
            <X className="h-4 w-4" /> Mostra tutti i file
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Upload className="h-8 w-8" />}
          title="Nessun file"
          description="Carica un file per iniziare."
          action={<Button onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" /> Carica</Button>}
        />
      ) : filesView === 'list' ? (
        <DataTable
          data={filtered}
          columns={columns}
          onRowClick={(file) => setOpenId(file.id)}
          rowMenu={fileMenu}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((file) => (
            <ContextMenu key={file.id} items={fileMenu(file)}>
              <Card onClick={() => setOpenId(file.id)} className="press flex cursor-pointer flex-col gap-4 p-4 transition-colors hover:border-border-strong">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-2">{iconFor(file.mime)}</div>
                  <Badge tone={file.clientVisible ? 'info' : 'neutral'}>{file.clientVisible ? 'Cliente' : 'Interno'}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-fg-subtle">{file.mime || 'File generico'}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-fg-subtle">
                  <div>
                    <p className="text-fg-faint">Dimensione</p>
                    <p>{formatSize(file.size)}</p>
                  </div>
                  <div>
                    <p className="text-fg-faint">Data</p>
                    <p>{formatDate(file.createdAt)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-fg-faint">Progetto / cliente</p>
                    <p className="truncate">{projectName(file.projectId)} · {clientName(file.clientId)}</p>
                  </div>
                </div>
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
