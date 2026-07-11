import type { DocumentLineItem, Invoice, Payment, Project, TimeEntry } from '@/types';

/** Arrotondamento a 2 decimali stabile. */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface LineTotals {
  net: number; // imponibile riga (dopo sconto riga)
  vat: number; // IVA riga
  gross: number; // totale riga
}

/** Totale di una singola riga documento (quantità × prezzo, sconto riga, IVA). */
export function lineTotals(item: DocumentLineItem): LineTotals {
  const base = (item.quantity ?? 0) * (item.unitPrice ?? 0);
  const net = base * (1 - (item.discountPct ?? 0) / 100);
  const vat = net * ((item.vatRate ?? 0) / 100);
  return { net: round2(net), vat: round2(vat), gross: round2(net + vat) };
}

export interface DocumentTotals {
  subtotal: number; // somma imponibili riga
  globalDiscount: number; // importo sconto globale
  taxable: number; // imponibile dopo sconto globale
  vat: number; // IVA totale (sull'imponibile scontato)
  withholding: number; // ritenuta d'acconto
  total: number; // totale documento
  deposit: number; // acconto richiesto
}

/**
 * Totali di un documento (preventivo/fattura).
 * Lo sconto globale si applica proporzionalmente all'imponibile; l'IVA è ricalcolata
 * sull'imponibile scontato mantenendo il peso di ciascuna aliquota.
 */
export function documentTotals(
  items: DocumentLineItem[],
  opts: { globalDiscountPct?: number; withholdingPct?: number; depositPct?: number } = {},
): DocumentTotals {
  const globalDiscountPct = opts.globalDiscountPct ?? 0;
  const subtotal = round2(items.reduce((sum, it) => sum + lineTotals(it).net, 0));
  const globalDiscount = round2(subtotal * (globalDiscountPct / 100));
  const taxable = round2(subtotal - globalDiscount);
  const discountFactor = subtotal > 0 ? taxable / subtotal : 0;
  const vat = round2(
    items.reduce((sum, it) => sum + lineTotals(it).vat, 0) * discountFactor,
  );
  const withholding = round2(taxable * ((opts.withholdingPct ?? 0) / 100));
  const total = round2(taxable + vat - withholding);
  const deposit = round2(total * ((opts.depositPct ?? 0) / 100));
  return { subtotal, globalDiscount, taxable, vat, withholding, total, deposit };
}

/** Somma dei pagamenti che concorrono al saldo (completed + rimborsi negativi). */
export function paidAmount(payments: Payment[]): number {
  return round2(
    payments.reduce((sum, p) => {
      if (p.status === 'completed') return sum + p.amount;
      if (p.status === 'refunded') return sum - p.amount;
      if (p.status === 'partially_refunded') return sum + p.amount; // importo già netto
      return sum;
    }, 0),
  );
}

export interface InvoiceBalance {
  total: number;
  paid: number;
  balance: number;
  status: 'paid' | 'partially_paid' | 'unpaid';
}

/** Saldo di una fattura dato l'insieme dei pagamenti collegati. */
export function invoiceBalance(invoice: Invoice, payments: Payment[]): InvoiceBalance {
  const total = documentTotals(invoice.items, {
    globalDiscountPct: invoice.globalDiscountPct,
    withholdingPct: invoice.withholdingPct,
  }).total;
  const paid = paidAmount(payments.filter((p) => p.invoiceId === invoice.id));
  const balance = round2(total - paid);
  const status: InvoiceBalance['status'] =
    paid <= 0 ? 'unpaid' : balance <= 0.005 ? 'paid' : 'partially_paid';
  return { total, paid, balance: Math.max(balance, 0), status };
}

export interface ProjectProfitability {
  contractValue: number;
  loggedMinutes: number;
  loggedHours: number;
  laborCost: number; // costo interno delle ore
  billableValue: number; // valore fatturabile delle ore
  budget: number;
  grossMargin: number; // valore contrattuale - costo lavoro
  marginPct: number;
  budgetVariance: number; // budget - costo (positivo = sotto budget)
  hoursVariance: number; // ore stimate - effettive
  hasEstimates: boolean; // se mancano dati costo, i calcoli sono parziali
}

/** Redditività di progetto derivata dalle ore registrate e dal valore contrattuale. */
export function projectProfitability(
  project: Project,
  entries: TimeEntry[],
): ProjectProfitability {
  const projectEntries = entries.filter((e) => e.projectId === project.id && !e.running);
  const loggedMinutes = projectEntries.reduce((s, e) => s + e.durationMinutes, 0);
  const loggedHours = round2(loggedMinutes / 60);
  const laborCost = round2(
    projectEntries.reduce((s, e) => s + ((e.internalCost ?? 0) * e.durationMinutes) / 60, 0),
  );
  const billableValue = round2(
    projectEntries
      .filter((e) => e.billable)
      .reduce((s, e) => s + ((e.hourlyRate ?? 0) * e.durationMinutes) / 60, 0),
  );
  const grossMargin = round2(project.contractValue - laborCost);
  const marginPct =
    project.contractValue > 0 ? round2((grossMargin / project.contractValue) * 100) : 0;
  const budgetVariance = round2(project.budget - laborCost);
  const hoursVariance = round2(project.estimatedHours - loggedHours);
  return {
    contractValue: project.contractValue,
    loggedMinutes,
    loggedHours,
    laborCost,
    billableValue,
    budget: project.budget,
    grossMargin,
    marginPct,
    budgetVariance,
    hoursVariance,
    hasEstimates: projectEntries.some((e) => (e.internalCost ?? 0) > 0),
  };
}
