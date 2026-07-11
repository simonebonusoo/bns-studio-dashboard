import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type RepoRecord = Record<string, any>;

const { store, repositories, createOrder, resetMockState } = vi.hoisted(() => {
  const data: Record<string, RepoRecord[]> = {
    clients: [],
    services: [],
    projects: [],
    estimates: [],
    contracts: [],
    invoices: [],
    payments: [],
    transactions: [],
    events: [],
    markdownImports: [],
  };

  const order: string[] = [];
  let idCounter = 1;

  const nextId = (prefix: string) => {
    const id = `${prefix}-${idCounter}`;
    idCounter += 1;
    return id;
  };

  const createRepo = (name: keyof typeof data) => ({
    list: vi.fn(async (filter?: (row: RepoRecord) => boolean) => {
      const rows = [...data[name]];
      return filter ? rows.filter(filter) : rows;
    }),
    get: vi.fn(async (id: string) => data[name].find((row) => row.id === id)),
    create: vi.fn(async (payload: RepoRecord) => {
      order.push(name);
      const row = {
        id: payload.id ?? nextId(name.slice(0, 3)),
        organizationId: 'org-1',
        createdAt: '2026-07-11T10:00:00.000Z',
        updatedAt: '2026-07-11T10:00:00.000Z',
        ...payload,
      };
      data[name].push(row);
      return row;
    }),
    update: vi.fn(async (id: string, patch: RepoRecord) => {
      const index = data[name].findIndex((row) => row.id === id);
      if (index === -1) throw new Error(`${name}:${id} missing`);
      data[name][index] = { ...data[name][index], ...patch, updatedAt: '2026-07-11T10:00:00.000Z' };
      return data[name][index];
    }),
    remove: vi.fn(async (id: string) => {
      const row = data[name].find((item) => item.id === id);
      if (row) row.deletedAt = '2026-07-11T10:00:00.000Z';
    }),
    hardDelete: vi.fn(async (id: string) => {
      data[name] = data[name].filter((row) => row.id !== id);
    }),
    count: vi.fn(async () => data[name].length),
  });

  const repos = {
    clients: createRepo('clients'),
    services: createRepo('services'),
    projects: createRepo('projects'),
    estimates: createRepo('estimates'),
    contracts: createRepo('contracts'),
    invoices: createRepo('invoices'),
    payments: createRepo('payments'),
    transactions: createRepo('transactions'),
    events: createRepo('events'),
    markdownImports: createRepo('markdownImports'),
  };

  return {
    store: data,
    repositories: repos,
    createOrder: order,
    resetMockState: () => {
      Object.keys(data).forEach((key) => {
        data[key] = [];
      });
      order.length = 0;
      idCounter = 1;
    },
  };
});

vi.mock('@/services/repository', () => ({ repositories }));
vi.mock('@/services/documentNumbers', () => ({
  nextEstimateNumber: vi.fn(async () => 'PREV-2026-0099'),
  nextInvoiceNumber: vi.fn(async () => 'FAT-2026-0099'),
  nextContractNumber: vi.fn(async () => 'CTR-2026-0099'),
  nextProjectCode: vi.fn(async () => 'PRJ-2026-099'),
}));
vi.mock('@/services/activity', () => ({ recordActivity: vi.fn(async () => undefined) }));

import { parseItalianDate, parseItalianNumber } from '@/services/markdownImport/utils';
import { parseMarkdownDocument } from '@/services/markdownImport/markdownParser';
import { analyzeParsedMarkdown } from '@/services/markdownImport/entityExtractor';
import { detectDuplicates } from '@/services/markdownImport/duplicateDetector';
import { executeMarkdownImport } from '@/services/markdownImport/importExecutor';

beforeEach(() => {
  resetMockState();
  vi.clearAllMocks();
});

