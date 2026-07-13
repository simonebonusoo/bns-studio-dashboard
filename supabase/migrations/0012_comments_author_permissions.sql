-- ============================================================================
-- BNS Studio v1.1.0 QA — permessi commenti Hub
--
-- La baseline generica `comments_member_all` consentiva update/delete a ogni
-- membro interno dell'organizzazione. Per i messaggi Hub serve un confine piu'
-- stretto: tutti i membri interni leggono e creano, ma solo autore e owner/admin
-- possono modificare o cancellare.
-- ============================================================================

drop policy if exists comments_member_all on public.comments;
drop policy if exists comments_internal_read on public.comments;
drop policy if exists comments_internal_insert on public.comments;
drop policy if exists comments_author_or_admin_update on public.comments;
drop policy if exists comments_author_or_admin_delete on public.comments;

create or replace function public.is_current_member(member uuid, org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.members m
    where m.id = member
      and m.organization_id = org
      and m.profile_id = auth.uid()
      and m.status = 'active'
      and m.deleted_at is null
  );
$$;

create or replace function public.can_manage_comment(comment_author uuid, org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_current_member(comment_author, org)
    or public.org_role(org) in ('owner', 'admin');
$$;

create policy comments_internal_read on public.comments
  for select to authenticated
  using (public.is_internal_org_member(organization_id));

create policy comments_internal_insert on public.comments
  for insert to authenticated
  with check (
    public.is_internal_org_member(organization_id)
    and (author_id is null or public.is_current_member(author_id, organization_id))
  );

create policy comments_author_or_admin_update on public.comments
  for update to authenticated
  using (
    public.is_internal_org_member(organization_id)
    and public.can_manage_comment(author_id, organization_id)
  )
  with check (
    public.is_internal_org_member(organization_id)
    and public.can_manage_comment(author_id, organization_id)
  );

create policy comments_author_or_admin_delete on public.comments
  for delete to authenticated
  using (
    public.is_internal_org_member(organization_id)
    and public.can_manage_comment(author_id, organization_id)
  );
