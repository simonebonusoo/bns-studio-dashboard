import { useState } from 'react';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, Field } from '@/components/ui/Input';
import { useCreate, useUpdate, useRemove } from '@/hooks/useEntities';
import type { Service } from '@/types';
import { toast } from 'sonner';

const COLORS = ['#b0d62e', '#9b5de5', '#3b76d6', '#e07b39', '#22a05a', '#f24e6b'];

export function ServiceFormModal({ open, onClose, service }: { open: boolean; onClose: () => void; service?: Service | null }) {
  const create = useCreate<Service>('services');
  const update = useUpdate<Service>('services');
  const remove = useRemove('services');
  const [confirmDel, setConfirmDel] = useState(false);
  const editing = !!service;

  const blank = {
    name: '', description: '', category: 'Branding', basePrice: '', priceUnit: 'fixed',
    vatRate: '22', estimatedHours: '', internalCost: '', targetMargin: '45', color: COLORS[0], active: true,
  };
  const fromService = (s: Service) => ({
    name: s.name, description: s.description ?? '', category: s.category, basePrice: String(s.basePrice),
    priceUnit: s.priceUnit, vatRate: String(s.vatRate), estimatedHours: String(s.estimatedHours ?? ''),
    internalCost: String(s.internalCost ?? ''), targetMargin: String(s.targetMargin ?? ''), color: s.color, active: s.active,
  });
  const [form, setForm] = useState(() => (service ? fromService(service) : blank));
  const key = service?.id ?? 'new';
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) { setLastKey(key); setForm(service ? fromService(service) : blank); }

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Nome obbligatorio'); return; }
    const payload = {
      name: form.name, description: form.description, category: form.category,
      basePrice: Number(form.basePrice) || 0, priceUnit: form.priceUnit as Service['priceUnit'],
      vatRate: Number(form.vatRate) || 0, estimatedHours: Number(form.estimatedHours) || 0,
      internalCost: Number(form.internalCost) || 0, targetMargin: Number(form.targetMargin) || 0,
      color: form.color, active: form.active,
    };
    if (editing && service) { await update.mutateAsync({ id: service.id, patch: payload }); toast.success('Servizio aggiornato'); }
    else { await create.mutateAsync(payload); toast.success('Servizio creato'); }
    onClose();
  };
  const del = async () => { if (service) { await remove.mutateAsync(service.id); toast.success('Servizio eliminato'); onClose(); } };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editing ? 'Modifica servizio' : 'Nuovo servizio'}
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between">
            {editing ? <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)}>Elimina</Button> : <span />}
            <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Annulla</Button><Button onClick={submit}>{editing ? 'Salva' : 'Crea'}</Button></div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome" className="col-span-2"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Es. Brand Identity" /></Field>
          <Field label="Categoria"><Input value={form.category} onChange={(e) => set('category', e.target.value)} /></Field>
          <Field label="Unità prezzo">
            <Select value={form.priceUnit} onChange={(e) => set('priceUnit', e.target.value)}>
              <option value="fixed">Fisso</option><option value="hourly">Orario</option><option value="daily">Giornaliero</option>
              <option value="monthly">Mensile</option><option value="quantity">Per quantità</option><option value="custom">Personalizzato</option>
            </Select>
          </Field>
          <Field label="Prezzo base (€)"><Input type="number" step="50" value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} /></Field>
          <Field label="IVA %"><Input type="number" value={form.vatRate} onChange={(e) => set('vatRate', e.target.value)} /></Field>
          <Field label="Ore stimate"><Input type="number" value={form.estimatedHours} onChange={(e) => set('estimatedHours', e.target.value)} /></Field>
          <Field label="Costo interno (€)"><Input type="number" value={form.internalCost} onChange={(e) => set('internalCost', e.target.value)} /></Field>
          <Field label="Margine target %"><Input type="number" value={form.targetMargin} onChange={(e) => set('targetMargin', e.target.value)} /></Field>
          <Field label="Colore">
            <div className="flex gap-1.5 pt-1">
              {COLORS.map((c) => (
                <button key={c} onClick={() => set('color', c)} className={`h-6 w-6 rounded-full border-2 ${form.color === c ? 'border-fg' : 'border-transparent'}`} style={{ backgroundColor: c }} aria-label={c} />
              ))}
            </div>
          </Field>
          <Field label="Descrizione" className="col-span-2"><Textarea value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} className="accent-accent" /> Servizio attivo</label>
        </div>
      </Modal>
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={del} title="Elimina servizio" message={`Eliminare "${service?.name}"?`} confirmLabel="Elimina" danger />
    </>
  );
}
