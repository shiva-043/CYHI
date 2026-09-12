-- Enable Supabase Realtime broadcast for timetable and announcements
-- Run in Supabase SQL Editor so all students connected to the frontend
-- immediately receive live updates when a CR or Professor adds or edits a schedule.

begin;

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
