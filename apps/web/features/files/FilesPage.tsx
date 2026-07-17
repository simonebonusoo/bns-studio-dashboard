import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  File as FileIcon,
  FileArchive,
  FilePlus2,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  FolderUp,
  Grid2x2,
  Image,
  Link as LinkIcon,
  List,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select, Field } from '@/components/ui/Input';
import { ContextMenu, type MenuItem } from '@/components/ui/ContextMenu';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { useUploadFile, useRemoveFile } from '@/hooks/useFiles';
import { DOCUMENT_CATEGORIES } from './documentCategories';
import { FileDetailDrawer } from './FileDetailDrawer';
import { NewFolderDialog } from './NewFolderDialog';
import { MoveDialog } from './MoveDialog';
import { TrashDialog } from './TrashDialog';
import {
  useArchiveData,
  useArchiveMutations,
  resolveUploadContext,
  resolveParentContext,
  type NewFolderInput,
} from './useArchive';
import {
  ROOT_ID,
  allFolderNodes,
  buildBreadcrumb,
  collectDescendantFolderIds,
  dedupeName,
  fileLocationId,
  fileMatchesQuery,
  listChildren,
  locationPath,
  resolveFolder,
  wouldCreateCycle,
  type FolderNode,
} from './archiveModel';
import { usePreview } from '@/components/preview/previewContext';
import { fileService } from '@/services/fileService';
import { useUI } from '@/stores/ui';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { saveUrlFile } from '@/services/downloadService';
import type { FileItem, FolderVisibility, Project } from '@/types';

