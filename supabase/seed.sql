-- ============================================================================
-- BNS Studio OS — seed produzione (minimo)
-- Il dataset demo completo (clienti, progetti, fatture…) vive in
-- src/data/seed.ts per la modalità demo locale. In produzione si crea qui
-- l'organizzazione iniziale; i membri vengono collegati dopo il primo login.
-- ============================================================================

insert into organizations (id, name, slug, currency, locale, timezone, vat)
values (
  '00000000-0000-0000-0000-000000000001',
  'BNS Studio', 'bns-studio', 'EUR', 'it-IT', 'Europe/Rome', 'IT00000000000'
)
on conflict (slug) do nothing;
