import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { brandConfig } from '@/config/brandConfig';
import { useUI } from '@/stores/ui';
import { SidebarNav } from './Sidebar';

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
          <img src={brandConfig.logos.light} alt={brandConfig.name} className="h-[22px] dark:hidden" />
          <img src={brandConfig.logos.dark} alt={brandConfig.name} className="hidden h-[22px] dark:block" />
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
