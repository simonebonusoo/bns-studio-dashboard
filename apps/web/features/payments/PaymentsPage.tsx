import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Plus, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { MetricCard } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/tables/DataTable';
import type { MenuItem } from '@/components/ui/ContextMenu';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { useList, useRemove } from '@/hooks/useEntities';
import { PaymentFormModal } from './PaymentFormModal';
import { syncInvoiceStatus } from '@/services/paymentService';
import { voidPaymentCashflow } from '@/services/cashflowSync';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useEntities';
import { formatCurrency, formatDate } from '@/lib/format';
import { exportToCSV } from '@/utils/csv';
import { installmentSummary } from '@/services/installmentService';
import { useAuth } from '@/stores/auth';
import { toast } from 'sonner';
import type { Payment, Client, Invoice, PaymentInstallment } from '@/types';

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bonifico', card: 'Carta', paypal: 'PayPal', stripe: 'Stripe', cash: 'Contanti', cheque: 'Assegno', other: 'Altro',
};

export default function PaymentsPage() {
  const { data: payments, isLoading } = useList<Payment>('payments');
  const { data: clients } = useList<Client>('clients');
  const { data: invoices } = useList<Invoice>('invoices');
  const { data: installments } = useList<PaymentInstallment>('paymentInstallments');
  const remove = useRemove('payments');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get('new') === '1');
  const [editing, setEditing] = useState<Payment | null>(null);

  const list = (payments ?? []).sort((a, b) => (a.date < b.date ? 1 : -1));
  const clientName = (id?: string) => (clients ?? []).find((c) => c.id === id)?.displayName ?? '—';
  const invNumber = (id?: string) => (invoices ?? []).find((i) => i.id === id)?.number ?? '—';
  const total = list.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
  const pending = list.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const installmentsFor = (paymentId: string) => (installments ?? []).filter((installment) => installment.paymentId === paymentId);

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
  };

  const openEdit = (p: Payment) => { setEditing(p); setOpen(true); };

  const del = async (p: Payment) => {
    await voidPaymentCashflow(p.id);
    await remove.mutateAsync(p.id);
    await syncInvoiceStatus(p.invoiceId);
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: queryKeys.analytics });
    toast.success('Pagamento eliminato');
  };

  const rowMenu = (p: Payment): MenuItem[] => [
    { label: 'Modifica', icon: Pencil, onClick: () => openEdit(p) },
    ...(can('payments.manage') ? [{ label: 'Elimina', icon: Trash2, danger: true, separatorBefore: true, onClick: () => del(p) }] : []),
  ];

  const columns: Column<Payment>[] = [
    { key: 'date', header: 'Data', sortValue: (p) => p.date, render: (p) => formatDate(p.date) },
    { key: 'client', header: 'Cliente', render: (p) => clientName(p.clientId) },
    { key: 'invoice', header: 'Fattura', render: (p) => <span className="text-fg-subtle">{invNumber(p.invoiceId)}</span> },
    { key: 'method', header: 'Metodo', render: (p) => METHOD_LABELS[p.method] ?? p.method },
    { key: 'amount', header: 'Importo', sortValue: (p) => p.amount, render: (p) => <span className="font-semibold">{formatCurrency(p.amount)}</span> },
    {
      key: 'installments',
      header: 'Rate',
      render: (p) => {
        const paymentInstallments = installmentsFor(p.id);
        if (paymentInstallments.length === 0) return <span className="text-fg-subtle">Unico</span>;
        const summary = installmentSummary(p, paymentInstallments);
        return <span className="text-fg-subtle">{paymentInstallments.length} rate · {formatCurrency(summary.residual)} residuo</span>;
      },
    },
    { key: 'status', header: 'Stato', render: (p) => <StatusBadge status={p.status === 'completed' ? 'paid' : p.status} /> },
  ];

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pagamenti"
        description={`${list.length} pagamenti · clicca una riga per modificare`}
        actions={
          <>
            <Button variant="secondary" onClick={() => exportToCSV('pagamenti', list.map((p) => ({ data: p.date, cliente: clientName(p.clientId), fattura: invNumber(p.invoiceId), importo: p.amount, metodo: p.method, stato: p.status })))}><Download className="h-4 w-4" /> CSV</Button>
            {can('payments.manage') && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuovo pagamento</Button>}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard label="Totale incassato" value={formatCurrency(total)} />
        <MetricCard label="In attesa" value={formatCurrency(pending)} />
        <MetricCard label="Pagamenti" value={list.length} />
      </div>
      {list.length === 0 ? (
        <EmptyState title="Nessun pagamento" description="Registra il primo pagamento." action={can('payments.manage') && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuovo pagamento</Button>} />
      ) : (
        <DataTable data={list} columns={columns} onRowClick={openEdit} rowMenu={rowMenu} />
      )}

      <PaymentFormModal open={open} onClose={closeModal} payment={editing} />
    </div>
  );
}
