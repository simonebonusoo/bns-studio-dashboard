import { env } from '@/config/env';
import {
  format,
  formatDistanceToNow,
  isValid,
  parseISO,
  differenceInCalendarDays,
} from 'date-fns';
import { it } from 'date-fns/locale';

const currencyFmt = new Intl.NumberFormat(env.locale, {
  style: 'currency',
  currency: env.currency,
  maximumFractionDigits: 2,
});

const numberFmt = new Intl.NumberFormat(env.locale);

export const formatCurrency = (value: number): string => currencyFmt.format(value ?? 0);

export const formatNumber = (value: number): string => numberFmt.format(value ?? 0);

export const formatPercent = (value: number, digits = 0): string =>
  `${(value ?? 0).toLocaleString(env.locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

export const formatDate = (value?: string | Date | null, pattern = 'dd MMM yyyy'): string => {
  const d = toDate(value);
  return d ? format(d, pattern, { locale: it }) : '—';
};

export const formatDateTime = (value?: string | Date | null): string =>
  formatDate(value, 'dd MMM yyyy, HH:mm');

export const formatRelative = (value?: string | Date | null): string => {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true, locale: it }) : '—';
};

/** Giorni rimanenti (negativo = scaduto). */
export const daysUntil = (value?: string | Date | null): number | null => {
  const d = toDate(value);
  return d ? differenceInCalendarDays(d, new Date()) : null;
};

export const formatHours = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export const initials = (first?: string, last?: string, fallback = '?'): string => {
  const a = (first ?? '').trim()[0] ?? '';
  const b = (last ?? '').trim()[0] ?? '';
  return (a + b).toUpperCase() || fallback;
};
