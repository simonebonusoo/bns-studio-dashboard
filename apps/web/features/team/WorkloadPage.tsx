import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/States';
import { Avatar } from '@/components/ui/Avatar';
import { useList } from '@/hooks/useEntities';
import { formatHours } from '@/lib/format';
import type { Member, TimeEntry } from '@/types';

function workloadFor(member: Member, entries: TimeEntry[]) {
  const loggedMinutes = entries
    .filter((entry) => entry.memberId === member.id && !entry.running)
    .reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const monthlyCapacityHours = member.weeklyHours * 4;
  const loggedHours = loggedMinutes / 60;
  const utilization = monthlyCapacityHours
    ? Math.min(100, Math.round((loggedHours / monthlyCapacityHours) * 100))
    : 0;

  return {
    loggedHours,
    monthlyCapacityHours,
    utilization,
    remainingHours: Math.max(0, monthlyCapacityHours - loggedHours),
  };
}

export default function WorkloadPage() {
  const { data: members, isLoading } = useList<Member>('members');
  const { data: entries } = useList<TimeEntry>('timeEntries');

  if (isLoading) return <LoadingState />;

  const team = (members ?? []).filter((member) => member.role !== 'client');
  const rows = team
    .map((member) => ({
      member,
      metrics: workloadFor(member, entries ?? []),
    }))
    .sort((left, right) => right.metrics.utilization - left.metrics.utilization);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workload"
        description="Capacita mensile, ore registrate e saturazione del team."
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-surface-2/70 text-left text-xs uppercase tracking-wide text-fg-faint">
              <tr>
                <th className="px-4 py-3">Membro</th>
                <th className="px-4 py-3">Ruolo</th>
                <th className="px-4 py-3">Capacita</th>
                <th className="px-4 py-3">Ore registrate</th>
                <th className="px-4 py-3">Disponibilita residua</th>
                <th className="px-4 py-3">Workload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ member, metrics }) => (
                <tr key={member.id} className="align-middle">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={`${member.firstName} ${member.lastName}`}
                        color={member.avatarColor}
                        size="sm"
                      />
                      <div>
                        <p className="font-medium">{member.firstName} {member.lastName}</p>
                        <p className="text-xs text-fg-subtle">{member.jobTitle}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-fg-subtle">{member.role}</td>
                  <td className="px-4 py-3">{formatHours(metrics.monthlyCapacityHours * 60)}</td>
                  <td className="px-4 py-3">{formatHours(metrics.loggedHours * 60)}</td>
                  <td className="px-4 py-3">{formatHours(metrics.remainingHours * 60)}</td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-32 items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={
                            metrics.utilization > 90
                              ? 'h-full rounded-full bg-danger'
                              : metrics.utilization > 70
                                ? 'h-full rounded-full bg-warning'
                                : 'h-full rounded-full bg-accent'
                          }
                          style={{ width: `${metrics.utilization}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs font-medium">{metrics.utilization}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
