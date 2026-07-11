-- ============================================================================
-- BNS Studio OS — allineamento schema <-> dominio frontend
-- Migrazione non distruttiva: aggiunge solo colonne mancanti usate dal dominio.
-- ============================================================================

alter table opportunities
  add column if not exists contact_name text;

alter table tasks
  add column if not exists parent_task_id uuid references tasks(id) on delete cascade,
  add column if not exists checklist jsonb default '[]';

alter table calendar_events
  add column if not exists attendee_ids uuid[] default '{}',
  add column if not exists reminder_minutes int,
  add column if not exists visibility text default 'internal';

alter table contracts
  add column if not exists payment_terms text,
  add column if not exists included_revisions int,
  add column if not exists terms text,
  add column if not exists pdf_name text,
  add column if not exists pdf_url text;
