import type { ArchiveFolder, Client, FileItem, Project } from '@/types';

/**
 * Modello dell'Archivio a cartelle.
 *
 * Le cartelle-progetto sono VIRTUALI: derivate da `projects`, senza record in
 * `archive_folders` (nessuna duplicazione, auto-sync). Le cartelle personalizzate
 * sono record reali. Le funzioni qui sono pure e testabili: la UI e gli hook si
 * limitano a fornire liste già caricate (files, folders, projects, clients).
 */

export const ROOT_ID = 'root';
export const UNASSIGNED_ID = 'unassigned';
export const PROJECT_PREFIX = 'project:';

export type FolderNodeKind = 'project' | 'custom' | 'system' | 'unassigned';

/** Nodo di cartella normalizzato per la UI (sia virtuale sia reale). */
export interface FolderNode {
  /** Id di navigazione: `root` non è un nodo; `project:<pid>`, `unassigned`, o l'uuid della cartella. */
  id: string;
  kind: FolderNodeKind;
  name: string;
  /** Progetto di appartenenza/scopo (per cartelle progetto e custom dentro un progetto). */
  projectId?: string | null;
  clientId?: string | null;
  /** Id di navigazione del genitore (per breadcrumb). */
  parentId: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  fileCount: number;
  folderCount: number;
  updatedAt?: string;
  /** Le cartelle progetto/sistema/non-organizzati non sono eliminabili. */
  deletable: boolean;
  /** Le cartelle progetto/non-organizzati non sono spostabili né rinominabili. */
  editable: boolean;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export interface ArchiveData {
  files: FileItem[];
  folders: ArchiveFolder[];
  projects: Project[];
  clients: Client[];
}

const activeFolders = (folders: ArchiveFolder[]) => folders.filter((f) => !f.deletedAt);

const projectFolderId = (projectId: string) => `${PROJECT_PREFIX}${projectId}`;
export const isProjectFolderId = (id: string) => id.startsWith(PROJECT_PREFIX);
export const projectIdFromFolderId = (id: string) => (isProjectFolderId(id) ? id.slice(PROJECT_PREFIX.length) : null);

/** File direttamente contenuti in una posizione (senza discendere nelle sottocartelle). */
function directFiles(locationId: string, data: ArchiveData): FileItem[] {
  const files = data.files.filter((f) => !f.deletedAt);
  if (locationId === UNASSIGNED_ID) {
    return files.filter((f) => !f.folderId && !f.projectId);
  }
  if (isProjectFolderId(locationId)) {
    const pid = projectIdFromFolderId(locationId);
    return files.filter((f) => !f.folderId && f.projectId === pid);
  }
  // Cartella custom/sistema (uuid reale).
  return files.filter((f) => f.folderId === locationId);
}

/** Sottocartelle custom dirette di una posizione. */
function directCustomFolders(locationId: string, data: ArchiveData): ArchiveFolder[] {
  const folders = activeFolders(data.folders);
  if (locationId === ROOT_ID) {
    // Cartelle radice: nessun genitore e nessun progetto.
    return folders.filter((f) => !f.parentFolderId && !f.projectId);
  }
  if (locationId === UNASSIGNED_ID) return [];
  if (isProjectFolderId(locationId)) {
    const pid = projectIdFromFolderId(locationId);
    // Cartelle custom radice del progetto (scopo progetto, senza genitore custom).
    return folders.filter((f) => !f.parentFolderId && f.projectId === pid);
  }
  return folders.filter((f) => f.parentFolderId === locationId);
}

function toNode(folder: ArchiveFolder, data: ArchiveData): FolderNode {
  const parentId = folder.parentFolderId
    ? folder.parentFolderId
    : folder.projectId
      ? projectFolderId(folder.projectId)
      : ROOT_ID;
  return {
    id: folder.id,
    kind: folder.folderType === 'system' ? 'system' : 'custom',
    name: folder.name,
    projectId: folder.projectId ?? null,
    clientId: folder.clientId ?? null,
    parentId,
    icon: folder.icon,
    color: folder.color,
    description: folder.description,
    fileCount: directFiles(folder.id, data).length,
    folderCount: directCustomFolders(folder.id, data).length,
    updatedAt: folder.updatedAt,
    deletable: folder.folderType !== 'system',
    editable: folder.folderType !== 'system',
  };
}

function projectNode(project: Project, data: ArchiveData): FolderNode {
  const id = projectFolderId(project.id);
  return {
    id,
    kind: 'project',
    name: project.name,
    projectId: project.id,
    clientId: project.clientId ?? null,
    parentId: ROOT_ID,
    icon: 'folder',
    color: project.color,
    fileCount: directFiles(id, data).length,
    folderCount: directCustomFolders(id, data).length,
    updatedAt: project.updatedAt,
    deletable: false,
    editable: false,
  };
}

function unassignedNode(data: ArchiveData): FolderNode {
  return {
    id: UNASSIGNED_ID,
    kind: 'unassigned',
    name: 'File non organizzati',
    parentId: ROOT_ID,
    fileCount: directFiles(UNASSIGNED_ID, data).length,
    folderCount: 0,
    deletable: false,
    editable: false,
  };
}

/** Trova il nodo cartella corrispondente a un id di navigazione (null = radice). */
export function resolveFolder(locationId: string, data: ArchiveData): FolderNode | null {
  if (!locationId || locationId === ROOT_ID) return null;
  if (locationId === UNASSIGNED_ID) return unassignedNode(data);
  if (isProjectFolderId(locationId)) {
    const pid = projectIdFromFolderId(locationId);
    const project = data.projects.find((p) => p.id === pid && !p.deletedAt);
    return project ? projectNode(project, data) : null;
  }
  const folder = activeFolders(data.folders).find((f) => f.id === locationId);
  return folder ? toNode(folder, data) : null;
}

/** Contenuto di una posizione: sottocartelle (prima) e file. */
export function listChildren(locationId: string, data: ArchiveData): { folders: FolderNode[]; files: FileItem[] } {
  const folderNodes: FolderNode[] = [];

  if (locationId === ROOT_ID) {
    // 1) cartelle progetto virtuali, 2) cartelle custom radice, 3) non organizzati.
    for (const project of data.projects.filter((p) => !p.deletedAt)) {
      folderNodes.push(projectNode(project, data));
    }
    for (const folder of directCustomFolders(ROOT_ID, data)) {
      folderNodes.push(toNode(folder, data));
    }
    const unassigned = unassignedNode(data);
    if (unassigned.fileCount > 0) folderNodes.push(unassigned);
  } else {
    for (const folder of directCustomFolders(locationId, data)) {
      folderNodes.push(toNode(folder, data));
    }
  }

  const sortedFolders = folderNodes.sort((a, b) => {
    // Cartelle progetto prima, poi custom, poi non-organizzati; a parità, per nome.
    const rank = (n: FolderNode) => (n.kind === 'project' ? 0 : n.kind === 'unassigned' ? 2 : 1);
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });

  const files = directFiles(locationId, data).sort((a, b) => a.name.localeCompare(b.name));
  return { folders: sortedFolders, files };
}

/** Percorso a briciole dalla radice alla posizione corrente. */
export function buildBreadcrumb(locationId: string, data: ArchiveData): BreadcrumbItem[] {
  const trail: BreadcrumbItem[] = [{ id: ROOT_ID, name: 'Archivio' }];
  if (!locationId || locationId === ROOT_ID) return trail;

  const chain: BreadcrumbItem[] = [];
  let current: FolderNode | null = resolveFolder(locationId, data);
  const guard = new Set<string>();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    chain.unshift({ id: current.id, name: current.name });
    current = current.parentId === ROOT_ID ? null : resolveFolder(current.parentId, data);
  }
  return [...trail, ...chain];
}

