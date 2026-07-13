import { uid } from '@/lib/id';
import {
  CLIENT_STATUS_MAP,
  CONTRACT_STATUS_MAP,
  ESTIMATE_STATUS_MAP,
  EVENT_TYPE_MAP,
  INVOICE_STATUS_MAP,
  MONTHS_IT,
  PAYMENT_METHOD_MAP,
  PAYMENT_STATUS_MAP,
  PRICE_UNIT_MAP,
  PRIORITY_MAP,
  PROJECT_STATUS_MAP,
} from './constants';

export function toTemporaryId() {
  return `imp_${uid()}`;
}

export function normalizeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[`"'*_[\]{}()]/g, ' ')
    .replace(/[^\p{L}\p{N}:/.-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeIdentity(value: string | null | undefined) {
  if (!value) return '';
  return normalizeLabel(value)
    .replace(/[:/.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeText(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = String(value)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/(^|[\s([{])[*_]{1,3}([^*_]+)[*_]{1,3}(?=$|[\s.,;:!?)}\]])/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/javascript:/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

export function extractWikiLinks(value: string) {
  return [...value.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => sanitizeText(match[1] ?? ''));
}

export function extractLinks(value: string) {
  return [...value.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((match) => sanitizeText(match[2] ?? ''));
}

export function parseItalianNumber(value: unknown) {
  const text = sanitizeText(value);
  if (!text) return undefined;
  const stripped = text.replace(/[^\d.,-]/g, '');
  if (!stripped) return undefined;

  let normalized = stripped;
  const hasComma = stripped.includes(',');
  const hasDot = stripped.includes('.');

  if (hasComma && hasDot) {
    normalized = stripped.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    const [left, right] = stripped.split(',');
    normalized = right && right.length <= 2
      ? `${left}.${right}`
      : stripped.replace(/,/g, '');
  } else if (hasDot) {
    const parts = stripped.split('.');
    normalized = parts.length > 1 && parts.slice(1).every((part) => part.length === 3)
      ? parts.join('')
      : stripped;
  }

  const result = Number(normalized);
  return Number.isFinite(result) ? result : undefined;
}

export function parseBooleanValue(value: unknown) {
  const normalized = normalizeIdentity(String(value ?? ''));
  if (!normalized) return undefined;
  if (['si', 'sì', 'yes', 'true', 'attivo', 'attiva', 'on', '1', 'pagato'].includes(normalized)) return true;
  if (['no', 'false', 'inattivo', 'inattiva', 'off', '0'].includes(normalized)) return false;
  return undefined;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function parseItalianDate(value: unknown, withTime = false) {
  const text = sanitizeText(value);
  if (!text) return undefined;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ t](\d{1,2}):(\d{2}))?$/i);
  if (isoMatch) {
    const [, year, month, day, hour, minute] = isoMatch;
    if (!withTime || !hour) return `${year}-${month}-${day}`;
    return `${year}-${month}-${day}T${pad(Number(hour))}:${minute}:00.000Z`;
  }

  const simpleMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (simpleMatch) {
    const [, day, month, year, hour, minute] = simpleMatch;
    if (!withTime || !hour) return `${year}-${pad(Number(month))}-${pad(Number(day))}`;
    return `${year}-${pad(Number(month))}-${pad(Number(day))}T${pad(Number(hour))}:${minute}:00.000Z`;
  }

  const namedMonth = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (namedMonth) {
    const [, day, monthName, year, hour, minute] = namedMonth;
    const month = MONTHS_IT[monthName];
    if (!month) return undefined;
    if (!withTime || !hour) return `${year}-${pad(month)}-${pad(Number(day))}`;
    return `${year}-${pad(month)}-${pad(Number(day))}T${pad(Number(hour))}:${minute}:00.000Z`;
  }

  return undefined;
}

export function normalizeStatusValue(kind: 'client' | 'project' | 'estimate' | 'contract' | 'invoice' | 'payment' | 'event', value: unknown) {
  const normalized = normalizeIdentity(String(value ?? ''));
  if (!normalized) return undefined;
  const map = {
    client: CLIENT_STATUS_MAP,
    project: PROJECT_STATUS_MAP,
    estimate: ESTIMATE_STATUS_MAP,
    contract: CONTRACT_STATUS_MAP,
    invoice: INVOICE_STATUS_MAP,
    payment: PAYMENT_STATUS_MAP,
    event: EVENT_TYPE_MAP,
  }[kind];
  return map[normalized];
}

export function normalizePriority(value: unknown) {
  const normalized = normalizeIdentity(String(value ?? ''));
  return normalized ? PRIORITY_MAP[normalized] : undefined;
}

export function normalizePriceUnit(value: unknown) {
  const normalized = normalizeIdentity(String(value ?? ''));
  return normalized ? PRICE_UNIT_MAP[normalized] : undefined;
}

export function normalizePaymentMethod(value: unknown) {
  const normalized = normalizeIdentity(String(value ?? ''));
  return normalized ? PAYMENT_METHOD_MAP[normalized] : undefined;
}

export function ensureArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => sanitizeText(item)).filter(Boolean);
  const text = sanitizeText(value);
  if (!text) return [];
  return text.split(',').map((item) => sanitizeText(item)).filter(Boolean);
}

export function toPlainObject(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, typeof entry === 'string' ? sanitizeText(entry) : entry]),
  );
}
