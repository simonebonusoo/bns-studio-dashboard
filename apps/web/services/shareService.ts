import { isTauri } from '@/lib/platform';
import { saveBlobFile, saveTextFile } from '@/services/downloadService';
import { toast } from 'sonner';

export interface SharePayload {
  title: string;
  text?: string;
  url?: string;
  filename?: string;
  blob?: Blob;
  mime?: string;
}

async function copyFallback(payload: SharePayload) {
  const value = payload.url ?? payload.text ?? payload.title;
  await navigator.clipboard?.writeText(value);
  toast.success('Copiato negli appunti');
}

export async function shareDocument(payload: SharePayload) {
  try {
    if (!isTauri && typeof navigator !== 'undefined' && 'share' in navigator) {
      if (payload.blob && payload.filename && 'canShare' in navigator) {
        const file = new File([payload.blob], payload.filename, { type: payload.mime ?? payload.blob.type });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: payload.title, text: payload.text, files: [file] });
          return;
        }
      }
      await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
      return;
    }

    if (payload.blob && payload.filename) {
      await saveBlobFile(payload.filename, payload.blob, payload.mime);
      toast.info(isTauri ? 'Share sheet nativa non configurata: file salvato come fallback reale.' : 'File scaricato come fallback di condivisione.');
      return;
    }
    if (payload.filename && payload.text) {
      await saveTextFile(payload.filename, payload.text);
      return;
    }
    await copyFallback(payload);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    console.error('[BnsStudio] Share fallita', error);
    if (payload.blob && payload.filename) {
      await saveBlobFile(payload.filename, payload.blob, payload.mime);
      return;
    }
    await copyFallback(payload);
  }
}
