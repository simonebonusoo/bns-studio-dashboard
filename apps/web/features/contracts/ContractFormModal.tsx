import { useEffect, useRef, useState } from 'react';
import { Upload, Download, FileCheck } from 'lucide-react';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, Field } from '@/components/ui/Input';
import { useCreate, useUpdate, useRemove, useList } from '@/hooks/useEntities';
import { env } from '@/config/env';
import { nextContractNumber } from '@/services/documentNumbers';
import { saveUrlFile } from '@/services/downloadService';
import type { Contract, Client, Project, Estimate } from '@/types';
import { toast } from 'sonner';

const TYPES: { value: Contract['type']; label: string }[] = [
  { value: 'single_project', label: 'Progetto singolo' },
  { value: 'maintenance', label: 'Manutenzione' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'collaboration', label: 'Collaborazione' },
  { value: 'consulting', label: 'Consulenza' },
  { value: 'software', label: 'Sviluppo software' },
  { value: 'license', label: 'Licenza' },
  { value: 'custom', label: 'Personalizzato' },
];
const STATUSES: { value: Contract['status']; label: string }[] = [
  { value: 'draft', label: 'Bozza' },
  { value: 'sent', label: 'Inviato' },
  { value: 'awaiting_signature', label: 'Attesa firma' },
  { value: 'active', label: 'Attivo' },
  { value: 'expired', label: 'Scaduto' },
  { value: 'terminated', label: 'Terminato' },
  { value: 'archived', label: 'Archiviato' },
];
const RECURRENCES: { value: NonNullable<Contract['recurrence']>; label: string }[] = [
  { value: 'one_time', label: 'Una tantum' },
  { value: 'monthly', label: 'Mensile' },
  { value: 'quarterly', label: 'Trimestrale' },
  { value: 'semiannual', label: 'Semestrale' },
  { value: 'annual', label: 'Annuale' },
  { value: 'custom', label: 'Custom' },
];
const RENEWALS: { value: NonNullable<Contract['renewalType']>; label: string }[] = [
  { value: 'none', label: 'Nessun rinnovo' },
  { value: 'manual', label: 'Rinnovo manuale' },
  { value: 'automatic', label: 'Rinnovo automatico' },
];

const EMPTY_CONTRACT_FORM = {
  title: '', clientId: '', projectId: '', estimateId: '', type: 'single_project' as Contract['type'],
  status: 'draft' as Contract['status'], value: '', startDate: '', endDate: '',
  recurrence: 'one_time' as NonNullable<Contract['recurrence']>,
  billingFrequency: 'one_time' as NonNullable<Contract['billingFrequency']>,
  renewalType: 'none' as NonNullable<Contract['renewalType']>,
  paymentTerms: '30 giorni', includedRevisions: '2', terms: '', signedByClient: false, signedByStudio: false,
  pdfName: '', pdfUrl: '',
};
type ContractFormState = typeof EMPTY_CONTRACT_FORM;

