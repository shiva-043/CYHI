-- Migration: allow_all_semesters_announcements.sql
-- Enables announcements and events to target "ALL" semesters and "ALL" branches
-- so announcements reach all registered students, CRs, and faculty.

-- 1. Relax target_semester NOT NULL and update semester check constraint
alter table public.announcements
  alter column target_semester drop not null;

alter table public.announcements
  drop constraint if exists announcements_semester_valid;

alter table public.announcements
  add constraint announcements_semester_valid
  check (
    target_semester is null
    or target_semester = 0
    or (target_semester between 1 and 8)
  );

-- 2. Relax target_branch NOT NULL and update branch check constraint
alter table public.announcements
  alter column target_branch drop not null;

alter table public.announcements
  drop constraint if exists announcements_branch_valid;

alter table public.announcements
  add constraint announcements_branch_valid
  check (
    target_branch is null
    or (btrim(target_branch) <> '' and target_branch = upper(target_branch))
  );

-- 3. Ensure target_section constraint allows NULL, specific sections, and ALL
alter table public.announcements
  drop constraint if exists announcements_section_valid;

alter table public.announcements
  add constraint announcements_section_valid
  check (
    target_section is null
    or (btrim(target_section) <> '' and target_section = upper(target_section))
  );

-- 4. Ensure created_by defaults to the authenticated user and has safety trigger
alter table public.announcements
  alter column created_by set default auth.uid();

create or replace function public.handle_announcement_defaults()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists announcement_set_defaults on public.announcements;
create trigger announcement_set_defaults
before insert on public.announcements
for each row execute function public.handle_announcement_defaults();

-- 5. Update can_view_announcement so ALL semesters/branches reach all registered students and CRs
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
    left join public.sections section_record
      on section_record.id = profile.section_id
    where profile.id = auth.uid()
      and (
        -- Case 1: Student or Class Leader (CR)
        (
          profile.role in ('student', 'class_leader', 'cr')
          and (
            -- Semester: ALL (null / 0) or exact match
            announcement_semester is null
            or announcement_semester = 0
            or coalesce(section_record.semester, profile.semester) = announcement_semester
          )
          and (
            -- Branch: ALL (null / 'ALL') or exact match
            announcement_branch is null
            or upper(btrim(announcement_branch)) = 'ALL'
            or upper(coalesce(section_record.branch, profile.branch, '')) = upper(btrim(announcement_branch))
          )
          and (
            -- Section: ALL (null / 'ALL') or exact match
            announcement_section is null
            or upper(btrim(announcement_section)) = 'ALL'
            or upper(coalesce(section_record.name, '')) = upper(btrim(announcement_section))
          )
        )
        -- Case 2: Professor
        or (
          profile.role = 'professor'
          and (
            -- ALL semesters and ALL branches
            (
              (announcement_semester is null or announcement_semester = 0)
              and (announcement_branch is null or upper(btrim(announcement_branch)) = 'ALL')
            )
            -- Matches professor department
            or (
              (announcement_semester is null or announcement_semester = 0)
              and upper(coalesce(profile.branch, '')) = upper(btrim(announcement_branch))
            )
            -- Assigned sections
            or exists (
              select 1
              from public.section_professors assignment
              join public.sections prof_section
                on prof_section.id = assignment.section_id
              where assignment.professor_id = auth.uid()
                and (
                  announcement_semester is null
                  or announcement_semester = 0
                  or prof_section.semester = announcement_semester
                )
                and (
                  announcement_branch is null
                  or upper(btrim(announcement_branch)) = 'ALL'
                  or upper(prof_section.branch) = upper(btrim(announcement_branch))
                )
                and (
                  announcement_section is null
                  or upper(btrim(announcement_section)) = 'ALL'
                  or upper(prof_section.name) = upper(btrim(announcement_section))
                )
            )
          )
        )
      )
  );
$$;

-- 6. Update can_manage_announcement_target for professors and CRs
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
    -- Professors can manage announcements
    when public.get_current_user_role() = 'professor' then true

    -- Class Leaders (CRs)
    when public.get_current_user_role() in ('class_leader', 'cr') then (
      case
        -- ALL semesters: allowed for CRs
        when announcement_semester is null or announcement_semester = 0 then true
        -- Specific semester: allowed if it matches their semester and branch
        when announcement_semester between 1 and 8 then
          exists (
            select 1
            from public.profiles profile
            left join public.sections section_record
              on section_record.id = profile.section_id
            where profile.id = auth.uid()
              and profile.role in ('class_leader', 'cr')
              and (
                announcement_branch is null
                or upper(btrim(announcement_branch)) = 'ALL'
                or upper(coalesce(section_record.branch, profile.branch, '')) = upper(btrim(announcement_branch))
              )
              and (
                coalesce(section_record.semester, profile.semester) = announcement_semester
                or profile.semester is null
              )
          )
        else false
      end
    )
    else false
  end;
$$;

-- 7. Refresh RLS policies on public.announcements (drop all variations)
drop policy if exists announcements_select_targeted on public.announcements;
drop policy if exists announcements_insert_scoped on public.announcements;
drop policy if exists announcements_update_scoped on public.announcements;
drop policy if exists announcements_delete_scoped on public.announcements;
drop policy if exists announcements_insert_staff on public.announcements;
drop policy if exists announcements_update_staff on public.announcements;
drop policy if exists announcements_delete_staff on public.announcements;

create policy announcements_select_targeted
on public.announcements for select
to authenticated
using (
  created_by = auth.uid()
  or public.can_view_announcement(
    target_semester,
    target_branch,
    target_section
  )
);

create policy announcements_insert_scoped
on public.announcements for insert
to authenticated
with check (
  (created_by is null or created_by = auth.uid())
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
  created_by = auth.uid()
  or public.can_manage_announcement_target(
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
  created_by = auth.uid()
  or public.can_manage_announcement_target(
    target_semester,
    target_branch,
    target_section
  )
);

-- 8. Explicit API and function grants
grant select, insert, update, delete on table public.announcements to authenticated;
grant execute on function public.can_view_announcement(integer, text, text) to authenticated;
grant execute on function public.can_manage_announcement_target(integer, text, text) to authenticated;
