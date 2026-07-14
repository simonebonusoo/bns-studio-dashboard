-- ============================================================================
-- BNS Studio v1.2.0 — Studio: comunicazione interna, thread e collaboration.
--
-- Compatibilita: i vecchi commenti progetto restano in `comments`. La nuova
-- feature usa tabelle dedicate `studio_*`; la migrazione dati puo' essere fatta
-- progressivamente senza rompere i riferimenti storici.
-- ============================================================================

create table if not exists public.studio_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('channel', 'project', 'dm', 'group_dm')),
  name text not null,
  slug text not null,
  description text,
  project_id uuid references public.projects(id) on delete cascade,
  is_private boolean not null default false,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz,
  unique (organization_id, slug),
  unique (organization_id, project_id)
);

create table if not exists public.studio_conversation_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.studio_conversations(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (conversation_id, member_id)
);

create table if not exists public.studio_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.studio_conversations(id) on delete cascade,
  author_id uuid not null references public.members(id) on delete restrict,
  parent_message_id uuid references public.studio_messages(id) on delete cascade,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.studio_message_reactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  message_id uuid not null references public.studio_messages(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (message_id, member_id, emoji)
);

create table if not exists public.studio_message_saves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  message_id uuid not null references public.studio_messages(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (message_id, member_id)
);

create table if not exists public.studio_conversation_reads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.studio_conversations(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (conversation_id, member_id)
);

create table if not exists public.studio_message_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  message_id uuid not null references public.studio_messages(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (message_id, file_id)
);

create index if not exists studio_conversations_org_type_idx on public.studio_conversations (organization_id, type, archived_at);
create index if not exists studio_conversations_project_idx on public.studio_conversations (organization_id, project_id);
create index if not exists studio_conversation_members_member_idx on public.studio_conversation_members (organization_id, member_id);
create index if not exists studio_messages_recent_idx on public.studio_messages (organization_id, conversation_id, parent_message_id, created_at desc);
create index if not exists studio_messages_search_idx on public.studio_messages using gin (to_tsvector('simple', content));
create index if not exists studio_reads_member_idx on public.studio_conversation_reads (organization_id, member_id);

create or replace function public.is_studio_conversation_member(conversation uuid, member uuid, org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.studio_conversation_members scm
    join public.members m on m.id = scm.member_id
    where scm.conversation_id = conversation
      and scm.member_id = member
      and scm.organization_id = org
      and scm.deleted_at is null
      and m.organization_id = org
      and m.profile_id = auth.uid()
      and m.status = 'active'
      and m.deleted_at is null
  );
$$;

create or replace function public.can_read_studio_conversation(conversation uuid, org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_internal_org_member(org)
    and exists (
      select 1
      from public.studio_conversations sc
      where sc.id = conversation
        and sc.organization_id = org
        and sc.deleted_at is null
        and (
          sc.is_private = false
          or exists (
            select 1
            from public.studio_conversation_members scm
            join public.members m on m.id = scm.member_id
            where scm.conversation_id = sc.id
              and scm.organization_id = org
              and scm.deleted_at is null
              and m.profile_id = auth.uid()
              and m.status = 'active'
              and m.deleted_at is null
          )
        )
    );
$$;

create or replace function public.current_member_id(org uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select m.id
  from public.members m
  where m.organization_id = org
    and m.profile_id = auth.uid()
    and m.status = 'active'
    and m.deleted_at is null
  limit 1;
$$;

alter table public.studio_conversations enable row level security;
alter table public.studio_conversation_members enable row level security;
alter table public.studio_messages enable row level security;
alter table public.studio_message_reactions enable row level security;
alter table public.studio_message_saves enable row level security;
alter table public.studio_conversation_reads enable row level security;
alter table public.studio_message_attachments enable row level security;

create policy studio_conversations_read on public.studio_conversations
  for select to authenticated
  using (public.can_read_studio_conversation(id, organization_id));

create policy studio_conversations_insert on public.studio_conversations
  for insert to authenticated
  with check (
    public.is_internal_org_member(organization_id)
    and (created_by is null or public.is_current_member(created_by, organization_id))
  );

create policy studio_conversations_update on public.studio_conversations
  for update to authenticated
  using (public.is_internal_org_member(organization_id))
  with check (public.is_internal_org_member(organization_id));

create policy studio_conversation_members_read on public.studio_conversation_members
  for select to authenticated
  using (public.can_read_studio_conversation(conversation_id, organization_id));

create policy studio_conversation_members_write on public.studio_conversation_members
  for all to authenticated
  using (public.is_internal_org_member(organization_id))
  with check (public.is_internal_org_member(organization_id));

create policy studio_messages_read on public.studio_messages
  for select to authenticated
  using (public.can_read_studio_conversation(conversation_id, organization_id));

create policy studio_messages_insert on public.studio_messages
  for insert to authenticated
  with check (
    public.can_read_studio_conversation(conversation_id, organization_id)
    and public.is_current_member(author_id, organization_id)
  );

create policy studio_messages_update_own_or_admin on public.studio_messages
  for update to authenticated
  using (
    public.can_read_studio_conversation(conversation_id, organization_id)
    and (public.is_current_member(author_id, organization_id) or public.org_role(organization_id) in ('owner', 'admin'))
  )
  with check (
    public.can_read_studio_conversation(conversation_id, organization_id)
    and (public.is_current_member(author_id, organization_id) or public.org_role(organization_id) in ('owner', 'admin'))
  );

create policy studio_reactions_read on public.studio_message_reactions
  for select to authenticated
  using (public.is_internal_org_member(organization_id));

create policy studio_reactions_self on public.studio_message_reactions
  for all to authenticated
  using (public.is_current_member(member_id, organization_id))
  with check (public.is_current_member(member_id, organization_id));

create policy studio_saves_self on public.studio_message_saves
  for all to authenticated
  using (public.is_current_member(member_id, organization_id))
  with check (public.is_current_member(member_id, organization_id));

create policy studio_reads_self on public.studio_conversation_reads
  for all to authenticated
  using (public.is_current_member(member_id, organization_id))
  with check (public.is_current_member(member_id, organization_id));

create policy studio_attachments_read on public.studio_message_attachments
  for select to authenticated
  using (public.is_internal_org_member(organization_id));

create policy studio_attachments_write on public.studio_message_attachments
  for all to authenticated
  using (public.is_internal_org_member(organization_id))
  with check (public.is_internal_org_member(organization_id));
