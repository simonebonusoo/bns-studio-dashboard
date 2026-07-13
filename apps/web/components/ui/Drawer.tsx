import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Drawer laterale stile desktop (pannello di dettaglio/edit).
 * Slide-in da destra, backdrop, chiusura con Escape / click esterno.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 animate-overlay-in bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute right-0 top-0 flex h-dvh max-h-dvh w-full animate-slide-in-right flex-col overflow-hidden border-l border-border bg-surface shadow-pop',
          widths[width],
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-sm text-fg-subtle">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="press -mr-1 rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
