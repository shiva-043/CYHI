-- IIITDM JABALPUR CAMPUS COMPANION: CLEAN SUPABASE BACKEND
-- DESTRUCTIVE REVIEW DRAFT - DO NOT RUN WITHOUT EXPLICIT RESET APPROVAL.
--
-- This migration preserves auth.users and every Supabase-managed auth object.
-- It deletes and recreates only these public application tables:
--   announcements, timetable, section_professors, profiles, sections,
--   staff_signup_authorizations
-- It removes the existing auth.users trigger only when that trigger calls
-- public.handle_new_user(). It then recreates exactly one profile trigger.
-- The transaction rolls back completely if any statement fails.

begin;

-- The current project uses this exact trigger name. Remove it before dropping
-- its function so PostgreSQL does not report dependency error 2BP01.
drop trigger if exists on_auth_user_created on auth.users;

-- Remove only triggers that call the known old profile-creation function.
-- This also handles an older installation that used a different trigger name.
do $$
declare
  trigger_to_remove record;
begin
  if pg_catalog.to_regprocedure('public.handle_new_user()') is not null then
    for trigger_to_remove in
      select trigger_record.tgname
      from pg_catalog.pg_trigger trigger_record
      join pg_catalog.pg_class relation
        on relation.oid = trigger_record.tgrelid
      join pg_catalog.pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'auth'
        and relation.relname = 'users'
        and not trigger_record.tgisinternal
        and trigger_record.tgfoid = 'public.handle_new_user()'::regprocedure
    loop
      execute format(
        'drop trigger %I on auth.users',
        trigger_to_remove.tgname
      );
    end loop;
  end if;
end;
$$;

-- Destructive application reset. No CASCADE is used: an unknown dependency
-- stops and rolls back the migration instead of being removed silently.
drop table if exists public.announcements;
drop table if exists public.timetable;
drop table if exists public.section_professors;
drop table if exists public.profiles;
drop table if exists public.sections;
drop table if exists public.staff_signup_authorizations;

drop function if exists public.handle_new_user();
drop function if exists public.set_content_audit_fields();
drop function if exists public.set_updated_at();
drop function if exists public.validate_section_professor();
drop function if exists public.can_manage_announcement_target(integer, text, text);
drop function if exists public.can_manage_timetable(uuid);
drop function if exists public.can_view_timetable(uuid);
drop function if exists public.can_view_announcement(integer, text, text);
drop function if exists public.can_manage_section(uuid);
drop function if exists public.is_class_leader_for_section(uuid);
drop function if exists public.is_professor_for_section(uuid);
drop function if exists public.is_staff();
drop function if exists public.get_current_user_role();

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  branch text not null,
  semester integer not null,
  created_at timestamptz not null default now(),
  constraint sections_name_not_blank check (btrim(name) <> ''),
  constraint sections_name_uppercase check (name = upper(name)),
  constraint sections_branch_not_blank check (btrim(branch) <> ''),
  constraint sections_branch_uppercase check (branch = upper(branch)),
  constraint sections_semester_valid check (semester between 1 and 8),
  constraint sections_batch_unique unique (name, branch, semester)
);

-- These are structural batch identifiers, not fake timetable or student data.
insert into public.sections (name, branch, semester)
select section_name, branch_name, semester_number
from unnest(array['A', 'B', 'C', 'D', 'E']) as section_names(section_name)
cross join unnest(array['CSE', 'ECE', 'MECH', 'SM']) as branch_names(branch_name)
cross join generate_series(1, 8) as semesters(semester_number);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null default 'student',
  branch text,
  semester integer,
  section_id uuid references public.sections(id) on delete set null,
  roll_no integer,
  admission_year integer,
  created_at timestamptz not null default now(),
  constraint profiles_name_not_blank check (btrim(full_name) <> ''),
  constraint profiles_email_lowercase check (email = lower(email)),
  constraint profiles_role_valid check (
    role in ('student', 'class_leader', 'professor')
  ),
  constraint profiles_branch_valid check (
    branch is null or (btrim(branch) <> '' and branch = upper(branch))
  ),
  constraint profiles_semester_valid check (
    semester is null or semester between 1 and 8
  ),
  constraint profiles_roll_number_valid check (
    roll_no is null or roll_no > 0
  ),
  constraint profiles_admission_year_valid check (
    admission_year is null or admission_year between 2000 and 2100
  )
);

-- Staff roles requested by public signup must be authorized here first.
-- This table has RLS and no client policies, so only trusted server/database
-- administrators can change it.
create table public.staff_signup_authorizations (
  email text primary key,
  role text not null,
  created_at timestamptz not null default now(),
  constraint staff_authorization_email_lowercase check (email = lower(email)),
  constraint staff_authorization_role_valid check (
    role in ('class_leader', 'professor')
  )
);

