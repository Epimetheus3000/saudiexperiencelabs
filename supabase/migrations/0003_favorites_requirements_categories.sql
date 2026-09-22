-- Adds: per-user idea favorites (a star any lab member can toggle once per
-- idea), per-user "requirements to advance" notes on ideas, and an
-- admin-managed list of categories per lab (replacing the free-text
-- category input with a dropdown the Master curates per lab's theme).
--
-- As with 0001/0002, apply this by pasting into the Supabase SQL Editor —
-- there's no CLI/db push workflow set up for this project.

-- ---- idea_favorites -----------------------------------------------------
-- One row per (idea, user) — the primary key itself enforces "once per
-- user," so toggling is just insert-to-favorite / delete-to-unfavorite.
create table public.idea_favorites (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create index idx_idea_favorites_idea on public.idea_favorites (idea_id);

alter table public.idea_favorites enable row level security;

create policy "idea_favorites_select" on public.idea_favorites for select
  using (
    exists (
      select 1 from public.ideas i
      where i.id = idea_id and public.has_lab_access(auth.uid(), i.lab_id)
    )
  );

create policy "idea_favorites_insert_own" on public.idea_favorites for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.ideas i
      where i.id = idea_id and public.has_lab_access(auth.uid(), i.lab_id)
    )
  );

create policy "idea_favorites_delete_own" on public.idea_favorites for delete
  using (user_id = auth.uid());

-- ---- idea_requirements ---------------------------------------------------
-- A per-user checklist of "what this idea needs before it can move on" —
-- distinct from the Distribution stage's shared todo list (stage_data JSON):
-- this one is attributed per author and available at every stage.
create table public.idea_requirements (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  body text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_idea_requirements_idea on public.idea_requirements (idea_id);

alter table public.idea_requirements enable row level security;

create policy "idea_requirements_select" on public.idea_requirements for select
  using (
    exists (
      select 1 from public.ideas i
      where i.id = idea_id and public.has_lab_access(auth.uid(), i.lab_id)
    )
  );

create policy "idea_requirements_insert_own" on public.idea_requirements for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.ideas i
      where i.id = idea_id and public.has_lab_access(auth.uid(), i.lab_id)
    )
  );

-- Matches the comments table's convention: the author can edit/remove their
-- own entry, and Master can moderate anyone's.
create policy "idea_requirements_update_own_or_master" on public.idea_requirements for update
  using (user_id = auth.uid() or public.is_master(auth.uid()))
  with check (user_id = auth.uid() or public.is_master(auth.uid()));

create policy "idea_requirements_delete_own_or_master" on public.idea_requirements for delete
  using (user_id = auth.uid() or public.is_master(auth.uid()));

-- ---- labs.categories ------------------------------------------------------
-- Admin-curated per-lab category list, shown as a dropdown on the new-idea
-- form instead of a free-text field. Seeded with a generic Saudi
-- tourism-experience set; Master edits it per lab's actual theme from the
-- lab's admin page.
alter table public.labs
  add column categories text[] not null default array[
    'Heritage & Culture',
    'Culinary Experience',
    'Adventure & Outdoor',
    'Wellness & Retreat',
    'Arts & Entertainment',
    'Nature & Wildlife',
    'Shopping & Lifestyle',
    'Hospitality & Stay'
  ];
