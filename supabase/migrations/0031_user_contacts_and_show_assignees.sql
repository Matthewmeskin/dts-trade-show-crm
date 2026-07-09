-- =============================================================================
-- DTS Trade Show CRM — 0031 User contacts + show assignees
-- Gives internal users reachable contact info, lets a show be staffed with
-- assigned users, and lets an MHA submission remember which show it resolved to
-- so the uploader can be shown who to call. Run AFTER 0030_shipment_forced.sql.
-- =============================================================================

-- Contact details on the internal user profile. is_mha_default_contact marks
-- the fallback contact shown when a show has no assigned team.
alter table public.profiles
  add column phone                  text,
  add column title                  text,
  add column is_mha_default_contact boolean not null default false;

-- Users staffed on a show. Full access for any authenticated user (project
-- convention); the page that manages it is admin-gated in the app.
create table public.show_assignees (
  id         uuid primary key default gen_random_uuid(),
  show_id    uuid not null references public.shows(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (show_id, user_id)
);

alter table public.show_assignees enable row level security;
create policy "show_assignees: all (authenticated)"
  on public.show_assignees for all to authenticated using (true) with check (true);

create index show_assignees_show_id_idx on public.show_assignees (show_id);
create index show_assignees_user_id_idx on public.show_assignees (user_id);

-- Remember the show an MHA resolved to (via matched load or show-name), so the
-- result screen can surface the assigned contact on re-fetch too.
alter table public.mha_submissions
  add column show_id uuid references public.shows(id);
