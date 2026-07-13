import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { repositories, store } = vi.hoisted(() => {
  const store = {
    projects: [] as Record<string, unknown>[],
    invoices: [] as Record<string, unknown>[],
    payments: [] as Record<string, unknown>[],
    transactions: [] as Record<string, unknown>[],
    services: [] as Record<string, unknown>[],
    timeEntries: [] as Record<string, unknown>[],
    members: [] as Record<string, unknown>[],
    estimates: [] as Record<string, unknown>[],
  };

  const repo = (name: keyof typeof store) => ({
    list: vi.fn(async () => store[name]),
  });

  return {
    store,
    repositories: {
      projects: repo('projects'),
      invoices: repo('invoices'),
      payments: repo('payments'),
      transactions: repo('transactions'),
      services: repo('services'),
      timeEntries: repo('timeEntries'),
      members: repo('members'),
      estimates: repo('estimates'),
    },
  };
});

vi.mock('@/services/repository', () => ({ repositories }));

import { getAnalytics } from '@/services/analytics';

describe('analytics cashflow source of truth', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T10:00:00.000Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('usa le transactions per i ricavi incassati senza sommare anche i payments completati', async () => {
    store.payments.push({
      id: 'pay-1',
      organizationId: 'org-1',
      amount: 1000,
      currency: 'EUR',
      date: '2026-07-10',
      method: 'bank_transfer',
      status: 'completed',
      createdAt: '',
      updatedAt: '',
    });
    store.transactions.push({
      id: 'txn-1',
      organizationId: 'org-1',
      type: 'income',
      category: 'Pagamento cliente',
      description: 'Pagamento automatico',
      amount: 1000,
      currency: 'EUR',
      date: '2026-07-10',
      sourceType: 'payment',
      sourceId: 'pay-1',
      automatic: true,
      createdAt: '',
      updatedAt: '',
    });

    const analytics = await getAnalytics();

    expect(analytics.summary.income).toBe(1000);
    expect(analytics.summary.profit).toBe(1000);
    expect(analytics.monthly.find((point) => point.ricavi === 1000)).toBeTruthy();
    expect(analytics.monthly.every((point) => point.ricavi !== 2000)).toBe(true);
  });
});
