-- One-time approval requested by the project owner for existing, confirmed
-- accounts that originally selected CR or Professor during signup.
-- No Auth users or profiles are deleted.

begin;

insert into public.staff_signup_authorizations (email, role)
select
  lower(auth_user.email),
  case lower(auth_user.raw_user_meta_data ->> 'role')
    when 'cr' then 'class_leader'
    when 'class_leader' then 'class_leader'
    when 'professor' then 'professor'
  end
from auth.users auth_user
where auth_user.email is not null
  and auth_user.email_confirmed_at is not null
  and lower(auth_user.raw_user_meta_data ->> 'role')
    in ('cr', 'class_leader', 'professor')
on conflict (email) do update
set role = excluded.role;

update public.profiles profile
set
  role = staff_entry.role,
  branch = case
    when staff_entry.role = 'professor' then null
    else coalesce(
      profile.branch,
      nullif(upper(btrim(auth_user.raw_user_meta_data ->> 'branch')), '')
    )
  end,
  semester = case
    when staff_entry.role = 'professor' then null
    else coalesce(
      profile.semester,
      case
        when (auth_user.raw_user_meta_data ->> 'semester') ~ '^[1-8]$'
        then (auth_user.raw_user_meta_data ->> 'semester')::integer
        else null
      end
    )
  end,
  section_id = case
    when staff_entry.role = 'professor' then null
    else coalesce(
      profile.section_id,
      (
        select section_record.id
        from public.sections section_record
        where section_record.name = upper(btrim(auth_user.raw_user_meta_data ->> 'section_name'))
          and section_record.branch = upper(btrim(auth_user.raw_user_meta_data ->> 'branch'))
          and section_record.semester = case
            when (auth_user.raw_user_meta_data ->> 'semester') ~ '^[1-8]$'
            then (auth_user.raw_user_meta_data ->> 'semester')::integer
            else null
          end
        limit 1
      )
    )
  end,
  roll_no = case when staff_entry.role = 'professor' then null else profile.roll_no end,
  admission_year = case
    when staff_entry.role = 'professor' then null
    else profile.admission_year
  end
from auth.users auth_user
join public.staff_signup_authorizations staff_entry
  on staff_entry.email = lower(auth_user.email)
where profile.id = auth_user.id
  and profile.role = 'student'
  and lower(auth_user.raw_user_meta_data ->> 'role')
    in ('cr', 'class_leader', 'professor');

commit;
