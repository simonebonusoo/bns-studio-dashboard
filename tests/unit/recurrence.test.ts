import { describe, it, expect } from 'vitest';
import { expandEvent, expandEvents, isOccurrenceId, masterEventId, OCCURRENCE_SEPARATOR } from '@/lib/recurrence';
import type { CalendarEvent } from '@/types';

const base = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'ev1',
  organizationId: 'org',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  title: 'Standup',
  type: 'meeting',
  start: '2026-08-03T09:00:00.000Z',
  end: '2026-08-03T09:30:00.000Z',
  allDay: false,
  ...over,
});

const range = (from: string, to: string): [Date, Date] => [new Date(from), new Date(to)];

describe('expandEvent', () => {
  it('evento senza ricorrenza → se stesso solo se nel range', () => {
    const ev = base({});
    const [s, e] = range('2026-08-01', '2026-08-31');
    expect(expandEvent(ev, s, e)).toHaveLength(1);
    const [s2, e2] = range('2026-09-01', '2026-09-30');
    expect(expandEvent(ev, s2, e2)).toHaveLength(0);
  });

  it('weekly: espande le occorrenze settimanali nel range', () => {
    const ev = base({ recurrence: 'weekly' });
    const [s, e] = range('2026-08-01', '2026-08-31T23:59:59.000Z');
    const occ = expandEvent(ev, s, e);
    // 3, 10, 17, 24, 31 agosto = 5 occorrenze
    expect(occ).toHaveLength(5);
    expect(occ[0].id).toBe('ev1'); // la prima è il master
    expect(isOccurrenceId(occ[1].id)).toBe(true);
    expect(masterEventId(occ[1].id)).toBe('ev1');
    // durata preservata (30 min)
    const d = new Date(occ[1].end).getTime() - new Date(occ[1].start).getTime();
    expect(d).toBe(30 * 60_000);
  });

  it('rispetta recurrence_until', () => {
    const ev = base({ recurrence: 'weekly', recurrenceUntil: '2026-08-10' });
    const [s, e] = range('2026-08-01', '2026-08-31');
    expect(expandEvent(ev, s, e)).toHaveLength(2); // 3 e 10 agosto
  });

  it('monthly: gestisce il passo mensile', () => {
    const ev = base({ recurrence: 'monthly', start: '2026-01-15T10:00:00.000Z', end: '2026-01-15T11:00:00.000Z' });
    const [s, e] = range('2026-01-01', '2026-04-30');
    expect(expandEvent(ev, s, e)).toHaveLength(4); // gen, feb, mar, apr
  });

  it('eventi che iniziano prima del range: mostra solo le occorrenze interne', () => {
    const ev = base({ recurrence: 'daily', start: '2026-07-30T08:00:00.000Z', end: '2026-07-30T09:00:00.000Z' });
    const [s, e] = range('2026-08-01T00:00:00.000Z', '2026-08-03T23:59:59.000Z');
    const occ = expandEvent(ev, s, e);
    expect(occ.length).toBeGreaterThanOrEqual(3);
    expect(occ.every((o) => new Date(o.start) >= s)).toBe(true);
  });

});

describe('expandEvents / helper id', () => {
  it('espande più eventi insieme', () => {
    const [s, e] = range('2026-08-01', '2026-08-31T23:59:59.000Z');
    const occ = expandEvents([base({}), base({ id: 'ev2', recurrence: 'weekly' })], s, e);
    expect(occ.filter((o) => masterEventId(o.id) === 'ev2')).toHaveLength(5);
  });

  it('id sintetici riconoscibili', () => {
    const synthetic = `abc${OCCURRENCE_SEPARATOR}2026-08-10T09:00:00.000Z`;
    expect(isOccurrenceId(synthetic)).toBe(true);
    expect(masterEventId(synthetic)).toBe('abc');
    expect(isOccurrenceId('abc')).toBe(false);
  });
});
