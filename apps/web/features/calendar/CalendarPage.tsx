import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addWeeks, addMonths,
  format, isSameMonth, isSameDay, parseISO, differenceInCalendarDays,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, Flag, MapPin, Pencil, Plus, Repeat2, Trash2, Users, Video, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useList, useRemove, useUpdate } from '@/hooks/useEntities';
import { EventFormModal, type EventDraft } from './EventFormModal';
import { cn } from '@/lib/cn';
import { expandEvents, isOccurrenceId, masterEventId } from '@/lib/recurrence';
import { formatDate, formatDateTime } from '@/lib/format';
import type { CalendarEvent, Client, Member, Milestone, Project } from '@/types';
import { toast } from 'sonner';

type View = 'month' | 'week' | 'day' | 'agenda';

const TYPE_COLORS: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  meeting: { dot: '#6366f1', bg: 'rgba(99,102,241,.10)', border: 'rgba(99,102,241,.24)', text: '#4338ca' },
  client_call: { dot: '#0ea5e9', bg: 'rgba(14,165,233,.11)', border: 'rgba(14,165,233,.24)', text: '#0369a1' },
  project_deadline: { dot: '#e11d48', bg: 'rgba(225,29,72,.10)', border: 'rgba(225,29,72,.24)', text: '#be123c' },
  deadline: { dot: '#e11d48', bg: 'rgba(225,29,72,.10)', border: 'rgba(225,29,72,.24)', text: '#be123c' },
  work: { dot: '#0f766e', bg: 'rgba(15,118,110,.10)', border: 'rgba(15,118,110,.24)', text: '#0f766e' },
  administration: { dot: '#b45309', bg: 'rgba(180,83,9,.10)', border: 'rgba(180,83,9,.24)', text: '#92400e' },
  personal: { dot: '#16a34a', bg: 'rgba(22,163,74,.10)', border: 'rgba(22,163,74,.24)', text: '#15803d' },
  time_off: { dot: '#16a34a', bg: 'rgba(22,163,74,.10)', border: 'rgba(22,163,74,.24)', text: '#15803d' },
  task: { dot: '#64748b', bg: 'rgba(100,116,139,.10)', border: 'rgba(100,116,139,.22)', text: '#475569' },
  milestone: { dot: '#84a50f', bg: 'rgba(132,165,15,.12)', border: 'rgba(132,165,15,.28)', text: '#657d0c' },
  lead_followup: { dot: '#7c3aed', bg: 'rgba(124,58,237,.10)', border: 'rgba(124,58,237,.22)', text: '#6d28d9' },
  estimate_due: { dot: '#0891b2', bg: 'rgba(8,145,178,.10)', border: 'rgba(8,145,178,.22)', text: '#0e7490' },
  invoice_due: { dot: '#c2410c', bg: 'rgba(194,65,12,.10)', border: 'rgba(194,65,12,.22)', text: '#9a3412' },
  payment_due: { dot: '#ca8a04', bg: 'rgba(202,138,4,.11)', border: 'rgba(202,138,4,.24)', text: '#a16207' },
  custom: { dot: '#71717a', bg: 'rgba(113,113,122,.10)', border: 'rgba(113,113,122,.22)', text: '#52525b' },
};

const TYPE_LABELS: Record<string, string> = {
  task: 'Task',
  milestone: 'Milestone',
  meeting: 'Riunione',
  client_call: 'Call cliente',
  project_deadline: 'Scadenza progetto',
  deadline: 'Deadline',
  work: 'Lavoro operativo',
  administration: 'Amministrazione',
  personal: 'Personale',
  time_off: 'Assenza / ferie',
  lead_followup: 'Follow-up lead',
  estimate_due: 'Scadenza preventivo',
  invoice_due: 'Scadenza fattura',
  payment_due: 'Scadenza pagamento',
  custom: 'Altro',
};

const EVENT_TYPES = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));
const FALLBACK_TYPE = TYPE_COLORS.custom;

const RECURRENCE_LABELS: Record<string, string> = {
  none: 'Non ricorrente',
  daily: 'Giornaliera',
  weekly: 'Settimanale',
  monthly: 'Mensile',
  yearly: 'Annuale',
};

interface CalItem {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  colorBg: string;
  colorBorder: string;
  colorText: string;
  kind: 'event' | 'milestone';
  type?: string;
  typeLabel: string;
  time?: string;
  link?: string;
  /** true se è un'occorrenza derivata di una serie ricorrente (non il master). */
  occurrence?: boolean;
  occurrenceStart?: string;
  occurrenceEnd?: string;
}

