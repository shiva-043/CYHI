-- Transactional role-scope tests for the Supabase SQL Editor.
-- Every temporary profile/assignment change is rolled back at the end.

begin;

do $test$
declare
  student_or_cr_id uuid;
  professor_id uuid;
  assigned_section public.sections%rowtype;
  unrelated_section public.sections%rowtype;
begin
  select profile.id
  into student_or_cr_id
  from public.profiles profile
  order by profile.created_at
  limit 1;

  select profile.id
  into professor_id
  from public.profiles profile
  where profile.id <> student_or_cr_id
  order by profile.created_at
  limit 1;

  select section_record.*
  into assigned_section
  from public.sections section_record
  order by section_record.semester, section_record.branch, section_record.name
  limit 1;

  select section_record.*
  into unrelated_section
  from public.sections section_record
  where section_record.semester = assigned_section.semester
    and section_record.branch = assigned_section.branch
    and section_record.id <> assigned_section.id
  order by section_record.name
  limit 1;

  if student_or_cr_id is null or professor_id is null then
    raise exception 'Two existing profiles are required for this rollback-only test.';
  end if;
  if assigned_section.id is null or unrelated_section.id is null then
    raise exception 'At least two sections in one batch are required for this test.';
  end if;

  update public.profiles
  set role = 'student',
      branch = assigned_section.branch,
      semester = assigned_section.semester,
      section_id = assigned_section.id
  where id = student_or_cr_id;

  perform set_config('request.jwt.claim.sub', student_or_cr_id::text, true);

  if public.can_manage_section(assigned_section.id)
    or public.can_manage_timetable(assigned_section.id)
    or public.can_manage_announcement_target(
      assigned_section.semester,
      assigned_section.branch,
      assigned_section.name
    ) then
    raise exception 'Student write-denial test failed.';
  end if;

  if not public.can_view_timetable(assigned_section.id)
    or public.can_view_timetable(unrelated_section.id)
    or not public.can_view_announcement(
      assigned_section.semester,
      assigned_section.branch,
      assigned_section.name
    )
    or public.can_view_announcement(
      unrelated_section.semester,
      unrelated_section.branch,
      unrelated_section.name
    ) then
    raise exception 'Student targeting test failed.';
  end if;

  update public.profiles
  set role = 'class_leader'
  where id = student_or_cr_id;

  if not public.can_manage_section(assigned_section.id)
    or public.can_manage_section(unrelated_section.id)
    or not public.can_manage_timetable(assigned_section.id)
    or public.can_manage_timetable(unrelated_section.id)
    or not public.can_manage_announcement_target(
      assigned_section.semester,
      assigned_section.branch,
      assigned_section.name
    )
    or public.can_manage_announcement_target(
      unrelated_section.semester,
      unrelated_section.branch,
      unrelated_section.name
    )
    or public.can_manage_announcement_target(
      assigned_section.semester,
      assigned_section.branch,
      'ALL'
    ) then
    raise exception 'Class Leader scope test failed.';
  end if;

  update public.profiles
  set role = 'professor', branch = null, semester = null, section_id = null
  where id = professor_id;

  insert into public.section_professors (section_id, professor_id)
  values (assigned_section.id, professor_id)
  on conflict (section_id, professor_id) do nothing;

  perform set_config('request.jwt.claim.sub', professor_id::text, true);

  if not public.can_manage_section(assigned_section.id)
    or public.can_manage_section(unrelated_section.id)
    or not public.can_manage_timetable(assigned_section.id)
    or public.can_manage_timetable(unrelated_section.id)
    or not public.can_manage_announcement_target(
      assigned_section.semester,
      assigned_section.branch,
      assigned_section.name
    )
    or public.can_manage_announcement_target(
      unrelated_section.semester,
      unrelated_section.branch,
      unrelated_section.name
    )
    or public.can_manage_announcement_target(
      assigned_section.semester,
      assigned_section.branch,
      'ALL'
    ) then
    raise exception 'Professor scope test failed.';
  end if;

  if public.can_manage_announcement_target(9, 'INVALID', 'Z') then
    raise exception 'Invalid target test failed.';
  end if;
end;
$test$;

rollback;
