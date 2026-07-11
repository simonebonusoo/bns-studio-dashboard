import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { CommandPalette } from '@/components/navigation/CommandPalette';
import { LoadingState } from '@/components/ui/States';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export function AppLayout() {
  const { pathname } = useLocation();
  useKeyboardShortcuts();

  return (
    <div className="flex min-h-screen bg-bg">
      <a href="#main" className="skip-link">
        Vai al contenuto
      </a>
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
      <CommandPalette />
    </div>
  );
}
