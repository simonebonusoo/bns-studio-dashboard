# BnsStudio Markdown Import Standard

Versione logica: `bns_markdown_version: 1`.

Questo standard definisce il formato consigliato per Markdown generati da Claude, Codex, automazioni AI o compilazione manuale esterna. Il parser resta tollerante verso documenti legacy, ma i nuovi documenti dovrebbero usare frontmatter YAML e heading ufficiali.

## Frontmatter

Ogni documento ufficiale inizia con frontmatter YAML:

```yaml
---
bns_markdown_version: 1
entity_type: client
document_title: Cliente Kokoro Sushi
created_at:
updated_at:
client_name:
project_name:
organization_name:
---
```

`entity_type` accetta questi valori canonici: `client`, `project`, `estimate`, `contract`, `invoice`, `payment`, `bundle`.

Gli ID Supabase non sono richiesti nei template utente. Se presenti in Markdown generati internamente, il parser puo usarli come indizio; altrimenti il matching avviene per nome, codice o numero documento.

## Formati

Date consigliate: `YYYY-MM-DD`. Il parser accetta anche date italiane comuni come `31/07/2026`.

Importi consigliati: punto decimale, ad esempio `1800.00`. Il parser accetta anche formati italiani come `1.800,00`.

Enum consigliati in italiano:

- Stato cliente/progetto: `Prospect`, `Attivo`, `Completato`, `In pausa`.
- Priorita: `Bassa`, `Media`, `Alta`, `Urgente`.
- Stato pagamento: `In attesa`, `Pagato`, `Annullato`.
- Tipo pagamento: `Unico`, `Rateizzato`.
- Ricorrenza: `Mensile`, `Trimestrale`, `Semestrale`, `Annuale`.
- Rinnovo: `Automatico`, `Manuale`, `Nessun rinnovo`.

## Template ufficiali

I template completi sono in `docs/markdown-templates/`:

- `client.md`
- `project.md`
- `estimate.md`
- `contract.md`
- `invoice.md`
- `payment.md`
- `bundle.md`

## Import contestuale

L'import contestuale crea una sola entita del tipo atteso. Prima del form finale mostra una preview editabile in italiano. I record collegati, come cliente, progetto, servizio, preventivo o fattura, vengono cercati tra quelli esistenti: BnsStudio non crea automaticamente relazioni mancanti.

## Import globale

L'import globale puo leggere un bundle multi-entita. Nel bundle non tutte le sezioni sono obbligatorie. Heading generici come `Note`, `Descrizione`, `Obiettivi`, `Condizioni`, `Servizi inclusi`, `Note operative` e `Tag` sono sezioni, non entita.

## Campi mancanti

I campi sconosciuti possono restare vuoti. La preview permette di correggere prima di continuare; il form finale resta la source of truth per validazione e salvataggio.

## Regole per la generazione AI

- Usa sempre frontmatter YAML con `bns_markdown_version: 1`.
- Usa `entity_type` canonici e heading ufficiali: `Cliente`, `Progetto`, `Preventivo`, `Contratto`, `Fattura`, `Pagamento`.
- Per documenti completi usa `entity_type: bundle` e sezioni `## Cliente`, `## Progetto`, ecc.
- Non inventare ID Supabase.
- Lascia vuoti i dati sconosciuti.
- Non usare asterischi nei valori semplici.
- Usa date ISO `YYYY-MM-DD`.
- Usa importi con punto decimale nel Markdown.
- Usa enum tramite label italiane supportate.
- Non creare heading ambigui come root di entita: metti note operative, obiettivi e vincoli sotto l'entita corretta.
