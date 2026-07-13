/**
 * Espansione delle ricorrenze eventi (§21). Ricorrenza semplice persistita in
 * `recurrence` + `recurrence_interval` + `recurrence_until` (niente "ricorrente:
 * true" finto): da un evento master si derivano le occorrenze visibili in un
 * intervallo, senza materializzarle a DB.
 *
 * Le occorrenze hanno id sintetico `${id}::occurrence::${ISO}` così la UI può
 * risalire all'evento master (per "modifica serie") e distinguere le repliche.
 */
import type { CalendarEvent } from '@/types';

export const OCCURRENCE_SEPARATOR = '::occurrence::';

/** true se l'id appartiene a un'occorrenza derivata (non al master). */
export function isOccurrenceId(id: string): boolean {
  return id.includes(OCCURRENCE_SEPARATOR);
}

/** Estrae l'id dell'evento master da un id occorrenza (o ritorna l'id stesso). */
export function masterEventId(id: string): string {
  return id.split(OCCURRENCE_SEPARATOR)[0];
}

function addStep(date: Date, recurrence: NonNullable<CalendarEvent['recurrence']>): Date {
  const next = new Date(date);
  switch (recurrence) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

/** Limite difensivo di occorrenze per evento (evita loop su input malformati). */
const MAX_OCCURRENCES = 366;

/**
 * Espande un evento nelle sue occorrenze dentro [rangeStart, rangeEnd].
 * L'evento originale è incluso se cade nel range. Eventi senza ricorrenza
 * ritornano al più se stessi.
 */
export function expandEvent(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEvent[] {
  const recurrence = event.recurrence ?? 'none';
  const start = new Date(event.start);
  const end = new Date(event.end);
  const durationMs = Math.max(0, end.getTime() - start.getTime());

  const inRange = (s: Date) => s >= rangeStart && s <= rangeEnd;

  if (recurrence === 'none') {
    return inRange(start) ? [event] : [];
  }

  const until = event.recurrenceUntil ? new Date(event.recurrenceUntil) : null;
  if (until) until.setHours(23, 59, 59, 999);

  const out: CalendarEvent[] = [];
  let cursor = new Date(start);
  for (let i = 0; i < MAX_OCCURRENCES; i++) {
    if (cursor > rangeEnd) break;
    if (until && cursor > until) break;
    if (inRange(cursor)) {
      const occStart = new Date(cursor);
      const occEnd = new Date(cursor.getTime() + durationMs);
      const isMaster = occStart.getTime() === start.getTime();
      out.push({
        ...event,
        id: isMaster ? event.id : `${event.id}${OCCURRENCE_SEPARATOR}${occStart.toISOString()}`,
        start: occStart.toISOString(),
        end: occEnd.toISOString(),
      });
    }
    cursor = addStep(cursor, recurrence);
  }
  return out;
}

/** Espande una lista di eventi in occorrenze dentro il range dato. */
export function expandEvents(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): CalendarEvent[] {
  return events.flatMap((event) => expandEvent(event, rangeStart, rangeEnd));
}
