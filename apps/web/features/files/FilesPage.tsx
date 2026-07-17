import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Download,
  File,
  FileArchive,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  FolderUp,
  Grid2x2,
  Image,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ContextMenu, type MenuItem } from '@/components/ui/ContextMenu';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { useUploadFile, useRemoveFile } from '@/hooks/useFiles';
import { DOCUMENT_CATEGORIES } from './documentCategories';
import { FileDetailDrawer } from './FileDetailDrawer';
import { NewFolderDialog } from './NewFolderDialog';
import {
  useArchiveData,
  useArchiveMutations,
  resolveUploadContext,
  type NewFolderInput,
} from './useArchive';
import {
  ROOT_ID,
  buildBreadcrumb,
  collectDescendantFolderIds,
  fileMatchesQuery,
  listChildren,
  resolveFolder,
  type FolderNode,
} from './archiveModel';
import { usePreview } from '@/components/preview/previewContext';
import { fileService } from '@/services/fileService';
import { useUI } from '@/stores/ui';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { saveUrlFile } from '@/services/downloadService';
import type { FileItem } from '@/types';

function iconFor(mime?: string | null) {
  const type = mime ?? '';
  if (type.startsWith('image')) return <Image className="h-5 w-5 text-info" />;
  if (type.includes('pdf')) return <FileText className="h-5 w-5 text-danger" />;
  if (type.includes('zip')) return <FileArchive className="h-5 w-5 text-warning" />;
  return <File className="h-5 w-5 text-fg-subtle" />;
}

const formatSize = (bytes?: number | null) => {
  const safeBytes = bytes ?? 0;
  return safeBytes > 1e6 ? `${(safeBytes / 1e6).toFixed(1)} MB` : `${Math.round(safeBytes / 1000)} KB`;
};

const categoryOf = (file: FileItem) => file.documentCategory ?? 'Altro';
const isMarkdownFile = (file: FileItem) => /\.(md|markdown)$/i.test(file.name) || (file.mime ?? '').includes('markdown');

