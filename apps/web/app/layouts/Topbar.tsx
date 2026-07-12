import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Sun, Moon, Monitor, Menu } from 'lucide-react';
import { useUI } from '@/stores/ui';
import { useList, useUpdate } from '@/hooks/useEntities';
import type { Notification } from '@/types';
import { TimerWidget } from '@/features/time-tracking/TimerWidget';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { isMac } from '@/lib/platform';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

export function Topbar() {
  const navigate = useNavigate();
  const setCommandOpen = useUI((s) => s.setCommandOpen);
  const setMobileNavOpen = useUI((s) => s.setMobileNavOpen);
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const { data: notifications } = useList<Notification>('notifications');
  const updateNotification = useUpdate<Notification>('notifications');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  const cycleTheme = () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const recentNotifications = (notifications ?? [])
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 8);

  useEffect(() => {
    if (!notificationsOpen) return;
    const close = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) setNotificationsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setNotificationsOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [notificationsOpen]);

  const notificationTarget = (notification: Notification) => {
    switch (notification.entityType) {
      case 'project':
        return notification.entityId ? `/projects/${notification.entityId}` : '/projects';
      case 'estimate':
        return notification.entityId ? `/estimates/${notification.entityId}` : '/estimates';
      case 'invoice':
        return notification.entityId ? `/invoices/${notification.entityId}` : '/invoices';
      case 'payment':
      case 'payment_installment':
        return '/payments';
      case 'contract':
        return '/contracts';
      case 'file':
        return '/files';
      case 'comment':
        return '/hub';
      default:
        return null;
    }
  };

  const openNotification = async (notification: Notification) => {
    if (!notification.read) {
      await updateNotification.mutateAsync({ id: notification.id, patch: { read: true } });
    }
    setNotificationsOpen(false);
    const target = notificationTarget(notification);
    if (target) navigate(target);
  };

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-surface px-3 sm:px-4">
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
        className="press flex h-8 w-10 items-center justify-center gap-2 rounded-md border border-border bg-bg/60 px-2.5 text-sm text-fg-subtle transition-colors hover:border-border-strong hover:text-fg sm:w-56 sm:justify-start md:w-72 lg:w-80"
        aria-label="Cerca (comando K)"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden truncate sm:inline">Cerca o vai a…</span>
        <kbd className="ml-auto hidden items-center gap-0.5 rounded border border-border bg-surface-2 px-1.5 font-mono text-2xs text-fg-faint md:inline-flex">
          {isMac ? '⌘' : 'Ctrl'} K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <TimerWidget />

        <button
          onClick={cycleTheme}
          className="press flex h-8 w-8 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label="Cambia tema"
          title={`Tema: ${theme}`}
        >
          <ThemeIcon className="h-4 w-4" />
        </button>

        <div ref={notificationsRef} className="relative">
          <button
            onClick={() => setNotificationsOpen((value) => !value)}
            className="press relative flex h-8 w-8 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label="Notifiche"
            aria-expanded={notificationsOpen}
            title="Notifiche"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
            )}
          </button>
          {notificationsOpen && (
            <div
              role="dialog"
              aria-label="Notifiche"
              className="absolute right-0 top-full z-50 mt-2 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-base font-semibold tracking-[-0.02em] text-fg">Notifiche</p>
                <button
                  className="text-sm font-medium text-info hover:underline"
                  onClick={() => {
                    setNotificationsOpen(false);
                    navigate('/notifications');
                  }}
                >
                  Vedi tutte
                </button>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                {recentNotifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-fg-subtle">Nessuna notifica</div>
                ) : (
                  recentNotifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => void openNotification(notification)}
                      className={cn(
                        'flex w-full items-start gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-2/70',
                        !notification.read && 'bg-accent/5',
                      )}
                    >
                      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', notification.read ? 'bg-border' : 'bg-accent')} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-fg">{notification.title}</span>
                        {notification.body && <span className="mt-0.5 block text-sm text-fg-subtle">{notification.body}</span>}
                        <span className="mt-1 block text-xs text-fg-faint">{formatRelative(notification.createdAt)}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
