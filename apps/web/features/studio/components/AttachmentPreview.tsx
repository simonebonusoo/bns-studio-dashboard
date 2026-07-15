import { useEffect, useState } from 'react';
import { Download, File } from 'lucide-react';
import { fileService } from '@/services/fileService';
import type { FileItem, StudioMessageAttachment } from '@/types';

/** Icona coerente col tipo di file. Estratto da StudioPage nella Fase 0. */
function fileIcon(file?: FileItem) {
  if (!file) return <File className="h-4 w-4" />;
  if (file.mime.startsWith('image/')) return <File className="h-4 w-4 text-info" />;
  if (file.mime === 'application/pdf') return <File className="h-4 w-4 text-danger" />;
  return <File className="h-4 w-4" />;
}

/** Anteprima di un allegato (immagine inline / riga file con download firmato). */
export function AttachmentPreview({ attachment, files }: { attachment: StudioMessageAttachment; files: FileItem[] }) {
  const file = files.find((item) => item.id === attachment.fileId);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!file) return;
    fileService.resolveUrl(file).then((resolved) => alive && setUrl(resolved)).catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [file]);

  if (!file) return null;
  const isImage = file.mime.startsWith('image/');
  const isPdf = file.mime === 'application/pdf';
  return (
    <div className="mt-2 max-w-md overflow-hidden rounded-lg border border-border bg-surface">
      {isImage && url && (
        <img src={url} alt={file.name} className="max-h-64 w-full object-cover" loading="lazy" />
      )}
      <div className="flex items-center gap-2 px-2.5 py-2 text-sm text-fg-subtle">
        {fileIcon(file)}
        <div className="min-w-0 flex-1">
          <p className="truncate text-fg">{file.name}</p>
          <p className="text-xs text-fg-faint">{isPdf ? 'PDF' : file.mime || 'File'} · {Math.ceil(file.size / 1024)} KB</p>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" download className="rounded-md p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg" title="Apri o scarica">
            <Download className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}
