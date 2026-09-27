-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260926232531 "tradeshow_0040_partners".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

create table tradeshow.partners (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (btrim(name) <> ''),
  partner_type   text not null default 'exhibit_house'
                 check (partner_type in ('exhibit_house', 'gsc', 'organizer', 'agency', 'other')),
  tier           smallint check (tier between 1 and 3),
  website        text,
  city           text,
  state          text,
  client_count   integer check (client_count is null or client_count >= 0),
  stage          text not null default 'target'
                 check (stage in ('target', 'working', 'conversation', 'qualified', 'booked',
                                  'held', 'pilot', 'full_book', 'nurture', 'not_fit')),
  admin_id       uuid references tradeshow.profiles(id) on delete set null,
  rep_id         uuid references tradeshow.profiles(id) on delete set null,
  next_step      text,
  next_step_on   date,
  shipping_pain  text,
  source         text,
  notes          text,
  archived       boolean not null default false,
  created_by     uuid references tradeshow.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index partners_name_unique on tradeshow.partners (lower(btrim(name)));
create index partners_stage_idx on tradeshow.partners (stage) where not archived;
create index partners_next_step_idx on tradeshow.partners (next_step_on) where not archived;

create table tradeshow.partner_shows (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references tradeshow.partners(id) on delete cascade,
  show_id       uuid not null references tradeshow.shows(id) on delete cascade,
  client_count  integer check (client_count is null or client_count >= 0),
  notes         text,
  created_at    timestamptz not null default now(),
  unique (partner_id, show_id)
);
create index partner_shows_show_idx on tradeshow.partner_shows (show_id);

create table tradeshow.partner_signals (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references tradeshow.partners(id) on delete cascade,
  signal_type  text not null
               check (signal_type in ('show_page', 'quote_request', 'checklist_download',
                                      'website_visit', 'exhibitor_list', 'outreach_reply',
                                      'event', 'referral', 'other')),
  occurred_on  date not null default ((now() at time zone 'America/Los_Angeles')::date),
  show_id      uuid references tradeshow.shows(id) on delete set null,
  note         text,
  worked_at    timestamptz,
  worked_by    uuid references tradeshow.profiles(id) on delete set null,
  created_by   uuid references tradeshow.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now()
);
create index partner_signals_open_idx on tradeshow.partner_signals (occurred_on desc) where worked_at is null;
create index partner_signals_partner_idx on tradeshow.partner_signals (partner_id);

create table tradeshow.partner_touches (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references tradeshow.partners(id) on delete cascade,
  channel      text not null check (channel in ('call', 'email', 'linkedin', 'in_person', 'other')),
  reached      boolean not null default false,
  note         text,
  occurred_at  timestamptz not null default now(),
  created_by   uuid references tradeshow.profiles(id) on delete set null default auth.uid()
);
create index partner_touches_when_idx on tradeshow.partner_touches (occurred_at desc);
create index partner_touches_partner_idx on tradeshow.partner_touches (partner_id);

create table tradeshow.partner_calls (
  id              uuid primary key default gen_random_uuid(),
  partner_id      uuid not null references tradeshow.partners(id) on delete cascade,
  rep_id          uuid not null references tradeshow.profiles(id),
  booked_by       uuid references tradeshow.profiles(id) on delete set null default auth.uid(),
  scheduled_at    timestamptz not null,
  signal          text not null check (btrim(signal) <> ''),
  shows_note      text not null check (btrim(shows_note) <> ''),
  client_count    integer check (client_count is null or client_count >= 0),
  shipping_pain   text not null check (btrim(shipping_pain) <> ''),
  contact_id      uuid references tradeshow.contacts(id) on delete set null,
  q_influence     boolean not null default false,
  q_show_120      boolean not null default false,
  q_agreed_time   boolean not null default false,
  status          text not null default 'booked'
                  check (status in ('booked', 'held', 'no_show', 'canceled')),
  outcome         text check (outcome in ('good_fit', 'not_fit', 'next_step')),
  outcome_note    text,
  outcome_at      timestamptz,
  outcome_by      uuid references tradeshow.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint partner_calls_qualified check (q_influence and q_show_120 and q_agreed_time),
  constraint partner_calls_held_has_outcome check (status <> 'held' or outcome is not null)
);
create index partner_calls_when_idx on tradeshow.partner_calls (scheduled_at desc);
create index partner_calls_partner_idx on tradeshow.partner_calls (partner_id);

create table tradeshow.playbook_sections (
  key         text primary key check (key ~ '^[a-z0-9_]+$'),
  title       text not null,
  body        text not null default '',
  sort        integer not null default 0,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references tradeshow.profiles(id) on delete set null
);

alter table tradeshow.contacts
  add column if not exists partner_id uuid references tradeshow.partners(id) on delete set null;
create index if not exists contacts_partner_idx on tradeshow.contacts (partner_id);

alter table tradeshow.profiles add column if not exists booking_url text;
comment on column tradeshow.profiles.booking_url is
  'Rep booking link (Calendly, Outlook Bookings, …). The sales admin books partner discovery calls onto it.';

create trigger trg_partners_updated_at before update on tradeshow.partners
  for each row execute function tradeshow.set_updated_at();
create trigger trg_partner_calls_updated_at before update on tradeshow.partner_calls
  for each row execute function tradeshow.set_updated_at();

alter table tradeshow.partners          enable row level security;
alter table tradeshow.partner_shows     enable row level security;
alter table tradeshow.partner_signals   enable row level security;
alter table tradeshow.partner_touches   enable row level security;
alter table tradeshow.partner_calls     enable row level security;
alter table tradeshow.playbook_sections enable row level security;

do $$
declare t text;
begin
  foreach t in array array['partners', 'partner_shows', 'partner_signals', 'partner_touches', 'partner_calls']
  loop
    execute format('create policy members_read on tradeshow.%I for select to authenticated using (tradeshow.is_member())', t);
    execute format('create policy members_insert on tradeshow.%I for insert to authenticated with check (tradeshow.is_member())', t);
    execute format('create policy members_update on tradeshow.%I for update to authenticated using (tradeshow.is_member()) with check (tradeshow.is_member())', t);
  end loop;
end $$;

create policy members_delete on tradeshow.partner_shows
  for delete to authenticated using (tradeshow.is_member());

create policy members_read on tradeshow.playbook_sections
  for select to authenticated using (tradeshow.is_member());
create policy admins_write on tradeshow.playbook_sections
  for all to authenticated
  using (exists (select 1 from tradeshow.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from tradeshow.profiles p where p.id = auth.uid() and p.role = 'admin'));

grant select, insert, update on tradeshow.partners, tradeshow.partner_signals,
  tradeshow.partner_touches, tradeshow.partner_calls to authenticated;
grant select, insert, update, delete on tradeshow.partner_shows to authenticated;
grant select, insert, update, delete on tradeshow.playbook_sections to authenticated;
grant all on tradeshow.partners, tradeshow.partner_shows, tradeshow.partner_signals,
  tradeshow.partner_touches, tradeshow.partner_calls, tradeshow.playbook_sections to service_role;
