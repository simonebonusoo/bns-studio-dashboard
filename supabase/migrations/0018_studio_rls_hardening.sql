-- ============================================================================
-- BNS Studio v1.2.1 — Studio RLS hardening.
--
-- Restringe le policy Studio introdotte in 0016:
-- - gestione conversazioni/membri solo ad admin/owner org o owner/admin canale;
-- - reazioni, salvati, read state e allegati leggibili/scrivibili solo se il
--   messaggio appartiene a una conversazione leggibile dall'utente corrente.
-- ============================================================================

create or replace function public.can_manage_studio_conversation(conversation uuid, org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.org_role(org) in ('owner', 'admin')
    or exists (
      select 1
      from public.studio_conversations sc
      where sc.id = conversation
        and sc.organization_id = org
        and sc.deleted_at is null
        and sc.created_by = public.current_member_id(org)
    )
    or exists (
      select 1
      from public.studio_conversation_members scm
      join public.members m on m.id = scm.member_id
      where scm.conversation_id = conversation
        and scm.organization_id = org
        and scm.deleted_at is null
        and scm.role in ('owner', 'admin')
        and m.profile_id = auth.uid()
        and m.status = 'active'
        and m.deleted_at is null
    );
$$;

create or replace function public.can_read_studio_message(message uuid, org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.studio_messages sm
    where sm.id = message
      and sm.organization_id = org
      and sm.deleted_at is null
      and public.can_read_studio_conversation(sm.conversation_id, org)
  );
$$;

drop policy if exists studio_conversations_update on public.studio_conversations;
create policy studio_conversations_update on public.studio_conversations
  for update to authenticated
  using (public.can_manage_studio_conversation(id, organization_id))
  with check (public.can_manage_studio_conversation(id, organization_id));

drop policy if exists studio_conversation_members_write on public.studio_conversation_members;
create policy studio_conversation_members_write on public.studio_conversation_members
  for all to authenticated
  using (
    public.can_manage_studio_conversation(conversation_id, organization_id)
    or public.is_current_member(member_id, organization_id)
  )
  with check (
    public.can_manage_studio_conversation(conversation_id, organization_id)
    or public.is_current_member(member_id, organization_id)
  );

drop policy if exists studio_reactions_read on public.studio_message_reactions;
create policy studio_reactions_read on public.studio_message_reactions
  for select to authenticated
  using (public.can_read_studio_message(message_id, organization_id));

drop policy if exists studio_reactions_self on public.studio_message_reactions;
create policy studio_reactions_self on public.studio_message_reactions
  for all to authenticated
  using (
    public.is_current_member(member_id, organization_id)
    and public.can_read_studio_message(message_id, organization_id)
  )
  with check (
    public.is_current_member(member_id, organization_id)
    and public.can_read_studio_message(message_id, organization_id)
  );

drop policy if exists studio_saves_self on public.studio_message_saves;
create policy studio_saves_self on public.studio_message_saves
  for all to authenticated
  using (
    public.is_current_member(member_id, organization_id)
    and public.can_read_studio_message(message_id, organization_id)
  )
  with check (
    public.is_current_member(member_id, organization_id)
    and public.can_read_studio_message(message_id, organization_id)
  );

drop policy if exists studio_reads_self on public.studio_conversation_reads;
create policy studio_reads_self on public.studio_conversation_reads
  for all to authenticated
  using (
    public.is_current_member(member_id, organization_id)
    and public.can_read_studio_conversation(conversation_id, organization_id)
  )
  with check (
    public.is_current_member(member_id, organization_id)
    and public.can_read_studio_conversation(conversation_id, organization_id)
  );

drop policy if exists studio_attachments_read on public.studio_message_attachments;
create policy studio_attachments_read on public.studio_message_attachments
  for select to authenticated
  using (public.can_read_studio_message(message_id, organization_id));

drop policy if exists studio_attachments_write on public.studio_message_attachments;
create policy studio_attachments_write on public.studio_message_attachments
  for all to authenticated
  using (public.can_read_studio_message(message_id, organization_id))
  with check (public.can_read_studio_message(message_id, organization_id));
