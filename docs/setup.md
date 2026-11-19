# Setting up a test Supabase project and Vercel preview

Status: **done** (Travis, 2026-11-16). Test project `Light-web-test` on
Supabase, preview at https://light-web-theta.vercel.app. Uses only the
fictional sample project; the real pilot project comes later.

## Step 1: Create the Supabase project (about 5 min)
1. supabase.com/dashboard → **New project**, name it e.g. `light-web-test`.
2. Save the database password in your password manager; pick the nearest region.
3. Wait about two minutes for setup to finish.

## Step 2: Load the database (about 2 min)
1. Build the one-file script: `bash scripts/build-setup-sql.sh > light-web-setup.sql`
   (or ask Claude for it).
2. **SQL Editor** → **New query** → paste the whole file → **Run**, once.
   It's all-or-nothing; on error nothing is applied.
3. Expect "Success. No rows returned." **Table Editor** → `projects` should
   have one row (Kibira, fictional).

## Step 3: Copy two values
**Project Settings** → **API Keys** (or **API**): the **Project URL** and the
**publishable key** (older projects: **anon public** key). Never use the
secret / `service_role` key.

## Step 4: Vercel preview (about 10 min)
1. vercel.com → **Add New… → Project** → import `TravisKolder/light-web`.
2. Environment variables: `NEXT_PUBLIC_SUPABASE_URL` = Project URL,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` = publishable key.
3. Deploy, then note the site URL (e.g. `https://light-web-xxxx.vercel.app`).

## Step 5: Sign-in redirect URLs
Supabase → **Authentication → URL Configuration**:
- **Site URL**: your Vercel URL.
- **Redirect URLs**: `<vercel-url>/auth/callback` and
  `http://localhost:3000/auth/callback`.
- Optional: turn off "Allow new users to sign up" and invite Travis and John
  from **Authentication → Users** instead.

## Step 6: First sign-in and test
1. Open `<vercel-url>/edit`, request a link, click it in your email.
2. You should see **Not an editor yet** with your user id.
3. In the SQL Editor:
   ```sql
   insert into public.editors (user_id, display_name)
   select id, 'Travis' from auth.users where email = '<your-login-email>';
   ```
4. Reload `/edit`: the sample project should be listed.
5. Check the public side: `<vercel-url>/p/sample-kibira-classroom-block`
   loads, and in the SQL Editor `supabase/checks/public_views_no_private_columns.sql`
   reports OK.

When done, update the status line at the top of this file.

## Later database changes

The test database was loaded on 2026-11-16 with migrations up to 013. Newer
migrations are applied by pasting one upgrade file into the SQL Editor, once:

| File | Adds | Applied to the test project? |
| --- | --- | --- |
| `supabase/upgrades/20261117_014_015_audit_log_timezone.sql` | Audit log (014), project time zone (015) | yes, run by Travis 2026-11-17 (not yet confirmed by `check:anon-access`) |
| `supabase/upgrades/20261117_016_sample_flag.sql` | Sample flag (016); removes SAMPLE / (fictional) from the sample's public text | yes (already applied; a re-run on 2026-11-19 said "already exists") |
| `supabase/upgrades/20261119_017_assertion_corrections.sql` | Correcting and withdrawing statements (017); needs 016 first | yes, run by Travis 2026-11-19 |
| `supabase/upgrades/20261119_018_public_assertion_corrections.sql` | Withdrawn/corrected statements on public passports (018); needs 017 first; safe to re-run | not yet |

The app keeps working before an upgrade is applied (it just lacks the new
feature). A brand-new project needs only `scripts/build-setup-sql.sh`.
