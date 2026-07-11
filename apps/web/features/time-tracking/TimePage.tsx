import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Download } from 'lucide-react';
import { LoadingState } from '@/components/ui/States';
import { useList } from '@/hooks/useEntities';
import { formatHours, formatDate } from '@/lib/format';
import { exportToCSV } from '@/utils/csv';
import type { TimeEntry, Project, Member } from '@/types';

export default function TimePage() {
  const { data: entries, isLoading } = useList<TimeEntry>('timeEntries');
  const { data: projects } = useList<Project>('projects');
  const { data: members } = useList<Member>('members');
  const list = (entries ?? []).filter((e) => !e.running).sort((a, b) => (a.date < b.date ? 1 : -1));

  const projectName = (id?: string | null) => (projects ?? []).find((p) => p.id === id)?.name ?? '—';
  const memberName = (id: string) => { const m = (members ?? []).find((x) => x.id === id); return m ? `${m.firstName} ${m.lastName}` : '—'; };

  const totalMin = list.reduce((s, e) => s + e.durationMinutes, 0);
  const billableMin = list.filter((e) => e.billable).reduce((s, e) => s + e.durationMinutes, 0);

  const columns: Column<TimeEntry>[] = [
    { key: 'date', header: 'Data', sortValue: (e) => e.date, render: (e) => formatDate(e.date) },
    { key: 'member', header: 'Membro', render: (e) => memberName(e.memberId) },
    { key: 'project', header: 'Progetto', render: (e) => <span className="text-fg-subtle">{projectName(e.projectId)}</span> },
    { key: 'desc', header: 'Attività', render: (e) => e.description },
    { key: 'dur', header: 'Durata', sortValue: (e) => e.durationMinutes, render: (e) => <span className="font-medium">{formatHours(e.durationMinutes)}</span> },
    { key: 'billable', header: 'Fatturabile', render: (e) => <Badge tone={e.billable ? 'success' : 'neutral'}>{e.billable ? 'Sì' : 'No'}</Badge> },
  ];

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Time Tracking"
        description="Usa il timer nella barra in alto per registrare le ore"
        actions={<Button variant="secondary" onClick={() => exportToCSV('timesheet', list.map((e) => ({ data: e.date, membro: memberName(e.memberId), progetto: projectName(e.projectId), attivita: e.description, minuti: e.durationMinutes, fatturabile: e.billable })))}><Download className="h-4 w-4" /> Esporta timesheet</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Ore totali" value={formatHours(totalMin)} />
        <MetricCard label="Fatturabili" value={formatHours(billableMin)} hint={`${totalMin ? Math.round((billableMin / totalMin) * 100) : 0}% del totale`} />
        <MetricCard label="Non fatturabili" value={formatHours(totalMin - billableMin)} />
        <MetricCard label="Registrazioni" value={list.length} />
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Timesheet</h2>
        <DataTable data={list} columns={columns} />
      </div>
    </div>
  );
}
