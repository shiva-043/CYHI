# Clean backend reset review

`migrations/clean_backend.sql` is a destructive draft. It has not been run.

## Read-only inspection first

Run `inspect_backend.sql` in the Supabase SQL Editor and save all result tabs.
It lists public columns, constraints, foreign keys, application/Auth triggers,
public functions, RLS policies, and approximate row counts.

The anon browser client cannot see administrative catalog details or reliable
row counts through RLS, so the SQL Editor inventory is required before reset
approval.

## Back up before approval

Create a Supabase database backup or export the current public tables from the
Dashboard. If using the Supabase CLI, use a database URL supplied securely at
runtime; never save the database password in this repository.

At minimum, export:

- `profiles`
- `sections`
- `section_professors`
- `timetable`
- `announcements` if it exists

Also record the Auth user list. The migration preserves `auth.users`, but the
old public profile rows are deleted during the reset.

## Objects and data deleted by the draft

The following public tables are dropped and recreated, including their rows,
indexes, constraints, policies, and table triggers:

- `announcements`
- `timetable`
- `section_professors`
- `profiles`
- `sections`
- `staff_signup_authorizations` if it already exists

The draft removes triggers on `auth.users` only when they call the known
`public.handle_new_user()` function. It drops and recreates the named Campus
Companion helper/trigger functions in the migration. It uses no `CASCADE`; an
unknown dependency stops and rolls back the transaction.

## Objects explicitly preserved

- `auth.users` and all Auth users
- Supabase Auth schemas and managed objects
- Storage objects and buckets
- Edge Functions
- Any unrelated public table not listed above

After rebuilding `profiles`, retained Auth users receive a basic Student profile
with their existing id, email, and Auth display name. Batch assignments and
approved staff roles must be assigned again by an administrator.

## Staff signup security

The public role selector cannot securely grant staff access by itself. Before an
approved CR or Professor signs up, add their lowercase email to the administrator
only allowlist:

```sql
insert into public.staff_signup_authorizations (email, role)
values
  ('approved-cr@iiitdmj.ac.in', 'class_leader'),
  ('approved-professor@iiitdmj.ac.in', 'professor');
```

An unapproved CR/Professor request receives a Student profile. No browser user
can read or modify the allowlist.

## Data needed after reset

The migration creates the 160 valid section identifiers formed by Sections A–E,
Branches CSE/ECE/MECH/SM, and Semesters 1–8. These are structural batch records;
it inserts no fake users, announcements, classes, or timetable information.
Assign retained users to their batch and add professor assignments in
`section_professors` after the reset.

## Feature inventory note

Dashboard events already reuse announcements with category `Events`; no events
table is needed. The Announcements page also invokes an existing Supabase Edge
Function named `schedule-announcement-reminder`. Email delivery is not created
by this SQL migration and must be reviewed separately before that button works.
