-- IIITDM Campus Companion: section-scoped content management
--
-- This migration is non-destructive. It keeps every table and row, replaces
-- only authorization helper functions and RLS policies, and assumes the clean
-- backend schema in clean_backend.sql is already installed.

begin;

-- Ensure every batch selectable by the existing signup and management forms
-- has a real section UUID. Existing section rows and data are preserved.
insert into public.sections (name, branch, semester)
select section_name, branch_name, semester_number
from unnest(array['A', 'B', 'C', 'D', 'E']) as section_names(section_name)
cross join unnest(array['CSE', 'ECE', 'MECH', 'SM']) as branch_names(branch_name)
cross join generate_series(1, 8) as semesters(semester_number)
on conflict (name, branch, semester) do nothing;

-- Public signup may ask only whether one email/role pair has been approved.
-- The authorization table itself remains unreadable from the browser.
create or replace function public.is_staff_signup_authorized(
  requested_email text,
  requested_role text
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.staff_signup_authorizations staff_entry
    where staff_entry.email = lower(btrim(requested_email))
      and staff_entry.role = case lower(btrim(requested_role))
        when 'cr' then 'class_leader'
        when 'class_leader' then 'class_leader'
        when 'professor' then 'professor'
        else ''
      end
  )
$$;

-- Update the existing Auth trigger function in place. The trigger itself is
-- left untouched, so there remains exactly one profile-creation trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  requested_role text := 'student';
  requested_branch text := null;
  requested_semester integer := null;
  requested_section_id uuid := null;
  requested_roll_no integer := null;
  requested_admission_year integer := null;
  requested_section_name text := null;
  raw_value text;
begin
  requested_role := case lower(coalesce(new.raw_user_meta_data ->> 'role', 'student'))
    when 'cr' then 'class_leader'
    when 'class_leader' then 'class_leader'
    when 'professor' then 'professor'
    else 'student'
  end;

  if requested_role in ('class_leader', 'professor')
    and not public.is_staff_signup_authorized(new.email, requested_role) then
    raise exception 'Staff signup is not authorized for this email and role'
      using errcode = '42501';
  end if;

  requested_branch := nullif(
    upper(btrim(new.raw_user_meta_data ->> 'branch')),
    ''
  );

  raw_value := nullif(btrim(new.raw_user_meta_data ->> 'semester'), '');
  if raw_value ~ '^[1-8]$' then
    requested_semester := raw_value::integer;
  end if;

  raw_value := nullif(btrim(new.raw_user_meta_data ->> 'roll_no'), '');
  if raw_value ~ '^[0-9]+$' then
    begin
      requested_roll_no := raw_value::integer;
    exception when numeric_value_out_of_range then
      requested_roll_no := null;
    end;
  end if;

  raw_value := nullif(btrim(new.raw_user_meta_data ->> 'admission_year'), '');
  if raw_value ~ '^[0-9]+$' then
    begin
      requested_admission_year := raw_value::integer;
    exception when numeric_value_out_of_range then
      requested_admission_year := null;
    end;
  end if;

  raw_value := nullif(btrim(new.raw_user_meta_data ->> 'section_id'), '');
  if raw_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    begin
      select section_record.id,
             coalesce(requested_branch, section_record.branch),
             coalesce(requested_semester, section_record.semester)
      into requested_section_id, requested_branch, requested_semester
      from public.sections section_record
      where section_record.id = raw_value::uuid;
    exception when invalid_text_representation then
      requested_section_id := null;
    end;
  end if;

  requested_section_name := nullif(
    upper(btrim(new.raw_user_meta_data ->> 'section_name')),
    ''
  );

  if requested_section_id is null
    and requested_section_name is not null
    and requested_branch is not null
    and requested_semester is not null then
    select section_record.id
    into requested_section_id
    from public.sections section_record
    where section_record.name = requested_section_name
      and section_record.branch = requested_branch
      and section_record.semester = requested_semester;
  end if;

  insert into public.profiles (
    id, full_name, email, role, branch, semester, section_id,
    roll_no, admission_year
  ) values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(lower(new.email), '@', 1)
    ),
    lower(new.email),
    requested_role,
    requested_branch,
    requested_semester,
    requested_section_id,
    requested_roll_no,
    requested_admission_year
  );

  return new;
end;
$$;

-- A class leader manages only the section stored on their own profile.
create or replace function public.is_class_leader_for_section(
  requested_section_id uuid
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
      and profile.role = 'class_leader'
      and profile.section_id = requested_section_id
  )
$$;

