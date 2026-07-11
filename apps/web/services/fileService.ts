import { IS_DEMO, env } from '@/config/env';
import { getSupabaseClient } from '@/services/supabase';
import { getActiveSession } from '@/services/session';
import { repositories } from '@/services/repository';
import { uid } from '@/lib/id';
import type { FileItem } from '@/types';

/**
 * Servizio file: unico punto che tocca lo storage binario. I componenti React
 * non chiamano MAI direttamente Supabase Storage o Dexie.
 *
 *   • DEMO       → il contenuto è un data-URI salvato nella riga (IndexedDB).
 *   • PRODUCTION → i byte vivono nel bucket Storage; la riga `files` conserva
 *                  solo il `storage_path` (campo dominio `url`). L'accesso in
 *                  lettura passa da URL firmati temporanei (file privati).
 */

export interface FileUploadInput {
  file: File;
  folder?: string;
  projectId?: string | null;
  clientId?: string | null;
  clientVisible?: boolean;
  tags?: string[];
}

/** Estensione/percorso sicuro: niente path traversal, niente caratteri strani. */
function safeName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'file';
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Lettura file non riuscita'));
    reader.readAsDataURL(file);
  });
}

function assertUnderLimit(file: File) {
  const maxBytes = env.maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`"${file.name}" supera il limite di ${env.maxUploadMb}MB.`);
  }
}

export const fileService = {
  /** Carica un file e crea la riga di metadati collegata. */
  async upload(input: FileUploadInput): Promise<FileItem> {
    assertUnderLimit(input.file);
    const { file } = input;
    const mime = file.type || 'application/octet-stream';

    const base = {
      name: file.name,
      mime,
      size: file.size,
      folder: input.folder,
      projectId: input.projectId ?? null,
      clientId: input.clientId ?? null,
      clientVisible: input.clientVisible ?? false,
      uploadedBy: getActiveSession().memberId ?? undefined,
      tags: input.tags ?? [],
    };

    if (IS_DEMO) {
      const url = await readAsDataUrl(file);
      return repositories.files.create({ ...base, url });
    }

    const organizationId = getActiveSession().organizationId;
    if (!organizationId) {
      throw new Error('Nessuna organizzazione attiva: impossibile caricare il file.');
    }

    // Percorso oggetto: <organization_id>/<fileId>/<nome-sicuro>. Il prefisso
    // organization_id è imposto anche dalle policy Storage (isolamento tenant).
    const fileId = uid();
    const path = `${organizationId}/${fileId}/${safeName(file.name)}`;

    const { error: uploadError } = await getSupabaseClient()
      .storage.from(env.storageBucket)
      .upload(path, file, { contentType: mime, upsert: false });
    if (uploadError) throw uploadError;

    try {
      return await repositories.files.create({ ...base, id: fileId, url: path });
    } catch (error) {
      // Rollback dello storage se la scrittura dei metadati fallisce.
      await getSupabaseClient().storage.from(env.storageBucket).remove([path]);
      throw error;
    }
  },

  /**
   * URL utilizzabile per anteprima/download.
   *   • demo → il data-URI già salvato.
   *   • prod → URL firmato temporaneo generato al volo (bucket privato).
   */
  async resolveUrl(file: FileItem, expiresInSeconds = 3600): Promise<string | null> {
    if (!file.url) return null;
    if (IS_DEMO) return file.url;

    const { data, error } = await getSupabaseClient()
      .storage.from(env.storageBucket)
      .createSignedUrl(file.url, expiresInSeconds);
    if (error) throw error;
    return data?.signedUrl ?? null;
  },

  /** Elimina l'oggetto Storage (in prod) e soft-delete della riga metadati. */
  async remove(file: FileItem): Promise<void> {
    if (!IS_DEMO && file.url) {
      const { error } = await getSupabaseClient()
        .storage.from(env.storageBucket)
        .remove([file.url]);
      if (error) throw error;
    }
    await repositories.files.remove(file.id);
  },
};
