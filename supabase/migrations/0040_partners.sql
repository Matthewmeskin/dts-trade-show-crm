-- =============================================================================
-- DTS Trade Show CRM — 0040 Partners
--
-- The partner growth plan: win the companies that control freight for many
-- exhibitors at once (exhibit houses, regional GSCs, organizers, I&D and
-- experiential agencies) instead of chasing exhibitors one at a time.
--
--   partners          the tiered target list, with the admin's status
--   partner_shows     which shows a partner works, and how many clients there
--   partner_signals   warm signals the sales admin works from (the morning list)
--   partner_touches   every call / email / LinkedIn touch, for weekly activity
--   partner_calls     discovery calls booked onto a rep, with the handoff note,
--                     the qualification bar, and the rep's outcome
--   playbook_sections the admin kit (script, rules, workflow), editable in the
--                     CRM so the process does not live in one person's head
--
-- Plus contacts.partner_id (people at a partner) and profiles.booking_url (each
-- rep's booking link, used when the admin books a call).
--
-- Internal only. Partner logins, when the portal exists, live in the DTS Trade
-- Show public project - never in this schema.
--
-- Applied live to DTS Database (tradeshow schema variant) 2026-09-26.
-- =============================================================================

do $$
begin
  if to_regclass('public.ap_ledger_invoices') is not null then
    raise exception
      'Refusing to run: public here is the payables schema, not the CRM. The DTS operations project uses the tradeshow-scoped variant of this migration.';
  end if;
end $$;

create table public.partners (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (btrim(name) <> ''),
  partner_type   text not null default 'exhibit_house'
                 check (partner_type in ('exhibit_house', 'gsc', 'organizer', 'agency', 'other')),
  tier           smallint check (tier between 1 and 3),
  website        text,
  city           text,
  state          text,
  -- How many exhibitors they influence freight for. The first qualification
  -- rule is "at least 3, or a GSC / organizer".
  client_count   integer check (client_count is null or client_count >= 0),
  stage          text not null default 'target'
                 check (stage in ('target', 'working', 'conversation', 'qualified', 'booked',
                                  'held', 'pilot', 'full_book', 'nurture', 'not_fit')),
  admin_id       uuid references public.profiles(id) on delete set null,
  rep_id         uuid references public.profiles(id) on delete set null,
  next_step      text,
  next_step_on   date,
  shipping_pain  text,
  source         text,
  notes          text,
  archived       boolean not null default false,
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- One row per company, so an import can't double the list.
create unique index partners_name_unique on public.partners (lower(btrim(name)));
create index partners_stage_idx on public.partners (stage) where not archived;
create index partners_next_step_idx on public.partners (next_step_on) where not archived;

create table public.partner_shows (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references public.partners(id) on delete cascade,
  show_id       uuid not null references public.shows(id) on delete cascade,
  client_count  integer check (client_count is null or client_count >= 0),
  notes         text,
  created_at    timestamptz not null default now(),
  unique (partner_id, show_id)
);
create index partner_shows_show_idx on public.partner_shows (show_id);

create table public.partner_signals (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  signal_type  text not null
               check (signal_type in ('show_page', 'quote_request', 'checklist_download',
                                      'website_visit', 'exhibitor_list', 'outreach_reply',
                                      'event', 'referral', 'other')),
  occurred_on  date not null default ((now() at time zone 'America/Los_Angeles')::date),
  show_id      uuid references public.shows(id) on delete set null,
  note         text,
  -- Worked = the admin has acted on it. Unworked signals are the morning list.
  worked_at    timestamptz,
  worked_by    uuid references public.profiles(id) on delete set null,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index partner_signals_open_idx on public.partner_signals (occurred_on desc) where worked_at is null;
create index partner_signals_partner_idx on public.partner_signals (partner_id);

create table public.partner_touches (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  channel      text not null check (channel in ('call', 'email', 'linkedin', 'in_person', 'other')),
  -- Reached = a real two-way conversation, which is what the weekly target counts.
  reached      boolean not null default false,
  note         text,
  occurred_at  timestamptz not null default now(),
  created_by   uuid references public.profiles(id) on delete set null default auth.uid()
);
create index partner_touches_when_idx on public.partner_touches (occurred_at desc);
create index partner_touches_partner_idx on public.partner_touches (partner_id);

create table public.partner_calls (
  id              uuid primary key default gen_random_uuid(),
  partner_id      uuid not null references public.partners(id) on delete cascade,
  rep_id          uuid not null references public.profiles(id),
  booked_by       uuid references public.profiles(id) on delete set null default auth.uid(),
  scheduled_at    timestamptz not null,
  -- The handoff note, written before the call.
  signal          text not null check (btrim(signal) <> ''),
  shows_note      text not null check (btrim(shows_note) <> ''),
  client_count    integer check (client_count is null or client_count >= 0),
  shipping_pain   text not null check (btrim(shipping_pain) <> ''),
  contact_id      uuid references public.contacts(id) on delete set null,
  -- The quality bar. A call that doesn't clear all three isn't booked.
  q_influence     boolean not null default false,
  q_show_120      boolean not null default false,
  q_agreed_time   boolean not null default false,
  status          text not null default 'booked'
                  check (status in ('booked', 'held', 'no_show', 'canceled')),
  outcome         text check (outcome in ('good_fit', 'not_fit', 'next_step')),
  outcome_note    text,
  outcome_at      timestamptz,
  outcome_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint partner_calls_qualified check (q_influence and q_show_120 and q_agreed_time),
  constraint partner_calls_held_has_outcome check (status <> 'held' or outcome is not null)
);
create index partner_calls_when_idx on public.partner_calls (scheduled_at desc);
create index partner_calls_partner_idx on public.partner_calls (partner_id);

create table public.playbook_sections (
  key         text primary key check (key ~ '^[a-z0-9_]+$'),
  title       text not null,
  body        text not null default '',
  sort        integer not null default 0,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

alter table public.contacts
  add column if not exists partner_id uuid references public.partners(id) on delete set null;
create index if not exists contacts_partner_idx on public.contacts (partner_id);

alter table public.profiles add column if not exists booking_url text;
comment on column public.profiles.booking_url is
  'Rep booking link (Calendly, Outlook Bookings, …). The sales admin books partner discovery calls onto it.';

create trigger trg_partners_updated_at before update on public.partners
  for each row execute function public.set_updated_at();
create trigger trg_partner_calls_updated_at before update on public.partner_calls
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: membership is the grant (see 0035). Nothing here is `using (true)`.
-- Touches and calls have no delete policy: the weekly numbers and the rep's
-- 24-hour loop are an accountability record, so they are corrected, not erased.
-- ---------------------------------------------------------------------------
alter table public.partners          enable row level security;
alter table public.partner_shows     enable row level security;
alter table public.partner_signals   enable row level security;
alter table public.partner_touches   enable row level security;
alter table public.partner_calls     enable row level security;
alter table public.playbook_sections enable row level security;

do $$
declare t text;
begin
  foreach t in array array['partners', 'partner_shows', 'partner_signals', 'partner_touches', 'partner_calls']
  loop
    execute format('create policy members_read on public.%I for select to authenticated using (public.is_member())', t);
    execute format('create policy members_insert on public.%I for insert to authenticated with check (public.is_member())', t);
    execute format('create policy members_update on public.%I for update to authenticated using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

create policy members_delete on public.partner_shows
  for delete to authenticated using (public.is_member());

-- Everyone reads the playbook; admins edit it.
create policy members_read on public.playbook_sections
  for select to authenticated using (public.is_member());
create policy admins_write on public.playbook_sections
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

grant select, insert, update on public.partners, public.partner_signals,
  public.partner_touches, public.partner_calls to authenticated;
grant select, insert, update, delete on public.partner_shows to authenticated;
grant select, insert, update, delete on public.playbook_sections to authenticated;
grant all on public.partners, public.partner_shows, public.partner_signals,
  public.partner_touches, public.partner_calls, public.playbook_sections to service_role;

-- ---------------------------------------------------------------------------
-- The admin kit, from the Partner Growth Plan (2026-09-26). Editable in the CRM.
-- ---------------------------------------------------------------------------
insert into public.playbook_sections (key, title, sort, body) values
('pitch', 'What we are selling', 10,
$md$We sell partners peace of mind about their clients' freight, not rates.

- One DTS contact who knows every show on your calendar.
- One place to see every client shipment.
- Outbound booked before teardown.

**Core line:** "We take the freight questions off your plate so you can focus on the booth."

**Outbound is the hook.** Exhibitors with nothing arranged at teardown get pushed onto the show carrier at a high price. Getting outbound booked early is easy to explain and easy to prove.

**Language rules.** Talk about coordination, communication and our strong carrier network. Never promise on-time delivery and never claim we prevent delays. We are the broker: we coordinate, communicate and consult - carriers move the freight.$md$),
('script', 'Call script (short version)', 20,
$md$1. "I saw you have clients heading to **[show]**. How are you handling their freight in and out right now?"
2. "What happens with outbound when the show closes?"
3. "Would a 15-minute call with **[rep]** to walk through how we handle that for builders be worth it?"

Name a specific upcoming show every time. If you can't name one, you're not ready to call.$md$),
('qualify', 'Book the call only if', 30,
$md$All three, every time:

1. They influence freight for **at least 3 exhibitors**, or they are a **GSC or organizer**.
2. They have a **show in the next 120 days**.
3. They **agreed to the time themselves** - not just "send me info."

The CRM will not save a booked call that misses any of the three. "Send me info" is a touch, not a call: log it and set a next step.$md$),
('workflow', 'Daily workflow', 40,
$md$1. Open **Partners → Worklist**. Work the unworked signals first, newest at the top.
2. For each: check the partner's next shows, draft a first touch that names one of them, edit it, send it.
3. Call or email anyone who engaged. Log every touch - tick "reached" only for a real conversation.
4. Qualified? Book straight onto the rep's calendar with their booking link.
5. Write the handoff note in the CRM **before** the call: signal, shows, number of clients, current shipping pain.

Protect the outreach hours. If daily ops work lands on you, booking is the first thing that slips - say so in the weekly review.$md$),
('handoff', 'Handoff note template', 50,
$md$- **Signal:** what brought them in (show page visit, reply, event, referral…)
- **Shows:** their next shows, and how many clients they have at each
- **Clients:** how many exhibitors they influence freight for
- **Shipping pain:** what is going wrong for them today, in their words
- **Who:** the person on the call and their role$md$),
('signals', 'Warm signals we work from', 60,
$md$1. Someone visited a show page, requested a quote, or downloaded a checklist.
2. A builder or GSC website visit (Apollo visitor tracking).
3. A builder whose clients appear on an upcoming show's exhibitor list.
4. A reply or click from Smartlead or LinkedIn outreach.
5. Someone we met at an EDPA, ESCA or show floor event.
6. A referral from an existing customer or partner.

No signal, no call. Cold dialing burns out the admin and fills the calendar with bad calls.$md$),
('targets', 'Weekly targets and accountability', 70,
$md$Starting targets - adjust after 30 days.

| Weekly activity | Target |
|---|---|
| Warm contacts worked | 60 to 80 |
| Conversations | 10 to 15 |
| Qualified calls booked | 3 to 5 |
| Show rate on booked calls | 75% or better |

- The admin is measured on **qualified calls held** - not calls booked, not dials.
- Reps close the loop in the CRM **within 24 hours**: good fit, not a fit, or next step.
- Weekly 20-minute review: which signal produced the best calls, what to drop.$md$)
on conflict (key) do nothing;
