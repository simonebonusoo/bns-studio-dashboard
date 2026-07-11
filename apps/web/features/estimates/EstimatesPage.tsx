import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { MetricCard } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { useList } from '@/hooks/useEntities';
import { documentTotals } from '@/lib/finance';
import { formatCurrency, formatDate } from '@/lib/format';
import { exportToCSV } from '@/utils/csv';
import { EstimateFormModal } from './EstimateFormModal';
import type { Estimate, Client } from '@/types';

export default function EstimatesPage() {
  const { data: estimates, isLoading } = useList<Estimate>('estimates');
  const { data: clients } = useList<Client>('clients');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  const list = estimates ?? [];

  const closeModal = () => {
    setOpen(false);
    if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
  };

  const clientName = (id?: string) => (clients ?? []).find((c) => c.id === id)?.displayName ?? '—';
  const total = (e: Estimate) => documentTotals(e.items, { globalDiscountPct: e.globalDiscountPct }).total;

  const openValue = list.filter((e) => ['sent', 'viewed', 'draft'].includes(e.status)).reduce((s, e) => s + total(e), 0);
  const acceptedValue = list.filter((e) => e.status === 'accepted').reduce((s, e) => s + total(e), 0);
  const acceptedCount = list.filter((e) => e.status === 'accepted').length;
  const decided = list.filter((e) => ['accepted', 'rejected'].includes(e.status)).length;
  const conversion = decided ? Math.round((acceptedCount / decided) * 100) : 0;

  const columns: Column<Estimate>[] = [
    { key: 'number', header: 'Numero', sortValue: (e) => e.number, render: (e) => <span className="font-medium">{e.number}</span> },
    { key: 'client', header: 'Cliente', render: (e) => clientName(e.clientId) },
    { key: 'issue', header: 'Emissione', sortValue: (e) => e.issueDate, render: (e) => <span className="text-fg-subtle">{formatDate(e.issueDate)}</span> },
    { key: 'total', header: 'Totale', sortValue: (e) => total(e), render: (e) => formatCurrency(total(e)) },
    { key: 'status', header: 'Stato', render: (e) => <StatusBadge status={e.status} />, sortValue: (e) => e.status },
  ];

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Preventivi"
        description={`${list.length} preventivi`}
        actions={
          <>
            <Button variant="secondary" onClick={() => exportToCSV('preventivi', list.map((e) => ({ numero: e.number, cliente: clientName(e.clientId), totale: total(e), stato: e.status })))}><Download className="h-4 w-4" /> CSV</Button>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuovo preventivo</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Valore aperto" value={formatCurrency(openValue)} />
        <MetricCard label="Accettati" value={formatCurrency(acceptedValue)} hint={`${acceptedCount} preventivi`} />
        <MetricCard label="Conversione" value={`${conversion}%`} />
        <MetricCard label="Totale" value={list.length} />
      </div>
      <DataTable data={list} columns={columns} onRowClick={(e) => navigate(`/estimates/${e.id}`)} />
      <EstimateFormModal open={open} onClose={closeModal} />
    </div>
  );
}