function iconFor(mime?: string | null) {
  const type = mime ?? '';
  if (type.startsWith('image')) return <Image className="h-5 w-5 text-info" />;
  if (type.includes('pdf')) return <FileText className="h-5 w-5 text-danger" />;
  if (type.includes('zip')) return <FileArchive className="h-5 w-5 text-warning" />;
  return <FileIcon className="h-5 w-5 text-fg-subtle" />;
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
  const [searchScope, setSearchScope] = useState<'folder' | 'all'>('folder');
  const [openId, setOpenId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FolderNode | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<FolderNode | null>(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState<FileItem | null>(null);
  const [renameFileTarget, setRenameFileTarget] = useState<FileItem | null>(null);
  const [linkProjectOpen, setLinkProjectOpen] = useState(false);
  const [tagPromptOpen, setTagPromptOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  // Selezione multipla: id compositi "file:<id>" / "folder:<id>".
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveState, setMoveState] = useState<{ files: FileItem[]; folders: FolderNode[] } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemRef = useRef<{ kind: 'file' | 'folder'; id: string } | null>(null);
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

  const trimmedQuery = query.trim();
  const globalSearch = trimmedQuery.length > 0 && searchScope === 'all';

  // Filtri (categoria + ricerca). In ricerca globale si attraversa tutto l'archivio.
  const visibleFiles = useMemo(() => {
    const source = globalSearch ? data.files.filter((f) => !f.deletedAt) : children.files;
    return source.filter((file) => {
      const matchesCategory = category === 'all' || categoryOf(file) === category;
      const matchesQuery = fileMatchesQuery(file, query, projectName(file.projectId), clientName(file.clientId));
      return matchesCategory && matchesQuery;
    });
  }, [globalSearch, data.files, children.files, category, query, projectName, clientName]);

  const visibleFolders = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (globalSearch) {
      return allFolderNodes(data).filter((f) => f.name.toLowerCase().includes(q));
    }
    return children.folders.filter((f) => !q || f.name.toLowerCase().includes(q));
  }, [globalSearch, data, children.folders, trimmedQuery]);

  const navigateTo = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params);
      next.delete('projectId');
      if (id === ROOT_ID) next.delete('folderId');
      else next.set('folderId', id);
      setParams(next);
      setCategory('all');
      setSelected(new Set());
    },
    [params, setParams],
  );

  // ─────────────── Selezione multipla ───────────────
  const selectionActive = selected.size > 0;
  const isSelected = (kind: 'file' | 'folder', id: string) => selected.has(`${kind}:${id}`);
  const toggleSelect = useCallback((kind: 'file' | 'folder', id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = `${kind}:${id}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectedFiles = useMemo(
    () => visibleFiles.filter((f) => selected.has(`file:${f.id}`)),
    [visibleFiles, selected],
  );
  const selectedFolders = useMemo(
    () => visibleFolders.filter((f) => selected.has(`folder:${f.id}`)),
    [visibleFolders, selected],
  );

  // ─────────────── Spostamento (drag&drop, menu, barra di massa) ───────────────
  const moveFileTo = useCallback(
    async (file: FileItem, targetLocationId: string) => {
      const ctx = resolveUploadContext(targetLocationId, data);
      if ((file.folderId ?? null) === ctx.folderId && (file.projectId ?? null) === ctx.projectId) return;
      await updateFile.mutateAsync({
        id: file.id,
        patch: { folderId: ctx.folderId, projectId: ctx.projectId, clientId: ctx.clientId },
      });
    },
    [data, updateFile],
  );

  const moveFolderTo = useCallback(
    async (folder: FolderNode, targetLocationId: string) => {
      if (folder.kind !== 'custom') {
        toast.error('Questa cartella non può essere spostata');
        return;
      }
      const ctx = resolveParentContext(targetLocationId, data);
      if (folder.id === ctx.parentFolderId || wouldCreateCycle(folder.id, ctx.parentFolderId, data.folders)) {
        toast.error('Spostamento non valido: creerebbe un ciclo di cartelle');
        return;
      }
      const descendants = collectDescendantFolderIds(folder.id, data.folders);
      const subtree = new Set([folder.id, ...descendants]);
      await updateFolder.mutateAsync({
        id: folder.id,
        patch: { parentFolderId: ctx.parentFolderId, projectId: ctx.projectId, clientId: ctx.clientId },
      });
      // Il sottoalbero eredita lo scopo (progetto/cliente) della destinazione.
      await Promise.all(
        descendants.map((id) => updateFolder.mutateAsync({ id, patch: { projectId: ctx.projectId, clientId: ctx.clientId } })),
      );
      const affectedFiles = data.files.filter((f) => f.folderId && subtree.has(f.folderId) && !f.deletedAt);
      await Promise.all(
        affectedFiles.map((f) => updateFile.mutateAsync({ id: f.id, patch: { projectId: ctx.projectId, clientId: ctx.clientId } })),
      );
    },
    [data, updateFolder, updateFile],
  );

  const performMove = useCallback(
    async (targetLocationId: string, files: FileItem[], folders: FolderNode[]) => {
      try {
        for (const folder of folders) await moveFolderTo(folder, targetLocationId);
        for (const file of files) await moveFileTo(file, targetLocationId);
        const total = files.length + folders.length;
        if (total) toast.success(`${total} element${total === 1 ? 'o spostato' : 'i spostati'}`);
        clearSelection();
      } catch (error) {
        console.error('[BnsStudio] Spostamento fallito', error);
        toast.error('Spostamento non riuscito');
      }
    },
    [moveFileTo, moveFolderTo, clearSelection],
  );

  // Elimina una cartella preservando i file: risalgono al livello superiore
  // (folderId=null); le sottocartelle vengono soft-eliminate a cascata.
  const deleteFolderCascade = useCallback(
    async (folder: FolderNode) => {
      const descendants = collectDescendantFolderIds(folder.id, data.folders);
      const affectedFolderIds = new Set([folder.id, ...descendants]);
      const affectedFiles = data.files.filter((f) => f.folderId && affectedFolderIds.has(f.folderId) && !f.deletedAt);
      await Promise.all(affectedFiles.map((f) => updateFile.mutateAsync({ id: f.id, patch: { folderId: null } })));
      await Promise.all([...affectedFolderIds].map((id) => removeFolder.mutateAsync(id)));
    },
    [data, updateFile, removeFolder],
  );

  // ─────────────── Azioni di massa ───────────────
  const bulkDownload = useCallback(async () => {
    for (const file of selectedFiles) {
      const url = await fileService.resolveUrl(file);
      if (url) await saveUrlFile(file.name, url, file.mime ?? undefined);
    }
    if (selectedFiles.length) toast.success(`${selectedFiles.length} file scaricati`);
  }, [selectedFiles]);

  const bulkSetVisibility = useCallback(
    async (clientVisible: boolean) => {
      await Promise.all(selectedFiles.map((f) => updateFile.mutateAsync({ id: f.id, patch: { clientVisible } })));
      toast.success(clientVisible ? 'Resi visibili al cliente' : 'Resi interni');
      clearSelection();
    },
    [selectedFiles, updateFile, clearSelection],
  );

  const bulkDelete = useCallback(async () => {
    await Promise.all(selectedFiles.map((f) => remove.mutateAsync(f)));
    for (const folder of selectedFolders) await deleteFolderCascade(folder);
    toast.success('Elementi eliminati');
    clearSelection();
  }, [selectedFiles, selectedFolders, remove, deleteFolderCascade, clearSelection]);

  // ─────────────── Drag & drop ───────────────
  const beginDrag = useCallback((e: React.DragEvent, kind: 'file' | 'folder', id: string) => {
    dragItemRef.current = { kind, id };
    // setData è necessario ad alcuni browser (Firefox) per avviare il drag.
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', `${kind}:${id}`);
    } catch {
      /* alcuni ambienti non permettono setData: il ref è comunque sufficiente */
    }
  }, []);

  const onDropOnFolder = useCallback(
    async (targetLocationId: string) => {
      const dragged = dragItemRef.current;
      setDragOverId(null);
      dragItemRef.current = null;
      if (!dragged) return;
      // Se l'elemento trascinato è selezionato, sposta l'intera selezione.
      const draggedKey = `${dragged.kind}:${dragged.id}`;
      const useSelection = selected.has(draggedKey) && selected.size > 1;
      const files = useSelection ? selectedFiles : dragged.kind === 'file' ? visibleFiles.filter((f) => f.id === dragged.id) : [];
      const folders = useSelection ? selectedFolders : dragged.kind === 'folder' ? visibleFolders.filter((f) => f.id === dragged.id) : [];
      await performMove(targetLocationId, files, folders);
    },
    [selected, selectedFiles, selectedFolders, visibleFiles, visibleFolders, performMove],
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

  // Cmd/Ctrl+A seleziona tutto il visibile; Escape azzera la selezione.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setNewFolderOpen(true);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        if (visibleFiles.length + visibleFolders.length === 0) return;
        event.preventDefault();
        setSelected(
          new Set([
            ...visibleFolders.map((f) => `folder:${f.id}`),
            ...visibleFiles.map((f) => `file:${f.id}`),
          ]),
        );
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selected.size > 0) {
        event.preventDefault();
        setBulkDeleteOpen(true);
      } else if (event.key === 'Escape' && selected.size > 0) {
        setSelected(new Set());
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visibleFiles, visibleFolders, selected.size]);

  // ─────────────── Upload nella cartella corrente (eredità progetto/cliente) ───────────────
  const uploadFiles = useCallback(
    async (selected: File[]) => {
      if (!selected.length) return;
      const ctx = resolveUploadContext(location, data);
      // Dedupe nomi nella cartella corrente (comportamento "mantieni entrambi").
      const taken = new Set(children.files.map((f) => f.name.toLowerCase()));
      const toastId = toast.loading(`Caricamento 0/${selected.length}…`);
      let uploaded = 0;
      for (const file of selected) {
        try {
          const name = dedupeName(file.name, taken);
          taken.add(name.toLowerCase());
          const toUpload = name === file.name ? file : new File([file], name, { type: file.type });
          await upload.mutateAsync({
            file: toUpload,
            folderId: ctx.folderId,
            projectId: ctx.projectId,
            clientId: ctx.clientId,
            documentCategory: category === 'all' ? undefined : (category as FileItem['documentCategory']),
            // Eredita la visibilità di default della cartella, se impostata.
            clientVisible: ctx.defaultVisibility === 'client',
            tags: [],
          });
          uploaded += 1;
          toast.loading(`Caricamento ${uploaded}/${selected.length}…`, { id: toastId });
        } catch (error) {
          console.error('[BnsStudio] Upload file fallito', error);
          const message = error instanceof Error ? error.message : 'Errore sconosciuto';
          toast.error(`Caricamento non riuscito per "${file.name}": ${message}`);
        }
      }
      if (uploaded) toast.success(`${uploaded} file caricati`, { id: toastId });
      else toast.dismiss(toastId);
    },
    [location, data, children.files, upload, category],
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

  const editFolder = async (
    folder: FolderNode,
    patch: { name: string; color: string | null; description: string | null; defaultVisibility: FolderVisibility | null },
  ) => {
    await updateFolder.mutateAsync({ id: folder.id, patch });
    toast.success('Cartella aggiornata');
  };

  const deleteFolder = async (folder: FolderNode) => {
    await deleteFolderCascade(folder);
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
      { label: 'Modifica (nome, colore)', icon: Pencil, onClick: () => setRenameTarget(folder) },
      { label: 'Sposta', icon: FolderInput, onClick: () => setMoveState({ files: [], folders: [folder] }) },
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

  const copyLink = useCallback(async (file: FileItem) => {
    try {
      const url = await fileService.resolveUrl(file);
      if (!url) return toast.error('Link non disponibile');
      await navigator.clipboard.writeText(url);
      toast.success('Link copiato');
    } catch {
      toast.error('Impossibile copiare il link');
    }
  }, []);

  const toggleVisibility = useCallback(
    async (file: FileItem) => {
      await updateFile.mutateAsync({ id: file.id, patch: { clientVisible: !file.clientVisible } });
      toast.success(file.clientVisible ? 'Reso interno' : 'Reso visibile al cliente');
    },
    [updateFile],
  );

  const duplicateFile = useCallback(
    async (file: FileItem) => {
      try {
        const url = await fileService.resolveUrl(file);
        if (!url) return toast.error('Impossibile duplicare: file non disponibile');
        const blob = await (await fetch(url)).blob();
        const taken = new Set(children.files.map((f) => f.name.toLowerCase()));
        const copyName = dedupeName(file.name, taken);
        await upload.mutateAsync({
          file: new File([blob], copyName, { type: file.mime || blob.type }),
          folderId: file.folderId ?? null,
          projectId: file.projectId ?? null,
          clientId: file.clientId ?? null,
          documentCategory: file.documentCategory,
          clientVisible: file.clientVisible,
          tags: file.tags ?? [],
        });
        toast.success('File duplicato');
      } catch (error) {
        console.error('[BnsStudio] Duplicazione fallita', error);
        toast.error('Duplicazione non riuscita');
      }
    },
    [children.files, upload],
  );

  const bulkLinkProject = useCallback(
    async (projectId: string | null) => {
      const clientId = projectId ? (data.projects.find((p) => p.id === projectId)?.clientId ?? null) : null;
      await Promise.all(
        selectedFiles.map((f) => updateFile.mutateAsync({ id: f.id, patch: { projectId, clientId } })),
      );
      toast.success('Progetto collegato');
      clearSelection();
    },
    [selectedFiles, data.projects, updateFile, clearSelection],
  );

  const bulkAddTags = useCallback(
    async (tags: string[]) => {
      if (!tags.length) return;
      await Promise.all(
        selectedFiles.map((f) =>
          updateFile.mutateAsync({ id: f.id, patch: { tags: Array.from(new Set([...(f.tags ?? []), ...tags])) } }),
        ),
      );
      toast.success('Tag aggiunti');
      clearSelection();
    },
    [selectedFiles, updateFile, clearSelection],
  );

  const fileMenu = (file: FileItem): MenuItem[] => [
    { label: 'Anteprima', icon: Search, onClick: () => void previewFile(file) },
    { label: 'Modifica', icon: Pencil, onClick: () => setOpenId(file.id) },
    { label: 'Rinomina', icon: Pencil, onClick: () => setRenameFileTarget(file) },
    { label: 'Sposta', icon: FolderInput, onClick: () => setMoveState({ files: [file], folders: [] }) },
    { label: 'Duplica', icon: Copy, onClick: () => void duplicateFile(file) },
    {
      label: 'Scarica',
      icon: Download,
      onClick: async () => {
        const url = await fileService.resolveUrl(file);
        if (url) void saveUrlFile(file.name, url, file.mime ?? undefined);
      },
    },
    { label: 'Copia link', icon: LinkIcon, onClick: () => void copyLink(file) },
    {
      label: file.clientVisible ? 'Rendi interno' : 'Rendi visibile al cliente',
      icon: file.clientVisible ? EyeOff : Eye,
      onClick: () => void toggleVisibility(file),
    },
    { label: 'Elimina', icon: Trash2, danger: true, separatorBefore: true, onClick: () => setDeleteFileTarget(file) },
  ];

  // ─────────────── Colonne vista lista (file) ───────────────
  const columns: Column<FileItem>[] = [
    {
      key: 'select',
      header: '',
      className: 'w-8',
      render: (file) => (
        <SelectCheckbox
          selected={isSelected('file', file.id)}
          show={selectionActive}
          onToggle={() => toggleSelect('file', file.id)}
        />
      ),
    },
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
            <Button variant="secondary" size="icon" onClick={() => setTrashOpen(true)} title="Cestino" aria-label="Cestino">
              <Trash2 className="h-4 w-4" />
            </Button>
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
                onDragOver={(e) => {
                  if (dragItemRef.current && crumb.id !== location) {
                    e.preventDefault();
                    setDragOverId(`crumb:${crumb.id}`);
                  }
                }}
                onDragLeave={() => setDragOverId((cur) => (cur === `crumb:${crumb.id}` ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  void onDropOnFolder(crumb.id);
                }}
                className={cn(
                  'rounded px-1.5 py-0.5 transition-colors',
                  dragOverId === `crumb:${crumb.id}` && 'bg-accent/15 ring-1 ring-accent/40',
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchScope === 'all' ? 'Cerca in tutto l’archivio…' : `Cerca in ${locationLabel}…`}
              className="pl-9"
            />
          </div>
          {trimmedQuery && (
            <div className="flex items-center rounded-lg border border-border bg-surface p-0.5 text-sm">
              <button
                onClick={() => setSearchScope('folder')}
                className={cn('rounded-md px-2.5 py-1.5 transition-colors', searchScope === 'folder' ? 'bg-surface-2 text-fg' : 'text-fg-subtle hover:text-fg')}
              >
                Questa cartella
              </button>
              <button
                onClick={() => setSearchScope('all')}
                className={cn('rounded-md px-2.5 py-1.5 transition-colors', searchScope === 'all' ? 'bg-surface-2 text-fg' : 'text-fg-subtle hover:text-fg')}
              >
                Tutto l’archivio
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={category === 'all'} onClick={() => setCategory('all')} label="Tutti" />
          {DOCUMENT_CATEGORIES.map((item) => (
            <FilterChip key={item} active={category === item} onClick={() => setCategory(item)} label={item} />
          ))}
        </div>
        {globalSearch && (
          <p className="text-xs text-fg-subtle">
            Ricerca in tutto l’archivio · {visibleFiles.length} file, {visibleFolders.length} cartelle
          </p>
        )}
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
                      <FolderCard
                        folder={folder}
                        clientName={clientName}
                        menu={folderMenu(folder)}
                        onOpen={() => navigateTo(folder.id)}
                        selection={{
                          selected: isSelected('folder', folder.id),
                          selectionActive,
                          onToggleSelect: () => toggleSelect('folder', folder.id),
                        }}
                        drag={{
                          draggable: folder.kind === 'custom',
                          onDragStart: (e) => beginDrag(e, 'folder', folder.id),
                          onDragEnd: () => {
                            dragItemRef.current = null;
                            setDragOverId(null);
                          },
                        }}
                        drop={{
                          dragOver: dragOverId === folder.id,
                          onDragOver: (e) => {
                            e.preventDefault();
                            if (dragItemRef.current) setDragOverId(folder.id);
                          },
                          onDragLeave: () => setDragOverId((cur) => (cur === folder.id ? null : cur)),
                          onDrop: (e) => {
                            e.preventDefault();
                            void onDropOnFolder(folder.id);
                          },
                        }}
                      />
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
                        pathLabel={globalSearch ? locationPath(fileLocationId(file), data) : undefined}
                        onPreview={() => openPreviewAt(index)}
                        onEdit={() => setOpenId(file.id)}
                        selection={{
                          selected: isSelected('file', file.id),
                          selectionActive,
                          onToggleSelect: () => toggleSelect('file', file.id),
                        }}
                        drag={{
                          onDragStart: (e) => beginDrag(e, 'file', file.id),
                          onDragEnd: () => {
                            dragItemRef.current = null;
                          },
                        }}
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
                    <div
                      role="button"
                      tabIndex={0}
                      draggable={folder.kind === 'custom'}
                      onDragStart={(e) => beginDrag(e, 'folder', folder.id)}
                      onDragEnd={() => {
                        dragItemRef.current = null;
                        setDragOverId(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragItemRef.current) setDragOverId(folder.id);
                      }}
                      onDragLeave={() => setDragOverId((cur) => (cur === folder.id ? null : cur))}
                      onDrop={(e) => {
                        e.preventDefault();
                        void onDropOnFolder(folder.id);
                      }}
                      onClick={() => (selectionActive ? toggleSelect('folder', folder.id) : navigateTo(folder.id))}
                      onKeyDown={(e) => e.key === 'Enter' && navigateTo(folder.id)}
                      className={cn(
                        'group flex w-full cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 text-left text-sm transition-colors last:border-b-0',
                        dragOverId === folder.id ? 'bg-accent/10 ring-1 ring-inset ring-accent/40' : 'hover:bg-surface-2',
                        isSelected('folder', folder.id) && 'bg-accent/[0.06]',
                      )}
                    >
                      <SelectCheckbox
                        selected={isSelected('folder', folder.id)}
                        show={selectionActive}
                        onToggle={() => toggleSelect('folder', folder.id)}
                      />
                      <Folder className="h-4 w-4 shrink-0" style={{ color: folder.color ?? undefined }} />
                      <span className="min-w-0 flex-1 truncate font-medium" title={folder.name}>{folder.name}</span>
                      <span className="shrink-0 text-xs text-fg-subtle">
                        {folder.folderCount > 0 && `${folder.folderCount} cartelle · `}{folder.fileCount} file
                      </span>
                    </div>
                  </ContextMenu>
                ))}
              </div>
            )}
            {visibleFiles.length > 0 && (
              <DataTable
                data={visibleFiles}
                columns={columns}
                onRowClick={(file) => (selectionActive ? toggleSelect('file', file.id) : void previewFile(file))}
                rowMenu={fileMenu}
              />
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

      <EditFolderDialog
        folder={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSave={(patch) => renameTarget && editFolder(renameTarget, patch)}
      />

      <PromptDialog
        open={!!renameFileTarget}
        title="Rinomina file"
        label="Nome file"
        initial={renameFileTarget?.name ?? ''}
        onClose={() => setRenameFileTarget(null)}
        onConfirm={async (name) => {
          if (renameFileTarget && name.trim()) {
            await updateFile.mutateAsync({ id: renameFileTarget.id, patch: { name: name.trim() } });
            toast.success('File rinominato');
          }
        }}
      />

      <PromptDialog
        open={tagPromptOpen}
        title="Aggiungi tag"
        label="Tag (separati da virgola)"
        initial=""
        onClose={() => setTagPromptOpen(false)}
        onConfirm={(value) => bulkAddTags(value.split(',').map((t) => t.trim()).filter(Boolean))}
      />

      <LinkProjectDialog
        open={linkProjectOpen}
        projects={data.projects.filter((p) => !p.deletedAt)}
        onClose={() => setLinkProjectOpen(false)}
        onConfirm={(projectId) => bulkLinkProject(projectId)}
      />

      <TrashDialog open={trashOpen} onClose={() => setTrashOpen(false)} />

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

      {/* Dialog Sposta (menu contestuale o barra di massa) */}
      <MoveDialog
        open={!!moveState}
        onClose={() => setMoveState(null)}
        data={data}
        count={(moveState?.files.length ?? 0) + (moveState?.folders.length ?? 0)}
        exclude={
          moveState
            ? new Set(
                moveState.folders.flatMap((f) => [f.id, ...collectDescendantFolderIds(f.id, data.folders)]),
              )
            : undefined
        }
        onMove={(target) => {
          if (moveState) return performMove(target, moveState.files, moveState.folders);
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => void bulkDelete()}
        title="Elimina elementi selezionati"
        message={`Eliminare ${selectedFiles.length} file e ${selectedFolders.length} cartelle? I file nelle cartelle verranno spostati al livello superiore.`}
        confirmLabel="Elimina"
        danger
      />

      {/* Barra azioni di massa */}
      {selectionActive && (
        <BulkBar
          fileCount={selectedFiles.length}
          folderCount={selectedFolders.length}
          onMove={() => setMoveState({ files: selectedFiles, folders: selectedFolders })}
          onDownload={() => void bulkDownload()}
          onVisible={() => void bulkSetVisibility(true)}
          onInternal={() => void bulkSetVisibility(false)}
          onLinkProject={() => setLinkProjectOpen(true)}
          onAddTags={() => setTagPromptOpen(true)}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={clearSelection}
        />
      )}
    </div>
  );
}

function BulkBar({
  fileCount,
  folderCount,
  onMove,
  onDownload,
  onVisible,
  onInternal,
  onLinkProject,
  onAddTags,
  onDelete,
  onClear,
}: {
  fileCount: number;
  folderCount: number;
  onMove: () => void;
  onDownload: () => void;
  onVisible: () => void;
  onInternal: () => void;
  onLinkProject: () => void;
  onAddTags: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const total = fileCount + folderCount;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/95 p-1.5 pl-3 shadow-pop backdrop-blur animate-scale-in">
        <span className="mr-1 text-sm font-medium">{total} selezionati</span>
        <Button variant="ghost" size="sm" onClick={onMove}><FolderInput className="h-4 w-4" /> Sposta</Button>
        {fileCount > 0 && (
          <>
            <Button variant="ghost" size="sm" onClick={onDownload}><Download className="h-4 w-4" /> Scarica</Button>
            <Button variant="ghost" size="sm" onClick={onLinkProject}><FileText className="h-4 w-4" /> Progetto</Button>
            <Button variant="ghost" size="sm" onClick={onAddTags}><Tag className="h-4 w-4" /> Tag</Button>
            <Button variant="ghost" size="sm" onClick={onVisible} title="Rendi visibile al cliente"><Eye className="h-4 w-4" /> Cliente</Button>
            <Button variant="ghost" size="sm" onClick={onInternal} title="Rendi interno"><EyeOff className="h-4 w-4" /> Interno</Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 text-danger" /> Elimina</Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <button onClick={onClear} aria-label="Deseleziona" className="press rounded-md p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────── Sottocomponenti ───────────────

interface SelectionProps {
  selected: boolean;
  selectionActive: boolean;
  onToggleSelect: () => void;
}

interface DropProps {
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

interface DragProps {
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function SelectCheckbox({ selected, show, onToggle }: { selected: boolean; show: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={selected ? 'Deseleziona' : 'Seleziona'}
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-md border transition-all',
        selected
          ? 'border-accent bg-accent text-bg'
          : 'border-border bg-surface/80 text-transparent hover:border-border-strong',
        selected || show ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </button>
  );
}

function FolderCard({
  folder,
  clientName,
  menu,
  selection,
  drop,
  drag,
  onOpen,
}: {
  folder: FolderNode;
  clientName: (id?: string | null) => string;
  menu: MenuItem[];
  selection: SelectionProps;
  drop: DropProps;
  drag: DragProps;
  onOpen: () => void;
}) {
  const handleClick = () => (selection.selectionActive ? selection.onToggleSelect() : onOpen());
  return (
    <Card
      onClick={handleClick}
      tabIndex={0}
      draggable={drag.draggable}
      onDragStart={drag.onDragStart}
      onDragEnd={drag.onDragEnd}
      onDragOver={drop.onDragOver}
      onDragLeave={drop.onDragLeave}
      onDrop={drop.onDrop}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className={cn(
        'group press flex cursor-pointer items-center gap-3 p-3.5 outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30',
        drop.dragOver ? 'border-accent ring-2 ring-accent/40' : 'hover:border-border-strong',
        selection.selected && 'border-accent/60 bg-accent/[0.06]',
      )}
    >
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${folder.color ?? '#a3e635'}22` }}
        >
          <Folder className="h-6 w-6" style={{ color: folder.color ?? '#a3e635' }} />
        </div>
        <div className="absolute -left-1 -top-1">
          <SelectCheckbox selected={selection.selected} show={selection.selectionActive} onToggle={selection.onToggleSelect} />
        </div>
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
  pathLabel,
  selection,
  drag,
  onPreview,
  onEdit,
}: {
  file: FileItem;
  projectName: (id?: string | null) => string;
  clientName: (id?: string | null) => string;
  pathLabel?: string;
  selection: SelectionProps;
  drag: Omit<DragProps, 'draggable'>;
  onPreview: () => void;
  onEdit: () => void;
}) {
  const handleClick = () => (selection.selectionActive ? selection.onToggleSelect() : onPreview());
  return (
    <Card
      onClick={handleClick}
      tabIndex={0}
      draggable
      onDragStart={drag.onDragStart}
      onDragEnd={drag.onDragEnd}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          handleClick();
        } else if (e.key === 'Enter') handleClick();
      }}
      className={cn(
        'group press flex cursor-pointer flex-col gap-3 p-3.5 outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30',
        selection.selected ? 'border-accent/60 bg-accent/[0.06]' : 'hover:border-border-strong',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2">{iconFor(file.mime)}</div>
          <div className="absolute -left-1 -top-1">
            <SelectCheckbox selected={selection.selected} show={selection.selectionActive} onToggle={selection.onToggleSelect} />
          </div>
        </div>
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
        <span className="col-span-2 truncate" title={pathLabel}>
          {pathLabel ?? `${projectName(file.projectId)} · ${clientName(file.clientId)}`}
        </span>
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

const FOLDER_COLORS = ['#a3e635', '#38bdf8', '#f472b6', '#fbbf24', '#c084fc', '#34d399', '#f87171', '#94a3b8'];

function EditFolderDialog({
  folder,
  onClose,
  onSave,
}: {
  folder: FolderNode | null;
  onClose: () => void;
  onSave: (patch: { name: string; color: string | null; description: string | null; defaultVisibility: FolderVisibility | null }) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'' | FolderVisibility>('');
  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setColor(folder.color ?? null);
      setDescription(folder.description ?? '');
      setVisibility(folder.defaultVisibility ?? '');
    }
  }, [folder]);

  const submit = () => {
    if (name.trim()) onSave({ name: name.trim(), color, description: description.trim() || null, defaultVisibility: visibility || null });
    onClose();
  };

  return (
    <Modal
      open={!!folder}
      onClose={onClose}
      title="Modifica cartella"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={submit} disabled={!name.trim()}>Salva</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </Field>
        <Field label="Colore">
          <div className="flex flex-wrap gap-2">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Colore ${c}`}
                style={{ backgroundColor: c }}
                className={cn('h-7 w-7 rounded-full border-2 transition-transform', color === c ? 'scale-110 border-fg' : 'border-transparent hover:scale-105')}
              />
            ))}
          </div>
        </Field>
        <Field label="Visibilità predefinita" hint="Ereditata dai file caricati nella cartella.">
          <Select value={visibility} onChange={(e) => setVisibility(e.target.value as '' | FolderVisibility)}>
            <option value="">Interno (predefinito)</option>
            <option value="internal">Interno</option>
            <option value="client">Cliente</option>
          </Select>
        </Field>
        <Field label="Descrizione" hint="Opzionale">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
      </div>
    </Modal>
  );
}

function PromptDialog({
  open,
  title,
  label,
  initial,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  label: string;
  initial: string;
  onClose: () => void;
  onConfirm: (value: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);

  const submit = async () => {
    await onConfirm(value);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={submit} disabled={!value.trim()}>Conferma</Button>
        </>
      }
    >
      <Field label={label}>
        <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </Field>
    </Modal>
  );
}

function LinkProjectDialog({
  open,
  projects,
  onClose,
  onConfirm,
}: {
  open: boolean;
  projects: Project[];
  onClose: () => void;
  onConfirm: (projectId: string | null) => Promise<void> | void;
}) {
  const [projectId, setProjectId] = useState('');
  useEffect(() => {
    if (open) setProjectId('');
  }, [open]);

  const submit = async () => {
    await onConfirm(projectId || null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Collega a progetto"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={submit}>Collega</Button>
        </>
      }
    >
      <Field label="Progetto" hint="Il cliente verrà ereditato dal progetto.">
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Nessun progetto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </Field>
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
