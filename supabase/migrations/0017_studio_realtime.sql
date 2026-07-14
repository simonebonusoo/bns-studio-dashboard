-- ============================================================================
-- BNS Studio v1.2.1 — abilita Supabase Realtime sulle tabelle Studio.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'studio_messages'
  ) then
    alter publication supabase_realtime add table public.studio_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'studio_message_reactions'
  ) then
    alter publication supabase_realtime add table public.studio_message_reactions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'studio_message_saves'
  ) then
    alter publication supabase_realtime add table public.studio_message_saves;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'studio_message_attachments'
  ) then
    alter publication supabase_realtime add table public.studio_message_attachments;
  end if;
end $$;