export default function FilesPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useArchiveData();
  const { createFolder: createFolderMutation, updateFolder, removeFolder, updateFile, buildFolderPayload } = useArchiveMutations();
  const preview = usePreview();
  const upload = useUploadFile();
  const remove = useRemoveFile();
  const filesView = useUI((state) => state.filesView);
  const setFilesView = useUI((state) => state.setFilesView);

  const [params, setParams] = useSearchParams();
  // La posizione corrente vive nell'URL: ?folderId=... (retrocompatibile con ?projectId=).
  const legacyProject = params.get('projectId');
  const location = params.get('folderId') ?? (legacyProject ? `project:${legacyProject}` : ROOT_ID);

  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FolderNode | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<FolderNode | null>(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState<FileItem | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);

  // Abilita la selezione di intere cartelle (attributi non standard, supportati dai browser).
  useEffect(() => {
    if (dirInput.current) {
      dirInput.current.setAttribute('webkitdirectory', '');
      dirInput.current.setAttribute('directory', '');
    }
  }, []);

  const projectName = useCallback(
    (id?: string | null) => data.projects.find((p) => p.id === id)?.name ?? '—',
    [data.projects],
  );
  const clientName = useCallback(
    (id?: string | null) => data.clients.find((c) => c.id === id)?.displayName ?? '—',
    [data.clients],
  );

  const currentFolder = useMemo(() => resolveFolder(location, data), [location, data]);
  const breadcrumb = useMemo(() => buildBreadcrumb(location, data), [location, data]);
  const children = useMemo(() => listChildren(location, data), [location, data]);

  // Filtri (categoria + ricerca) applicati alla cartella corrente.
  const visibleFiles = useMemo(
    () =>
      children.files.filter((file) => {
        const matchesCategory = category === 'all' || categoryOf(file) === category;
        const matchesQuery = fileMatchesQuery(file, query, projectName(file.projectId), clientName(file.clientId));
        return matchesCategory && matchesQuery;
      }),
    [children.files, category, query, projectName, clientName],
  );
  const visibleFolders = useMemo(
    () => children.folders.filter((f) => !query.trim() || f.name.toLowerCase().includes(query.trim().toLowerCase())),
    [children.folders, query],
  );

  const navigateTo = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params);
      next.delete('projectId');
      if (id === ROOT_ID) next.delete('folderId');
      else next.set('folderId', id);
      setParams(next);
      setCategory('all');
    },
    [params, setParams],
  );

  // ─────────────── Anteprima file (click diretto sulla card/riga) ───────────────
  const previewFile = useCallback(
    async (file: FileItem) => {
      try {
        const url = await fileService.resolveUrl(file);
        if (!url) {
          toast.error('Anteprima non disponibile per questo file');
          return;
        }
        if (isMarkdownFile(file)) {
          const text = await (await fetch(url)).text();
          preview.open({ name: file.name, markdown: text });
        } else {
          preview.open({ name: file.name, url, mime: file.mime ?? undefined });
        }
      } catch {
        toast.error("Impossibile aprire l'anteprima");
      }
    },
    [preview],
  );

  // Navigazione anteprima con frecce ← → tra i file visibili (stile Finder).
  const previewIndexRef = useRef<number>(-1);
  const openPreviewAt = useCallback(
    (index: number) => {
      const list = visibleFiles;
      if (index < 0 || index >= list.length) return;
      previewIndexRef.current = index;
      void previewFile(list[index]);
    },
    [visibleFiles, previewFile],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && previewIndexRef.current >= 0) {
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const next = previewIndexRef.current + delta;
        if (next >= 0 && next < visibleFiles.length) {
          event.preventDefault();
          openPreviewAt(next);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visibleFiles, openPreviewAt]);

  // ─────────────── Upload nella cartella corrente (eredità progetto/cliente) ───────────────
  const uploadFiles = useCallback(
    async (selected: File[]) => {
      if (!selected.length) return;
      const ctx = resolveUploadContext(location, data);
      let uploaded = 0;
      for (const file of selected) {
        try {
          await upload.mutateAsync({
            file,
            folderId: ctx.folderId,
            projectId: ctx.projectId,
            clientId: ctx.clientId,
            documentCategory: category === 'all' ? undefined : (category as FileItem['documentCategory']),
            clientVisible: false,
            tags: [],
          });
          uploaded += 1;
        } catch (error) {
          console.error('[BnsStudio] Upload file fallito', error);
          const message = error instanceof Error ? error.message : 'Errore sconosciuto';
          toast.error(`Caricamento non riuscito per "${file.name}": ${message}`);
        }
      }
      if (uploaded) toast.success(`${uploaded} file caricati`);
    },
    [location, data, upload, category],
  );

  const onUploadInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await uploadFiles(Array.from(event.target.files ?? []));
    if (fileInput.current) fileInput.current.value = '';
    if (dirInput.current) dirInput.current.value = '';
  };

  // Trigger upload automatico da altre pagine (?upload=1).
  useEffect(() => {
    if (params.get('upload') === '1') {
      const next = new URLSearchParams(params);
      next.delete('upload');
      setParams(next, { replace: true });
      const timeout = setTimeout(() => fileInput.current?.click(), 120);
      return () => clearTimeout(timeout);
    }
  }, [params, setParams]);

  // ─────────────── Cartelle: crea / rinomina / elimina ───────────────
  const createFolder = async (input: NewFolderInput) => {
    const payload = buildFolderPayload(input, data);
    await createFolderMutation.mutateAsync(payload);
    toast.success('Cartella creata');
  };

  const renameFolder = async (folder: FolderNode, name: string) => {
    if (!name.trim() || name === folder.name) return;
    await updateFolder.mutateAsync({ id: folder.id, patch: { name: name.trim() } });
    toast.success('Cartella rinominata');
  };

  const deleteFolder = async (folder: FolderNode) => {
    // Zero-loss: i file risalgono al livello superiore (folderId=null), le
    // sottocartelle vengono soft-eliminate a cascata.
    const descendants = collectDescendantFolderIds(folder.id, data.folders);
    const affectedFolderIds = new Set([folder.id, ...descendants]);
    const affectedFiles = data.files.filter((f) => f.folderId && affectedFolderIds.has(f.folderId) && !f.deletedAt);
    await Promise.all(affectedFiles.map((f) => updateFile.mutateAsync({ id: f.id, patch: { folderId: null } })));
    await Promise.all([...affectedFolderIds].map((id) => removeFolder.mutateAsync(id)));
    toast.success('Cartella eliminata');
  };

  // ─────────────── Menu contestuali ───────────────
  const folderMenu = (folder: FolderNode): MenuItem[] => {
    if (folder.kind === 'project' || folder.kind === 'unassigned') {
      return [
        { label: 'Apri', icon: Folder, onClick: () => navigateTo(folder.id) },
        ...(folder.kind === 'project'
          ? [
              {
                label: 'Visualizza progetto',
                icon: FileText,
                onClick: () => folder.projectId && navigate(`/projects/${folder.projectId}`),
              },
              {
                label: 'Nuova sottocartella',
                icon: FolderPlus,
                onClick: () => {
                  navigateTo(folder.id);
                  setNewFolderOpen(true);
                },
              },
            ]
          : []),
      ];
    }
    return [
      { label: 'Apri', icon: Folder, onClick: () => navigateTo(folder.id) },
      { label: 'Rinomina', icon: Pencil, onClick: () => setRenameTarget(folder) },
      {
        label: 'Nuova sottocartella',
        icon: FolderPlus,
        onClick: () => {
          navigateTo(folder.id);
          setNewFolderOpen(true);
        },
      },
      { label: 'Elimina', icon: Trash2, danger: true, separatorBefore: true, onClick: () => setDeleteFolderTarget(folder) },
    ];
  };

  const fileMenu = (file: FileItem): MenuItem[] => [
    { label: 'Anteprima', icon: Search, onClick: () => void previewFile(file) },
    { label: 'Modifica', icon: Pencil, onClick: () => setOpenId(file.id) },
    {
      label: 'Scarica',
      icon: Download,
      onClick: async () => {
        const url = await fileService.resolveUrl(file);
        if (url) void saveUrlFile(file.name, url, file.mime ?? undefined);
      },
    },
    { label: 'Elimina', icon: Trash2, danger: true, separatorBefore: true, onClick: () => setDeleteFileTarget(file) },
  ];

  // ─────────────── Colonne vista lista (file) ───────────────
  const columns: Column<FileItem>[] = [
    {
      key: 'name',
      header: 'Nome',
      sortValue: (file) => file.name.toLowerCase(),
      render: (file) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2">{iconFor(file.mime)}</div>
          <div className="min-w-0">
            <p className="truncate font-medium" title={file.name}>{file.name}</p>
            <p className="truncate text-xs text-fg-subtle">{file.mime || 'File'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Categoria',
      sortValue: (file) => categoryOf(file),
      render: (file) => <Badge tone="neutral">{categoryOf(file)}</Badge>,
    },
    {
      key: 'project',
      header: 'Progetto / cliente',
      sortValue: (file) => `${projectName(file.projectId)}${clientName(file.clientId)}`,
      render: (file) => (
        <div className="space-y-0.5">
          <p className="truncate">{projectName(file.projectId)}</p>
          <p className="truncate text-xs text-fg-subtle">{clientName(file.clientId)}</p>
        </div>
      ),
    },
    {
      key: 'size',
      header: 'Dimensione',
      sortValue: (file) => file.size ?? 0,
      render: (file) => <span>{formatSize(file.size)}</span>,
    },
    {
      key: 'date',
      header: 'Ultima modifica',
      sortValue: (file) => file.updatedAt ?? file.createdAt,
      render: (file) => <span>{formatDate(file.updatedAt ?? file.createdAt)}</span>,
    },
    {
      key: 'visibility',
      header: 'Visibilità',
      render: (file) => <Badge tone={file.clientVisible ? 'info' : 'neutral'}>{file.clientVisible ? 'Cliente' : 'Interno'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (file) => (
        <button
          onClick={(event) => {
            event.stopPropagation();
            setOpenId(file.id);
          }}
          title="Modifica"
          aria-label="Modifica"
          className="press rounded-md p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ),
    },
  ];

  if (isLoading) return <LoadingState />;

  const locationLabel = currentFolder?.name ?? 'Archivio';
  const description = currentFolder
    ? `${visibleFolders.length ? `${visibleFolders.length} cartelle · ` : ''}${visibleFiles.length} file`
    : `${data.projects.filter((p) => !p.deletedAt).length} progetti · ${data.files.filter((f) => !f.deletedAt).length} file`;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <input ref={fileInput} type="file" multiple className="hidden" onChange={onUploadInput} />
      {/* webkitdirectory/directory non sono nei tipi standard: impostati via ref (vedi effetto sotto). */}
      <input ref={dirInput} type="file" multiple className="hidden" onChange={onUploadInput} />

      <PageHeader
        title="Archivio"
        description={description}
        actions={
          <>
            <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
              <button
                onClick={() => setFilesView('list')}
                className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors', filesView === 'list' ? 'bg-surface-2 text-fg' : 'text-fg-subtle hover:text-fg')}
              >
                <List className="h-4 w-4" /> Lista
              </button>
              <button
                onClick={() => setFilesView('grid')}
                className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors', filesView === 'grid' ? 'bg-surface-2 text-fg' : 'text-fg-subtle hover:text-fg')}
              >
                <Grid2x2 className="h-4 w-4" /> Griglia
              </button>
            </div>
            <NewMenu
              onNewFolder={() => setNewFolderOpen(true)}
              onUploadFile={() => fileInput.current?.click()}
              onUploadFolder={() => dirInput.current?.click()}
              onImportMarkdown={() => navigate('/import')}
            />
          </>
        }
      />

      {/* Breadcrumb + back */}
      <div className="flex items-center gap-2 text-sm">
        {location !== ROOT_ID && (
          <button
            onClick={() => navigateTo(currentFolder?.parentId ?? ROOT_ID)}
            className="press rounded-md p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg"
            title="Indietro"
            aria-label="Indietro"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap">
          {breadcrumb.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg-faint" />}
              <button
                onClick={() => navigateTo(crumb.id)}
                className={cn(
                  'rounded px-1.5 py-0.5 transition-colors',
                  index === breadcrumb.length - 1 ? 'font-medium text-fg' : 'text-fg-subtle hover:bg-surface-2 hover:text-fg',
                )}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>
      </div>

      {/* Ricerca + filtri categoria */}
      <div className="flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Cerca in ${locationLabel}…`}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={category === 'all'} onClick={() => setCategory('all')} label="Tutti" />
          {DOCUMENT_CATEGORIES.map((item) => (
            <FilterChip key={item} active={category === item} onClick={() => setCategory(item)} label={item} />
          ))}
        </div>
      </div>

      {/* Contenuto */}
      <div className="min-h-0 flex-1">
        {visibleFolders.length === 0 && visibleFiles.length === 0 ? (
          <div className="flex min-h-full items-center justify-center">
            <EmptyState
              icon={<Upload className="h-8 w-8" />}
              title={query ? 'Nessun risultato' : 'Cartella vuota'}
              description={query ? 'Nessun file o cartella corrisponde alla ricerca.' : 'Carica un file o crea una cartella per iniziare.'}
              action={
                <Button onClick={() => fileInput.current?.click()}>
                  <Upload className="h-4 w-4" /> Carica file
                </Button>
              }
            />
          </div>
        ) : filesView === 'grid' ? (
          <div className="max-h-full space-y-5 overflow-y-auto overscroll-contain pr-1">
            {visibleFolders.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-medium uppercase tracking-wide text-fg-faint">Cartelle</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {visibleFolders.map((folder) => (
                    <ContextMenu key={folder.id} items={folderMenu(folder)}>
                      <FolderCard folder={folder} clientName={clientName} onOpen={() => navigateTo(folder.id)} menu={folderMenu(folder)} />
                    </ContextMenu>
                  ))}
                </div>
              </section>
            )}
            {visibleFiles.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-medium uppercase tracking-wide text-fg-faint">File</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleFiles.map((file, index) => (
                    <ContextMenu key={file.id} items={fileMenu(file)}>
                      <FileCard
                        file={file}
                        projectName={projectName}
                        clientName={clientName}
                        onPreview={() => openPreviewAt(index)}
                        onEdit={() => setOpenId(file.id)}
                      />
                    </ContextMenu>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="max-h-full space-y-4 overflow-y-auto overscroll-contain pr-1">
            {visibleFolders.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-border">
                {visibleFolders.map((folder) => (
                  <ContextMenu key={folder.id} items={folderMenu(folder)}>
                    <button
                      onClick={() => navigateTo(folder.id)}
                      className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-surface-2"
                    >
                      <Folder className="h-4 w-4 shrink-0" style={{ color: folder.color ?? undefined }} />
                      <span className="min-w-0 flex-1 truncate font-medium" title={folder.name}>{folder.name}</span>
                      <span className="shrink-0 text-xs text-fg-subtle">
                        {folder.folderCount > 0 && `${folder.folderCount} cartelle · `}{folder.fileCount} file
                      </span>
                    </button>
                  </ContextMenu>
                ))}
              </div>
            )}
            {visibleFiles.length > 0 && (
              <DataTable data={visibleFiles} columns={columns} onRowClick={(file) => void previewFile(file)} rowMenu={fileMenu} />
            )}
          </div>
        )}
      </div>

      <FileDetailDrawer fileId={openId} onClose={() => setOpenId(null)} />

      <NewFolderDialog
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        onCreate={createFolder}
        locationName={locationLabel}
        parentLocationId={location}
      />

      <RenameDialog
        folder={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={(name) => renameTarget && renameFolder(renameTarget, name)}
      />

      <ConfirmDialog
        open={!!deleteFolderTarget}
        onClose={() => setDeleteFolderTarget(null)}
        onConfirm={() => deleteFolderTarget && void deleteFolder(deleteFolderTarget)}
        title="Elimina cartella"
        message={
          deleteFolderTarget
            ? `Eliminare "${deleteFolderTarget.name}"? ${
                deleteFolderTarget.fileCount + deleteFolderTarget.folderCount > 0
                  ? `Contiene ${deleteFolderTarget.folderCount} sottocartelle e ${deleteFolderTarget.fileCount} file: i file verranno spostati al livello superiore, non eliminati.`
                  : 'La cartella è vuota.'
              }`
            : ''
        }
        confirmLabel="Elimina cartella"
        danger
      />

      <ConfirmDialog
        open={!!deleteFileTarget}
        onClose={() => setDeleteFileTarget(null)}
        onConfirm={async () => {
          if (deleteFileTarget) {
            await remove.mutateAsync(deleteFileTarget);
            toast.success('File eliminato');
          }
        }}
        title="Elimina file"
        message={deleteFileTarget ? `Eliminare "${deleteFileTarget.name}"?` : ''}
        confirmLabel="Elimina"
        danger
      />
    </div>
  );
}

// ─────────────── Sottocomponenti ───────────────

function FolderCard({
  folder,
  clientName,
  onOpen,
  menu,
}: {
  folder: FolderNode;
  clientName: (id?: string | null) => string;
  onOpen: () => void;
  menu: MenuItem[];
}) {
  return (
    <Card
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="group press flex cursor-pointer items-center gap-3 p-3.5 outline-none transition-colors hover:border-border-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${folder.color ?? '#a3e635'}22` }}
      >
        <Folder className="h-6 w-6" style={{ color: folder.color ?? '#a3e635' }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={folder.name}>{folder.name}</p>
        <p className="truncate text-xs text-fg-subtle">
          {folder.folderCount > 0 && `${folder.folderCount} cartelle · `}
          {folder.fileCount} file
          {folder.clientId ? ` · ${clientName(folder.clientId)}` : ''}
        </p>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <ActionMenu items={menu} />
      </div>
    </Card>
  );
}

function FileCard({
  file,
  projectName,
  clientName,
  onPreview,
  onEdit,
}: {
  file: FileItem;
  projectName: (id?: string | null) => string;
  clientName: (id?: string | null) => string;
  onPreview: () => void;
  onEdit: () => void;
}) {
  return (
    <Card
      onClick={onPreview}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          onPreview();
        } else if (e.key === 'Enter') onPreview();
      }}
      className="group press flex cursor-pointer flex-col gap-3 p-3.5 outline-none transition-colors hover:border-border-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2">{iconFor(file.mime)}</div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label="Modifica"
            title="Modifica"
            className="press rounded-md p-1.5 text-fg-subtle opacity-0 transition-opacity hover:bg-surface-2 hover:text-fg group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <Badge tone={file.clientVisible ? 'info' : 'neutral'}>{file.clientVisible ? 'Cliente' : 'Interno'}</Badge>
        </div>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium" title={file.name}>{file.name}</p>
        <Badge tone="neutral">{file.documentCategory ?? 'Altro'}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-fg-subtle">
        <span>{formatSize(file.size)}</span>
        <span className="text-right">{formatDate(file.updatedAt ?? file.createdAt)}</span>
        <span className="col-span-2 truncate">{projectName(file.projectId)} · {clientName(file.clientId)}</span>
      </div>
    </Card>
  );
}

