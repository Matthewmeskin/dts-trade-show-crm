# Deploying to Vercel

The app deploys to Vercel by uploading the local code directly — **no GitHub
required** (though Git integration also works). ~5 minutes.

> Prereqs: the Vercel CLI is available via `npx vercel` (or `npm i -g vercel`).
> Run everything from the project root: `cd ~/dts-trade-show-crm`.

## 1. Log in (once)

```bash
npx vercel login
```

Pick your login method; confirm in the browser. This saves auth on this machine.

> After this step you can tell Claude "logged in" and it will drive the rest
> (link, env vars, deploy) for you.

## 2. Link the project

```bash
npx vercel link
```

- Scope: **matthewmeskin's projects**
- Link to existing project? **No** → create a new one
- Name: **dts-trade-show-crm** (or whatever you like)

This writes `.vercel/project.json` (already gitignored).

## 3. Set environment variables

These mirror your `.env.local`. NEXT_PUBLIC_* are inlined at build time, so set
them **before** the production build.

Easiest — the dashboard: Vercel → your project → **Settings → Environment
Variables**, add each for the **Production** (and Preview) environment, copying
values from `.env.local`:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | from `.env.local` (server-only) |
| `ANTHROPIC_API_KEY` | optional — your Anthropic key for the AI summary |
| `TMS_WEBHOOK_SECRET` | from `.env.local` (Hyperion ingest auth) |

Or via CLI (paste the value when prompted, once per environment):

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add TMS_WEBHOOK_SECRET production
# optional:
npx vercel env add ANTHROPIC_API_KEY production
```

## 4. Deploy

```bash
npx vercel deploy --prod
```

Vercel installs deps, builds, and returns a live HTTPS URL.

## 5. After deploy

- **Supabase auth**: Supabase → Authentication → URL Configuration → set the
  **Site URL** to your new Vercel URL (good hygiene for email/password auth).
- **Hyperion / n8n**: point the ingest at `https://<your-app>/api/tms/shipments`
  with `Authorization: Bearer <TMS_WEBHOOK_SECRET>`. See `TMS-INTEGRATION.md`.
- **Redeploys**: re-run `npx vercel deploy --prod`, or connect the GitHub repo in
  the Vercel dashboard for push-to-deploy.

## Notes

- `.env.local` is never uploaded (gitignored + Vercel ignores it) — env values
  live in Vercel's project settings.
- Vercel builds on Node 22 by default, which is fine for Next.js 16.
