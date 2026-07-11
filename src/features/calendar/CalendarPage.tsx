import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addWeeks, addMonths,
  format, isSameMonth, isSameDay, parseISO, differenceInCalendarDays,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Clock, ListChecks, Flag } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/States';
import { useList, useUpdate } from '@/hooks/useEntities';
import { EventFormModal, type EventDraft } from './EventFormModal';
import { cn } from '@/lib/cn';
import type { CalendarEvent, Task, Milestone } from '@/types';

type View = 'month' | 'week' | 'day' | 'agenda';

const TYPE_COLORS: Record<string, string> = {
  client_call: '#3b76d6', meeting: '#9b5de5', lead_followup: '#e07b39',
  project_deadline: '#f24e6b', time_off: '#22a05a', custom: '#71717a',
};

interface CalItem {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  kind: 'event' | 'task' | 'milestone';
  time?: string;
  link?: string;
}

export default function CalendarPage() {
  const { data: events, isLoading } = useList<CalendarEvent>('events');
  const { data: tasks } = useList<Task>('tasks');
  const { data: milestones } = useList<Milestone>('milestones');
  const updateEvent = useUpdate<CalendarEvent>('events');
  const navigate = useNavigate();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(new Date());
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const items: CalItem[] = useMemo(() => {
    const evs: CalItem[] = (events ?? []).map((e) => ({
      id: e.id, title: e.title, start: e.start, end: e.end, allDay: e.allDay,
      color: TYPE_COLORS[e.type] ?? '#71717a', kind: 'event', time: format(parseISO(e.start), 'HH:mm'),
    }));
    const tks: CalItem[] = (tasks ?? []).filter((t) => t.dueDate && t.status !== 'completed' && t.status !== 'cancelled').map((t) => ({
      id: `task-${t.id}`, title: t.title, start: t.dueDate!, end: t.dueDate!, allDay: true, color: '#a1a1aa', kind: 'task', link: '/tasks',
    }));
    const ms: CalItem[] = (milestones ?? []).filter((m) => m.dueDate && m.status !== 'completed').map((m) => ({
      id: `ms-${m.id}`, title: m.title, start: m.dueDate!, end: m.dueDate!, allDay: true, color: '#b0d62e', kind: 'milestone', link: `/projects/${m.projectId}`,
    }));
    return [...evs, ...tks, ...ms];
  }, [events, tasks, milestones]);

  const itemsOn = (day: Date) => items.filter((i) => isSameDay(parseISO(i.start), day)).sort((a, b) => a.start < b.start ? -1 : 1);

  const openItem = (item: CalItem) => {
    if (item.kind === 'event') setDraft({ id: item.id, start: item.start, end: item.end });
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
    <div className="space-y-4">
      <PageHeader
        title="Calendario"
        description="Eventi, scadenze e attività"
        actions={<Button onClick={() => createAt(view === 'agenda' ? new Date() : cursor)}><Plus className="h-4 w-4" /> Nuovo evento</Button>}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>Oggi</Button>
          <Button variant="ghost" size="icon" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-40 text-center font-semibold capitalize">{title}</span>
          <Button variant="ghost" size="icon" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex rounded-lg border border-border p-0.5">
          {(['month', 'week', 'day', 'agenda'] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn('rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors', view === v ? 'bg-surface-2 text-fg' : 'text-fg-subtle hover:text-fg')}>
              {v === 'month' ? 'Mese' : v === 'week' ? 'Settimana' : v === 'day' ? 'Giorno' : 'Agenda'}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && <MonthView cursor={cursor} itemsOn={itemsOn} onCreate={createAt} onOpen={openItem} onDropDay={dropOnDay} setDragId={setDragId} />}
      {view === 'week' && <TimeGridView days={weekDays(cursor)} itemsOn={itemsOn} onCreate={createAt} onOpen={openItem} />}
      {view === 'day' && <TimeGridView days={[cursor]} itemsOn={itemsOn} onCreate={createAt} onOpen={openItem} />}
      {view === 'agenda' && <AgendaView items={items} onOpen={openItem} />}

      <div className="flex flex-wrap gap-4 text-xs text-fg-subtle">
        <Legend color="#9b5de5" label="Evento" icon={<Clock className="h-3 w-3" />} />
        <Legend color="#b0d62e" label="Milestone" icon={<Flag className="h-3 w-3" />} />
        <Legend color="#a1a1aa" label="Task in scadenza" icon={<ListChecks className="h-3 w-3" />} />
      </div>

      <EventFormModal draft={draft} onClose={() => setDraft(null)} />
    </div>
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
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border text-center text-2xs font-medium uppercase text-fg-faint">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
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
              className={cn('group min-h-28 cursor-pointer border-b border-r border-border p-1.5 transition-colors hover:bg-surface-2/50', !inMonth && 'bg-surface-2/30')}
            >
              <div className="flex items-center justify-between">
                <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs', today && 'bg-accent font-semibold text-accent-fg', !inMonth && !today && 'text-fg-faint')}>
                  {format(day, 'd')}
                </span>
                <Plus className="h-3.5 w-3.5 text-fg-faint opacity-0 group-hover:opacity-100" />
              </div>
              <div className="mt-1 space-y-1">
                {dayItems.slice(0, 3).map((i) => (
                  <div
                    key={i.id}
                    draggable={i.kind === 'event'}
                    onDragStart={() => i.kind === 'event' && setDragId(i.id)}
                    onClick={(e) => { e.stopPropagation(); onOpen(i); }}
                    className={cn('flex items-center gap-1 truncate rounded px-1 py-0.5 text-2xs transition-opacity hover:opacity-80', i.kind === 'event' ? 'cursor-grab' : 'cursor-pointer border-l-2')}
                    style={i.kind === 'event' ? { backgroundColor: `${i.color}22`, color: 'rgb(var(--fg))' } : { borderColor: i.color }}
                  >
                    {i.kind === 'milestone' && <Flag className="h-2.5 w-2.5 shrink-0" style={{ color: i.color }} />}
                    {i.kind === 'task' && <ListChecks className="h-2.5 w-2.5 shrink-0" style={{ color: i.color }} />}
                    {i.kind === 'event' && i.time && <span className="font-medium">{i.time}</span>}
                    <span className="truncate">{i.title}</span>
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
    <Card className="overflow-hidden">
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div />
        {days.map((d) => {
          const today = isSameDay(d, new Date());
          return <div key={d.toISOString()} className="border-l border-border py-2 text-center"><p className="text-2xs uppercase text-fg-faint">{format(d, 'EEE', { locale: it })}</p><p className={cn('text-sm font-semibold', today && 'text-accent')}>{format(d, 'd')}</p></div>;
        })}
      </div>
      <div className="max-h-[560px] overflow-y-auto">
        {hours.map((h) => (
          <div key={h} className="grid border-b border-border/60" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
            <div className="py-3 pr-2 text-right text-2xs text-fg-faint">{String(h).padStart(2, '0')}:00</div>
            {days.map((d) => {
              const slotItems = itemsOn(d).filter((i) => !i.allDay && new Date(i.start).getHours() === h);
              return (
                <div key={d.toISOString()} onClick={() => onCreate(d, h)} className="min-h-12 cursor-pointer border-l border-border p-1 hover:bg-surface-2/50">
                  {slotItems.map((i) => (
                    <div key={i.id} onClick={(e) => { e.stopPropagation(); onOpen(i); }} className="mb-1 truncate rounded px-1.5 py-1 text-2xs" style={{ backgroundColor: `${i.color}22` }}>
                      <span className="font-medium">{i.time}</span> {i.title}
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
  if (upcoming.length === 0) return <Card className="py-12 text-center text-sm text-fg-subtle">Nessun evento in programma</Card>;
  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([day, dayItems]) => (
        <div key={day}>
          <p className="mb-1.5 text-xs font-semibold uppercase capitalize text-fg-faint">{day}</p>
          <Card className="divide-y divide-border">
            {dayItems.map((i) => (
              <button key={i.id} onClick={() => onOpen(i)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: i.color }} />
                <span className="w-14 shrink-0 text-sm text-fg-subtle">{i.allDay ? 'Tutto il g.' : i.time}</span>
                <span className="flex-1 truncate text-sm font-medium">{i.title}</span>
                <span className="text-2xs text-fg-faint">{i.kind === 'event' ? 'Evento' : i.kind === 'milestone' ? 'Milestone' : 'Task'}</span>
              </button>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}

function Legend({ color, label, icon }: { color: string; label: string; icon: React.ReactNode }) {
  return <span className="flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded" style={{ backgroundColor: `${color}33`, color }}>{icon}</span>{label}</span>;
}