function NewMenu({
  onNewFolder,
  onUploadFile,
  onUploadFolder,
  onImportMarkdown,
}: {
  onNewFolder: () => void;
  onUploadFile: () => void;
  onUploadFolder: () => void;
  onImportMarkdown: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item = (icon: React.ReactNode, label: string, action: () => void) => (
    <button
      onClick={() => {
        setOpen(false);
        action();
      }}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setOpen((v) => !v)}>
        <Plus className="h-4 w-4" /> Nuovo
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 animate-scale-in rounded-lg border border-border bg-surface p-1 shadow-pop">
          {item(<FolderPlus className="h-4 w-4" />, 'Nuova cartella', onNewFolder)}
          {item(<Upload className="h-4 w-4" />, 'Carica file', onUploadFile)}
          {item(<FolderUp className="h-4 w-4" />, 'Carica cartella', onUploadFolder)}
          <div className="my-1 h-px bg-border" />
          {item(<FilePlus2 className="h-4 w-4" />, 'Importa Markdown', onImportMarkdown)}
        </div>
      )}
    </div>
  );
}

function RenameDialog({
  folder,
  onClose,
  onRename,
}: {
  folder: FolderNode | null;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (folder) setName(folder.name);
  }, [folder]);

  const submit = () => {
    if (name.trim()) onRename(name);
    onClose();
  };

  return (
    <Modal
      open={!!folder}
      onClose={onClose}
      title="Rinomina cartella"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={submit} disabled={!name.trim()}>Salva</Button>
        </>
      }
    >
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
    </Modal>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm transition-colors',
        active ? 'border-accent/40 bg-accent/10 text-fg' : 'border-border text-fg-subtle hover:bg-surface-2',
      )}
    >
      {label}
    </button>
  );
}
