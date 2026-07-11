# BNS Markdown Import Format

## Obiettivo

Il Markdown importer legge file `.md` o `.markdown`, estrae entita operative e le converte in record persistiti tramite repository BnsStudio.

La source of truth finale resta sempre PostgreSQL/Supabase.

## Frontmatter consigliato

Il frontmatter `bns_type` ha priorita massima nel riconoscimento.

```md
---
bns_type: client
bns_version: 1
name: Kokoro Sushi Roma
status: active
city: Roma
industry: Ristorazione giapponese
source: Contatto diretto
---
```

Tipi supportati:

- `client`
- `service`
- `project`
- `estimate`
- `contract`
- `invoice`
- `payment`
- `transaction`
- `event`

## Pattern supportati

- YAML frontmatter
- heading Markdown
- paragrafi e label `Campo: valore`
- Dataview style `Campo:: valore`
- bullet list
- checklist
- tabelle Markdown
- wiki link Obsidian `[[Cliente]]`
- link Markdown standard

## Alias principali

### Client

- `name`, `nome`, `cliente`, `ragione sociale`, `azienda` -> `displayName`
- `email`, `e-mail` -> `email`
- `telefono`, `phone`, `tel` -> `phone`
- `p iva`, `partita iva`, `vat` -> `vat`
- `settore`, `industry` -> `sector`
- `citta`, `city` -> `city`

### Project

- `nome progetto`, `progetto`, `project name` -> `name`
- `cliente`, `client` -> relationship hint `clientId`
- `servizio`, `service` -> relationship hint `serviceId`
- `valore`, `valore contrattuale`, `contract value` -> `contractValue`
- `budget costi`, `costi`, `cost budget` -> `budget`
- `ore`, `ore stimate`, `estimated hours` -> `estimatedHours`
- `scadenza`, `deadline`, `due date` -> `dueDate`

### Estimate / Invoice / Contract

- `numero`, `number` -> `number`
- `cliente`, `client` -> `clientId`
- `progetto`, `project` -> `projectId`
- `preventivo`, `estimate` -> `estimateId`
- `totale`, `importo`, `valore` -> line item sintetico se non esiste una tabella righe

## Numeri

Sono supportati:

- `1800`
- `1.800`
- `1.800,00`
- `€1.800`
- `1.800 €`
- `EUR 1800`

Regola: il parser assume formato italiano e quindi `1.800` viene interpretato come `1800`, non `1.8`.

## Date

Sono supportate:

- `31/07/2026`
- `31-07-2026`
- `2026-07-31`
- `31 luglio 2026`

Regola di ambiguita: `03/04/2026` viene interpretata come `DD/MM/YYYY`.

## Boolean

Valori supportati:

- veri: `si`, `sì`, `yes`, `true`, `attivo`
- falsi: `no`, `false`, `inattivo`

## Status ed enum

Il parser salva nel dominio solo enum validi del prodotto.

Esempi:

- `In attesa` -> `pending`
- `Accettato` -> `accepted`
- `Attivo` -> `active`

Se uno status non e mappabile:

- il candidate riceve un warning `unknown_status`
- viene usato il default sicuro del dominio

## Relazioni

Sono supportati riferimenti testuali come:

```md
Cliente: Kokoro Sushi Roma
Servizio: Sviluppo Web
[[Kokoro Sushi Roma]]
```

Durante la review il sistema prova a risolverli contro:

- record esistenti
- record nuovi presenti nello stesso batch

## Multi-entity document

Un singolo file puo contenere piu sezioni:

```md
# K9 Pro

## Cliente
Nome: K9 Security Academy

## Progetto
Nome progetto: K9 Pro

## Preventivo
Numero: PREV-2026-0001
Totale: €1.800
```

## Tabelle pagamenti

Una tabella con piu rate produce piu candidate `payment`.

```md
| Rata | Importo | Stato |
|---|---:|---|
| 1/3 | €600 | Pagato |
| 2/3 | €600 | In attesa |
| 3/3 | €600 | In attesa |
```

## Note di sicurezza

- il parser usa YAML safe parsing
- il Markdown viene trattato come input non attendibile
- nessun HTML o script viene eseguito
- il contenuto non viene inviato a servizi AI esterni durante il parsing