create table public.section_professors (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint section_professors_unique unique (section_id, professor_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null,
  target_semester integer not null,
  target_branch text not null,
  target_section text default 'ALL',
  deadline timestamptz,
  button_text text,
  action_url text,
  created_by uuid not null default auth.uid()
    references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_title_not_blank check (btrim(title) <> ''),
  constraint announcements_description_not_blank check (btrim(description) <> ''),
  constraint announcements_category_valid check (
    category in ('Academic', 'Events', 'Urgent')
  ),
  constraint announcements_semester_valid check (target_semester between 1 and 8),
  constraint announcements_branch_valid check (
    btrim(target_branch) <> '' and target_branch = upper(target_branch)
  ),
  constraint announcements_section_valid check (
    target_section is null
    or upper(target_section) in ('A', 'B', 'C', 'D', 'E', 'ALL')
  )
);

create table public.timetable (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  subject text not null,
  room text,
  day_of_week text not null,
  start_time time not null,
  end_time time not null,
  type text not null,
  created_by uuid default auth.uid()
    references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetable_subject_not_blank check (btrim(subject) <> ''),
  constraint timetable_day_valid check (
    day_of_week in (
      'Monday', 'Tuesday', 'Wednesday', 'Thursday',
      'Friday', 'Saturday', 'Sunday'
    )
  ),
  constraint timetable_type_valid check (type in ('class', 'break', 'free')),
  constraint timetable_time_valid check (start_time < end_time),
  constraint timetable_room_for_class check (
    type <> 'class' or nullif(btrim(room), '') is not null
  )
);

-- Primary keys and unique constraints already index every id. Add only indexes
-- used by role checks, targeting, and timetable lookups.
create index profiles_role_index on public.profiles(role);
create index profiles_branch_index on public.profiles(branch);
create index profiles_semester_index on public.profiles(semester);
create index profiles_section_index on public.profiles(section_id);
create index sections_batch_lookup_index
  on public.sections(branch, semester, name);
create index section_professors_professor_index
  on public.section_professors(professor_id, section_id);
create index announcements_semester_index
  on public.announcements(target_semester);
create index announcements_branch_index
  on public.announcements(target_branch);
create index announcements_section_index
  on public.announcements(target_section);
create index announcements_dashboard_index
  on public.announcements(category, created_at desc);
create index timetable_daily_lookup_index
  on public.timetable(section_id, day_of_week, start_time);

-- RLS-safe authorization helpers. They read protected tables as the function
-- owner and expose only booleans or the current user's role.
create function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select profile.role
  from public.profiles profile
  where profile.id = auth.uid()
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    public.get_current_user_role() in ('class_leader', 'professor'),
    false
  )
$$;

create function public.is_professor_for_section(requested_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.section_professors assignment
    where assignment.professor_id = auth.uid()
      and assignment.section_id = requested_section_id
  )
$$;

create function public.is_class_leader_for_section(requested_section_id uuid)
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

create function public.can_manage_section(requested_section_id uuid)
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