export function ContractFormModal({ open, onClose, contract, defaults }: { open: boolean; onClose: () => void; contract?: Contract | null; defaults?: Partial<ContractFormState> }) {
  const create = useCreate<Contract>('contracts');
  const update = useUpdate<Contract>('contracts');
  const remove = useRemove('contracts');
  const { data: clients } = useList<Client>('clients');
  const { data: projects } = useList<Project>('projects');
  const { data: estimates } = useList<Estimate>('estimates');
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const editing = !!contract;

  const [form, setForm] = useState(() =>
    contract
      ? {
          title: contract.title, clientId: contract.clientId ?? '', projectId: contract.projectId ?? '',
          estimateId: contract.estimateId ?? '', type: contract.type, status: contract.status,
          value: String(contract.value), startDate: contract.startDate?.slice(0, 10) ?? '',
          recurrence: contract.recurrence ?? 'one_time',
          billingFrequency: contract.billingFrequency ?? contract.recurrence ?? 'one_time',
          renewalType: contract.renewalType ?? 'none',
          endDate: contract.endDate?.slice(0, 10) ?? '', paymentTerms: contract.paymentTerms ?? '30 giorni',
          includedRevisions: String(contract.includedRevisions ?? 2), terms: contract.terms ?? '',
          signedByClient: contract.signedByClient, signedByStudio: contract.signedByStudio,
          pdfName: contract.pdfName ?? '', pdfUrl: contract.pdfUrl ?? '',
        }
      : { ...EMPTY_CONTRACT_FORM, ...defaults },
  );

  useEffect(() => {
    if (!open) return;
    setForm(
      contract
        ? {
            title: contract.title, clientId: contract.clientId ?? '', projectId: contract.projectId ?? '',
            estimateId: contract.estimateId ?? '', type: contract.type, status: contract.status,
            value: String(contract.value), startDate: contract.startDate?.slice(0, 10) ?? '',
            recurrence: contract.recurrence ?? 'one_time',
            billingFrequency: contract.billingFrequency ?? contract.recurrence ?? 'one_time',
            renewalType: contract.renewalType ?? 'none',
            endDate: contract.endDate?.slice(0, 10) ?? '', paymentTerms: contract.paymentTerms ?? '30 giorni',
            includedRevisions: String(contract.includedRevisions ?? 2), terms: contract.terms ?? '',
            signedByClient: contract.signedByClient, signedByStudio: contract.signedByStudio,
            pdfName: contract.pdfName ?? '', pdfUrl: contract.pdfUrl ?? '',
          }
        : { ...EMPTY_CONTRACT_FORM, ...defaults },
    );
  }, [contract, defaults, open]);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const onPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > env.maxUploadMb * 1024 * 1024) { toast.error(`Max ${env.maxUploadMb}MB`); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, pdfName: file.name, pdfUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Titolo obbligatorio'); return; }
    const payload = {
      title: form.title, clientId: form.clientId || undefined, projectId: form.projectId || undefined,
      estimateId: form.estimateId || undefined, type: form.type, status: form.status,
      value: Number(form.value) || 0, startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      recurrence: form.recurrence,
      billingFrequency: form.billingFrequency,
      renewalType: form.renewalType,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null, paymentTerms: form.paymentTerms,
      includedRevisions: Number(form.includedRevisions) || 0, terms: form.terms,
      signedByClient: form.signedByClient, signedByStudio: form.signedByStudio,
      pdfName: form.pdfName || undefined, pdfUrl: form.pdfUrl || undefined,
    };
    if (editing && contract) {
      await update.mutateAsync({ id: contract.id, patch: payload });
      toast.success('Contratto aggiornato');
    } else {
      await create.mutateAsync({ ...payload, number: await nextContractNumber() });
      toast.success('Contratto creato');
    }
    onClose();
  };

  const del = async () => { if (contract) { await remove.mutateAsync(contract.id); toast.success('Contratto eliminato'); onClose(); } };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editing ? `Contratto ${contract?.number}` : 'Nuovo contratto'}
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between">
            {editing ? <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)}>Elimina</Button> : <span />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Annulla</Button>
              <Button onClick={submit} loading={create.isPending || update.isPending}>{editing ? 'Salva' : 'Crea'}</Button>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Titolo" className="col-span-2"><Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Es. Contratto sito web" /></Field>
          <Field label="Cliente"><Select value={form.clientId} onChange={(e) => set('clientId', e.target.value)}><option value="">—</option>{(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}</Select></Field>
          <Field label="Progetto"><Select value={form.projectId} onChange={(e) => set('projectId', e.target.value)}><option value="">—</option>{(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Preventivo collegato"><Select value={form.estimateId} onChange={(e) => set('estimateId', e.target.value)}><option value="">—</option>{(estimates ?? []).map((es) => <option key={es.id} value={es.id}>{es.number}</option>)}</Select></Field>
          <Field label="Tipo"><Select value={form.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
          <Field label="Stato"><Select value={form.status} onChange={(e) => set('status', e.target.value)}>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field>
          <Field label="Valore (€)"><Input type="number" step="100" value={form.value} onChange={(e) => set('value', e.target.value)} /></Field>
          <Field label="Ricorrenza"><Select value={form.recurrence} onChange={(e) => set('recurrence', e.target.value)}>{RECURRENCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
          <Field label="Frequenza economica"><Select value={form.billingFrequency} onChange={(e) => set('billingFrequency', e.target.value)}>{RECURRENCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
          <Field label="Rinnovo"><Select value={form.renewalType} onChange={(e) => set('renewalType', e.target.value)}>{RENEWALS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></Field>
          <Field label="Inizio"><Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
          <Field label="Fine"><Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
          <Field label="Termini di pagamento"><Input value={form.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} /></Field>
          <Field label="Revisioni incluse"><Input type="number" value={form.includedRevisions} onChange={(e) => set('includedRevisions', e.target.value)} /></Field>
          <Field label="Condizioni / clausole" className="col-span-2"><Textarea value={form.terms} onChange={(e) => set('terms', e.target.value)} /></Field>

          <div className="col-span-2 flex flex-wrap items-center gap-4 border-t border-border pt-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.signedByClient} onChange={(e) => set('signedByClient', e.target.checked)} className="accent-accent" /> Firmato dal cliente</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.signedByStudio} onChange={(e) => set('signedByStudio', e.target.checked)} className="accent-accent" /> Firmato da BNS Studio</label>
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <input ref={fileInput} type="file" accept="application/pdf" className="hidden" onChange={onPdf} />
            <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" /> Carica PDF firmato</Button>
            {form.pdfName && (
              <span className="flex items-center gap-1.5 text-sm text-fg-subtle"><FileCheck className="h-4 w-4 text-success" /> {form.pdfName}
                <button
                  type="button"
                  className="text-info hover:underline"
                  onClick={() => form.pdfUrl && void saveUrlFile(form.pdfName, form.pdfUrl, 'application/pdf')}
                  aria-label="Scarica PDF firmato"
                >
                  <Download className="inline h-4 w-4" />
                </button>
              </span>
            )}
          </div>
          <p className="col-span-2 text-2xs text-fg-faint">La firma elettronica qualificata non è implementata: qui si registra lo stato e si allega il PDF firmato.</p>
        </div>
      </Modal>

      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={del} title="Elimina contratto" message={`Eliminare "${contract?.title}"?`} confirmLabel="Elimina" danger />
    </>
  );
}
