import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { useList } from '@/hooks/useEntities';
import { memberAvatarProps } from '@/lib/memberAvatar';
import { ROLE_LABELS } from '@/types/enums';
import { MemberDetailDrawer } from './MemberDetailDrawer';
import type { Member, TimeEntry } from '@/types';

export default function TeamPage() {
  const { data: members, isLoading } = useList<Member>('members');
  const { data: entries } = useList<TimeEntry>('timeEntries');
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading) return <LoadingState />;

  const team = (members ?? []).filter((member) => member.role !== 'client');
  const minutesFor = (id: string) =>
    (entries ?? [])
      .filter((entry) => entry.memberId === id && !entry.running)
      .reduce((sum, entry) => sum + entry.durationMinutes, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Membri" description={`${team.length} membri · clicca un membro per gestirlo`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((member) => {
          const minutes = minutesFor(member.id);
          const capacity = member.weeklyHours * 60 * 4;
          const utilization = capacity ? Math.min(100, Math.round((minutes / capacity) * 100)) : 0;
          return (
            <Card
              key={member.id}
              onClick={() => setOpenId(member.id)}
              className="press cursor-pointer p-4 transition-colors hover:border-border-strong"
            >
              <div className="flex items-center gap-3">
                <Avatar {...memberAvatarProps(member)} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{member.firstName} {member.lastName}</p>
                  <p className="truncate text-sm text-fg-subtle">{member.jobTitle}</p>
                </div>
                <Badge tone="accent">{ROLE_LABELS[member.role]}</Badge>
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-fg-subtle">
                  <span>{Math.round(minutes / 60)}h registrate</span>
                  <span>Workload {utilization}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className={`h-full rounded-full ${utilization > 90 ? 'bg-danger' : utilization > 70 ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${utilization}%` }} />
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
