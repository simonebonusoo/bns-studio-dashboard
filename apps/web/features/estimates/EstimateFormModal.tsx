import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field, Textarea } from '@/components/ui/Input';
import { useCreate, useList, useUpdate } from '@/hooks/useEntities';
import { documentTotals } from '@/lib/finance';
import { formatCurrency } from '@/lib/format';
import { uid } from '@/lib/id';
import { nextEstimateNumber } from '@/services/documentNumbers';
import type { Estimate, Client, Service, DocumentLineItem } from '@/types';
import { toast } from 'sonner';

const EMPTY_STATE = {
  clientId: '',
  status: 'draft' as Estimate['status'],
  issueDate: new Date().toISOString().slice(0, 10),
  expiryDate: new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10),
  depositPct: '30',
  notes: '',
  items: [] as DocumentLineItem[],
};

export function EstimateFormModal({
  open,
  onClose,
  estimate,
}: {
  open: boolean;
  onClose: () => void;
  estimate?: Estimate;
}) {
  const create = useCreate<Estimate>('estimates');
  const update = useUpdate<Estimate>('estimates');
  const { data: clients } = useList<Client>('clients');
  const { data: services } = useList<Service>('services');
  const [form, setForm] = useState(EMPTY_STATE);
  const editing = Boolean(estimate);

  useEffect(() => {
    if (!open) return;
    if (estimate) {
      setForm({
        clientId: estimate.clientId ?? '',
        status: estimate.status,
        issueDate: estimate.issueDate.slice(0, 10),
        expiryDate: estimate.expiryDate?.slice(0, 10) ?? '',
        depositPct: String(estimate.depositPct ?? 0),
        notes: estimate.notes ?? '',
        items: estimate.items,
      });
      return;
    }
    setForm(EMPTY_STATE);
  }, [estimate, open]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
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

  const totals = documentTotals(form.items, { depositPct: Number(form.depositPct) });

  const submit = async () => {
    if (form.items.length === 0) {
      toast.error('Aggiungi almeno una voce');
      return;
    }

    const payload = {
      clientId: form.clientId || undefined,
      status: form.status,
      currency: 'EUR',
      issueDate: form.issueDate,
      expiryDate: form.expiryDate || null,
      items: form.items,
      globalDiscountPct: 0,
      depositPct: Number(form.depositPct) || 0,
      notes: form.notes || undefined,
      terms: '',
    };

    if (editing && estimate) {
      await update.mutateAsync({
        id: estimate.id,
        patch: payload,
      });
      toast.success('Preventivo aggiornato');
    } else {
      await create.mutateAsync({
        number: await nextEstimateNumber(),
        version: 1,
        ...payload,
      });
      toast.success('Preventivo creato');
    }

    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Modifica ${estimate?.number}` : 'Nuovo preventivo'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={submit}>{editing ? 'Salva' : 'Crea preventivo'}</Button>
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
          <Field label="Stato">
            <Select value={form.status} onChange={(event) => setField('status', event.target.value as Estimate['status'])}>
              <option value="draft">Bozza</option>
              <option value="internal_review">Review interna</option>
              <option value="sent">Inviato</option>
              <option value="viewed">Visto</option>
              <option value="accepted">Accettato</option>
              <option value="rejected">Rifiutato</option>
              <option value="expired">Scaduto</option>
              <option value="cancelled">Annullato</option>
              <option value="superseded">Sostituito</option>
            </Select>
          </Field>
          <Field label="Data emissione">
            <Input type="date" value={form.issueDate} onChange={(event) => setField('issueDate', event.target.value)} />
          </Field>
          <Field label="Scadenza">
            <Input type="date" value={form.expiryDate} onChange={(event) => setField('expiryDate', event.target.value)} />
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
                <Input value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} className="h-8 flex-1" />
                <Input type="number" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })} className="h-8 w-16" title="Quantità" />
                <Input type="number" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: Number(event.target.value) })} className="h-8 w-24" title="Prezzo" />
                <span className="w-24 text-right text-sm font-medium">{formatCurrency(item.quantity * item.unitPrice)}</span>
                <button onClick={() => removeItem(item.id)} aria-label="Rimuovi">
                  <X className="h-4 w-4 text-fg-faint hover:text-danger" />
                </button>
              </div>
            ))}
            {form.items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-fg-subtle">
                Nessuna voce · aggiungi un servizio
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Acconto %">
            <Input type="number" value={form.depositPct} onChange={(event) => setField('depositPct', event.target.value)} className="w-24" />
          </Field>
          <Field label="Note">
            <Textarea value={form.notes} onChange={(event) => setField('notes', event.target.value)} />
          </Field>
        </div>

        <div className="flex items-end justify-between border-t border-border pt-4">
          <div className="text-xs text-fg-subtle">
            {editing ? 'Le modifiche aggiornano il record esistente e alimentano subito analytics e dashboard.' : 'Il preventivo sarà disponibile subito in dashboard e flussi finanziari.'}
          </div>
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
