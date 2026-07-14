import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Plus, Pencil, Trash2, Download, Share2, Eye } from 'lucide-react';
import { useDetail, useList, useCreate, useUpdate, useRemove } from '@/hooks/useEntities';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Input, Select, Field } from '@/components/ui/Input';
import { DocumentView } from '@/features/finance/DocumentView';
import { invoiceBalance } from '@/lib/finance';
import { formatCurrency, formatDate } from '@/lib/format';
import { getInvoiceDeleteSafety, hasBlockingDependencies } from '@/services/deleteSafety';
import { syncPaymentCashflow, voidPaymentCashflow } from '@/services/cashflowSync';
import { useAuth } from '@/stores/auth';
import { InvoiceFormModal } from './InvoiceFormModal';
import { usePreview } from '@/components/preview/previewContext';
import { downloadPdf, invoicePdfBlob, sharePdf } from '@/services/documentService';
import type { Invoice, Client, Payment } from '@/types';
import { toast } from 'sonner';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const can = useAuth((s) => s.can);
  const preview = usePreview();
  const { data: invoice, isLoading } = useDetail<Invoice>('invoices', id);
  const { data: clients } = useList<Client>('clients');
  const { data: payments } = useList<Payment>('payments');
  const createPayment = useCreate<Payment>('payments');
  const updateInvoice = useUpdate<Invoice>('invoices');
  const remove = useRemove('invoices');
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Payment['method']>('bank_transfer');

  if (isLoading) return <LoadingState />;
  if (!invoice) return <ErrorState message="Fattura non trovata" />;

  const client = (clients ?? []).find((c) => c.id === invoice.clientId);
  const invPayments = (payments ?? []).filter((p) => p.invoiceId === invoice.id);
  const balance = invoiceBalance(invoice, payments ?? []);
  const deleteSafety = getInvoiceDeleteSafety(invoice, payments ?? []);
  const blockedDelete = hasBlockingDependencies(deleteSafety);

  const recordPayment = async () => {
    const value = Number(amount);
    if (!value || value <= 0) { toast.error('Importo non valido'); return; }
    const payment = await createPayment.mutateAsync({
      clientId: invoice.clientId,
      invoiceId: invoice.id,
      projectId: invoice.projectId,
      amount: value,
      currency: invoice.currency,
      date: new Date().toISOString().slice(0, 10),
      method,
      status: 'completed',
      reference: `MAN-${Date.now().toString().slice(-5)}`,
    });
    await syncPaymentCashflow(payment);
    // aggiorna stato fattura in base al nuovo saldo
    const newBalance = invoiceBalance(invoice, [
      ...(payments ?? []),
      { amount: value, status: 'completed', invoiceId: invoice.id } as Payment,
    ]);
    await updateInvoice.mutateAsync({
      id: invoice.id,
      patch: { status: newBalance.status === 'paid' ? 'paid' : 'partially_paid' },
    });
    toast.success(`Pagamento di ${formatCurrency(value)} registrato`);
    setOpen(false);
    setAmount('');
  };

  const deleteInvoice = async () => {
    if (blockedDelete) return;
    await Promise.all(invPayments.map((payment) => voidPaymentCashflow(payment.id)));
    await remove.mutateAsync(invoice.id);
    toast.success('Fattura eliminata');
    navigate('/invoices');
  };

  const downloadInvoicePdf = async () => {
    await downloadPdf(`fattura-${invoice.number}.pdf`, invoicePdfBlob(invoice, client));
  };
  const shareInvoicePdf = async () => {
    await sharePdf(`Fattura ${invoice.number}`, `fattura-${invoice.number}.pdf`, invoicePdfBlob(invoice, client));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Link to="/invoices" className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Fatture
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge status={invoice.status} />
          <Button variant="secondary" onClick={() => preview.open({ name: `fattura-${invoice.number}.pdf`, blob: invoicePdfBlob(invoice, client), mime: 'application/pdf' })}><Eye className="h-4 w-4" /> Anteprima</Button>
          <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Stampa / PDF</Button>
          <Button variant="secondary" onClick={downloadInvoicePdf}><Download className="h-4 w-4" /> PDF</Button>
          <Button variant="secondary" onClick={shareInvoicePdf}><Share2 className="h-4 w-4" /> Share</Button>
          {can('invoices.manage') && (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Modifica
            </Button>
          )}
          {can('payments.manage') && balance.balance > 0 && (
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Registra pagamento</Button>
          )}
          {can('invoices.manage') && (
            <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 text-danger" /> Elimina
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DocumentView
            title="Fattura"
            number={invoice.number}
            clientName={client?.displayName ?? '—'}
            issueDate={formatDate(invoice.issueDate)}
            dueDate={invoice.dueDate ? formatDate(invoice.dueDate) : undefined}
            items={invoice.items}
            globalDiscountPct={invoice.globalDiscountPct}
            withholdingPct={invoice.withholdingPct}
            notes={invoice.notes}
          />
        </div>

        <div className="space-y-4 print:hidden">
          <Card className="p-4">
            <p className="text-sm text-fg-subtle">Saldo residuo</p>
            <p className={`mt-1 text-2xl font-bold ${balance.balance > 0 ? 'text-danger' : 'text-success'}`}>
              {formatCurrency(balance.balance)}
            </p>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-fg-subtle">Totale</span><span>{formatCurrency(balance.total)}</span></div>
              <div className="flex justify-between"><span className="text-fg-subtle">Incassato</span><span>{formatCurrency(balance.paid)}</span></div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Pagamenti" />
            <ul className="divide-y divide-border">
              {invPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-fg-subtle">{formatDate(p.date)} · {p.method}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </li>
              ))}
              {invPayments.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-subtle">Nessun pagamento</li>}
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Registra pagamento"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={recordPayment}>Registra</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Importo (€)" hint={`Saldo residuo: ${formatCurrency(balance.balance)}`}>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </Field>
          <Field label="Metodo">
            <Select value={method} onChange={(e) => setMethod(e.target.value as Payment['method'])}>
              <option value="bank_transfer">Bonifico</option>
              <option value="card">Carta</option>
              <option value="paypal">PayPal</option>
              <option value="stripe">Stripe</option>
              <option value="cash">Contanti</option>
              <option value="other">Altro</option>
            </Select>
          </Field>
        </div>
      </Modal>
      <InvoiceFormModal open={editOpen} onClose={() => setEditOpen(false)} invoice={invoice} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={blockedDelete ? () => {} : deleteInvoice}
        title={blockedDelete ? 'Eliminazione non disponibile' : `Eliminare ${invoice.number}?`}
        message={
          blockedDelete ? (
            <div className="space-y-2">
              <p>Non puoi eliminare definitivamente questa fattura perché è collegata a:</p>
              <ul className="list-disc space-y-1 pl-5">
                {deleteSafety.dependencies.map((item) => (
                  <li key={item.label}>
                    {item.count} {item.label}
                    {item.count > 1 ? 'i' : ''}
                  </li>
                ))}
              </ul>
              <p>Rimuovi prima i pagamenti oppure mantieni la fattura nello storico.</p>
            </div>
          ) : (
            deleteSafety.warning ?? 'Questa azione rimuoverà la fattura dal gestionale.'
          )
        }
        confirmLabel={blockedDelete ? 'Chiudi' : 'Elimina fattura'}
        danger={!blockedDelete}
      />
    </div>
  );
}
