-- v3 brief: 6-stage pipeline, per-stage gate checklists, partner co-branding,
-- and native image upload for the Concept stage's Visuals field.

-- ============================================================================
-- LABS: partner co-branding
-- ============================================================================

alter table public.labs
  add column if not exists partner_name text,
  add column if not exists partner_logo_url text;

-- ============================================================================
-- STAGES: description + Master-editable gate checklist (tracked, non-blocking)
-- ============================================================================

alter table public.stages
  add column if not exists description text,
  add column if not exists gate_checklist jsonb not null default '[]'::jsonb;

-- ============================================================================
-- IDEAS: stage-specific fields move into a single flexible JSONB column
-- ============================================================================

alter table public.ideas
  add column if not exists stage_data jsonb not null default '{}'::jsonb;

-- Fold any existing data from the old fixed columns into stage_data before
-- dropping them, keyed the same way the app will key new writes.
update public.ideas
set stage_data = stage_data
  || jsonb_strip_nulls(jsonb_build_object(
       'shortlist', jsonb_strip_nulls(jsonb_build_object('reasoning', shortlist_reasoning))
     ))
  || jsonb_strip_nulls(jsonb_build_object(
       'concept', jsonb_strip_nulls(jsonb_build_object(
         'operationalDetails', concept_details,
         'audience', concept_audience,
         'notes', concept_notes
       ))
     ))
where shortlist_reasoning is not null
   or concept_details is not null
   or concept_audience is not null
   or concept_notes is not null;

alter table public.ideas
  drop column if exists shortlist_reasoning,
  drop column if exists concept_details,
  drop column if exists concept_audience,
  drop column if exists concept_notes;

-- ============================================================================
-- Reseed: new labs now get 6 stages, with default gate checklists on
-- Shortlist and Go-Live. Existing labs are migrated further down.
-- ============================================================================

create or replace function public.seed_default_stages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.stages (lab_id, name, position, description, gate_checklist) values
    (new.id, 'Longlist', 1,
     'Every idea starts here — quick capture, no filter yet.',
     '[]'::jsonb),
    (new.id, 'Shortlist', 2,
     'Ideas worth pursuing. Say why, and what to watch for.',
     '[
       {"key": "fits_theme", "label": "Fits lab theme"},
       {"key": "feasible_partners", "label": "Feasible with current partners"},
       {"key": "differentiated", "label": "Differentiated from existing offer"},
       {"key": "cost_sense_checked", "label": "Rough cost/effort sense-checked"}
     ]'::jsonb),
    (new.id, 'Concept', 3,
     'Build out the idea — place, story, how it runs, what it looks like.',
     '[]'::jsonb),
    (new.id, 'Prototyping / Field-Testing', 4,
     'Try it for real. Log what happened.',
     '[]'::jsonb),
    (new.id, 'Go-Live', 5,
     'Everything needed to launch, checked off.',
     '[
       {"key": "operational_ready", "label": "Operational details ready"},
       {"key": "marketing_ready", "label": "Marketing assets ready"},
       {"key": "staffing_confirmed", "label": "Staffing confirmed"},
       {"key": "pricing_set", "label": "Pricing set"},
       {"key": "legal_cleared", "label": "Legal/permits and insurance cleared"},
       {"key": "partner_signed_off", "label": "Partner agreement signed off"},
       {"key": "safety_assessed", "label": "Safety/risk assessment done"},
       {"key": "booking_live", "label": "Booking/listing live"}
     ]'::jsonb),
    (new.id, 'Distribution', 6,
     'Get it in front of travelers — channels and rollout tasks.',
     '[]'::jsonb);
  return new;
end;
$$;

-- Backfill: existing labs only have the old 3 stages (Longlist/Shortlist/
-- Concept). Add the 3 new stages after Concept, and backfill descriptions
-- and gate_checklist on the 3 that already exist.
do $$
declare
  lab record;
  concept_position int;
begin
  for lab in select id from public.labs loop
    select position into concept_position
    from public.stages where lab_id = lab.id and name = 'Concept';

    if concept_position is not null
       and not exists (select 1 from public.stages where lab_id = lab.id and name = 'Prototyping / Field-Testing')
    then
      insert into public.stages (lab_id, name, position, description, gate_checklist) values
        (lab.id, 'Prototyping / Field-Testing', concept_position + 1,
         'Try it for real. Log what happened.', '[]'::jsonb),
        (lab.id, 'Go-Live', concept_position + 2,
         'Everything needed to launch, checked off.',
         '[
           {"key": "operational_ready", "label": "Operational details ready"},
           {"key": "marketing_ready", "label": "Marketing assets ready"},
           {"key": "staffing_confirmed", "label": "Staffing confirmed"},
           {"key": "pricing_set", "label": "Pricing set"},
           {"key": "legal_cleared", "label": "Legal/permits and insurance cleared"},
           {"key": "partner_signed_off", "label": "Partner agreement signed off"},
           {"key": "safety_assessed", "label": "Safety/risk assessment done"},
           {"key": "booking_live", "label": "Booking/listing live"}
         ]'::jsonb),
        (lab.id, 'Distribution', concept_position + 3,
         'Get it in front of travelers — channels and rollout tasks.', '[]'::jsonb);
    end if;
  end loop;

  update public.stages set
    description = 'Every idea starts here — quick capture, no filter yet.'
  where name = 'Longlist' and description is null;

  update public.stages set
    description = 'Ideas worth pursuing. Say why, and what to watch for.',
    gate_checklist = '[
      {"key": "fits_theme", "label": "Fits lab theme"},
      {"key": "feasible_partners", "label": "Feasible with current partners"},
      {"key": "differentiated", "label": "Differentiated from existing offer"},
      {"key": "cost_sense_checked", "label": "Rough cost/effort sense-checked"}
    ]'::jsonb
  where name = 'Shortlist' and description is null;

  update public.stages set
    description = 'Build out the idea — place, story, how it runs, what it looks like.'
  where name = 'Concept' and description is null;
end $$;

-- ============================================================================
-- Shortlist gate now checks stage_data instead of a dedicated column.
-- Still only a reasoning requirement — the "things to consider" checklist is
-- tracked but non-blocking per product decision.
-- ============================================================================

create or replace function public.enforce_shortlist_reasoning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  longlist_position int;
  new_stage_position int;
  reasoning text;
begin
  if TG_OP = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    select position into longlist_position
    from public.stages where lab_id = new.lab_id and name = 'Longlist';

    select position into new_stage_position
    from public.stages where id = new.stage_id;

    reasoning := new.stage_data #>> '{shortlist,reasoning}';

    if new_stage_position > longlist_position
       and (reasoning is null or btrim(reasoning) = '') then
      raise exception 'A reasoning note is required before moving an idea out of Longlist';
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- Storage: private bucket for Concept-stage Visuals uploads, scoped by lab
-- the same way every other table is — path convention is
-- "{lab_id}/{idea_id}/{filename}" and RLS reads the lab_id off the path.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'idea-visuals',
  'idea-visuals',
  false,
  10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "idea_visuals_select" on storage.objects for select
using (
  bucket_id = 'idea-visuals'
  and public.has_lab_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);

create policy "idea_visuals_insert" on storage.objects for insert
with check (
  bucket_id = 'idea-visuals'
  and public.has_lab_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);

create policy "idea_visuals_delete" on storage.objects for delete
using (
  bucket_id = 'idea-visuals'
  and public.has_lab_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);
