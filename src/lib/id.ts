import { nanoid } from 'nanoid';

/** UUID-like id per entità demo (in produzione lo genera Postgres). */
export const uid = (): string => nanoid(16);

export const nowISO = (): string => new Date().toISOString();

export const todayISO = (): string => new Date().toISOString().slice(0, 10);
