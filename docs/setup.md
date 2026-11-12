# Setting up a test Supabase project and Vercel preview

Status: **not started yet** (Travis postponed it on 2026-11-12). Pick up at
Step 1. Uses only the fictional sample project; the real pilot project comes later.

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
