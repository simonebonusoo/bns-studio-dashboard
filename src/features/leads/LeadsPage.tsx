import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { MetricCard } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { useList } from '@/hooks/useEntities';
import { STAGE_LABELS } from '@/types/enums';
import { formatCurrency, formatDate } from '@/lib/format';
import { OpportunityFormModal } from './OpportunityFormModal';
import type { Opportunity } from '@/types';

export default function LeadsPage() {
  const { data: opps, isLoading } = useList<Opportunity>('opportunities');
  const [open, setOpen] = useState(false);
  const list = opps ?? [];

  const openOpps = list.filter((o) => !['won', 'lost'].includes(o.stage));
  const pipelineValue = openOpps.reduce((s, o) => s + o.value, 0);
  const weighted = openOpps.reduce((s, o) => s + (o.value * o.probability) / 100, 0);
  const won = list.filter((o) => o.stage === 'won').length;
  const closed = list.filter((o) => ['won', 'lost'].includes(o.stage)).length;
  const conversion = closed ? Math.round((won / closed) * 100) : 0;

  const columns: Column<Opportunity>[] = [
    { key: 'title', header: 'Opportunità', sortValue: (o) => o.title, render: (o) => <span className="font-medium">{o.title}</span> },
    { key: 'stage', header: 'Fase', render: (o) => <StatusBadge status={o.stage === 'won' ? 'accepted' : o.stage === 'lost' ? 'rejected' : 'in_progress'} /> },
    { key: 'stageLabel', header: '', render: (o) => <span className="text-xs text-fg-subtle">{STAGE_LABELS[o.stage]}</span> },
    { key: 'value', header: 'Valore', sortValue: (o) => o.value, render: (o) => formatCurrency(o.value) },
    { key: 'prob', header: 'Prob.', sortValue: (o) => o.probability, render: (o) => `${o.probability}%` },
    { key: 'close', header: 'Chiusura prevista', sortValue: (o) => o.expectedCloseDate ?? '', render: (o) => <span className="text-fg-subtle">{formatDate(o.expectedCloseDate)}</span> },
  ];

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Opportunità"
        description={`${list.length} opportunità`}
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuova</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Valore pipeline" value={formatCurrency(pipelineValue)} />
        <MetricCard label="Valore ponderato" value={formatCurrency(weighted)} />
        <MetricCard label="Vinte" value={won} />
        <MetricCard label="Conversione" value={`${conversion}%`} />
      </div>
      <DataTable data={list} columns={columns} />
      <OpportunityFormModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
