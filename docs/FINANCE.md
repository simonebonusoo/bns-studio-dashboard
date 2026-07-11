# Finanze — logica di calcolo

Tutta la logica è pura e testata in `src/lib/finance.ts` (test in `tests/unit/finance.test.ts`).

## Riga documento

```
net   = quantità × prezzo × (1 − sconto_riga%)
iva   = net × aliquota%
gross = net + iva
```

## Totali documento

```
subtotal       = Σ net delle righe
globalDiscount = subtotal × sconto_globale%
taxable        = subtotal − globalDiscount
vat            = (Σ iva righe) × (taxable / subtotal)   // IVA riproporzionata
withholding    = taxable × ritenuta%
total          = taxable + vat − withholding
deposit        = total × acconto%
```

Lo sconto globale riduce l'imponibile e l'IVA viene ricalcolata proporzionalmente, preservando il peso di ciascuna aliquota.

## Saldo fattura

```
paid    = Σ pagamenti 'completed' − Σ 'refunded'
balance = total − paid
status  = paid ≤ 0 → unpaid | balance ≤ 0 → paid | altrimenti partially_paid
```

Registrare un pagamento in `InvoiceDetailPage` aggiorna il saldo **e** lo stato della fattura.

## Redditività progetto

```
loggedHours = Σ minuti registrati (timer esclusi) / 60
laborCost   = Σ (costo_interno × minuti / 60)
grossMargin = valore_contrattuale − laborCost
marginPct   = grossMargin / valore_contrattuale
hoursVariance = ore_stimate − loggedHours
```

Se mancano i costi orari, `hasEstimates=false` e la UI segnala **calcolo parziale** — nessun costo viene inventato.

## Limiti

Modulo **gestionale**: non sostituisce software fiscali o la fatturazione elettronica certificata (SDI). L'integrazione con provider italiani è predisposta ma non attiva.
