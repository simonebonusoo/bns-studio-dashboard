import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field, Textarea } from '@/components/ui/Input';
import { useList, useUpdate } from '@/hooks/useEntities';
import { documentTotals } from '@/lib/finance';
import { formatCurrency } from '@/lib/format';
import type { Client, DocumentLineItem, Invoice, PaymentMethod, Service } from '@/types';
import { toast } from 'sonner';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bonifico',
  card: 'Carta',
  paypal: 'PayPal',
  stripe: 'Stripe',
  cash: 'Contanti',
  cheque: 'Assegno',
  other: 'Altro',
};

export function InvoiceFormModal({
  open,
  onClose,
  invoice,
}: {
  open: boolean;
  onClose: () => void;
  invoice: Invoice;
}) {
  const update = useUpdate<Invoice>('invoices');
  const { data: clients } = useList<Client>('clients');
  const { data: services } = useList<Service>('services');
  const [clientId, setClientId] = useState(invoice.clientId ?? '');
  const [status, setStatus] = useState<Invoice['status']>(invoice.status);
  const [issueDate, setIssueDate] = useState(invoice.issueDate.slice(0, 10));
  const [dueDate, setDueDate] = useState(invoice.dueDate?.slice(0, 10) ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(invoice.paymentMethod ?? 'bank_transfer');
  const [notes, setNotes] = useState(invoice.notes ?? '');
  const [items, setItems] = useState<DocumentLineItem[]>(invoice.items);

  useEffect(() => {
    if (!open) return;
    setClientId(invoice.clientId ?? '');
    setStatus(invoice.status);
    setIssueDate(invoice.issueDate.slice(0, 10));
    setDueDate(invoice.dueDate?.slice(0, 10) ?? '');
    setPaymentMethod(invoice.paymentMethod ?? 'bank_transfer');
    setNotes(invoice.notes ?? '');
    setItems(invoice.items);
  }, [invoice, open]);

  const addService = (id: string) => {
    const service = (services ?? []).find((item) => item.id === id);
    if (!service) return;
    setItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        serviceId: service.id,
        description: service.name,
        quantity: 1,
        unit: service.priceUnit,
        unitPrice: service.basePrice,
        discountPct: 0,
        vatRate: service.vatRate,
      },
    ]);
  };

  const updateItem = (id: string, patch: Partial<DocumentLineItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const totals = documentTotals(items);

  const submit = async () => {
    if (items.length === 0) {
      toast.error('Aggiungi almeno una voce');
      return;
    }

    await update.mutateAsync({
      id: invoice.id,
      patch: {
        clientId: clientId || undefined,
        status,
        issueDate,
        dueDate: dueDate || null,
        items,
        paymentMethod,
        notes: notes || undefined,
      },
    });
    toast.success('Fattura aggiornata');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Modifica ${invoice.number}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={submit}>Salva</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cliente">
            <Select value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="">—</option>
              {(clients ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stato">
            <Select value={status} onChange={(event) => setStatus(event.target.value as Invoice['status'])}>
              <option value="draft">Bozza</option>
              <option value="issued">Emessa</option>
              <option value="sent">Inviata</option>
              <option value="viewed">Vista</option>
              <option value="partially_paid">Parzialmente pagata</option>
              <option value="paid">Pagata</option>
              <option value="overdue">Scaduta</option>
              <option value="cancelled">Annullata</option>
              <option value="credited">Stornata</option>
            </Select>
          </Field>
          <Field label="Data emissione">
            <Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
          </Field>
          <Field label="Scadenza">
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
          <Field label="Metodo pagamento">
            <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-fg-subtle">Voci</span>
            <Select className="h-8 w-48" value="" onChange={(event) => event.target.value && addService(event.target.value)}>
              <option value="">+ Aggiungi servizio…</option>
              {(services ?? []).filter((service) => service.active).map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <Input value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} className="h-8 flex-1" />
                <Input type="number" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })} className="h-8 w-16" title="Quantità" />
                <Input type="number" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: Number(event.target.value) })} className="h-8 w-24" title="Prezzo" />
                <span className="w-24 text-right text-sm font-medium">{formatCurrency(item.quantity * item.unitPrice)}</span>
                <button onClick={() => removeItem(item.id)} aria-label="Rimuovi">
                  <X className="h-4 w-4 text-fg-faint hover:text-danger" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <Field label="Note">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>

        <div className="flex justify-end border-t border-border pt-4">
          <div className="space-y-1 text-right text-sm">
            <div className="flex justify-between gap-8">
              <span className="text-fg-subtle">Imponibile</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-fg-subtle">IVA</span>
              <span>{formatCurrency(totals.vat)}</span>
            </div>
            <div className="flex justify-between gap-8 text-base font-bold">
              <span>Totale</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
