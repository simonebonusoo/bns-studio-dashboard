import { useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Field } from '@/components/ui/Input';
import { useCreate, useList } from '@/hooks/useEntities';
import { documentTotals } from '@/lib/finance';
import { formatCurrency } from '@/lib/format';
import { uid } from '@/lib/id';
import { nextEstimateNumber } from '@/services/documentNumbers';
import type { Estimate, Client, Service, DocumentLineItem } from '@/types';
import { toast } from 'sonner';

export function EstimateFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreate<Estimate>('estimates');
  const { data: clients } = useList<Client>('clients');
  const { data: services } = useList<Service>('services');
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<DocumentLineItem[]>([]);
  const [depositPct, setDepositPct] = useState('30');
  const [expiry, setExpiry] = useState(new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10));

  const reset = () => { setClientId(''); setItems([]); setDepositPct('30'); };

  const addService = (id: string) => {
    const s = (services ?? []).find((x) => x.id === id);
    if (!s) return;
    setItems((prev) => [...prev, { id: uid(), serviceId: s.id, description: s.name, quantity: 1, unit: s.priceUnit, unitPrice: s.basePrice, discountPct: 0, vatRate: s.vatRate }]);
  };
  const updateItem = (id: string, patch: Partial<DocumentLineItem>) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const totals = documentTotals(items, { depositPct: Number(depositPct) });

  const submit = async () => {
    if (items.length === 0) { toast.error('Aggiungi almeno una voce'); return; }
    await create.mutateAsync({
      number: await nextEstimateNumber(),
      version: 1, clientId: clientId || undefined, status: 'draft', currency: 'EUR',
      issueDate: new Date().toISOString().slice(0, 10), expiryDate: expiry || null,
      items, globalDiscountPct: 0, depositPct: Number(depositPct), notes: '',
    });
    toast.success('Preventivo creato');
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuovo preventivo"
      size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Annulla</Button><Button onClick={submit}>Crea preventivo</Button></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cliente">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">—</option>
              {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
            </Select>
          </Field>
          <Field label="Scadenza"><Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-fg-subtle">Voci</span>
            <Select className="h-8 w-48" value="" onChange={(e) => { if (e.target.value) addService(e.target.value); }}>
              <option value="">+ Aggiungi servizio…</option>
              {(services ?? []).filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <Input value={it.description} onChange={(e) => updateItem(it.id, { description: e.target.value })} className="h-8 flex-1" />
                <Input type="number" value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) })} className="h-8 w-16" title="Quantità" />
                <Input type="number" value={it.unitPrice} onChange={(e) => updateItem(it.id, { unitPrice: Number(e.target.value) })} className="h-8 w-24" title="Prezzo" />
                <span className="w-24 text-right text-sm font-medium">{formatCurrency(it.quantity * it.unitPrice)}</span>
                <button onClick={() => removeItem(it.id)} aria-label="Rimuovi"><X className="h-4 w-4 text-fg-faint hover:text-danger" /></button>
              </div>
            ))}
            {items.length === 0 && <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-fg-subtle">Nessuna voce · aggiungi un servizio</p>}
          </div>
        </div>

        <div className="flex items-end justify-between border-t border-border pt-4">
          <Field label="Acconto %"><Input type="number" value={depositPct} onChange={(e) => setDepositPct(e.target.value)} className="w-24" /></Field>
          <div className="space-y-1 text-right text-sm">
            <div className="flex justify-between gap-8"><span className="text-fg-subtle">Imponibile</span><span>{formatCurrency(totals.subtotal)}</span></div>
            <div className="flex justify-between gap-8"><span className="text-fg-subtle">IVA</span><span>{formatCurrency(totals.vat)}</span></div>
            <div className="flex justify-between gap-8 text-base font-bold"><span>Totale</span><span>{formatCurrency(totals.total)}</span></div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
