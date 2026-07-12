import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { CommandPalette } from '@/components/navigation/CommandPalette';
import { LoadingState } from '@/components/ui/States';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { isMac, isTauri } from '@/lib/platform';

export function AppLayout() {
  const { pathname } = useLocation();
  useKeyboardShortcuts();

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <a href="#main" className="skip-link">
        Vai al contenuto
      </a>
      {isTauri && isMac && (
        <div
          data-tauri-drag-region
          className="hidden h-9 shrink-0 select-none items-center justify-center border-b border-border bg-surface text-xs font-semibold text-fg-faint md:flex"
        >
          BnsStudio
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <MobileNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="main" className="flex-1">
            <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<LoadingState />}>
                {/* key sul path per una transizione d'ingresso coerente tra pagine */}
                <div key={pathname} className="page-enter">
                  <Outlet />
                </div>
              </Suspense>
            </div>
          </main>
        </div>
      </div>
      <CommandPalette />
    </div>
  );
}
