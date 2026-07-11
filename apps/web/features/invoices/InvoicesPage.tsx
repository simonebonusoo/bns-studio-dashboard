import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { MetricCard } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { useList } from '@/hooks/useEntities';
import { invoiceBalance } from '@/lib/finance';
import { formatCurrency, formatDate } from '@/lib/format';
import { exportToCSV } from '@/utils/csv';
import type { Invoice, Client, Payment } from '@/types';

export default function InvoicesPage() {
  const { data: invoices, isLoading } = useList<Invoice>('invoices');
  const { data: clients } = useList<Client>('clients');
  const { data: payments } = useList<Payment>('payments');
  const navigate = useNavigate();
  const list = invoices ?? [];

  const clientName = (id?: string) => (clients ?? []).find((c) => c.id === id)?.displayName ?? '—';
  const bal = (inv: Invoice) => invoiceBalance(inv, payments ?? []);

  const totalIssued = list.reduce((s, i) => s + bal(i).total, 0);
  const totalPaid = list.reduce((s, i) => s + bal(i).paid, 0);
  const totalPending = list.reduce((s, i) => s + bal(i).balance, 0);
  const overdue = list.filter((i) => i.status === 'overdue').length;

  const columns: Column<Invoice>[] = [
    { key: 'number', header: 'Numero', sortValue: (i) => i.number, render: (i) => <span className="font-medium">{i.number}</span> },
    { key: 'client', header: 'Cliente', render: (i) => clientName(i.clientId) },
    { key: 'due', header: 'Scadenza', sortValue: (i) => i.dueDate ?? '', render: (i) => <span className="text-fg-subtle">{formatDate(i.dueDate)}</span> },
    { key: 'total', header: 'Totale', sortValue: (i) => bal(i).total, render: (i) => formatCurrency(bal(i).total) },
    { key: 'balance', header: 'Saldo', render: (i) => { const b = bal(i); return <span className={b.balance > 0 ? 'text-danger' : 'text-success'}>{formatCurrency(b.balance)}</span>; } },
    { key: 'status', header: 'Stato', render: (i) => <StatusBadge status={i.status} />, sortValue: (i) => i.status },
  ];

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fatture"
        description={`${list.length} fatture · modulo gestionale (non sostituisce la fatturazione elettronica certificata)`}
        actions={<Button variant="secondary" onClick={() => exportToCSV('fatture', list.map((i) => ({ numero: i.number, cliente: clientName(i.clientId), totale: bal(i).total, saldo: bal(i).balance, stato: i.status })))}><Download className="h-4 w-4" /> Esporta CSV</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Emesso" value={formatCurrency(totalIssued)} />
        <MetricCard label="Incassato" value={formatCurrency(totalPaid)} />
        <MetricCard label="Da incassare" value={formatCurrency(totalPending)} />
        <MetricCard label="Scadute" value={overdue} accent={overdue > 0} />
      </div>
      <DataTable data={list} columns={columns} onRowClick={(i) => navigate(`/invoices/${i.id}`)} />
    </div>
  );
}
