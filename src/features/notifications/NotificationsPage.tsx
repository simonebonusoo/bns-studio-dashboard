import { Bell, Check } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useList, useUpdate } from '@/hooks/useEntities';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Notification } from '@/types';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useList<Notification>('notifications');
  const update = useUpdate<Notification>('notifications');
  const list = (notifications ?? []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const unread = list.filter((n) => !n.read);

  const markAll = async () => {
    await Promise.all(unread.map((n) => update.mutateAsync({ id: n.id, patch: { read: true } })));
    toast.success('Tutte segnate come lette');
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifiche"
        description={`${unread.length} non lette`}
        actions={unread.length > 0 && <Button variant="secondary" onClick={markAll}><Check className="h-4 w-4" /> Segna tutte lette</Button>}
      />
      {list.length === 0 ? (
        <EmptyState icon={<Bell className="h-8 w-8" />} title="Nessuna notifica" />
      ) : (
        <Card className="divide-y divide-border">
          {list.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.read && update.mutate({ id: n.id, patch: { read: true } })}
              className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2', !n.read && 'bg-accent/5')}
            >
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-border' : 'bg-accent')} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-sm text-fg-subtle">{n.body}</p>}
                <p className="mt-0.5 text-xs text-fg-subtle">{formatRelative(n.createdAt)}</p>
              </div>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
