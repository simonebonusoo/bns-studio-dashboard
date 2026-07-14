import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ExternalLink, FileText, FileCode, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { PreviewContext, type PreviewItem, type PreviewKind } from './previewContext';

function detectKind(item: PreviewItem): PreviewKind {
  if (item.kind) return item.kind;
  if (item.markdown != null) return 'markdown';
  if (item.text != null) return 'text';
  const hay = `${item.mime ?? ''} ${item.name ?? ''}`.toLowerCase();
  if (hay.includes('pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/.test(hay) || hay.includes('image/')) return 'image';
  if (/\.(md|markdown)(\?|$)/.test(hay) || hay.includes('markdown')) return 'markdown';
  if (/\.(txt|csv|json|log)(\?|$)/.test(hay) || hay.includes('text/')) return 'text';
  return 'other';
}

const KIND_ICON: Record<PreviewKind, ReactNode> = {
  pdf: <FileText className="h-4 w-4 text-danger" />,
  markdown: <FileCode className="h-4 w-4 text-info" />,
  image: <ImageIcon className="h-4 w-4 text-accent" />,
  text: <FileText className="h-4 w-4 text-fg-subtle" />,
  other: <FileIcon className="h-4 w-4 text-fg-subtle" />,
};

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<PreviewItem | null>(null);

  const open = useCallback((next: PreviewItem) => setItem(next), []);
  const close = useCallback(() => setItem(null), []);
  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <PreviewContext.Provider value={value}>
      {children}
      {item && <PreviewOverlay item={item} onClose={close} />}
    </PreviewContext.Provider>
  );
}

function PreviewOverlay({ item, onClose }: { item: PreviewItem; onClose: () => void }) {
  const kind = detectKind(item);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);

  // Object URL derivato dal Blob, revocato alla chiusura per non perdere memoria.
  useEffect(() => {
    if (!item.blob) return;
    const url = URL.createObjectURL(item.blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [item.blob]);

  const resolved: PreviewItem = { ...item, url: item.url ?? blobUrl };

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      window.clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  const download = () => {
    if (item.onDownload) return item.onDownload();
    if (resolved.url) {
      const a = document.createElement('a');
      a.href = resolved.url;
      a.download = item.name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  return createPortal(
    // Backdrop: click esterno chiude (Quick Look). Blur stile macOS.
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-overlay-in sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Anteprima ${item.name}`}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-pop outline-none animate-scale-in"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
          {KIND_ICON[kind]}
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
          {(resolved.url || item.onDownload) && (
            <button onClick={download} aria-label="Scarica" title="Scarica"
              className="press rounded-md p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg">
              <Download className="h-4 w-4" />
            </button>
          )}
          {resolved.url && kind !== 'markdown' && kind !== 'text' && (
            <a href={resolved.url} target="_blank" rel="noopener noreferrer" aria-label="Apri in una nuova scheda" title="Apri"
              className="press rounded-md p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button onClick={onClose} aria-label="Chiudi anteprima"
            className="press rounded-md p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-surface-2/30">
          <PreviewBody item={resolved} kind={kind} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PreviewBody({ item, kind }: { item: PreviewItem; kind: PreviewKind }) {
  if (kind === 'pdf' && item.url) {
    return <iframe src={item.url} title={item.name} className="h-[75vh] w-full border-0 bg-white" />;
  }
  if (kind === 'image' && item.url) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-4">
        <img src={item.url} alt={item.name} className="max-h-[75vh] max-w-full rounded-lg object-contain" />
      </div>
    );
  }
  if (kind === 'markdown' && item.markdown != null) {
    return <MarkdownRenderer source={item.markdown} className="mx-auto max-w-3xl p-6 text-sm text-fg" />;
  }
  if (kind === 'text' && item.text != null) {
    return <pre className="whitespace-pre-wrap p-6 text-sm text-fg">{item.text}</pre>;
  }
  // Fallback: tipo non renderizzabile inline.
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <FileIcon className="h-8 w-8 text-fg-subtle" />
      <p className="text-sm text-fg-subtle">Anteprima non disponibile per questo tipo di file.</p>
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-info underline">
          Apri in una nuova scheda
        </a>
      )}
    </div>
  );
}
