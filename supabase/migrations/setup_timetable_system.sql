-- Setup Timetable System Schema, Sections, and RLS Policies
-- Enables course_code, course_name, faculty, batch on timetable and profiles,
-- expands sections table for all IIITDM Jabalpur departments, and enforces
-- role-scoped management and duplicate prevention.

begin;

-- 1. Profile extensions
alter table public.profiles
  add column if not exists batch text;

-- 2. Timetable extensions
alter table public.timetable
  add column if not exists course_code text,
  add column if not exists course_name text,
  add column if not exists faculty text,
  add column if not exists batch text;

-- Make subject optional (synced with course_code/course_name)
alter table public.timetable
  alter column subject drop not null;

-- Expand allowed timetable types
alter table public.timetable
  drop constraint if exists timetable_type_valid;

alter table public.timetable
  add constraint timetable_type_valid
  check (type in ('class', 'lab', 'tut', 'break', 'free'));

-- Remove rigid room restriction for non-classroom or elective halls
alter table public.timetable
  drop constraint if exists timetable_room_for_class;

-- 3. Trigger to ensure consistent defaults for timetable entries
create or replace function public.handle_timetable_defaults()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  if nullif(btrim(new.course_code), '') is not null then
    new.course_code := btrim(new.course_code);
  end if;

  if nullif(btrim(new.course_name), '') is null then
    new.course_name := coalesce(new.course_code, new.subject, 'Class');
  else
    new.course_name := btrim(new.course_name);
  end if;

  if nullif(btrim(new.subject), '') is null then
    new.subject := coalesce(new.course_code, new.course_name, 'Class');
  end if;

  if nullif(btrim(new.course_code), '') is null then
    new.course_code := new.subject;
  end if;

  if nullif(btrim(new.batch), '') is not null then
    new.batch := btrim(new.batch);
  else
    new.batch := null;
  end if;

  if nullif(btrim(new.faculty), '') is not null then
    new.faculty := btrim(new.faculty);
  else
    new.faculty := null;
  end if;

  if nullif(btrim(new.room), '') is not null then
    new.room := btrim(new.room);
  else
    new.room := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists timetable_defaults_trigger on public.timetable;
create trigger timetable_defaults_trigger
before insert or update on public.timetable
for each row execute function public.handle_timetable_defaults();

-- 4. Ensure complete structural sections for IIITDM Jabalpur
-- CSE: A, B
-- ECE: C, A
-- ME: D1, D, A
-- MECH: D1, D, A
-- SM: D2, D, A
-- DS: E, E1, E2, A
insert into public.sections (name, branch, semester)
select s_name, b_name, sem
from (
  select 'CSE' as b_name, unnest(array['A', 'B']) as s_name
  union all
  select 'ECE' as b_name, unnest(array['C', 'A']) as s_name
  union all
  select 'ME' as b_name, unnest(array['D1', 'D', 'A']) as s_name
  union all
  select 'MECH' as b_name, unnest(array['D1', 'D', 'A']) as s_name
  union all
  select 'SM' as b_name, unnest(array['D2', 'D', 'A']) as s_name
  union all
  select 'DS' as b_name, unnest(array['E', 'E1', 'E2', 'A']) as s_name
) dept_sections
cross join generate_series(1, 8) as sem
on conflict (name, branch, semester) do nothing;

-- 5. Duplicate Prevention Index
-- Blocks duplicate / overlapping classes for same section, day, start_time, and batch
create unique index if not exists timetable_unique_slot_idx
  on public.timetable (
    section_id,
    day_of_week,
    start_time,
    coalesce(upper(btrim(batch)), 'ALL')
  );

-- 6. Helper & RLS Functions

-- Timetable visibility check
create or replace function public.can_view_timetable(
  requested_section_id uuid,
  requested_batch text default null
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and (
        -- Professors can view all timetable entries or sections assigned to them
        profile.role = 'professor'
        -- Students and CRs can view their assigned section and batch (or batch ALL)
        or (
          profile.role in ('student', 'class_leader')
          and profile.section_id = requested_section_id
          and (
            requested_batch is null
            or upper(btrim(requested_batch)) in ('', 'ALL')
            or profile.batch is null
            or upper(btrim(profile.batch)) in ('', 'ALL')
            or upper(btrim(profile.batch)) = upper(btrim(requested_batch))
          )
        )
      )
  )
$$;

-- Timetable management check (CRs only for own section; Professors for assigned sections)
create or replace function public.can_manage_timetable(
  requested_section_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.can_manage_section(requested_section_id)
$$;

-- 7. Update Timetable RLS Policies
drop policy if exists timetable_select_authorized on public.timetable;
create policy timetable_select_authorized
on public.timetable for select
to authenticated
using (public.can_view_timetable(section_id, batch));

drop policy if exists timetable_insert_authorized on public.timetable;
create policy timetable_insert_authorized
on public.timetable for insert
to authenticated
with check (
  public.can_manage_timetable(section_id)
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists timetable_update_authorized on public.timetable;
create policy timetable_update_authorized
on public.timetable for update
to authenticated
using (public.can_manage_timetable(section_id))
with check (public.can_manage_timetable(section_id));

drop policy if exists timetable_delete_authorized on public.timetable;
create policy timetable_delete_authorized
on public.timetable for delete
to authenticated
using (public.can_manage_timetable(section_id));

commit;