/** Id di navigazione della posizione di un file (cartella custom, radice progetto o non organizzati). */
export function fileLocationId(file: FileItem): string {
  if (file.folderId) return file.folderId;
  if (file.projectId) return `${PROJECT_PREFIX}${file.projectId}`;
  return UNASSIGNED_ID;
}

/** Percorso leggibile della posizione (es. "Archivio / K9 Pro / Branding"). */
export function locationPath(locationId: string, data: ArchiveData): string {
  return buildBreadcrumb(locationId, data)
    .map((c) => c.name)
    .join(' / ');
}

/** Tutte le cartelle (custom+progetto) come nodi, per la ricerca globale. */
export function allFolderNodes(data: ArchiveData): FolderNode[] {
  const nodes: FolderNode[] = [];
  for (const project of data.projects.filter((p) => !p.deletedAt)) {
    const node = resolveFolder(`${PROJECT_PREFIX}${project.id}`, data);
    if (node) nodes.push(node);
  }
  for (const folder of activeFolders(data.folders)) {
    const node = resolveFolder(folder.id, data);
    if (node) nodes.push(node);
  }
  return nodes;
}

/** Filtro di ricerca su un file (nome, descrizione, categoria, tag, progetto, cliente, estensione). */
export function fileMatchesQuery(file: FileItem, query: string, projectName: string, clientName: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    file.name,
    file.documentCategory ?? '',
    file.mime ?? '',
    (file.tags ?? []).join(' '),
    projectName,
    clientName,
    (file.metadata?.description as string) ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

/** Genera un nome non in conflitto: "logo.png" → "logo (1).png". */
export function dedupeName(name: string, taken: Set<string>): string {
  if (!taken.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 1;
  let candidate = `${base} (${i})${ext}`;
  while (taken.has(candidate.toLowerCase())) {
    i += 1;
    candidate = `${base} (${i})${ext}`;
  }
  return candidate;
}

export interface DestinationNode {
  id: string;
  name: string;
  depth: number;
  kind: FolderNodeKind;
}

/**
 * Albero appiattito delle destinazioni valide per uno spostamento (dialog "Sposta").
 * Include la radice, le cartelle progetto e le cartelle custom annidate. Le cartelle
 * in `exclude` (e i loro discendenti) vengono omesse per impedire cicli.
 */
export function buildDestinationTree(data: ArchiveData, exclude: Set<string> = new Set()): DestinationNode[] {
  const acc: DestinationNode[] = [{ id: ROOT_ID, name: 'Archivio', depth: 0, kind: 'system' }];
  const walk = (locationId: string, depth: number) => {
    for (const node of listChildren(locationId, data).folders) {
      if (node.kind === 'unassigned' || exclude.has(node.id)) continue;
      acc.push({ id: node.id, name: node.name, depth, kind: node.kind });
      walk(node.id, depth + 1);
    }
  };
  walk(ROOT_ID, 1);
  return acc;
}

/** Id di tutte le sottocartelle discendenti (incluse indirette) di una cartella. */
export function collectDescendantFolderIds(folderId: string, folders: ArchiveFolder[]): string[] {
  const active = folders.filter((f) => !f.deletedAt);
  const result: string[] = [];
  const walk = (parent: string) => {
    for (const f of active) {
      if (f.parentFolderId === parent) {
        result.push(f.id);
        walk(f.id);
      }
    }
  };
  walk(folderId);
  return result;
}

/** Verifica se spostare `folderId` sotto `targetParentId` creerebbe un ciclo. */
export function wouldCreateCycle(folderId: string, targetParentId: string | null, folders: ArchiveFolder[]): boolean {
  if (!targetParentId || targetParentId === ROOT_ID) return false;
  if (targetParentId === folderId) return true;
  const byId = new Map(folders.map((f) => [f.id, f]));
  let cursor: string | null | undefined = targetParentId;
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    if (cursor === folderId) return true;
    cursor = byId.get(cursor)?.parentFolderId ?? null;
  }
  return false;
}
