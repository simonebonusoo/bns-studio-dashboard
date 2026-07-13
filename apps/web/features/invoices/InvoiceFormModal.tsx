import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field, Textarea } from '@/components/ui/Input';
import { useCreate, useList, useUpdate } from '@/hooks/useEntities';
import { documentTotals } from '@/lib/finance';
import { formatCurrency } from '@/lib/format';
import { uid } from '@/lib/id';
import { nextInvoiceNumber } from '@/services/documentNumbers';
import type { Client, DocumentLineItem, Invoice, PaymentMethod, Project, Service } from '@/types';
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

function blankItem(): DocumentLineItem {
  return {
    id: uid(),
    description: '',
    quantity: 1,
    unit: 'fixed',
    unitPrice: 0,
    discountPct: 0,
    vatRate: 22,
  };
}

function buildInitialState(invoice?: Invoice | null, defaults?: { clientId?: string; projectId?: string }) {
  return {
    clientId: invoice?.clientId ?? defaults?.clientId ?? '',
    projectId: invoice?.projectId ?? defaults?.projectId ?? '',
    status: invoice?.status ?? ('draft' as Invoice['status']),
    issueDate: invoice?.issueDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    dueDate: invoice?.dueDate?.slice(0, 10) ?? '',
    paymentMethod: invoice?.paymentMethod ?? ('bank_transfer' as PaymentMethod),
    notes: invoice?.notes ?? '',
    items: invoice?.items?.length ? invoice.items : [blankItem()],
  };
}

export function InvoiceFormModal({
  open,
  onClose,
  invoice,
  defaults,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  invoice?: Invoice | null;
  defaults?: { clientId?: string; projectId?: string };
  onSaved?: (invoice: Invoice, mode: 'create' | 'update') => void;
}) {
  const create = useCreate<Invoice>('invoices');
  const update = useUpdate<Invoice>('invoices');
  const { data: clients } = useList<Client>('clients');
  const { data: projects } = useList<Project>('projects');
  const { data: services } = useList<Service>('services');
  const editing = Boolean(invoice);
  const initialState = useMemo(
    () => buildInitialState(invoice, defaults),
    [defaults, invoice],
  );
  const [form, setForm] = useState(initialState);

  useEffect(() => {
    if (!open) return;
    setForm(initialState);
  }, [initialState, open]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleProjectChange = (projectId: string) => {
    const project = (projects ?? []).find((item) => item.id === projectId);
    setForm((current) => ({
      ...current,
      projectId,
      clientId: project?.clientId ?? current.clientId,
    }));
  };

  const addService = (id: string) => {
    const service = (services ?? []).find((item) => item.id === id);
    if (!service) return;
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: uid(),
          serviceId: service.id,
          description: service.name,
          quantity: 1,
          unit: service.priceUnit,
          unitPrice: service.basePrice,
          discountPct: 0,
          vatRate: service.vatRate,
        },
      ],
    }));
  };

  const updateItem = (id: string, patch: Partial<DocumentLineItem>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const removeItem = (id: string) => {
    setForm((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
  };

  const totals = documentTotals(form.items);

  const submit = async () => {
    const normalizedItems = form.items
      .map((item) => ({ ...item, description: item.description.trim() }))
      .filter((item) => item.description.length > 0);

    if (normalizedItems.length === 0) {
      toast.error('Aggiungi almeno una voce valida');
      return;
    }

    const payload = {
      clientId: form.clientId || undefined,
      projectId: form.projectId || undefined,
      status: form.status,
      currency: 'EUR',
      issueDate: form.issueDate,
      dueDate: form.dueDate || null,
      items: normalizedItems,
      globalDiscountPct: invoice?.globalDiscountPct ?? 0,
      withholdingPct: invoice?.withholdingPct ?? 0,
      paymentMethod: form.paymentMethod,
      notes: form.notes || undefined,
    };

    if (editing && invoice) {
      const updatedInvoice = await update.mutateAsync({
        id: invoice.id,
        patch: payload,
      });
      toast.success('Fattura aggiornata');
      onSaved?.(updatedInvoice, 'update');
      onClose();
      return;
    }

    const createdInvoice = await create.mutateAsync({
      number: await nextInvoiceNumber(),
      ...payload,
    });
    toast.success('Fattura creata');
    onSaved?.(createdInvoice, 'create');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Modifica ${invoice?.number}` : 'Nuova fattura'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={submit} loading={create.isPending || update.isPending}>
            {editing ? 'Salva' : 'Crea fattura'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cliente">
            <Select value={form.clientId} onChange={(event) => setField('clientId', event.target.value)}>
              <option value="">—</option>
              {(clients ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Progetto">
            <Select value={form.projectId} onChange={(event) => handleProjectChange(event.target.value)}>
              <option value="">—</option>
              {(projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stato">
            <Select value={form.status} onChange={(event) => setField('status', event.target.value as Invoice['status'])}>
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
          <Field label="Metodo pagamento">
            <Select value={form.paymentMethod} onChange={(event) => setField('paymentMethod', event.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data emissione">
            <Input type="date" value={form.issueDate} onChange={(event) => setField('issueDate', event.target.value)} />
          </Field>
          <Field label="Scadenza">
            <Input type="date" value={form.dueDate} onChange={(event) => setField('dueDate', event.target.value)} />
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
            {form.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <Input value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} className="h-8 flex-1" placeholder="Descrizione voce" />
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
          <Textarea value={form.notes} onChange={(event) => setField('notes', event.target.value)} />
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
