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
import { useList, useRemove, useHardDelete } from '@/hooks/useEntities';
import { PaymentFormModal } from './PaymentFormModal';
import { CreateMethodDialog } from '@/features/import/CreateMethodDialog';
import { ContextualMarkdownImportDialog } from '@/features/import/ContextualMarkdownImportDialog';
import type { ResolvedImport } from '@/features/import/contextualImport';
import { syncInvoiceStatus } from '@/services/paymentService';
import { voidInstallmentCashflow, voidPaymentCashflow } from '@/services/cashflowSync';
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
  const hardDeleteInstallment = useHardDelete('paymentInstallments');
  const qc = useQueryClient();
  const can = useAuth((s) => s.can);
  const [params, setParams] = useSearchParams();
  const [chooserOpen, setChooserOpen] = useState(params.get('new') === '1');
  const [open, setOpen] = useState(false);
  const [markdownOpen, setMarkdownOpen] = useState(false);
  const [defaults, setDefaults] = useState<Record<string, unknown> | undefined>();
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
    setDefaults(undefined);
    if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
  };

  const openEdit = (p: Payment) => { setEditing(p); setDefaults(undefined); setOpen(true); };
  const openChooser = () => setChooserOpen(true);
  const closeChooser = () => {
    setChooserOpen(false);
    if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); }
  };
  const openManual = () => {
    setDefaults(undefined);
    setChooserOpen(false);
    setOpen(true);
  };
  const importMarkdown = (result: ResolvedImport) => {
    setDefaults(result.defaults);
    setOpen(true);
  };

  const del = async (p: Payment) => {
    const paymentInstallments = installmentsFor(p.id);
    await voidPaymentCashflow(p.id);
    await Promise.all(paymentInstallments.map(async (installment) => {
      await voidInstallmentCashflow(installment.id);
      await hardDeleteInstallment.mutateAsync(installment.id);
    }));
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
        return <span className="text-fg-subtle">{paymentInstallments.length} rate · {formatCurrency(summary.residual)} da incassare</span>;
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
            {can('payments.manage') && <Button onClick={openChooser}><Plus className="h-4 w-4" /> Nuovo pagamento</Button>}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard label="Totale incassato" value={formatCurrency(total)} />
        <MetricCard label="In attesa" value={formatCurrency(pending)} />
        <MetricCard label="Pagamenti" value={list.length} />
      </div>
      {list.length === 0 ? (
        <EmptyState title="Nessun pagamento" description="Registra il primo pagamento." action={can('payments.manage') && <Button onClick={openChooser}><Plus className="h-4 w-4" /> Nuovo pagamento</Button>} />
      ) : (
        <DataTable data={list} columns={columns} onRowClick={openEdit} rowMenu={rowMenu} />
      )}

      <CreateMethodDialog
        open={chooserOpen}
        onClose={closeChooser}
        entityLabel="pagamento"
        title="Nuovo pagamento"
        description="Come vuoi registrare questo pagamento?"
        onManual={openManual}
        onMarkdown={() => {
          setChooserOpen(false);
          setMarkdownOpen(true);
        }}
      />
      <ContextualMarkdownImportDialog open={markdownOpen} onClose={() => setMarkdownOpen(false)} entityType="payment" onContinue={importMarkdown} />
      <PaymentFormModal open={open} onClose={closeModal} payment={editing} defaults={defaults} />
    </div>
  );
}
