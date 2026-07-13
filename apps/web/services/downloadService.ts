import { isTauri } from '@/lib/platform';
import { toast } from 'sonner';

export interface DownloadResult {
  path?: string;
  url?: string;
  filename: string;
}

const MIME_FILTERS: Record<string, { name: string; extensions: string[] }> = {
  'application/pdf': { name: 'PDF', extensions: ['pdf'] },
  'text/csv': { name: 'CSV', extensions: ['csv'] },
  'text/markdown': { name: 'Markdown', extensions: ['md', 'markdown'] },
  'text/plain': { name: 'Testo', extensions: ['txt'] },
};

export function sanitizeDownloadFilename(filename: string) {
  const normalized = filename
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split('')
    .filter((char) => char.charCodeAt(0) >= 32)
    .join('')
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\-\s]+/, '')
    .replace(/[. ]+$/, '');

  return normalized || 'download';
}

export async function toUint8Array(input: Blob | string | ArrayBuffer | Uint8Array) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof input === 'string') return new TextEncoder().encode(input);
  return new Uint8Array(await input.arrayBuffer());
}

function filterFor(filename: string, mime?: string) {
  const extension = filename.split('.').pop()?.toLowerCase();
  const normalizedMime = mime?.split(';')[0]?.toLowerCase();
  const byMime = normalizedMime ? MIME_FILTERS[normalizedMime] : undefined;
  if (byMime) return [byMime];
  if (extension) return [{ name: extension.toUpperCase(), extensions: [extension] }];
  return undefined;
}

function logDownloadError(message: string, error: unknown, context: Record<string, unknown>) {
  console.error(`[BnsStudio] ${message}`, { ...context, error });
}

export async function openDownloaded(result: DownloadResult) {
  try {
    if (result.path && isTauri) {
      const { openPath } = await import('@tauri-apps/plugin-opener');
      await openPath(result.path);
      return;
    }
    if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    logDownloadError('Apertura download fallita', error, { filename: result.filename, path: result.path });
    toast.error('Apertura non riuscita', { description: result.filename });
  }
}

function notifyDownloaded(result: DownloadResult) {
  toast.success('Scaricato', {
    description: result.filename,
    action: {
      label: 'Apri',
      onClick: () => void openDownloaded(result),
    },
  });
}

function webDownload(blob: Blob, filename: string): DownloadResult {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { filename, url };
}

export async function saveBlobFile(filename: string, blob: Blob, mime?: string): Promise<DownloadResult | null> {
  const safe = sanitizeDownloadFilename(filename);
  const loading = toast.loading('Preparazione download...');
  try {
    if (isTauri) {
      const [{ save }, { writeFile }] = await Promise.all([
        import('@tauri-apps/plugin-dialog'),
        import('@tauri-apps/plugin-fs'),
      ]);
      const path = await save({
        defaultPath: safe,
        filters: filterFor(safe, mime ?? blob.type),
      });
      if (!path) {
        toast.dismiss(loading);
        return null;
      }
      await writeFile(path, await toUint8Array(blob));
      const result = { filename: safe, path };
      toast.dismiss(loading);
      notifyDownloaded(result);
      return result;
    }

    const result = webDownload(blob, safe);
    toast.dismiss(loading);
    notifyDownloaded(result);
    return result;
  } catch (error) {
    toast.dismiss(loading);
    logDownloadError('Download fallito', error, { filename: safe, mime: mime ?? blob.type, isTauri });
    toast.error('Download non riuscito', { description: safe });
    return null;
  }
}

export async function saveTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  return saveBlobFile(filename, new Blob([content], { type: mime }), mime);
}

export async function saveUrlFile(filename: string, url: string, mime?: string): Promise<DownloadResult | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Impossibile scaricare il file (${response.status})`);
    const blob = await response.blob();
    return saveBlobFile(filename, blob, mime ?? blob.type);
  } catch (error) {
    const safe = sanitizeDownloadFilename(filename);
    logDownloadError('Download URL fallito', error, { filename: safe, url, mime });
    toast.error('Download non riuscito', { description: safe });
    return null;
  }
}