create function public.can_manage_announcement_target(
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

create function public.can_view_announcement(
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

create function public.can_view_timetable(requested_section_id uuid)
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

create function public.can_manage_timetable(requested_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.can_manage_section(requested_section_id)
$$;

-- Enforce the professor role even for trusted SQL inserts.
create function public.validate_section_professor()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = new.professor_id
      and profile.role = 'professor'
  ) then
    raise exception 'professor_id must reference a professor profile'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger validate_section_professor_before_write
before insert or update of professor_id
on public.section_professors
for each row execute function public.validate_section_professor();

-- Keep creator identity immutable and maintain timestamps.
create function public.set_content_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := coalesce(new.created_at, now());
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger announcements_audit_fields
before insert or update on public.announcements
for each row execute function public.set_content_audit_fields();

create trigger timetable_audit_fields
before insert or update on public.timetable
for each row execute function public.set_content_audit_fields();

-- Create a profile for every Auth user. Optional numeric and UUID metadata is
-- accepted only when it is safe to cast. Invalid optional data becomes NULL.
create function public.handle_new_user()
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

  -- A browser cannot grant itself a staff role. Only an email pre-authorized
  -- by a database administrator receives class_leader or professor.
  if requested_role in ('class_leader', 'professor') and not exists (
    select 1
    from public.staff_signup_authorizations staff_entry
    where staff_entry.email = lower(new.email)
      and staff_entry.role = requested_role
  ) then
    requested_role := 'student';
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
      select section_record.id, section_record.branch, section_record.semester
      into requested_section_id, requested_branch, requested_semester
      from public.sections section_record
      where section_record.id = raw_value::uuid;
    exception when invalid_text_representation then
      requested_section_id := null;
    end;
  end if;

  -- The signup page sends a section name. Resolve it using all three batch
  -- fields so CSE Semester 3 Section A is distinct from every other A section.
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
    id,
    full_name,
    email,
    role,
    branch,
    semester,
    section_id,
    roll_no,
    admission_year
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

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Refuse to commit if another public application trigger is also attached to
-- auth.users. Supabase-managed internal/auth-schema triggers are not counted.
do $$
declare
  public_auth_trigger_count integer;
begin
  select count(*)
  into public_auth_trigger_count
  from pg_catalog.pg_trigger trigger_record
  join pg_catalog.pg_class relation
    on relation.oid = trigger_record.tgrelid
  join pg_catalog.pg_namespace table_namespace
    on table_namespace.oid = relation.relnamespace
  join pg_catalog.pg_proc function_record
    on function_record.oid = trigger_record.tgfoid
  join pg_catalog.pg_namespace function_namespace
    on function_namespace.oid = function_record.pronamespace
  where table_namespace.nspname = 'auth'
    and relation.relname = 'users'
    and not trigger_record.tgisinternal
    and function_namespace.nspname = 'public';

  if public_auth_trigger_count <> 1 then
    raise exception
      'Expected one public application trigger on auth.users, found %; inspect before resetting',
      public_auth_trigger_count;
  end if;
end;
$$;

-- auth.users is intentionally preserved. Recreate one safe Student profile for
-- every existing Auth account so no retained user is left without a profile.
-- Administrators can assign approved staff roles and batch fields afterward.
insert into public.profiles (id, full_name, email, role)
select
  auth_user.id,
  coalesce(
    nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(auth_user.raw_user_meta_data ->> 'name'), ''),
    split_part(lower(auth_user.email), '@', 1)
  ),
  lower(auth_user.email),
  'student'
from auth.users auth_user
where auth_user.email is not null;

-- Enable RLS on every application table.
alter table public.profiles enable row level security;
alter table public.sections enable row level security;
alter table public.section_professors enable row level security;
alter table public.staff_signup_authorizations enable row level security;
alter table public.announcements enable row level security;
alter table public.timetable enable row level security;

-- Profiles: each user can read only their own row. Profile assignment and role
-- changes remain administrator operations.
create policy profiles_select_own
on public.profiles for select
to authenticated
using (id = auth.uid());

-- All authenticated users need batch labels. Client writes are intentionally
-- absent; sections are maintained by trusted database administrators.
create policy sections_select_authenticated
on public.sections for select
to authenticated
using (true);

-- Professors can read only their own section assignments. No client write
-- policy is created; assignments remain administrator-maintained.
create policy section_professors_select_own
on public.section_professors for select
to authenticated
using (professor_id = auth.uid());

-- Announcement targeting is enforced before rows reach the browser.
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

-- Timetable visibility and modification are section-aware.
create policy timetable_select_authorized
on public.timetable for select
to authenticated
using (public.can_view_timetable(section_id));

create policy timetable_insert_authorized
on public.timetable for insert
to authenticated
with check (
  public.can_manage_timetable(section_id)
  and created_by = auth.uid()
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

-- Explicit API grants. RLS remains the final authority for every row.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.sections from anon, authenticated;
revoke all on table public.section_professors from anon, authenticated;
revoke all on table public.staff_signup_authorizations from anon, authenticated;
revoke all on table public.announcements from anon, authenticated;
revoke all on table public.timetable from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.sections to authenticated;
grant select on table public.section_professors to authenticated;
grant select, insert, update, delete on table public.announcements to authenticated;
grant select, insert, update, delete on table public.timetable to authenticated;

revoke all on function public.get_current_user_role() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.is_professor_for_section(uuid) from public;
revoke all on function public.is_class_leader_for_section(uuid) from public;
revoke all on function public.can_manage_section(uuid) from public;
revoke all on function public.can_manage_announcement_target(integer, text, text) from public;
revoke all on function public.can_view_announcement(integer, text, text) from public;
revoke all on function public.can_view_timetable(uuid) from public;
revoke all on function public.can_manage_timetable(uuid) from public;

grant execute on function public.get_current_user_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_professor_for_section(uuid) to authenticated;
grant execute on function public.is_class_leader_for_section(uuid) to authenticated;
grant execute on function public.can_manage_section(uuid) to authenticated;
grant execute on function public.can_manage_announcement_target(integer, text, text)
  to authenticated;
grant execute on function public.can_view_announcement(integer, text, text) to authenticated;
grant execute on function public.can_view_timetable(uuid) to authenticated;
grant execute on function public.can_manage_timetable(uuid) to authenticated;

revoke all on function public.handle_new_user() from public;
revoke all on function public.validate_section_professor() from public;
revoke all on function public.set_content_audit_fields() from public;

commit;
