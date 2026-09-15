-- saudiexperiencelabs — initial schema, seeding triggers, and RLS policies
-- Order matters: tables, then helper functions, then triggers, then RLS.

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
create extension if not exists "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

create table public.labs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  primary_color text not null default '#0f172a',
  created_at timestamptz not null default now()
);

-- Mirrors auth.users; kept in sync by handle_new_user() trigger below.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  is_master boolean not null default false,
  is_external boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.lab_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  lab_id uuid not null references public.labs (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, lab_id)
);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.labs (id) on delete cascade,
  name text not null,
  position int not null,
  created_at timestamptz not null default now(),
  unique (lab_id, position),
  unique (lab_id, name)
);

create table public.stage_deadlines (
  stage_id uuid primary key references public.stages (id) on delete cascade,
  lab_id uuid not null references public.labs (id) on delete cascade,
  deadline_at timestamptz
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.labs (id) on delete cascade,
  stage_id uuid not null references public.stages (id) on delete restrict,
  title text not null,
  category text,
  description text,
  pros text,
  cons text,
  shortlist_reasoning text,
  concept_details text,
  concept_audience text,
  concept_notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rating_criteria (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid references public.labs (id) on delete cascade, -- null = global default
  name text not null,
  scale int not null default 5,
  created_at timestamptz not null default now()
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  criterion_id uuid not null references public.rating_criteria (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  score int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idea_id, criterion_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_lab_memberships_user on public.lab_memberships (user_id);
create index idx_lab_memberships_lab on public.lab_memberships (lab_id);
create index idx_stages_lab on public.stages (lab_id);
create index idx_ideas_lab_stage on public.ideas (lab_id, stage_id);
create index idx_ratings_idea on public.ratings (idea_id);
create index idx_comments_idea on public.comments (idea_id);

-- ============================================================================
-- AUTH SYNC: mirror auth.users -> public.users on signup
-- ============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================================
-- SEEDING: every new lab gets 3 fixed stages
-- ============================================================================

create or replace function public.seed_default_stages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.stages (lab_id, name, position) values
    (new.id, 'Longlist', 1),
    (new.id, 'Shortlist', 2),
    (new.id, 'Concept', 3);
  return new;
end;
$$;

create trigger on_lab_created_seed_stages
  after insert on public.labs
  for each row execute function public.seed_default_stages();

-- ============================================================================
-- ACCESS HELPERS (used by RLS policies)
-- ============================================================================

create or replace function public.is_master(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_master from public.users where id = uid), false);
$$;

create or replace function public.has_lab_access(uid uuid, target_lab_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_master(uid)
    or exists (
      select 1 from public.lab_memberships
      where user_id = uid and lab_id = target_lab_id
    );
$$;

-- ============================================================================
-- BUSINESS-RULE TRIGGERS (server-side enforcement, defense in depth)
-- ============================================================================

-- A partner (is_external = true) may never hold more than one lab membership,
-- even under concurrent inserts.
create or replace function public.enforce_external_single_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_is_external boolean;
  existing_count int;
begin
  perform pg_advisory_xact_lock(hashtext('membership_cap:' || new.user_id::text));

  select is_external into target_is_external from public.users where id = new.user_id;

  if target_is_external then
    select count(*) into existing_count
    from public.lab_memberships
    where user_id = new.user_id;

    if existing_count >= 1 then
      raise exception 'External (partner) users may only be assigned to a single lab';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_enforce_external_single_membership
  before insert on public.lab_memberships
  for each row execute function public.enforce_external_single_membership();

-- Hard cap of 50 ideas sitting in a lab's Longlist stage at once, race-safe
-- via an advisory lock keyed per lab.
create or replace function public.enforce_longlist_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  longlist_stage_id uuid;
  current_count int;
begin
  select id into longlist_stage_id
  from public.stages
  where lab_id = new.lab_id and name = 'Longlist';

  if new.stage_id = longlist_stage_id and (TG_OP = 'INSERT' or old.stage_id is distinct from new.stage_id) then
    perform pg_advisory_xact_lock(hashtext('longlist_cap:' || new.lab_id::text));

    select count(*) into current_count
    from public.ideas
    where lab_id = new.lab_id and stage_id = longlist_stage_id;

    if current_count >= 50 then
      raise exception 'Longlist is full: this lab already has 50 ideas in Longlist';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_enforce_longlist_cap
  before insert or update on public.ideas
  for each row execute function public.enforce_longlist_cap();

-- Moving an idea out of Longlist (into Shortlist or beyond) requires a
-- shortlist_reasoning value; once set it carries forward through later stages.
create or replace function public.enforce_shortlist_reasoning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  longlist_position int;
  new_stage_position int;
begin
  if TG_OP = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    select position into longlist_position
    from public.stages where lab_id = new.lab_id and name = 'Longlist';

    select position into new_stage_position
    from public.stages where id = new.stage_id;

    if new_stage_position > longlist_position
       and (new.shortlist_reasoning is null or btrim(new.shortlist_reasoning) = '') then
      raise exception 'A reasoning note is required before moving an idea out of Longlist';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_enforce_shortlist_reasoning
  before update on public.ideas
  for each row execute function public.enforce_shortlist_reasoning();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_ideas_updated_at
  before update on public.ideas
  for each row execute function public.set_updated_at();

create trigger trg_ratings_updated_at
  before update on public.ratings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.labs enable row level security;
alter table public.users enable row level security;
alter table public.lab_memberships enable row level security;
alter table public.stages enable row level security;
alter table public.stage_deadlines enable row level security;
alter table public.ideas enable row level security;
alter table public.rating_criteria enable row level security;
alter table public.ratings enable row level security;
alter table public.comments enable row level security;

-- ---- labs -------------------------------------------------------------
create policy "labs_select" on public.labs for select
  using (public.has_lab_access(auth.uid(), id));

create policy "labs_write_master_only" on public.labs for all
  using (public.is_master(auth.uid()))
  with check (public.is_master(auth.uid()));

-- ---- users --------------------------------------------------------------
create policy "users_select_self_or_master" on public.users for select
  using (
    id = auth.uid()
    or public.is_master(auth.uid())
    or exists (
      select 1
      from public.lab_memberships me
      join public.lab_memberships them on them.lab_id = me.lab_id
      where me.user_id = auth.uid() and them.user_id = public.users.id
    )
  );

create policy "users_write_master_only" on public.users for all
  using (public.is_master(auth.uid()))
  with check (public.is_master(auth.uid()));

-- ---- lab_memberships ------------------------------------------------------
create policy "lab_memberships_select" on public.lab_memberships for select
  using (
    user_id = auth.uid()
    or public.has_lab_access(auth.uid(), lab_id)
  );

create policy "lab_memberships_write_master_only" on public.lab_memberships for all
  using (public.is_master(auth.uid()))
  with check (public.is_master(auth.uid()));

-- ---- stages ---------------------------------------------------------------
create policy "stages_select" on public.stages for select
  using (public.has_lab_access(auth.uid(), lab_id));

create policy "stages_write_master_only" on public.stages for all
  using (public.is_master(auth.uid()))
  with check (public.is_master(auth.uid()));

-- ---- stage_deadlines --------------------------------------------------------
create policy "stage_deadlines_select" on public.stage_deadlines for select
  using (public.has_lab_access(auth.uid(), lab_id));

create policy "stage_deadlines_write_master_only" on public.stage_deadlines for all
  using (public.is_master(auth.uid()))
  with check (public.is_master(auth.uid()));

-- ---- ideas ------------------------------------------------------------------
create policy "ideas_select" on public.ideas for select
  using (public.has_lab_access(auth.uid(), lab_id));

create policy "ideas_insert" on public.ideas for insert
  with check (public.has_lab_access(auth.uid(), lab_id));

create policy "ideas_update" on public.ideas for update
  using (public.has_lab_access(auth.uid(), lab_id))
  with check (public.has_lab_access(auth.uid(), lab_id));

create policy "ideas_delete_master_only" on public.ideas for delete
  using (public.is_master(auth.uid()));

-- ---- rating_criteria ----------------------------------------------------------
create policy "rating_criteria_select" on public.rating_criteria for select
  using (lab_id is null or public.has_lab_access(auth.uid(), lab_id));

create policy "rating_criteria_write_master_only" on public.rating_criteria for all
  using (public.is_master(auth.uid()))
  with check (public.is_master(auth.uid()));

-- ---- ratings -------------------------------------------------------------------
create policy "ratings_select" on public.ratings for select
  using (
    exists (
      select 1 from public.ideas
      where ideas.id = ratings.idea_id
      and public.has_lab_access(auth.uid(), ideas.lab_id)
    )
  );

create policy "ratings_insert_own" on public.ratings for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.ideas
      where ideas.id = ratings.idea_id
      and public.has_lab_access(auth.uid(), ideas.lab_id)
    )
  );

create policy "ratings_update_own" on public.ratings for update
  using (user_id = auth.uid() or public.is_master(auth.uid()))
  with check (user_id = auth.uid() or public.is_master(auth.uid()));

create policy "ratings_delete_own_or_master" on public.ratings for delete
  using (user_id = auth.uid() or public.is_master(auth.uid()));

-- ---- comments ----------------------------------------------------------------
create policy "comments_select" on public.comments for select
  using (
    exists (
      select 1 from public.ideas
      where ideas.id = comments.idea_id
      and public.has_lab_access(auth.uid(), ideas.lab_id)
    )
  );

create policy "comments_insert_own" on public.comments for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.ideas
      where ideas.id = comments.idea_id
      and public.has_lab_access(auth.uid(), ideas.lab_id)
    )
  );

create policy "comments_update_own_or_master" on public.comments for update
  using (user_id = auth.uid() or public.is_master(auth.uid()))
  with check (user_id = auth.uid() or public.is_master(auth.uid()));

create policy "comments_delete_own_or_master" on public.comments for delete
  using (user_id = auth.uid() or public.is_master(auth.uid()));

-- ============================================================================
-- GLOBAL DEFAULT RATING CRITERIA (seed data, lab_id = null applies everywhere)
-- ============================================================================

insert into public.rating_criteria (lab_id, name, scale) values
  (null, 'Feasibility', 5),
  (null, 'Impact', 5),
  (null, 'Originality', 5),
  (null, 'Alignment with lab strategy', 5);