-- A professor manages only sections explicitly assigned through
-- section_professors. Class leaders use their profile.section_id assignment.
create or replace function public.can_manage_section(
  requested_section_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case public.get_current_user_role()
    when 'class_leader' then
      public.is_class_leader_for_section(requested_section_id)
    when 'professor' then
      public.is_professor_for_section(requested_section_id)
    else false
  end
$$;

-- Verify an announcement target against the caller's real database
-- assignments. ALL is allowed only when the caller manages every section in
-- that semester and branch, preventing a one-section CR or professor from
-- targeting unrelated sections.
create or replace function public.can_manage_announcement_target(
  announcement_semester integer,
  announcement_branch text,
  announcement_section text
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when announcement_semester not between 1 and 8 then false
    when nullif(btrim(announcement_branch), '') is null then false
    when upper(coalesce(announcement_section, 'ALL')) = 'ALL' then
      exists (
        select 1
        from public.sections section_record
        where section_record.semester = announcement_semester
          and section_record.branch = upper(announcement_branch)
      )
      and not exists (
        select 1
        from public.sections section_record
        where section_record.semester = announcement_semester
          and section_record.branch = upper(announcement_branch)
          and not public.can_manage_section(section_record.id)
      )
    else exists (
      select 1
      from public.sections section_record
      where section_record.semester = announcement_semester
        and section_record.branch = upper(announcement_branch)
        and section_record.name = upper(announcement_section)
        and public.can_manage_section(section_record.id)
    )
  end
$$;

-- Users see only announcements relevant to their own/assigned sections.
create or replace function public.can_view_announcement(
  announcement_semester integer,
  announcement_branch text,
  announcement_section text
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
    join public.sections section_record
      on section_record.id = profile.section_id
    where profile.id = auth.uid()
      and profile.role in ('student', 'class_leader')
      and section_record.semester = announcement_semester
      and section_record.branch = upper(announcement_branch)
      and (
        upper(coalesce(announcement_section, 'ALL')) = 'ALL'
        or section_record.name = upper(announcement_section)
      )
  )
  or exists (
    select 1
    from public.section_professors assignment
    join public.sections section_record
      on section_record.id = assignment.section_id
    where assignment.professor_id = auth.uid()
      and section_record.semester = announcement_semester
      and section_record.branch = upper(announcement_branch)
      and (
        upper(coalesce(announcement_section, 'ALL')) = 'ALL'
        or section_record.name = upper(announcement_section)
      )
  )
$$;

-- Students and class leaders see their own section. Professors see assigned
-- sections. The same section rule is used for all timetable writes.
create or replace function public.can_view_timetable(
  requested_section_id uuid
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
        (
          profile.role in ('student', 'class_leader')
          and profile.section_id = requested_section_id
        )
        or (
          profile.role = 'professor'
          and public.is_professor_for_section(requested_section_id)
        )
      )
  )
$$;

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

drop policy if exists section_professors_select_staff
  on public.section_professors;
drop policy if exists section_professors_select_own
  on public.section_professors;
create policy section_professors_select_own
on public.section_professors for select
to authenticated
using (professor_id = auth.uid());

drop policy if exists announcements_select_targeted
  on public.announcements;
drop policy if exists announcements_insert_staff
  on public.announcements;
drop policy if exists announcements_update_staff
  on public.announcements;
drop policy if exists announcements_delete_staff
  on public.announcements;
drop policy if exists announcements_insert_scoped
  on public.announcements;
drop policy if exists announcements_update_scoped
  on public.announcements;
drop policy if exists announcements_delete_scoped
  on public.announcements;

create policy announcements_select_targeted
on public.announcements for select
to authenticated
using (
  public.can_view_announcement(
    target_semester,
    target_branch,
    target_section
  )
);

create policy announcements_insert_scoped
on public.announcements for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.can_manage_announcement_target(
    target_semester,
    target_branch,
    target_section
  )
);

create policy announcements_update_scoped
on public.announcements for update
to authenticated
using (
  public.can_manage_announcement_target(
    target_semester,
    target_branch,
    target_section
  )
)
with check (
  public.can_manage_announcement_target(
    target_semester,
    target_branch,
    target_section
  )
);

create policy announcements_delete_scoped
on public.announcements for delete
to authenticated
using (
  public.can_manage_announcement_target(
    target_semester,
    target_branch,
    target_section
  )
);

-- Recreate timetable policies so installations with an older broad class
-- leader helper immediately receive the section-scoped behavior.
drop policy if exists timetable_select_authorized
  on public.timetable;
drop policy if exists timetable_insert_authorized
  on public.timetable;
drop policy if exists timetable_update_authorized
  on public.timetable;
drop policy if exists timetable_delete_authorized
  on public.timetable;

create policy timetable_select_authorized
on public.timetable for select
to authenticated
using (public.can_view_timetable(section_id));

create policy timetable_insert_authorized
on public.timetable for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.can_manage_timetable(section_id)
);

create policy timetable_update_authorized
on public.timetable for update
to authenticated
using (public.can_manage_timetable(section_id))
with check (public.can_manage_timetable(section_id));

create policy timetable_delete_authorized
on public.timetable for delete
to authenticated
using (public.can_manage_timetable(section_id));

revoke all on function public.is_class_leader_for_section(uuid) from public;
revoke all on function public.can_manage_section(uuid) from public;
revoke all on function public.can_manage_announcement_target(integer, text, text) from public;
revoke all on function public.is_staff_signup_authorized(text, text) from public;

grant execute on function public.is_class_leader_for_section(uuid) to authenticated;
grant execute on function public.can_manage_section(uuid) to authenticated;
grant execute on function public.can_manage_announcement_target(integer, text, text)
  to authenticated;
grant execute on function public.is_staff_signup_authorized(text, text)
  to anon, authenticated;

-- Enable Realtime broadcast for timetable and announcements
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'timetable'
    ) then
      alter publication supabase_realtime add table public.timetable;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'announcements'
    ) then
      alter publication supabase_realtime add table public.announcements;
    end if;
  end if;
end;
$$;

commit;
