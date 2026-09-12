-- Fix/Sync batch assignments and section_id for all Students and CRs
-- Ensures every CR and Student has their valid section_id so they receive
-- live timetable updates and can manage their section's schedule.

begin;

update public.profiles p
set
  branch = nullif(upper(btrim(u.raw_user_meta_data ->> 'branch')), ''),
  semester = case
    when (u.raw_user_meta_data ->> 'semester') ~ '^[1-8]$'
    then (u.raw_user_meta_data ->> 'semester')::integer
    else p.semester
  end,
  section_id = coalesce(
    (
      select s.id
      from public.sections s
      where s.name = upper(btrim(coalesce(u.raw_user_meta_data ->> 'section_name', 'A')))
        and s.branch = upper(btrim(u.raw_user_meta_data ->> 'branch'))
        and s.semester = case
          when (u.raw_user_meta_data ->> 'semester') ~ '^[1-8]$'
          then (u.raw_user_meta_data ->> 'semester')::integer
          else coalesce(p.semester, 1)
        end
      limit 1
    ),
    p.section_id
  )
from auth.users u
where p.id = u.id
  and p.role in ('student', 'class_leader')
  and nullif(upper(btrim(u.raw_user_meta_data ->> 'branch')), '') is not null
  and (
    p.branch is null
    or p.branch <> upper(btrim(u.raw_user_meta_data ->> 'branch'))
    or p.section_id is null
    or exists (
      select 1
      from public.sections existing_section
      where existing_section.id = p.section_id
        and existing_section.branch <> upper(btrim(u.raw_user_meta_data ->> 'branch'))
    )
  );

commit;
