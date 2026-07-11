# BnsStudio Operating Guide

## Importare Markdown

1. Apri `Importa Markdown` dalla sidebar.
2. Carica uno o piu file `.md` o `.markdown`.
3. Esegui l analisi.
4. Correggi i candidate nella fase `Revisione`.
5. Scegli per ogni record se creare, aggiornare o ignorare.
6. Avvia l import.

## Cosa aspettarsi

- i file vengono letti localmente
- il contenuto completo non viene salvato nel database
- i duplicati vengono segnalati prima della persistenza
- dashboard, analytics e activity feed si aggiornano senza reload

## Azioni distruttive

Regole operative:

- preferire `Archivia` dove disponibile
- usare `Elimina definitivamente` solo se non esistono dipendenze
- per i dati finanziari controllare sempre gli effetti su saldo e reportistica

## Flusso consigliato con Obsidian

- usa `bns_type` nel frontmatter
- mantieni i nomi di client e project coerenti
- separa le sezioni con heading chiari
- usa tabelle per rate e righe ripetitive
