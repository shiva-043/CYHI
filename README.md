## IIITDM Jabalpur Campus Companion

A static HTML, CSS, and Vanilla JavaScript campus frontend using Supabase Auth
and the Supabase Data API.

### Supabase setup

1. Review `SUPABASE_SETUP.md`.
2. Run the read-only `supabase/inspect_backend.sql` inventory.
3. Back up the current application tables and review
   `supabase/RESET_REVIEW.md`.
4. Review `supabase/migrations/clean_backend.sql`. It is destructive and must
   not be run until the reset is explicitly approved.
5. Serve this folder with any static web server.
6. Create an account from `signup.html`, confirm the email, and log in through
   `login.html`.

The Supabase URL and public anon key are stored once in `js/supabase.js`. Never
put a service-role key or database password in frontend code.