export default function CalendarPage() {
  const { data: events, isLoading } = useList<CalendarEvent>('events');
  const { data: milestones } = useList<Milestone>('milestones');
  const { data: clients } = useList<Client>('clients');
  const { data: projects } = useList<Project>('projects');
  const { data: members } = useList<Member>('members');
  const updateEvent = useUpdate<CalendarEvent>('events');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(new Date());
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState<{ start: string; end: string; occurrence: boolean } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  useEffect(() => {
    if (params.get('new') !== '1') return;
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);
    setDraft({ start: start.toISOString(), end: end.toISOString(), allDay: false });
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
  }, [params, setParams]);

  // Intervallo visibile per la vista corrente: le ricorrenze vengono espanse
  // solo dentro questo range (§21), senza materializzarle a DB.
  const [rangeStart, rangeEnd] = useMemo((): [Date, Date] => {
    if (view === 'month') {
      return [startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })];
    }
    if (view === 'week') {
      return [startOfWeek(cursor, { weekStartsOn: 1 }), endOfWeek(cursor, { weekStartsOn: 1 })];
    }
    if (view === 'day') {
      const s = new Date(cursor); s.setHours(0, 0, 0, 0);
      const e = new Date(cursor); e.setHours(23, 59, 59, 999);
      return [s, e];
    }
    // agenda: prossimi 90 giorni
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = addDays(s, 90); e.setHours(23, 59, 59, 999);
    return [s, e];
  }, [view, cursor]);

  const items: CalItem[] = useMemo(() => {
    const evs: CalItem[] = expandEvents(events ?? [], rangeStart, rangeEnd)
      .filter((event) => typeFilter.length === 0 || typeFilter.includes(event.type))
      .map((e) => {
        const palette = TYPE_COLORS[e.type] ?? FALLBACK_TYPE;
        return {
          id: e.id, title: e.title, start: e.start, end: e.end, allDay: e.allDay,
          color: palette.dot, colorBg: palette.bg, colorBorder: palette.border, colorText: palette.text,
          kind: 'event', type: e.type, typeLabel: TYPE_LABELS[e.type] ?? e.type, time: format(parseISO(e.start), 'HH:mm'),
          occurrence: isOccurrenceId(e.id), occurrenceStart: e.start, occurrenceEnd: e.end,
        };
      });
    const ms: CalItem[] = (milestones ?? []).filter((m) => m.dueDate && m.status !== 'completed').map((m) => ({
      id: `ms-${m.id}`, title: m.title, start: m.dueDate!, end: m.dueDate!, allDay: true,
      color: '#84a50f', colorBg: 'rgba(132,165,15,.10)', colorBorder: 'rgba(132,165,15,.28)', colorText: '#657d0c',
      kind: 'milestone', typeLabel: 'Milestone', link: `/projects/${m.projectId}`,
    }));
    return [...evs, ...ms];
  }, [events, milestones, rangeStart, rangeEnd, typeFilter]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    expandEvents(events ?? [], rangeStart, rangeEnd).forEach((event) => counts.set(event.type, (counts.get(event.type) ?? 0) + 1));
    return counts;
  }, [events, rangeStart, rangeEnd]);

  const itemsOn = (day: Date) => items.filter((i) => isSameDay(parseISO(i.start), day)).sort((a, b) => a.start < b.start ? -1 : 1);

  const openItem = (item: CalItem) => {
    // Le occorrenze derivate aprono il dettaglio dell'evento master della serie.
    if (item.kind === 'event') {
      setSelectedEventId(masterEventId(item.id));
      setSelectedOccurrence({ start: item.occurrenceStart ?? item.start, end: item.occurrenceEnd ?? item.end, occurrence: !!item.occurrence });
    }
    else if (item.link) navigate(item.link);
  };

  const createAt = (day: Date, hour?: number) => {
    const start = new Date(day);
    start.setHours(hour ?? 9, 0, 0, 0);
    const end = new Date(start.getTime() + 36e5);
    setDraft({ start: start.toISOString(), end: end.toISOString(), allDay: hour === undefined && view === 'month' });
  };

  const dropOnDay = async (day: Date) => {
    if (!dragId) return;
    const ev = (events ?? []).find((e) => e.id === dragId);
    setDragId(null);
    if (!ev) return;
    const oldStart = parseISO(ev.start);
    const delta = differenceInCalendarDays(day, oldStart);
    if (delta === 0) return;
    await updateEvent.mutateAsync({ id: ev.id, patch: { start: addDays(parseISO(ev.start), delta).toISOString(), end: addDays(parseISO(ev.end), delta).toISOString() } });
  };

  const title = view === 'month' ? format(cursor, 'MMMM yyyy', { locale: it })
    : view === 'week' ? `Settimana del ${format(startOfWeek(cursor, { weekStartsOn: 1 }), 'd MMM', { locale: it })}`
    : view === 'day' ? format(cursor, 'EEEE d MMMM', { locale: it })
    : 'Agenda';
  const step = (dir: number) => setCursor((c) => view === 'month' ? addMonths(c, dir) : view === 'week' ? addWeeks(c, dir) : addDays(c, dir));

  if (isLoading) return <LoadingState />;

  return (
    <div className="flex min-h-full flex-col gap-4 md:h-full md:overflow-hidden">
      <PageHeader
        title="Calendario"
        description="Eventi e milestone operative"
        actions={<Button onClick={() => createAt(view === 'agenda' ? new Date() : cursor)}><Plus className="h-4 w-4" /> Nuovo evento</Button>}
      />

      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>Oggi</Button>
          <Button variant="ghost" size="icon" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-40 text-center text-lg font-semibold capitalize tracking-normal">{title}</span>
          <Button variant="ghost" size="icon" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex rounded-full border border-border bg-surface p-0.5 shadow-card">
          {(['month', 'week', 'day', 'agenda'] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn('rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors', view === v ? 'bg-fg text-bg shadow-card' : 'text-fg-subtle hover:text-fg')}>
              {v === 'month' ? 'Mese' : v === 'week' ? 'Settimana' : v === 'day' ? 'Giorno' : 'Agenda'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
        <FilterChip
          active={typeFilter.length === 0}
          label="Tutti"
          count={Array.from(typeCounts.values()).reduce((sum, count) => sum + count, 0)}
          onClick={() => setTypeFilter([])}
        />
        {EVENT_TYPES.filter((type) => (typeCounts.get(type.value) ?? 0) > 0).map((type) => {
          const active = typeFilter.includes(type.value);
          const palette = TYPE_COLORS[type.value] ?? FALLBACK_TYPE;
          return (
            <FilterChip
              key={type.value}
              active={active}
              label={type.label}
              count={typeCounts.get(type.value) ?? 0}
              color={palette.dot}
              onClick={() => setTypeFilter((current) => active ? current.filter((value) => value !== type.value) : [...current, type.value])}
            />
          );
        })}
      </div>

      <div className="min-h-[520px] flex-1 md:min-h-0">
        {view === 'month' && <MonthView cursor={cursor} itemsOn={itemsOn} onCreate={createAt} onOpen={openItem} onDropDay={dropOnDay} setDragId={setDragId} />}
        {view === 'week' && <TimeGridView days={weekDays(cursor)} itemsOn={itemsOn} onCreate={createAt} onOpen={openItem} />}
        {view === 'day' && <TimeGridView days={[cursor]} itemsOn={itemsOn} onCreate={createAt} onOpen={openItem} />}
        {view === 'agenda' && <AgendaView items={items} onOpen={openItem} />}
      </div>

      <div className="shrink-0 flex flex-wrap gap-4 text-xs text-fg-subtle">
        <Legend color="#6366f1" label="Evento" icon={<Clock className="h-3 w-3" />} />
        <Legend color="#84a50f" label="Milestone" icon={<Flag className="h-3 w-3" />} />
      </div>

      <EventFormModal draft={draft} onClose={() => setDraft(null)} />
      <EventDetailDrawer
        event={(events ?? []).find((event) => event.id === selectedEventId)}
        occurrence={selectedOccurrence}
        clients={clients ?? []}
        projects={projects ?? []}
        members={members ?? []}
        onClose={() => { setSelectedEventId(null); setSelectedOccurrence(null); }}
        onEdit={(event) => {
          setSelectedEventId(null);
          setSelectedOccurrence(null);
          setDraft({ id: event.id, start: selectedOccurrence?.start ?? event.start, end: selectedOccurrence?.end ?? event.end, allDay: event.allDay });
        }}
      />
    </div>
  );
}

function FilterChip({ active, label, count, color, onClick }: { active: boolean; label: string; count: number; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
        active ? 'border-border-strong bg-surface-2 text-fg shadow-card' : 'border-border bg-surface text-fg-subtle hover:border-border-strong hover:text-fg',
      )}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      <span>{label}</span>
      <span className="rounded-full bg-surface-2 px-1.5 text-2xs text-fg-faint">{count}</span>
    </button>
  );
}

