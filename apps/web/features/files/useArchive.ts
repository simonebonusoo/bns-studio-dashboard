import { useMemo } from 'react';
import { useList, useCreate, useUpdate, useRemove } from '@/hooks/useEntities';
import { getActiveSession } from '@/services/session';
import type { ArchiveFolder, Client, FileItem, FolderType, FolderVisibility, Project } from '@/types';
import {
  type ArchiveData,
  ROOT_ID,
  isProjectFolderId,
  projectIdFromFolderId,
} from './archiveModel';

/**
 * Sorgente dati unica dell'Archivio. In questa fase carichiamo l'elenco completo
 * (come faceva la pagina originale) e deriviamo le viste per-cartella lato client:
 * il volume è ridotto e ogni mutazione invalida solo le query coinvolte. Il
 * passaggio a query per-cartella lato server è un'ottimizzazione successiva e
 * resta localizzata a questo hook.
 */
export function useArchiveData() {
  const files = useList<FileItem>('files');
  const folders = useList<ArchiveFolder>('archiveFolders');
  const projects = useList<Project>('projects');
  const clients = useList<Client>('clients');

  const data: ArchiveData = useMemo(
    () => ({
      files: files.data ?? [],
      folders: folders.data ?? [],
      projects: projects.data ?? [],
      clients: clients.data ?? [],
    }),
    [files.data, folders.data, projects.data, clients.data],
  );

  return {
    data,
    isLoading: files.isLoading || folders.isLoading || projects.isLoading || clients.isLoading,
  };
}

export interface NewFolderInput {
  name: string;
  parentLocationId: string; // ROOT_ID | project:<pid> | <folderId>
  description?: string;
  color?: string;
  icon?: string;
  folderType?: FolderType;
  defaultVisibility?: FolderVisibility;
}

/**
 * Deriva parentFolderId/projectId per una nuova cartella (o per uno spostamento)
 * a partire dalla posizione di navigazione di destinazione. Le cartelle progetto
 * sono virtuali: creare "dentro" un progetto significa projectId=pid, parent=null.
 */
export function resolveParentContext(
  parentLocationId: string,
  data: ArchiveData,
): { parentFolderId: string | null; projectId: string | null; clientId: string | null } {
  if (!parentLocationId || parentLocationId === ROOT_ID || parentLocationId === 'unassigned') {
    return { parentFolderId: null, projectId: null, clientId: null };
  }
  if (isProjectFolderId(parentLocationId)) {
    const projectId = projectIdFromFolderId(parentLocationId);
    const project = data.projects.find((p) => p.id === projectId);
    return { parentFolderId: null, projectId, clientId: project?.clientId ?? null };
  }
  const parent = data.folders.find((f) => f.id === parentLocationId);
  return {
    parentFolderId: parentLocationId,
    projectId: parent?.projectId ?? null,
    clientId: parent?.clientId ?? null,
  };
}

/**
 * Contesto di upload: dove finiscono i file caricati nella posizione corrente.
 * Dentro una cartella progetto ereditano project_id (e client_id); dentro una
 * cartella custom ereditano folder_id (+ eventuale progetto/cliente della cartella).
 */
export function resolveUploadContext(
  locationId: string,
  data: ArchiveData,
): { folderId: string | null; projectId: string | null; clientId: string | null } {
  if (!locationId || locationId === ROOT_ID || locationId === 'unassigned') {
    return { folderId: null, projectId: null, clientId: null };
  }
  if (isProjectFolderId(locationId)) {
    const projectId = projectIdFromFolderId(locationId);
    const project = data.projects.find((p) => p.id === projectId);
    return { folderId: null, projectId, clientId: project?.clientId ?? null };
  }
  const folder = data.folders.find((f) => f.id === locationId);
  return {
    folderId: locationId,
    projectId: folder?.projectId ?? null,
    clientId: folder?.clientId ?? null,
  };
}

/** Mutazioni sulle cartelle e sui collegamenti file→cartella. */
export function useArchiveMutations() {
  const createFolder = useCreate<ArchiveFolder>('archiveFolders');
  const updateFolder = useUpdate<ArchiveFolder>('archiveFolders');
  const removeFolder = useRemove('archiveFolders');
  const updateFile = useUpdate<FileItem>('files');

  return {
    createFolder,
    updateFolder,
    removeFolder,
    updateFile,
    /** Costruisce il payload di una nuova cartella dalla posizione corrente. */
    buildFolderPayload(input: NewFolderInput, data: ArchiveData): Partial<ArchiveFolder> {
      const ctx = resolveParentContext(input.parentLocationId, data);
      return {
        name: input.name.trim(),
        parentFolderId: ctx.parentFolderId,
        projectId: ctx.projectId,
        clientId: ctx.clientId,
        folderType: input.folderType ?? 'custom',
        description: input.description?.trim() || null,
        color: input.color || null,
        icon: input.icon || null,
        defaultVisibility: input.defaultVisibility ?? null,
        createdBy: getActiveSession().memberId ?? undefined,
      };
    },
  };
}
