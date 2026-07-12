import { useEffect, useState } from 'react';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, Field } from '@/components/ui/Input';
import { useCreate, useUpdate, useRemove, useList, useHardDelete } from '@/hooks/useEntities';
import { syncInvoiceStatus } from '@/services/paymentService';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useEntities';
import { formatCurrency } from '@/lib/format';
import { invoiceBalance, round2 } from '@/lib/finance';
import { installmentSummary, markInstallmentPaid } from '@/services/installmentService';
import type { Payment, Client, Invoice, PaymentInstallment } from '@/types';
import { toast } from 'sonner';

const EMPTY = {
  amount: '', method: 'bank_transfer', date: new Date().toISOString().slice(0, 10),
  clientId: '', invoiceId: '', reference: '', status: 'completed', notes: '',
};

interface InstallmentDraft {
  id?: string;
  installmentNumber: number;
  amount: string;
  dueDate: string;
  paidAt?: string | null;
  status: PaymentInstallment['status'];
  notes: string;
}

const emptyInstallment = (number: number, amount = ''): InstallmentDraft => ({
  installmentNumber: number,
  amount,
  dueDate: new Date().toISOString().slice(0, 10),
  paidAt: null,
  status: 'scheduled',
  notes: '',
});

export function PaymentFormModal({
  open,
  onClose,
  payment,
}: {
  open: boolean;
  onClose: () => void;
  payment?: Payment | null;
}) {
  const create = useCreate<Payment>('payments');
  const update = useUpdate<Payment>('payments');
  const remove = useRemove('payments');
  const createInstallment = useCreate<PaymentInstallment>('paymentInstallments');
  const updateInstallment = useUpdate<PaymentInstallment>('paymentInstallments');
  const hardDeleteInstallment = useHardDelete('paymentInstallments');
  const qc = useQueryClient();
  const { data: clients } = useList<Client>('clients');
  const { data: invoices } = useList<Invoice>('invoices');
  const { data: payments } = useList<Payment>('payments');
  const { data: allInstallments } = useList<PaymentInstallment>('paymentInstallments');
  const [confirmDel, setConfirmDel] = useState(false);
  const [mode, setMode] = useState<'single' | 'installments'>('single');
  const [installments, setInstallments] = useState<InstallmentDraft[]>([emptyInstallment(1)]);
  const editing = !!payment;

  const [form, setForm] = useState(() =>
    payment
      ? {
          amount: String(payment.amount), method: payment.method, date: payment.date,
          clientId: payment.clientId ?? '', invoiceId: payment.invoiceId ?? '',
          reference: payment.reference ?? '', status: payment.status, notes: payment.notes ?? '',
        }
      : EMPTY,
  );

  useEffect(() => {
    if (!open) return;
    const existingInstallments = payment
      ? (allInstallments ?? []).filter((installment) => installment.paymentId === payment.id)
      : [];
    setForm(
      payment
        ? {
            amount: String(payment.amount), method: payment.method, date: payment.date,
            clientId: payment.clientId ?? '', invoiceId: payment.invoiceId ?? '',
            reference: payment.reference ?? '', status: payment.status, notes: payment.notes ?? '',
          }
        : EMPTY,
    );
    setMode(existingInstallments.length > 0 ? 'installments' : 'single');
    setInstallments(
      existingInstallments.length > 0
        ? existingInstallments
            .sort((left, right) => left.installmentNumber - right.installmentNumber)
            .map((installment) => ({
              id: installment.id,
              installmentNumber: installment.installmentNumber,
              amount: String(installment.amount),
              dueDate: installment.dueDate,
              paidAt: installment.paidAt,
              status: installment.status,
              notes: installment.notes ?? '',
            }))
        : [emptyInstallment(1)],
    );
  }, [allInstallments, open, payment]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const selectedInvoice = (invoices ?? []).find((i) => i.id === form.invoiceId);
  const bal = selectedInvoice ? invoiceBalance(selectedInvoice, (payments ?? []).filter((p) => p.id !== payment?.id)) : null;
  const paymentInstallments = payment ? (allInstallments ?? []).filter((installment) => installment.paymentId === payment.id) : [];
  const savedSummary = payment ? installmentSummary(payment, paymentInstallments) : null;
  const installmentTotal = round2(installments.reduce((sum, installment) => sum + (Number(installment.amount) || 0), 0));
  const amount = Number(form.amount) || 0;
  const installmentDelta = round2(amount - installmentTotal);

  const afterChange = async (invoiceId?: string | null, prevInvoiceId?: string | null) => {
    await syncInvoiceStatus(invoiceId);
    if (prevInvoiceId && prevInvoiceId !== invoiceId) await syncInvoiceStatus(prevInvoiceId);
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: queryKeys.analytics });
  };

  const submit = async () => {
    if (!amount || amount <= 0) { toast.error('Importo non valido'); return; }
    if (mode === 'installments') {
      if (installments.some((installment) => !installment.dueDate || Number(installment.amount) <= 0)) {
        toast.error('Ogni rata deve avere importo e data prevista');
        return;
      }
      if (Math.abs(installmentDelta) > 0.005) {
        toast.error('Il totale delle rate deve coincidere con il totale pagamento');
        return;
      }
    }
    const payload = {
      amount, currency: 'EUR', date: form.date, method: form.method as Payment['method'],
      status: mode === 'installments' ? 'pending' as Payment['status'] : form.status as Payment['status'],
      reference: form.reference, notes: form.notes,
      clientId: form.clientId || undefined, invoiceId: form.invoiceId || undefined,
      projectId: selectedInvoice?.projectId,
    };
    let savedPayment: Payment;
    if (editing && payment) {
      savedPayment = await update.mutateAsync({ id: payment.id, patch: payload });
      await afterChange(payload.invoiceId, payment.invoiceId);
      toast.success('Pagamento aggiornato');
    } else {
      savedPayment = await create.mutateAsync(payload);
      await afterChange(payload.invoiceId);
      toast.success(`Pagamento di ${formatCurrency(amount)} registrato`);
    }
    await saveInstallments(savedPayment);
    onClose();
  };

  const saveInstallments = async (savedPayment: Payment) => {
    const existing = (allInstallments ?? []).filter((installment) => installment.paymentId === savedPayment.id);
    if (mode === 'single') {
      await Promise.all(existing.map((installment) => hardDeleteInstallment.mutateAsync(installment.id)));
      return;
    }
    const keptIds = new Set(installments.map((installment) => installment.id).filter(Boolean));
    await Promise.all(existing.filter((installment) => !keptIds.has(installment.id)).map((installment) => hardDeleteInstallment.mutateAsync(installment.id)));
    for (const installment of installments) {
      const payload = {
        paymentId: savedPayment.id,
        installmentNumber: installment.installmentNumber,
        amount: Number(installment.amount),
        dueDate: installment.dueDate,
        paidAt: installment.paidAt ?? null,
        status: installment.status,
        notes: installment.notes || null,
      };
      if (installment.id) await updateInstallment.mutateAsync({ id: installment.id, patch: payload });
      else await createInstallment.mutateAsync(payload);
    }
  };

  const del = async () => {
    if (!payment) return;
    await Promise.all(paymentInstallments.map((installment) => hardDeleteInstallment.mutateAsync(installment.id)));
    await remove.mutateAsync(payment.id);
    await afterChange(null, payment.invoiceId);
    toast.success('Pagamento eliminato');
    onClose();
  };

  const addInstallment = () => setInstallments((current) => [...current, emptyInstallment(current.length + 1)]);
  const removeInstallment = (index: number) =>
    setInstallments((current) =>
      current
        .filter((_, itemIndex) => itemIndex !== index)
        .map((installment, itemIndex) => ({ ...installment, installmentNumber: itemIndex + 1 })),
    );
  const patchInstallment = (index: number, patch: Partial<InstallmentDraft>) =>
    setInstallments((current) => current.map((installment, itemIndex) => (itemIndex === index ? { ...installment, ...patch } : installment)));

  const payInstallment = async (installment: InstallmentDraft) => {
    if (!installment.id) return;
    const persisted = paymentInstallments.find((item) => item.id === installment.id);
    if (!persisted) return;
    await markInstallmentPaid(persisted);
    await qc.invalidateQueries({ queryKey: ['paymentInstallments'] });
    await qc.invalidateQueries({ queryKey: ['payments'] });
    toast.success(`Rata ${installment.installmentNumber} pagata`);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editing ? 'Modifica pagamento' : 'Registra pagamento'}
        footer={
          <div className="flex w-full items-center justify-between">
            {editing ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)}>Elimina</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Annulla</Button>
              <Button onClick={submit} loading={create.isPending || update.isPending}>{editing ? 'Salva' : 'Registra'}</Button>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cliente">
            <Select value={form.clientId} onChange={(e) => set('clientId', e.target.value)}>
              <option value="">—</option>
              {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
            </Select>
          </Field>
          <Field label="Fattura" hint={bal ? `Saldo residuo: ${formatCurrency(bal.balance)}` : undefined}>
            <Select value={form.invoiceId} onChange={(e) => set('invoiceId', e.target.value)}>
              <option value="">—</option>
              {(invoices ?? []).map((i) => <option key={i.id} value={i.id}>{i.number}</option>)}
            </Select>
          </Field>
          <Field label="Importo (€)">
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} autoFocus />
          </Field>
          <Field label="Data">
            <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Metodo">
            <Select value={form.method} onChange={(e) => set('method', e.target.value)}>
              <option value="bank_transfer">Bonifico</option>
              <option value="card">Carta</option>
              <option value="paypal">PayPal</option>
              <option value="stripe">Stripe</option>
              <option value="cash">Contanti</option>
              <option value="cheque">Assegno</option>
              <option value="other">Altro</option>
            </Select>
          </Field>
          <Field label="Stato">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="completed">Completato</option>
              <option value="pending">In attesa</option>
              <option value="failed">Fallito</option>
              <option value="refunded">Rimborsato</option>
            </Select>
          </Field>
          <Field label="Tipo pagamento" className="col-span-2">
            <div className="flex rounded-lg border border-border p-0.5">
              <button type="button" onClick={() => setMode('single')} className={`flex-1 rounded-md px-3 py-2 text-sm ${mode === 'single' ? 'bg-surface-2 text-fg' : 'text-fg-subtle'}`}>
                Unico
              </button>
              <button type="button" onClick={() => setMode('installments')} className={`flex-1 rounded-md px-3 py-2 text-sm ${mode === 'installments' ? 'bg-surface-2 text-fg' : 'text-fg-subtle'}`}>
                Rateizzato
              </button>
            </div>
          </Field>
          {mode === 'installments' && (
            <div className="col-span-2 space-y-3 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-medium">Piano rate</p>
                  <p className={installmentDelta === 0 ? 'text-fg-subtle' : 'text-danger'}>
                    Totale rate {formatCurrency(installmentTotal)} · residuo {formatCurrency(installmentDelta)}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={addInstallment}>Aggiungi rata</Button>
              </div>
              <div className="space-y-2">
                {installments.map((installment, index) => (
                  <div key={installment.id ?? index} className="grid grid-cols-[52px_1fr_1fr_auto] items-center gap-2 rounded-lg bg-surface-2 p-2">
                    <span className="text-sm font-medium">#{installment.installmentNumber}</span>
                    <Input type="number" step="0.01" value={installment.amount} onChange={(e) => patchInstallment(index, { amount: e.target.value })} />
                    <Input type="date" value={installment.dueDate} onChange={(e) => patchInstallment(index, { dueDate: e.target.value })} />
                    <div className="flex gap-1">
                      {installment.id && installment.status !== 'paid' && (
                        <Button variant="secondary" size="sm" onClick={() => payInstallment(installment)}>Pagata</Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => removeInstallment(index)}>Rimuovi</Button>
                    </div>
                  </div>
                ))}
              </div>
              {savedSummary && (
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-lg bg-surface-2 p-2"><p className="font-semibold">{formatCurrency(savedSummary.paid)}</p><p className="text-xs text-fg-subtle">Pagato</p></div>
                  <div className="rounded-lg bg-surface-2 p-2"><p className="font-semibold">{formatCurrency(savedSummary.residual)}</p><p className="text-xs text-fg-subtle">Residuo</p></div>
                  <div className="rounded-lg bg-surface-2 p-2"><p className="font-semibold">{savedSummary.progress}%</p><p className="text-xs text-fg-subtle">Avanzamento</p></div>
                </div>
              )}
            </div>
          )}
          <Field label="Riferimento" className="col-span-2">
            <Input value={form.reference} onChange={(e) => set('reference', e.target.value)} placeholder="Es. BON-1042" />
          </Field>
          <Field label="Note" className="col-span-2">
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={del} title="Elimina pagamento" message="Eliminare questo pagamento? Il saldo della fattura verrà ricalcolato." confirmLabel="Elimina" danger />
    </>
  );
}