function weekDays(cursor: Date): Date[] {
  const start = startOfWeek(cursor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function MonthView({ cursor, itemsOn, onCreate, onOpen, onDropDay, setDragId }: {
  cursor: Date; itemsOn: (d: Date) => CalItem[]; onCreate: (d: Date) => void;
  onOpen: (i: CalItem) => void; onDropDay: (d: Date) => void; setDragId: (id: string | null) => void;
}) {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  return (
    <Card className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl md:min-h-0">
      <div className="grid grid-cols-7 border-b border-border bg-surface-2/40 text-center text-2xs font-semibold uppercase text-fg-faint">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((d) => <div key={d} className="py-3">{d}</div>)}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-hidden">
        {days.map((day) => {
          const dayItems = itemsOn(day);
          const inMonth = isSameMonth(day, cursor);
          const today = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              onClick={() => onCreate(day)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropDay(day)}
              className={cn('group min-h-0 cursor-pointer overflow-hidden border-b border-r border-border p-2.5 transition-colors hover:bg-surface-2/60', !inMonth && 'bg-surface-2/25')}
            >
              <div className="flex items-center justify-between">
                <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-full text-sm', today && 'bg-fg font-semibold text-bg shadow-card', !inMonth && !today && 'text-fg-faint')}>
                  {format(day, 'd')}
                </span>
                <Plus className="h-3.5 w-3.5 text-fg-faint opacity-0 group-hover:opacity-100" />
              </div>
              <div className="mt-1 max-h-[calc(100%-2rem)] space-y-1 overflow-y-auto overscroll-contain pr-0.5">
                {dayItems.slice(0, 3).map((i) => (
                  <div
                    key={i.id}
                    draggable={i.kind === 'event' && !i.occurrence}
                    onDragStart={() => i.kind === 'event' && !i.occurrence && setDragId(i.id)}
                    onClick={(e) => { e.stopPropagation(); onOpen(i); }}
                    className={cn('flex items-center gap-1.5 truncate rounded-md border px-1.5 py-1 text-2xs transition-opacity hover:opacity-80', i.kind === 'event' && !i.occurrence ? 'cursor-grab' : 'cursor-pointer')}
                    style={{ backgroundColor: i.colorBg, borderColor: i.colorBorder, color: i.colorText }}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: i.color }} />
                    {i.kind === 'event' && i.time && <span className="font-medium">{i.time}</span>}
                    <span className="truncate">{i.title}</span>
                    {i.occurrence && <Repeat2 className="h-2.5 w-2.5 shrink-0 opacity-70" />}
                  </div>
                ))}
                {dayItems.length > 3 && <p className="px-1 text-2xs text-fg-faint">+{dayItems.length - 3}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TimeGridView({ days, itemsOn, onCreate, onOpen }: {
  days: Date[]; itemsOn: (d: Date) => CalItem[]; onCreate: (d: Date, h: number) => void; onOpen: (i: CalItem) => void;
}) {
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 07–20
  return (
    <Card className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl md:min-h-0">
      <div className="grid border-b border-border bg-surface-2/40" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div />
        {days.map((d) => {
          const today = isSameDay(d, new Date());
          return <div key={d.toISOString()} className="border-l border-border py-2 text-center"><p className="text-2xs uppercase text-fg-faint">{format(d, 'EEE', { locale: it })}</p><p className={cn('mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold', today && 'bg-fg text-bg')}>{format(d, 'd')}</p></div>;
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {hours.map((h) => (
          <div key={h} className="grid border-b border-border/60" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
            <div className="py-3 pr-2 text-right text-2xs text-fg-faint">{String(h).padStart(2, '0')}:00</div>
            {days.map((d) => {
              const slotItems = itemsOn(d).filter((i) => !i.allDay && new Date(i.start).getHours() === h);
              return (
                <div key={d.toISOString()} onClick={() => onCreate(d, h)} className="min-h-12 cursor-pointer border-l border-border p-1 hover:bg-surface-2/50">
                  {slotItems.map((i) => (
                    <div key={i.id} onClick={(e) => { e.stopPropagation(); onOpen(i); }} className="mb-1 truncate rounded-md border px-2 py-1 text-2xs shadow-card" style={{ backgroundColor: i.colorBg, borderColor: i.colorBorder, color: i.colorText }}>
                      <span className="font-medium">{i.time}</span> {i.title}
                      {i.occurrence && <Repeat2 className="ml-1 inline h-2.5 w-2.5" />}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}

function AgendaView({ items, onOpen }: { items: CalItem[]; onOpen: (i: CalItem) => void }) {
  const upcoming = items.filter((i) => new Date(i.start) >= new Date(new Date().setHours(0, 0, 0, 0))).sort((a, b) => a.start < b.start ? -1 : 1).slice(0, 40);
  const groups = upcoming.reduce<Record<string, CalItem[]>>((acc, i) => {
    const key = format(parseISO(i.start), 'EEEE d MMMM', { locale: it });
    (acc[key] ??= []).push(i);
    return acc;
  }, {});
  if (upcoming.length === 0) return <EmptyCalendarState />;
  return (
    <div className="max-h-full space-y-4 overflow-y-auto overscroll-contain pr-1">
      {Object.entries(groups).map(([day, dayItems]) => (
        <div key={day}>
          <p className="mb-1.5 text-xs font-semibold uppercase capitalize text-fg-faint">{day}</p>
          <Card className="divide-y divide-border overflow-hidden rounded-2xl">
            {dayItems.map((i) => (
              <button key={i.id} onClick={() => onOpen(i)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: i.color }} />
                <span className="w-14 shrink-0 text-sm text-fg-subtle">{i.allDay ? 'Tutto il g.' : i.time}</span>
                <span className="flex-1 truncate text-sm font-medium">{i.title}</span>
                <span className="text-2xs text-fg-faint">{i.typeLabel}</span>
              </button>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}

function EmptyCalendarState() {
  return (
    <Card className="flex h-full min-h-[360px] items-center justify-center rounded-2xl px-6 py-12 text-center">
      <div className="max-w-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-fg-subtle">
          <CalendarDays className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-fg">Agenda libera</h3>
        <p className="mt-1 text-sm text-fg-subtle">Non ci sono eventi nel periodo selezionato. Puoi pianificare una nuova attività dal calendario.</p>
      </div>
    </Card>
  );
}

function Legend({ color, label, icon }: { color: string; label: string; icon: React.ReactNode }) {
  return <span className="flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded" style={{ backgroundColor: `${color}33`, color }}>{icon}</span>{label}</span>;
}

function EventDetailDrawer({
  event,
  occurrence,
  clients,
  projects,
  members,
  onClose,
  onEdit,
}: {
  event?: CalendarEvent;
  occurrence: { start: string; end: string; occurrence: boolean } | null;
  clients: Client[];
  projects: Project[];
  members: Member[];
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
}) {
  const remove = useRemove('events');
  const [confirmDel, setConfirmDel] = useState(false);
  const client = event?.clientId ? clients.find((item) => item.id === event.clientId) : undefined;
  const project = event?.projectId ? projects.find((item) => item.id === event.projectId) : undefined;
  const attendees = (event?.attendeeIds ?? [])
    .map((id) => members.find((member) => member.id === id))
    .filter(Boolean) as Member[];
  const recurrence = event?.recurrence ?? 'none';
  const visibleStart = occurrence?.start ?? event?.start;
  const visibleEnd = occurrence?.end ?? event?.end;

  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [event, onClose]);

  const del = async () => {
    if (!event) return;
    await remove.mutateAsync(event.id);
    toast.success(recurrence === 'none' ? 'Evento eliminato' : 'Serie evento eliminata');
    onClose();
  };

  return (
    <>
      {event ? (
        <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/20 p-3 animate-overlay-in sm:p-6" role="presentation">
          <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Chiudi dettaglio evento" />
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-event-title"
            className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl animate-scale-in flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-pop sm:max-h-[calc(100dvh-3rem)]"
          >
            <header className="shrink-0 border-b border-border px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge tone="accent">{TYPE_LABELS[event.type] ?? event.type}</Badge>
                    <Badge tone={event.visibility === 'client' ? 'info' : event.visibility === 'team' ? 'success' : 'neutral'}>
                      {event.visibility === 'client' ? 'Cliente' : event.visibility === 'team' ? 'Team' : 'Interno'}
                    </Badge>
                    {recurrence !== 'none' && <Badge tone="warning"><Repeat2 className="h-3 w-3" /> {RECURRENCE_LABELS[recurrence] ?? recurrence}</Badge>}
                    {occurrence?.occurrence && <Badge tone="neutral">Occorrenza</Badge>}
                  </div>
                  <h2 id="calendar-event-title" className="truncate text-xl font-semibold text-fg">{event.title}</h2>
                  {visibleStart && visibleEnd && (
                    <p className="mt-1 text-sm text-fg-subtle">
                      {event.allDay ? `${formatDate(visibleStart)} · tutto il giorno` : `${formatDateTime(visibleStart)} → ${formatDateTime(visibleEnd)}`}
                    </p>
                  )}
                </div>
                <button onClick={onClose} className="press -mr-1 rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg" aria-label="Chiudi">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
              {occurrence?.occurrence && (
                <div className="rounded-xl border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-fg-subtle">
                  Questa è una occorrenza di una serie ricorrente. Modifica ed eliminazione agiscono sulla serie completa.
                </div>
              )}

              <div className="rounded-xl border border-border bg-surface-2/50 p-4">
                {visibleStart && visibleEnd && <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Quando" value={event.allDay ? `${formatDate(visibleStart)} · tutto il giorno` : `${formatDateTime(visibleStart)} → ${formatDateTime(visibleEnd)}`} />}
                {recurrence !== 'none' && <DetailRow icon={<Repeat2 className="h-4 w-4" />} label="Ricorrenza" value={`${RECURRENCE_LABELS[recurrence] ?? recurrence}${event.recurrenceUntil ? ` fino al ${formatDate(event.recurrenceUntil)}` : ''}`} />}
                {event.location && <DetailRow icon={<MapPin className="h-4 w-4" />} label="Luogo" value={event.location} />}
                {event.meetingLink && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2">
                    <span className="min-w-0 truncate text-sm text-fg-subtle"><Video className="mr-2 inline h-4 w-4" /> {event.meetingLink}</span>
                    <Button variant="secondary" size="sm" onClick={() => window.open(event.meetingLink, '_blank', 'noopener,noreferrer')}>
                      <ExternalLink className="h-4 w-4" /> Partecipa
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Cliente" value={client?.displayName ?? '—'} />
                <InfoCard label="Progetto" value={project?.name ?? '—'} />
              </div>

              <section>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-faint"><Users className="h-3.5 w-3.5" /> Partecipanti</p>
                <div className="flex flex-wrap gap-1.5">
                  {attendees.map((member) => <Badge key={member.id}>{member.firstName} {member.lastName}</Badge>)}
                  {(event.invitedEmails ?? []).map((email) => <Badge key={email} tone="info">{email}</Badge>)}
                  {attendees.length === 0 && (event.invitedEmails ?? []).length === 0 && <p className="text-sm text-fg-subtle">Nessun partecipante indicato</p>}
                </div>
              </section>

              {event.description && <TextBlock label="Descrizione" value={event.description} />}
              {event.notes && <TextBlock label="Note operative" value={event.notes} />}
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)}>
                <Trash2 className="h-4 w-4 text-danger" /> Elimina
              </Button>
              <div className="flex gap-2">
                {event.meetingLink && (
                  <Button variant="secondary" size="sm" onClick={() => window.open(event.meetingLink, '_blank', 'noopener,noreferrer')}>
                    <Video className="h-4 w-4" /> Partecipa
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => onEdit(event)}>
                  <Pencil className="h-4 w-4" /> {recurrence === 'none' ? 'Modifica' : 'Modifica serie'}
                </Button>
              </div>
            </footer>
          </article>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={del}
        title={recurrence === 'none' ? 'Elimina evento' : 'Elimina serie evento'}
        message={recurrence === 'none' ? 'Eliminare questo evento?' : 'Eliminare questa serie ricorrente?'}
        confirmLabel="Elimina"
        danger
      />
    </>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="mt-0.5 text-fg-faint">{icon}</span>
      <div>
        <p className="text-2xs font-semibold uppercase tracking-wide text-fg-faint">{label}</p>
        <p className="text-fg">{value}</p>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-2xs font-semibold uppercase tracking-wide text-fg-faint">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <section>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-faint">{label}</p>
      <p className="whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg-subtle">{value}</p>
    </section>
  );
}
