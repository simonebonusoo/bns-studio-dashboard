import { nowISO } from '@/lib/id';
import { invoiceBalance } from '@/lib/finance';
import { repositories } from '@/services/repository';
import type { InvoiceStatus } from '@/types';

/**
 * Ricalcola stato e saldo di una fattura in base ai pagamenti collegati.
 * Da richiamare dopo ogni creazione/modifica/eliminazione di un pagamento.
 */
export async function syncInvoiceStatus(invoiceId?: string | null): Promise<void> {
  if (!invoiceId) return;
  const invoice = await repositories.invoices.get(invoiceId);
  if (!invoice || invoice.deletedAt) return;

  const payments = await repositories.payments.list((payment) => payment.invoiceId === invoiceId);
  const bal = invoiceBalance(invoice, payments);

  // Non forzare stati manuali come 'cancelled' / 'draft'
  if (invoice.status === 'cancelled' || invoice.status === 'draft') return;

  let status: InvoiceStatus = invoice.status;
  if (bal.status === 'paid') status = 'paid';
  else if (bal.status === 'partially_paid') status = 'partially_paid';
  else {
    // nessun pagamento: mantieni overdue se scaduta, altrimenti 'issued'/'sent'
    const overdue = invoice.dueDate && new Date(invoice.dueDate).getTime() < Date.now();
    status = overdue ? 'overdue' : invoice.status === 'paid' || invoice.status === 'partially_paid' ? 'issued' : invoice.status;
  }

  if (status !== invoice.status) {
    await repositories.invoices.update(invoiceId, { status, updatedAt: nowISO() });
  }
}
