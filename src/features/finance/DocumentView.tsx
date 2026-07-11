import { Card } from '@/components/ui/Card';
import { documentTotals, lineTotals } from '@/lib/finance';
import { formatCurrency } from '@/lib/format';
import { brandConfig } from '@/config/brandConfig';
import type { DocumentLineItem } from '@/types';

interface Props {
  title: string;
  number: string;
  clientName: string;
  issueDate: string;
  dueDate?: string;
  items: DocumentLineItem[];
  globalDiscountPct?: number;
  withholdingPct?: number;
  depositPct?: number;
  notes?: string;
}

/** Vista documento (preventivo/fattura) con righe e totali calcolati. */
export function DocumentView(props: Props) {
  const totals = documentTotals(props.items, {
    globalDiscountPct: props.globalDiscountPct,
    withholdingPct: props.withholdingPct,
    depositPct: props.depositPct,
  });

  return (
    <Card className="overflow-hidden" id="printable-document">
      <div className="flex items-start justify-between border-b border-border p-6">
        <div>
          <p className="text-lg font-bold">{brandConfig.name}</p>
          <p className="text-sm text-fg-subtle">{brandConfig.contacts.email}</p>
          <p className="text-sm text-fg-subtle">P. IVA {brandConfig.contacts.vat}</p>
        </div>
        <div className="text-right">
          <p className="text-sm uppercase tracking-wide text-fg-subtle">{props.title}</p>
          <p className="text-xl font-bold">{props.number}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-border p-6 text-sm">
        <div>
          <p className="text-xs uppercase text-fg-subtle">Cliente</p>
          <p className="font-medium">{props.clientName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase text-fg-subtle">Emissione</p>
          <p>{props.issueDate}</p>
          {props.dueDate && (
            <>
              <p className="mt-1 text-xs uppercase text-fg-subtle">Scadenza</p>
              <p>{props.dueDate}</p>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-fg-subtle">
              <th className="pb-2">Descrizione</th>
              <th className="pb-2 text-right">Qtà</th>
              <th className="pb-2 text-right">Prezzo</th>
              <th className="pb-2 text-right">Sconto</th>
              <th className="pb-2 text-right">IVA</th>
              <th className="pb-2 text-right">Totale</th>
            </tr>
          </thead>
          <tbody>
            {props.items.map((it) => {
              const lt = lineTotals(it);
              return (
                <tr key={it.id} className="border-b border-border/60">
                  <td className="py-2.5">{it.description}</td>
                  <td className="py-2.5 text-right">{it.quantity}</td>
                  <td className="py-2.5 text-right">{formatCurrency(it.unitPrice)}</td>
                  <td className="py-2.5 text-right">{it.discountPct}%</td>
                  <td className="py-2.5 text-right">{it.vatRate}%</td>
                  <td className="py-2.5 text-right font-medium">{formatCurrency(lt.gross)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-sm">
          <Line label="Imponibile" value={formatCurrency(totals.subtotal)} />
          {totals.globalDiscount > 0 && <Line label="Sconto" value={`- ${formatCurrency(totals.globalDiscount)}`} />}
          <Line label="IVA" value={formatCurrency(totals.vat)} />
          {totals.withholding > 0 && <Line label="Ritenuta" value={`- ${formatCurrency(totals.withholding)}`} />}
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
            <span>Totale</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
          {totals.deposit > 0 && <Line label="Acconto richiesto" value={formatCurrency(totals.deposit)} />}
        </div>
      </div>

      {props.notes && (
        <div className="border-t border-border p-6 text-sm text-fg-subtle">
          <p className="mb-1 text-xs uppercase">Note</p>
          {props.notes}
        </div>
      )}
      <div className="border-t border-border bg-surface-2 p-4 text-center text-xs text-fg-subtle">
        {brandConfig.document.footer}
      </div>
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-fg-subtle">{label}</span>
      <span>{value}</span>
    </div>
  );
}
