# Supabase setup

The website uses the Supabase project configured in `js/supabase.js`. Only the
public anon key belongs in browser code. Never add a service-role key or database
password to this repository.

## Reset workflow

1. Run the read-only `supabase/inspect_backend.sql` in Supabase SQL Editor.
2. Save every result and compare it with `supabase/RESET_REVIEW.md`.
3. Export the existing application tables before approving deletion.
4. Review `supabase/migrations/clean_backend.sql` in full.
5. Run the reset only after explicit approval.
6. Create real sections and assign retained users to their batch.
7. Add approved CR and Professor emails to `staff_signup_authorizations` before
   those users sign up.
8. Run `supabase/migrations/role_scoped_management.sql` to apply the
   non-destructive, section-scoped RLS update.

The reset preserves `auth.users`. Existing Auth users receive a basic Student
profile so they can still authenticate; staff roles and batch assignments must
be reassigned after the reset.

## Role security

Frontend labels map to database roles as follows:

- Student → `student`
- CR → `class_leader`
- Professor → `professor`

Student and CR signup also collects semester, branch, and section. The trigger
resolves those values to the matching composite section row. Professor signup
keeps all three batch fields empty.

The public signup form sends the requested role, but the database grants a staff
role only when the email and requested role match an administrator-created row
in `staff_signup_authorizations`. This prevents a visitor from granting
themselves announcement and timetable management permissions.

To approve a future CR or Professor before signup, run one of these statements
in Supabase SQL Editor with the real campus email:

```sql
insert into public.staff_signup_authorizations (email, role)
values ('cr-email@iiitdmj.ac.in', 'class_leader');

insert into public.staff_signup_authorizations (email, role)
values ('professor-email@iiitdmj.ac.in', 'professor');
```

The signup page checks this authorization before creating the Auth account. An
unapproved staff request is rejected clearly and is never silently stored as a
Student. `approve_existing_staff_requests.sql` is a one-time migration for the
confirmed staff test accounts that were created before this check existed.

## Application data model

- `profiles` stores public application identity and batch assignment.
- `sections` identifies one section within a branch and semester.
- `section_professors` assigns professors to the sections they may manage.
- `announcements` stores targeted Academic, Events, and Urgent information.
- `timetable` stores class, break, and free entries for one section.

RLS limits profiles to the signed-in user's own row, filters announcements and
timetable entries by authorized section, and denies all Student writes. A Class
Leader can manage only the `section_id` stored on their profile. A Professor can
manage only sections listed for them in `section_professors`. An announcement
targeting `ALL` sections is allowed only when that user manages every section
in the selected semester and branch.

Before testing management pages, verify that every Student and CR profile has a
valid `section_id`, and that every Professor has the required
`section_professors` assignment rows.

Dashboard events reuse `announcements` rows whose category is `Events`; there
is no separate events table.

## Email reminders

The existing Announcements UI calls a Supabase Edge Function named
`schedule-announcement-reminder`. The clean SQL migration does not create or
deploy that Edge Function. Review it separately before enabling production
email reminders.

## Live automatic updates (Realtime)

Frontend clients subscribe to Supabase Realtime changes on `public.timetable` and
`public.announcements`. Whenever a CR or Professor creates, edits, or deletes a
schedule entry for a section, all connected student clients of that section
automatically receive the update and re-render their schedule and next class
countdown without refreshing the page.

To ensure Realtime is enabled in your database, run `enable_realtime.sql` in the
Supabase SQL Editor or toggle Replication for `timetable` and `announcements` in
the Supabase Dashboard.
