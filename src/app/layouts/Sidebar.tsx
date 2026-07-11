import { useCallback, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV } from '@/app/navigation';
import { brandConfig } from '@/config/brandConfig';
import { useUI, SIDEBAR_MIN, SIDEBAR_MAX } from '@/stores/ui';
import { useAuth } from '@/stores/auth';
import { cn } from '@/lib/cn';
import { PanelLeftClose, PanelLeft } from 'lucide-react';

/** Contenuto navigazione condiviso tra sidebar desktop e drawer mobile. */
export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const can = useAuth((s) => s.can);

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
      {NAV.map((group, gi) => {
        const items = group.items.filter((it) => !it.permission || can(it.permission));
        if (items.length === 0) return null;
        return (
          <div key={gi}>
            {group.label && !collapsed && (
              <p className="px-2.5 pb-1 text-2xs font-semibold uppercase tracking-[0.08em] text-fg-faint">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    end={it.to === '/'}
                    title={collapsed ? it.label : undefined}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-sm font-medium transition-colors',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-surface-2 text-fg'
                          : 'text-fg-subtle hover:bg-surface-2/70 hover:text-fg',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && !collapsed && (
                          <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
                        )}
                        <it.icon
                          className={cn(
                            'h-[18px] w-[18px] shrink-0 transition-colors',
                            isActive ? 'text-fg' : 'text-fg-faint group-hover:text-fg-subtle',
                          )}
                        />
                        {!collapsed && <span className="truncate">{it.label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function BrandHeader({ collapsed }: { collapsed: boolean }) {
  return (
    <>
      <img
        src={collapsed ? brandConfig.logos.compact : brandConfig.logos.light}
        alt={brandConfig.name}
        className={cn('dark:hidden', collapsed ? 'h-7 w-7' : 'h-[22px]')}
      />
      <img
        src={collapsed ? brandConfig.logos.compact : brandConfig.logos.dark}
        alt={brandConfig.name}
        className={cn('hidden dark:block', collapsed ? 'h-7 w-7' : 'h-[22px]')}
      />
    </>
  );
}

/** Sidebar desktop: larghezza persistente e ridimensionabile con maniglia. */
export function Sidebar() {
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const toggle = useUI((s) => s.toggleSidebar);
  const width = useUI((s) => s.sidebarWidth);
  const setWidth = useUI((s) => s.setSidebarWidth);
  const dragging = useRef(false);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (dragging.current) setWidth(e.clientX);
    },
    [setWidth],
  );

  const stop = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stop);
  }, [onPointerMove]);

  useEffect(() => stop, [stop]);

  const startDrag = () => {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stop);
  };

  return (
    <aside
      style={{ width: collapsed ? 64 : width }}
      className="relative sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-smooth md:flex"
    >
      <div className="flex h-14 items-center justify-between px-3">
        <BrandHeader collapsed={collapsed} />
        <button
          onClick={toggle}
          className="press rounded-md p-1.5 text-fg-faint hover:bg-surface-2 hover:text-fg-subtle"
          aria-label={collapsed ? 'Espandi sidebar' : 'Comprimi sidebar'}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <SidebarNav collapsed={collapsed} />

      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <p className="text-2xs leading-tight text-fg-subtle">
              Demo locale · dati nel browser
            </p>
          </div>
        </div>
      )}

      {/* Maniglia di ridimensionamento */}
      {!collapsed && (
        <div
          onPointerDown={startDrag}
          onDoubleClick={() => setWidth((SIDEBAR_MIN + SIDEBAR_MAX) / 2)}
          className="group absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Ridimensiona sidebar"
        >
          <span className="absolute right-1 top-0 h-full w-px bg-transparent transition-colors group-hover:bg-accent/60" />
        </div>
      )}
    </aside>
  );
}
