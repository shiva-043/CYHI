-- ====================================================================
-- FIX & SYNCHRONIZE BRANCH AND SECTION ASSIGNMENTS
-- ====================================================================
-- Fixes any account where public.profiles has 'MECH' (or any mismatched
-- branch/section) while the user registered in 'CSE' (or another branch).
-- Run this in the Supabase SQL Editor.

-- STEP 1: PRE-CHECK / DIAGNOSTIC
-- Run this block first if you want to inspect which users have a mismatch:
select
  u.id,
  u.email,
  u.raw_user_meta_data ->> 'role' as meta_role,
  u.raw_user_meta_data ->> 'branch' as meta_branch,
  u.raw_user_meta_data ->> 'semester' as meta_semester,
  u.raw_user_meta_data ->> 'section_name' as meta_section,
  p.role as profile_role,
  p.branch as profile_branch,
  p.semester as profile_semester,
  s.name as section_name,
  s.branch as section_branch
from auth.users u
join public.profiles p on p.id = u.id
left join public.sections s on s.id = p.section_id
order by u.created_at;

-- STEP 2: SYNCHRONIZE PROFILES FROM AUTH METADATA
-- Updates all Student and CR profiles so their branch, semester, and section_id
-- strictly match what the user selected during registration.
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

-- STEP 3: MANUAL OVERRIDE HELPER (OPTIONAL)
-- If a specific user registered with the wrong branch even in their metadata,
-- replace 'user@iiitdmj.ac.in', 'CSE', 1, 'A' below and execute:
/*
begin;

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
  'branch', 'CSE',
  'semester', 1,
  'section_name', 'A'
)
where lower(email) = 'user@iiitdmj.ac.in';

update public.profiles
set
  branch = 'CSE',
  semester = 1,
  section_id = (
    select id from public.sections
    where branch = 'CSE' and semester = 1 and name = 'A'
    limit 1
  )
where lower(email) = 'user@iiitdmj.ac.in';

commit;
*/
