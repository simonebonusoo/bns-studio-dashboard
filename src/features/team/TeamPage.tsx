import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { useList } from '@/hooks/useEntities';
import { ROLE_LABELS } from '@/types/enums';
import { MemberDetailDrawer } from './MemberDetailDrawer';
import type { Member, TimeEntry, Task } from '@/types';

export default function TeamPage() {
  const { data: members, isLoading } = useList<Member>('members');
  const { data: entries } = useList<TimeEntry>('timeEntries');
  const { data: tasks } = useList<Task>('tasks');
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading) return <LoadingState />;
  const team = (members ?? []).filter((m) => m.role !== 'client');

  const minutesFor = (id: string) => (entries ?? []).filter((e) => e.memberId === id && !e.running).reduce((s, e) => s + e.durationMinutes, 0);
  const tasksFor = (id: string) => (tasks ?? []).filter((t) => t.assigneeIds.includes(id) && t.status !== 'completed').length;

  return (
    <div className="space-y-5">
      <PageHeader title="Team" description={`${team.length} membri · clicca un membro per gestirlo`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((m) => {
          const minutes = minutesFor(m.id);
          const capacity = m.weeklyHours * 60 * 4;
          const util = capacity ? Math.min(100, Math.round((minutes / capacity) * 100)) : 0;
          return (
            <Card
              key={m.id}
              onClick={() => setOpenId(m.id)}
              className="press cursor-pointer p-4 transition-colors hover:border-border-strong"
            >
              <div className="flex items-center gap-3">
                <Avatar name={`${m.firstName} ${m.lastName}`} color={m.avatarColor} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.firstName} {m.lastName}</p>
                  <p className="truncate text-sm text-fg-subtle">{m.jobTitle}</p>
                </div>
                <Badge tone="accent">{ROLE_LABELS[m.role]}</Badge>
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-fg-subtle">
                  <span>{tasksFor(m.id)} task attivi</span>
                  <span>Workload {util}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className={`h-full rounded-full ${util > 90 ? 'bg-danger' : util > 70 ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${util}%` }} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <MemberDetailDrawer memberId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
