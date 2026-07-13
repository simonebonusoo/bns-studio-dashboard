import { isTauri } from '@/lib/platform';
import { toast } from 'sonner';

export interface DownloadResult {
  path?: string;
  url?: string;
  filename: string;
}

function safeFilename(filename: string) {
  return filename.replace(/[^\w.-]+/g, '_');
}

async function blobToBytes(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

export async function openDownloaded(result: DownloadResult) {
  if (result.path && isTauri) {
    const { openPath } = await import('@tauri-apps/plugin-opener');
    await openPath(result.path);
    return;
  }
  if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
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
  const safe = safeFilename(filename);
  const loading = toast.loading('Preparazione download...');
  try {
    if (isTauri) {
      const [{ save }, { writeFile }] = await Promise.all([
        import('@tauri-apps/plugin-dialog'),
        import('@tauri-apps/plugin-fs'),
      ]);
      const path = await save({
        defaultPath: safe,
        filters: mime ? [{ name: mime, extensions: [safe.split('.').pop() ?? 'file'] }] : undefined,
      });
      if (!path) {
        toast.dismiss(loading);
        return null;
      }
      await writeFile(path, await blobToBytes(blob));
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
    console.error('[BnsStudio] Download fallito', error);
    toast.error(error instanceof Error ? error.message : 'Download non riuscito');
    return null;
  }
}

export async function saveTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  return saveBlobFile(filename, new Blob([content], { type: mime }), mime);
}