describe('markdown importer', () => {
  it('riconosce un client da YAML frontmatter', () => {
    const parsed = parseMarkdownDocument(
      'client.md',
      `---
bns_type: client
name: Kokoro Sushi Roma
status: active
city: Roma
---

# Kokoro Sushi Roma`,
    );

    const result = analyzeParsedMarkdown([parsed]);
    expect(result.candidateCount).toBe(1);
    expect(result.candidates[0]?.entityType).toBe('client');
    expect(result.candidates[0]?.normalizedFields.displayName).toBe('Kokoro Sushi Roma');
  });

  it('estrae piu entita da un markdown multi-section', () => {
    const parsed = parseMarkdownDocument(
      'multi.md',
      `# K9 Pro

## Cliente
Nome: K9 Security Academy

## Progetto
Nome progetto: K9 Pro
Cliente: K9 Security Academy

## Preventivo
Numero: PREV-2026-0001
Totale: €1.800`,
    );

    const result = analyzeParsedMarkdown([parsed]);
    expect(result.candidates.map((candidate) => candidate.entityType)).toEqual(['client', 'project', 'estimate']);
  });

  it('normalizza importi italiani', () => {
    expect(parseItalianNumber('€1.800,00')).toBe(1800);
    expect(parseItalianNumber('1.800 €')).toBe(1800);
  });

  it('normalizza date italiane', () => {
    expect(parseItalianDate('31/07/2026')).toBe('2026-07-31');
    expect(parseItalianDate('31 luglio 2026')).toBe('2026-07-31');
  });

  it('normalizza gli status supportati', () => {
    const parsed = parseMarkdownDocument(
      'payment.md',
      `## Pagamento
Importo: €600
Stato: In attesa`,
    );

    const result = analyzeParsedMarkdown([parsed]);
    expect(result.candidates[0]?.normalizedFields.status).toBe('pending');
  });

  it('riconosce wiki link come relationship hint', () => {
    const parsed = parseMarkdownDocument(
      'project.md',
      `## Progetto
Nome progetto: Kokoro Sito
Cliente: [[Kokoro Sushi Roma]]`,
    );

    const result = analyzeParsedMarkdown([parsed]);
    expect(result.candidates[0]?.relationshipHints[0]?.normalizedValue).toContain('kokoro sushi roma');
  });

  it('trasforma una tabella rate in piu payment candidate', () => {
    const parsed = parseMarkdownDocument(
      'payments.md',
      `## Pagamenti
| Rata | Importo | Stato |
|---|---:|---|
| 1/3 | €600 | Pagato |
| 2/3 | €600 | In attesa |
| 3/3 | €600 | In attesa |`,
    );

    const result = analyzeParsedMarkdown([parsed]);
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.every((candidate) => candidate.entityType === 'payment')).toBe(true);
  });

  it('marca un client identico come existing_identical', () => {
    store.clients.push({
      id: 'client-1',
      organizationId: 'org-1',
      displayName: 'Kokoro Sushi Roma',
      status: 'active',
      priority: 'medium',
      createdAt: '',
      updatedAt: '',
    });

    const parsed = parseMarkdownDocument(
      'client.md',
      `## Cliente
Nome: Kokoro Sushi Roma
Stato: active`,
    );
    const result = analyzeParsedMarkdown([parsed]);
    detectDuplicates(result.candidates, {
      clients: store.clients as any[],
      services: [],
      projects: [],
      estimates: [],
      contracts: [],
      invoices: [],
      payments: [],
      transactions: [],
      events: [],
    });

    expect(result.candidates[0]?.duplicateStatus).toBe('existing_identical');
  });

  it('marca un client simile ma diverso come existing_different', () => {
    store.clients.push({
      id: 'client-1',
      organizationId: 'org-1',
      displayName: 'Kokoro Sushi Roma',
      city: 'Milano',
      status: 'active',
      priority: 'medium',
      createdAt: '',
      updatedAt: '',
    });

    const parsed = parseMarkdownDocument(
      'client.md',
      `## Cliente
Nome: Kokoro Sushi Roma
Citta: Roma`,
    );
    const result = analyzeParsedMarkdown([parsed]);
    detectDuplicates(result.candidates, {
      clients: store.clients as any[],
      services: [],
      projects: [],
      estimates: [],
      contracts: [],
      invoices: [],
      payments: [],
      transactions: [],
      events: [],
    });

    expect(result.candidates[0]?.duplicateStatus).toBe('existing_different');
  });

  it('genera un warning per status sconosciuto', () => {
    const parsed = parseMarkdownDocument(
      'unknown.md',
      `## Preventivo
Numero: PREV-2026-0100
Stato: In orbita
Totale: €500`,
    );

    const result = analyzeParsedMarkdown([parsed]);
    expect(result.candidates[0]?.warnings.some((warning) => warning.code === 'unknown_status')).toBe(true);
  });

  it('gestisce YAML non valido con errore controllato', () => {
    expect(() =>
      parseMarkdownDocument(
        'invalid.md',
        `---
name: [broken
---
`,
      ),
    ).toThrow('Frontmatter YAML non valido');
  });

  it('non esegue script presenti nel markdown', () => {
    (globalThis as any).__markdownImportExecuted = 0;
    const parsed = parseMarkdownDocument(
      'unsafe.md',
      `## Cliente
Nome: Sicuro
Note: <script>globalThis.__markdownImportExecuted = 1</script>`,
    );

    const result = analyzeParsedMarkdown([parsed]);
    expect((globalThis as any).__markdownImportExecuted).toBe(0);
    expect(result.candidates[0]?.entityType).toBe('client');
  });

  it('importa nell ordine corretto client prima del project', async () => {
    const fixture = readFileSync(resolve(process.cwd(), '../../tests/fixtures/import/kokoro.md'), 'utf8');
    const parsed = parseMarkdownDocument('kokoro.md', fixture);
    const result = analyzeParsedMarkdown([parsed]);

    const execution = await executeMarkdownImport(result.candidates, ['kokoro.md']);

    expect(createOrder.indexOf('clients')).toBeLessThan(createOrder.indexOf('projects'));
    expect(execution.summary.created).toBeGreaterThanOrEqual(2);
  });

  it('risolve relazioni intra-batch assegnando il clientId creato al project', async () => {
    const parsed = parseMarkdownDocument(
      'batch.md',
      `## Cliente
Nome: Batch Client

## Progetto
Nome progetto: Batch Project
Cliente: Batch Client
Valore: €900`,
    );
    const result = analyzeParsedMarkdown([parsed]);

    await executeMarkdownImport(result.candidates, ['batch.md']);

    const createdClient = store.clients[0];
    const createdProject = store.projects[0];
    expect(createdClient?.displayName).toBe('Batch Client');
    expect(createdProject?.clientId).toBe(createdClient?.id);
  });
});
