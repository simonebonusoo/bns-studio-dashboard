import { useEffect, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, Field } from '@/components/ui/Input';
import { useCreate, useUpdate, useRemove, useList } from '@/hooks/useEntities';
import type { CalendarEvent, Client, Project, Member } from '@/types';
import { toast } from 'sonner';

const TYPES: { value: CalendarEvent['type']; label: string }[] = [
  { value: 'meeting', label: 'Riunione' },
  { value: 'client_call', label: 'Call cliente' },
  { value: 'project_deadline', label: 'Scadenza progetto' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'work', label: 'Lavoro operativo' },
  { value: 'administration', label: 'Amministrazione' },
  { value: 'personal', label: 'Personale' },
  { value: 'time_off', label: 'Assenza / ferie' },
  { value: 'custom', label: 'Altro' },
];

const RECURRENCES: { value: NonNullable<CalendarEvent['recurrence']>; label: string }[] = [
  { value: 'none', label: 'Non ricorrente' },
  { value: 'daily', label: 'Ogni giorno' },
  { value: 'weekly', label: 'Ogni settimana' },
  { value: 'monthly', label: 'Ogni mese' },
  { value: 'yearly', label: 'Ogni anno' },
];

/** Estrae le parti data/ora locali da una stringa ISO. */
function parts(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
function combine(date: string, time: string) {
  return new Date(`${date}T${time || '00:00'}`).toISOString();
}

export interface EventDraft {
  id?: string;
  start: string;
  end: string;
  allDay?: boolean;
}

export function EventFormModal({ draft, onClose }: { draft: EventDraft | null; onClose: () => void }) {
  const create = useCreate<CalendarEvent>('events');
  const update = useUpdate<CalendarEvent>('events');
  const remove = useRemove('events');
  const { data: events } = useList<CalendarEvent>('events');
  const { data: clients } = useList<Client>('clients');
  const { data: projects } = useList<Project>('projects');
  const { data: members } = useList<Member>('members');
  const [confirmDel, setConfirmDel] = useState(false);

  const existing = draft?.id ? (events ?? []).find((e) => e.id === draft.id) : undefined;
  const editing = !!existing;

  const initialForm = useMemo(
    () => {
      const init = existing ?? {
        title: '', type: 'meeting' as CalendarEvent['type'], start: draft?.start ?? new Date().toISOString(),
        end: draft?.end ?? new Date(Date.now() + 36e5).toISOString(), allDay: draft?.allDay ?? false,
        clientId: '', projectId: '', location: '', meetingLink: '', description: '', attendeeIds: [] as string[],
        reminderMinutes: 15, visibility: 'internal' as const,
        recurrence: 'none' as const, recurrenceUntil: '', invitedEmails: [] as string[], notes: '',
      };
      const sp = parts(init.start);
      const ep = parts(init.end);
      return {
        title: init.title,
        type: init.type,
        startDate: sp.date,
        startTime: sp.time,
        endDate: ep.date,
        endTime: ep.time,
        allDay: init.allDay,
        clientId: init.clientId ?? '',
        projectId: init.projectId ?? '',
        location: init.location ?? '',
        meetingLink: init.meetingLink ?? '',
        description: init.description ?? '',
        attendeeIds: init.attendeeIds ?? [],
        reminderMinutes: String(init.reminderMinutes ?? 15),
        visibility: init.visibility ?? 'internal',
        recurrence: init.recurrence ?? 'none',
        recurrenceUntil: init.recurrenceUntil ? parts(init.recurrenceUntil).date : '',
        invitedEmails: (init.invitedEmails ?? []).join(', '),
        notes: init.notes ?? '',
      };
    },
    [draft?.allDay, draft?.end, draft?.start, existing],
  );

  const [form, setForm] = useState(initialForm);
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!draft) return;
    setForm(initialForm);
  }, [draft, initialForm]);

  const buildPayload = (): Partial<CalendarEvent> => ({
    title: form.title || 'Evento', type: form.type,
    start: combine(form.startDate, form.allDay ? '00:00' : form.startTime),
    end: combine(form.endDate || form.startDate, form.allDay ? '23:59' : form.endTime),
    allDay: form.allDay, clientId: form.clientId || null, projectId: form.projectId || null,
    location: form.location, meetingLink: form.meetingLink, description: form.description,
    attendeeIds: form.attendeeIds, reminderMinutes: Number(form.reminderMinutes) || 0, visibility: form.visibility,
    recurrence: form.recurrence,
    recurrenceUntil: form.recurrenceUntil ? combine(form.recurrenceUntil, '23:59') : null,
    invitedEmails: form.invitedEmails.split(',').map((email) => email.trim()).filter(Boolean),
    notes: form.notes,
  });

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Titolo obbligatorio'); return; }
    if (editing && existing) { await update.mutateAsync({ id: existing.id, patch: buildPayload() }); toast.success('Evento aggiornato'); }
    else { await create.mutateAsync(buildPayload()); toast.success('Evento creato'); }
    onClose();
  };
  const duplicate = async () => { await create.mutateAsync(buildPayload()); toast.success('Evento duplicato'); onClose(); };
  const del = async () => { if (existing) { await remove.mutateAsync(existing.id); toast.success('Evento eliminato'); onClose(); } };

  const toggleAttendee = (id: string) => set('attendeeIds', form.attendeeIds.includes(id) ? form.attendeeIds.filter((x) => x !== id) : [...form.attendeeIds, id]);

  return (
    <>
      <Modal
        open={!!draft}
        onClose={onClose}
        title={editing ? 'Modifica evento' : 'Nuovo evento'}
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between">
            {editing ? <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)}>Elimina</Button> : <span />}
            <div className="flex gap-2">
              {editing && <Button variant="secondary" size="sm" onClick={duplicate}><Copy className="h-4 w-4" /> Duplica</Button>}
              <Button variant="ghost" onClick={onClose}>Annulla</Button>
              <Button onClick={submit} loading={create.isPending || update.isPending}>{editing ? 'Salva' : 'Crea'}</Button>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Titolo" className="col-span-2"><Input value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus placeholder="Es. Call con cliente" /></Field>
          <Field label="Tipo"><Select value={form.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
          <Field label="Visibilità"><Select value={form.visibility} onChange={(e) => set('visibility', e.target.value)}><option value="internal">Interna</option><option value="team">Team</option><option value="client">Cliente</option></Select></Field>

          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} className="accent-accent" /> Tutto il giorno</label>

          <Field label="Data inizio"><Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
          {!form.allDay && <Field label="Ora inizio"><Input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} /></Field>}
          <Field label="Data fine"><Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
          {!form.allDay && <Field label="Ora fine"><Input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} /></Field>}

          <Field label="Cliente"><Select value={form.clientId} onChange={(e) => set('clientId', e.target.value)}><option value="">—</option>{(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}</Select></Field>
          <Field label="Progetto"><Select value={form.projectId} onChange={(e) => set('projectId', e.target.value)}><option value="">—</option>{(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Ricorrenza"><Select value={form.recurrence} onChange={(e) => set('recurrence', e.target.value)}>{RECURRENCES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select></Field>
          <Field label="Fine ricorrenza"><Input type="date" value={form.recurrenceUntil} onChange={(e) => set('recurrenceUntil', e.target.value)} disabled={form.recurrence === 'none'} /></Field>
          <Field label="Luogo"><Input value={form.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="Meeting link"><Input value={form.meetingLink} onChange={(e) => set('meetingLink', e.target.value)} placeholder="https://…" /></Field>
          <Field label="Invitati esterni" className="col-span-2"><Input value={form.invitedEmails} onChange={(e) => set('invitedEmails', e.target.value)} placeholder="email@cliente.it, studio@partner.it" /></Field>

          <div className="col-span-2">
            <p className="mb-1.5 text-xs font-medium text-fg-subtle">Partecipanti</p>
            <div className="flex flex-wrap gap-1.5">
              {(members ?? []).filter((m) => m.role !== 'client').map((m) => {
                const active = form.attendeeIds.includes(m.id);
                return <button key={m.id} onClick={() => toggleAttendee(m.id)} className={`rounded-full border px-2 py-1 text-xs ${active ? 'border-accent/40 bg-accent/10 text-fg' : 'border-border text-fg-subtle hover:bg-surface-2'}`}>{m.firstName}</button>;
              })}
            </div>
          </div>

          <Field label="Promemoria"><Select value={form.reminderMinutes} onChange={(e) => set('reminderMinutes', e.target.value)}><option value="0">Nessuno</option><option value="15">15 min prima</option><option value="30">30 min prima</option><option value="60">1 ora prima</option><option value="1440">1 giorno prima</option></Select></Field>
          <Field label="Descrizione" className="col-span-2"><Textarea value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Note operative" className="col-span-2"><Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Brief, contesto o follow-up interni" /></Field>
        </div>
      </Modal>
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={del} title="Elimina evento" message="Eliminare questo evento?" confirmLabel="Elimina" danger />
    </>
  );
}
