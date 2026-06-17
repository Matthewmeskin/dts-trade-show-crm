# DTS Trade Show CRM — Setup

Get the schema, auth, and app running. ~10 minutes. Do the steps in order.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> → sign in → **New project**.
2. Name it (e.g. `dts-trade-show-crm`), pick a region near your team, and set a
   strong database password (save it).
3. Wait for the project to finish provisioning (~2 min).

## 2. Apply the database schema

In the Supabase dashboard, open **SQL Editor** → **New query**, then run the
three migration files **in order**. For each one: open the file from
`supabase/migrations/`, paste its full contents, and click **Run**.

1. `supabase/migrations/0001_schema.sql` — tables, enums, indexes, triggers,
   and the show-status logic.
2. `supabase/migrations/0002_rls.sql` — Row Level Security policies.
3. `supabase/migrations/0003_storage.sql` — the private `documents` bucket.

Each should report success. (Re-running them will error on “already exists” —
that's expected; they're meant to run once.)

> Verify: **Table Editor** should now list `profiles`, `shows`, `venues`,
> `exhibitors`, `shipments`, `carriers`, `contacts`, `documents`, `tasks`,
> `show_debriefs`, `show_exhibitors`, and `carrier_venues`.

## 3. Configure authentication

This is an internal, invite-only app — turn off public sign-up.

1. **Authentication → Providers → Email**: ensure **Email** is enabled. Leave
   “Confirm email” on for production, or turn it off for faster internal
   testing (you can confirm users manually instead).
2. **Authentication → Sign In / Providers** (or **Settings**): turn **off**
   “Allow new users to sign up”. Users will be created by an admin only.

## 4. Create your first admin user

1. **Authentication → Users → Add user → Create new user**. Enter your email +
   a password, and check **Auto Confirm User**.
2. The `profiles` row is created automatically (via the `on_auth_user_created`
   trigger) with the default `standard` role. Promote yourself to admin:
   **SQL Editor**, run:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@yourcompany.com';
   ```

Repeat step 4 (without the role update) to add standard teammates later.

## 5. Wire up environment variables

1. In the project root, copy the example file:

   ```bash
   cp .env.local.example .env.local
   ```

2. In Supabase, open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only; keep secret)

   Paste them into `.env.local`. Leave `ANTHROPIC_API_KEY` blank for now.

## 6. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login`. Sign in with the
admin user from step 4. You should land on the welcome page showing your email
and `admin` role, with a working **Sign out** button.

---

## Notes

- **Node**: this machine runs Node via `nvm`. If `node`/`npm` aren't found in a
  new terminal, run `nvm use --lts` first (or open a fresh login shell).
- **Show status** is computed live from dates, not stored. Query the
  `shows_with_status` view (or call `public.show_status(show)`) to get
  `upcoming` / `active` / `completed` / `archived`. Setting a show's `archived`
  flag overrides the date logic.
- **TMS / BrokerWareLite (phase two)**: `shipments.tms_reference_id` is the join
  key for n8n sync, `tms_sync_status` distinguishes manual vs synced rows. No
  integration code is built yet — the schema is ready for it.
- **Roles**: every authenticated user currently has full read/write on business
  data (RLS allows it). The `admin` vs `standard` distinction is stored and
  enforced for role changes; tighter per-role permissions can be layered on
  later without schema changes.
