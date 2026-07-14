import { createContext, useContext } from 'react';

export type PreviewKind = 'pdf' | 'markdown' | 'image' | 'text' | 'other';

export interface PreviewItem {
  /** Nome file mostrato in intestazione. */
  name: string;
  /** URL diretto (http/https/data/blob) per pdf/immagini. */
  url?: string;
  /** Blob da cui derivare un object URL temporaneo (revocato alla chiusura). */
  blob?: Blob;
  /** Sorgente Markdown grezzo. */
  markdown?: string;
  /** Testo semplice. */
  text?: string;
  mime?: string;
  /** Forza il tipo; se assente viene dedotto da mime/estensione. */
  kind?: PreviewKind;
  /** Azione di download personalizzata (altrimenti si usa `url`). */
  onDownload?: () => void;
}

export interface PreviewContextValue {
  open: (item: PreviewItem) => void;
  close: () => void;
}

export const PreviewContext = createContext<PreviewContextValue | null>(null);

/** Hook per aprire il Quick Look da qualsiasi sezione. */
export function usePreview(): PreviewContextValue {
  const ctx = useContext(PreviewContext);
  if (!ctx) throw new Error('usePreview deve essere usato dentro <PreviewProvider>');
  return ctx;
}
