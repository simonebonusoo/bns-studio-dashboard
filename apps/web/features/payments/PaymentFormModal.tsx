import { useState } from 'react';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, Field } from '@/components/ui/Input';
import { useCreate, useUpdate, useRemove, useList } from '@/hooks/useEntities';
import { syncInvoiceStatus } from '@/services/paymentService';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useEntities';
import { formatCurrency } from '@/lib/format';
import { invoiceBalance } from '@/lib/finance';
import type { Payment, Client, Invoice } from '@/types';
import { toast } from 'sonner';

const EMPTY = {
  amount: '', method: 'bank_transfer', date: new Date().toISOString().slice(0, 10),
  clientId: '', invoiceId: '', reference: '', status: 'completed', notes: '',
};

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
  const qc = useQueryClient();
  const { data: clients } = useList<Client>('clients');
  const { data: invoices } = useList<Invoice>('invoices');
  const { data: payments } = useList<Payment>('payments');
  const [confirmDel, setConfirmDel] = useState(false);
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
  // reset quando cambia il payment target
  const key = payment?.id ?? 'new';
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) {
    setLastKey(key);
    setForm(payment ? {
      amount: String(payment.amount), method: payment.method, date: payment.date,
      clientId: payment.clientId ?? '', invoiceId: payment.invoiceId ?? '',
      reference: payment.reference ?? '', status: payment.status, notes: payment.notes ?? '',
    } : EMPTY);
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const selectedInvoice = (invoices ?? []).find((i) => i.id === form.invoiceId);
  const bal = selectedInvoice ? invoiceBalance(selectedInvoice, (payments ?? []).filter((p) => p.id !== payment?.id)) : null;

  const afterChange = async (invoiceId?: string | null, prevInvoiceId?: string | null) => {
    await syncInvoiceStatus(invoiceId);
    if (prevInvoiceId && prevInvoiceId !== invoiceId) await syncInvoiceStatus(prevInvoiceId);
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: queryKeys.analytics });
  };

  const submit = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { toast.error('Importo non valido'); return; }
    const payload = {
      amount, currency: 'EUR', date: form.date, method: form.method as Payment['method'],
      status: form.status as Payment['status'], reference: form.reference, notes: form.notes,
      clientId: form.clientId || undefined, invoiceId: form.invoiceId || undefined,
      projectId: selectedInvoice?.projectId,
    };
    if (editing && payment) {
      await update.mutateAsync({ id: payment.id, patch: payload });
      await afterChange(payload.invoiceId, payment.invoiceId);
      toast.success('Pagamento aggiornato');
    } else {
      await create.mutateAsync(payload);
      await afterChange(payload.invoiceId);
      toast.success(`Pagamento di ${formatCurrency(amount)} registrato`);
    }
    onClose();
  };

  const del = async () => {
    if (!payment) return;
    await remove.mutateAsync(payment.id);
    await afterChange(null, payment.invoiceId);
    toast.success('Pagamento eliminato');
    onClose();
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
              <Button onClick={submit}>{editing ? 'Salva' : 'Registra'}</Button>
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
