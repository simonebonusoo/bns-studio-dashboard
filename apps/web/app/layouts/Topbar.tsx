import { useNavigate } from 'react-router-dom';
import { Search, Bell, Sun, Moon, Monitor, LogOut, Menu } from 'lucide-react';
import { useUI } from '@/stores/ui';
import { useAuth } from '@/stores/auth';
import { Avatar } from '@/components/ui/Avatar';
import { useList } from '@/hooks/useEntities';
import type { Notification } from '@/types';
import { TimerWidget } from '@/features/time-tracking/TimerWidget';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { isMac } from '@/lib/platform';

export function Topbar() {
  const navigate = useNavigate();
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const setMobileNavOpen = useUI((s) => s.setMobileNavOpen);
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const member = useAuth((s) => s.member);
  const logout = useAuth((s) => s.logout);
  const { data: notifications } = useList<Notification>('notifications');
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  const cycleTheme = () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface/82 px-3 shadow-[0_18px_44px_-42px_rgba(15,15,16,0.95)] backdrop-blur-md sm:px-4">
      <button
        onClick={() => setMobileNavOpen(true)}
        className="press rounded-lg p-2 text-fg-subtle hover:bg-surface-2 md:hidden"
        aria-label="Apri menu"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      <div className="hidden min-w-0 flex-1 md:block">
        <Breadcrumbs />
      </div>

      <button
        onClick={() => setCommandOpen(true)}
        className="press flex h-8 w-10 items-center justify-center gap-2 rounded-lg border border-border bg-bg/70 px-2.5 text-sm text-fg-subtle transition-colors hover:border-border-strong hover:text-fg sm:w-56 sm:justify-start md:w-72"
        aria-label="Cerca (comando K)"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden truncate sm:inline">Cerca o vai a…</span>
        <kbd className="ml-auto hidden items-center gap-0.5 rounded border border-border bg-surface-2 px-1.5 font-mono text-2xs text-fg-faint md:inline-flex">
          {isMac ? '⌘' : 'Ctrl'} K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-0.5 md:ml-0">
        <TimerWidget />

        <button
          onClick={cycleTheme}
          className="press rounded-lg p-2 text-fg-subtle hover:bg-surface-2 hover:text-fg"
          aria-label="Cambia tema"
          title={`Tema: ${theme}`}
        >
          <ThemeIcon className="h-[18px] w-[18px]" />
        </button>

        <button
          onClick={() => navigate('/notifications')}
          className="press relative rounded-lg p-2 text-fg-subtle hover:bg-surface-2 hover:text-fg"
          aria-label="Notifiche"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-2xs font-semibold text-accent-fg">
              {unread}
            </span>
          )}
        </button>

        <div className="mx-1 h-5 w-px bg-border" />

        <div className="flex items-center gap-1">
          {member && (
            <div className="hidden items-center gap-2 rounded-lg bg-bg/55 px-1.5 py-1 sm:flex">
              <Avatar name={`${member.firstName} ${member.lastName}`} color={member.avatarColor} size="sm" />
              <span className="max-w-28 truncate pr-1 text-xs font-medium text-fg-subtle">{member.firstName}</span>
            </div>
          )}
          <button
            onClick={logout}
            className="press rounded-lg p-2 text-fg-subtle hover:bg-surface-2 hover:text-fg"
            aria-label="Esci"
            title="Esci"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
