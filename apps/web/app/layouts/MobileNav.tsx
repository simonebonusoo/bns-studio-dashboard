import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUI } from '@/stores/ui';
import { SidebarNav } from './Sidebar';
import { BrandIcon } from '@/components/branding/BrandIcon';
import { brandConfig } from '@/config/brandConfig';

/** Navigazione mobile: drawer a scomparsa (sostituisce la sidebar sotto md). */
export function MobileNav() {
  const open = useUI((s) => s.mobileNavOpen);
  const setOpen = useUI((s) => s.setMobileNavOpen);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 animate-overlay-in bg-black/40" onClick={() => setOpen(false)} aria-hidden />
      <div className="absolute left-0 top-0 flex h-full w-72 animate-slide-in-right flex-col border-r border-border bg-surface">
        <div className="flex h-14 items-center justify-between px-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandIcon className="h-8 w-8 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-[-0.03em] text-fg">{brandConfig.productName}</p>
              <p className="mt-0.5 text-[11px] font-medium leading-none text-fg-faint">{brandConfig.version}</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-fg-subtle hover:bg-surface-2" aria-label="Chiudi">
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </div>
    </div>,
    document.body,
  );
}
