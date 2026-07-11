import { repositories } from '@/services/repository';

export async function nextEstimateNumber() {
  const count = await repositories.estimates.count();
  return `PREV-2026-${String(count + 1).padStart(4, '0')}`;
}

export async function nextInvoiceNumber() {
  const count = await repositories.invoices.count();
  return `FAT-2026-${String(count + 1).padStart(4, '0')}`;
}

export async function nextContractNumber() {
  const count = await repositories.contracts.count();
  return `CTR-2026-${String(count + 1).padStart(3, '0')}`;
}
