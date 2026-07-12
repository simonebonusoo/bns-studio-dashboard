import { useCallback, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { NAV } from '@/app/navigation';
import { brandConfig } from '@/config/brandConfig';
import { BrandIcon } from '@/components/branding/BrandIcon';
import { useUI, SIDEBAR_MIN, SIDEBAR_MAX } from '@/stores/ui';
import { useAuth } from '@/stores/auth';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { ROLE_LABELS } from '@/types/enums';
import { LogOut, PanelLeft, PanelLeftClose, Settings } from 'lucide-react';

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
    <nav className="flex-1 overflow-y-auto px-2 py-1">
      {NAV.map((group, gi) => {
        const items = group.items.filter((it) => !it.permission || can(it.permission));
        if (items.length === 0) return null;
        return (
          <div key={gi} className={cn(gi > 0 && 'mt-2.5')}>
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
                        'group relative flex h-8 items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-accent/10 text-fg'
                          : 'text-fg-subtle hover:bg-surface-2/65 hover:text-fg',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && !collapsed && (
                          <span className="absolute left-0 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
                        )}
                        {isActive && collapsed && (
                          <span className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent" />
                        )}
                        <it.icon
                          className={cn(
                            'h-4 w-4 shrink-0 transition-colors',
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

function BrandHeader({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div className={cn('flex h-14 items-center px-3', collapsed ? 'justify-center' : 'justify-between gap-2')}>
      <div className={cn('flex min-w-0 items-center', collapsed ? 'justify-center' : 'gap-2.5')}>
        <BrandIcon className={cn('shrink-0', collapsed ? 'h-8 w-8' : 'h-8 w-8')} />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-[-0.03em] text-fg">{brandConfig.productName}</p>
            <p className="mt-0.5 text-[11px] font-medium leading-none text-fg-faint">{brandConfig.version}</p>
          </div>
        )}
      </div>
      {!collapsed && (
        <button
          onClick={onToggle}
          className="press rounded-md p-1.5 text-fg-faint hover:bg-surface-2 hover:text-fg-subtle"
          aria-label="Comprimi sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function SidebarUtilityRow({
  icon: Icon,
  label,
  collapsed,
  onClick,
  to,
}: {
  icon: typeof Settings;
  label: string;
  collapsed: boolean;
  onClick?: () => void;
  to?: string;
}) {
  const className = cn(
    'group flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium text-fg-subtle transition-colors hover:bg-surface-2/65 hover:text-fg',
    collapsed && 'justify-center px-0',
  );

  if (to) {
    return (
      <NavLink to={to} title={collapsed ? label : undefined} className={({ isActive }) => cn(className, isActive && 'bg-accent/10 text-fg')}>
        <Icon className="h-4 w-4 shrink-0 text-fg-faint transition-colors group-hover:text-fg-subtle" />
        {!collapsed && <span className="truncate">{label}</span>}
      </NavLink>
    );
  }

  return (
    <button onClick={onClick} title={collapsed ? label : undefined} className={className}>
      <Icon className="h-4 w-4 shrink-0 text-fg-faint transition-colors group-hover:text-fg-subtle" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function ProfileRow({ collapsed }: { collapsed: boolean }) {
  const member = useAuth((s) => s.member);
  const navigate = useNavigate();

  if (!member) return null;

  const name = member.displayName || `${member.firstName} ${member.lastName}`;
  const secondary = member.jobTitle || ROLE_LABELS[member.role] || member.email;

  if (collapsed) {
    return (
      <button
        onClick={() => navigate('/profile')}
        className="press flex h-9 w-full items-center justify-center rounded-md hover:bg-surface-2/65"
        title={name}
      >
        <Avatar name={name} color={member.avatarColor} src={member.avatarUrl} size="xs" />
      </button>
    );
  }

  return (
    <button
      onClick={() => navigate('/profile')}
      className="press flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-2/65"
    >
      <Avatar name={name} color={member.avatarColor} src={member.avatarUrl} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-fg">{name}</span>
        <span className="block truncate text-[11px] text-fg-faint">{secondary}</span>
      </span>
    </button>
  );
}

/** Sidebar desktop: larghezza persistente e ridimensionabile con maniglia. */
export function Sidebar() {
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const toggle = useUI((s) => s.toggleSidebar);
  const width = useUI((s) => s.sidebarWidth);
  const setWidth = useUI((s) => s.setSidebarWidth);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
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
      className="relative hidden min-h-0 shrink-0 flex-col self-stretch border-r border-border bg-surface transition-[width] duration-200 ease-smooth md:flex"
    >
      <BrandHeader collapsed={collapsed} onToggle={toggle} />

      <SidebarNav collapsed={collapsed} />

      <div className="mt-auto space-y-1 px-2 pb-2">
        {collapsed && (
          <button
            onClick={toggle}
            className="press flex h-8 w-full items-center justify-center rounded-md text-fg-faint hover:bg-surface-2 hover:text-fg-subtle"
            aria-label="Espandi sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}
        <SidebarUtilityRow icon={Settings} label="Impostazioni" to="/settings" collapsed={collapsed} />
        <SidebarUtilityRow
          icon={LogOut}
          label="Logout"
          collapsed={collapsed}
          onClick={() => {
            logout();
            navigate('/login');
          }}
        />
        <div className="pt-1">
          <ProfileRow collapsed={collapsed} />
        </div>
      </div>

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
