-- =============================================================================
-- DTS Trade Show CRM - 0047 GSC Shipping Center: the requests inbox.
--
-- Exhibitors send shipping requests on a GSC's Shipping Center pages (the
-- DTS Trade Show project). Every 15 minutes the CRM's sync pulls the
-- confirmed ones here with a signed call, then acknowledges them, so the
-- public project never holds a price and the CRM never reads the public
-- project's tables.
--
--   ship_request_inbox  one row per request, as the exhibitor sent it, with
--                       what the pull found worth a look (problems) and who
--                       has it. Closed = cancelled or rejected, with a note.
--   ship_request_legs   one row per shipment in the request (outbound after
--                       the show, inbound pickups to it), with its own stage:
--                       new, quoted, approved (slice 5), booked, cancelled.
--   ship_quotes         the price we sent for a leg. Prices live only here:
--                       nothing in this table is ever exported.
--   ship_pull_state     when the pull last ran and what it found.
--   shipments.ship_leg_id  the load a leg was booked as.
--
-- Nobody deletes any of it: a request is closed, a leg is cancelled.
--
-- Applied to DTS Database as the tradeshow variant in ./tradeshow/, only after
-- Matthew has seen the SQL and point in time recovery is confirmed.
-- =============================================================================

do $$
begin
  if to_regclass('public.ap_ledger_invoices') is not null then
    raise exception
      'Refusing to run: public here is the payables schema, not the CRM. The DTS operations project uses the tradeshow-scoped variant of this migration.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Requests, as received
-- ---------------------------------------------------------------------------
create table public.ship_request_inbox (
  id                     uuid primary key default gen_random_uuid(),
  -- The request's id and reference in the public project. The upsert key.
  public_request_id      uuid not null unique,
  public_ref             text not null unique check (public_ref ~ '^SC-[0-9A-Z]{4}-[0-9A-Z]{4}$'),
  -- Null only when the pull could not match the GSC or show (see problems).
  partner_id             uuid references public.partners(id) on delete restrict,
  show_id                uuid references public.shows(id) on delete set null,
  -- The show as the exhibitor saw it when they sent the request.
  show_snapshot          jsonb not null default '{}'::jsonb,
  company                text,
  contact_name           text,
  email                  text,
  mobile                 text,
  booth                  text,
  booth_tbd              boolean not null default false,
  on_behalf_of           text,
  declared_value         numeric(12,2) check (declared_value is null or declared_value >= 0),
  wants_coverage         boolean not null default false,
  marketing_consent      boolean not null default false,
  marketing_consent_text text,
  terms_accepted_at      timestamptz,
  submitted_at           timestamptz,
  confirmed_at           timestamptz,
  received_at            timestamptz not null default now(),
  -- What the pull found worth a person's look (unknown show, hazmat, ...).
  problems               text[] not null default '{}',
  assigned_to            uuid references public.profiles(id) on delete set null,
  closed                 text check (closed in ('cancelled', 'rejected')),
  closed_note            text,
  closed_at              timestamptz,
  closed_by              uuid references public.profiles(id) on delete set null,
  updated_at             timestamptz not null default now(),
  constraint ship_request_inbox_closed_shape check ((closed is null) = (closed_at is null))
);
create index ship_request_inbox_open_idx on public.ship_request_inbox (confirmed_at) where closed is null;
create index ship_request_inbox_show_idx on public.ship_request_inbox (show_id);
create index ship_request_inbox_partner_idx on public.ship_request_inbox (partner_id);

create trigger trg_ship_request_inbox_updated_at
  before update on public.ship_request_inbox
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- The shipments in a request
-- ---------------------------------------------------------------------------
create table public.ship_request_legs (
  id                     uuid primary key default gen_random_uuid(),
  request_id             uuid not null references public.ship_request_inbox(id) on delete restrict,
  public_leg_id          uuid not null unique,
  direction              text not null check (direction in ('inbound', 'outbound')),
  seq                    smallint not null check (seq between 1 and 5),
  place_name             text,
  street1                text,
  street2                text,
  city                   text,
  state                  text,
  zip                    text,
  location_type          text,
  liftgate               boolean not null default false,
  inside                 boolean not null default false,
  ready_date             date,
  inbound_to             text check (inbound_to in ('advance_warehouse', 'direct')),
  own_carrier            boolean not null default false,
  deliver_by             date,
  onsite_contact_name    text,
  onsite_contact_mobile  text,
  return_to_warehouse    boolean not null default true,
  pieces                 integer check (pieces between 1 and 999),
  weight_lbs             integer check (weight_lbs between 1 and 100000),
  packaging              text,
  largest_l_in           integer,
  largest_w_in           integer,
  largest_h_in           integer,
  description            text,
  hazmat                 boolean not null default false,
  stage                  text not null default 'new'
                         check (stage in ('new', 'quoted', 'approved', 'booked', 'cancelled')),
  updated_at             timestamptz not null default now(),
  unique (request_id, direction, seq)
);

create trigger trg_ship_request_legs_updated_at
  before update on public.ship_request_legs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Prices. Only here; never in an export view.
-- ---------------------------------------------------------------------------
create table public.ship_quotes (
  id          uuid primary key default gen_random_uuid(),
  leg_id      uuid not null references public.ship_request_legs(id) on delete restrict,
  amount      numeric(10,2) not null check (amount > 0),
  note        text,
  -- 'email' when the CRM sent it; 'manual' when a coordinator sent it from
  -- their own mailbox and recorded it here.
  sent_via    text not null check (sent_via in ('email', 'manual')),
  sent_to     text,
  sent_at     timestamptz not null default now(),
  sent_by     uuid references public.profiles(id) on delete set null default auth.uid()
);
create index ship_quotes_leg_idx on public.ship_quotes (leg_id, sent_at desc);

-- ---------------------------------------------------------------------------
-- The load a leg was booked as
-- ---------------------------------------------------------------------------
alter table public.shipments
  add column if not exists ship_leg_id uuid unique references public.ship_request_legs(id) on delete set null;
alter table public.shipments
  add constraint shipments_ship_leg_source check (ship_leg_id is null or source = 'ship_center');

-- ---------------------------------------------------------------------------
-- The pull's heartbeat, one row
-- ---------------------------------------------------------------------------
create table public.ship_pull_state (
  id           smallint primary key default 1 check (id = 1),
  last_run_at  timestamptz,
  last_ok_at   timestamptz,
  last_count   integer not null default 0,
  last_error   text
);
insert into public.ship_pull_state (id) values (1);

-- ---------------------------------------------------------------------------
-- RLS. The whole team works the inbox: read, quote, book, close. The pull
-- writes with the service role. No deletes anywhere.
-- ---------------------------------------------------------------------------
alter table public.ship_request_inbox enable row level security;
alter table public.ship_request_legs  enable row level security;
alter table public.ship_quotes        enable row level security;
alter table public.ship_pull_state    enable row level security;

create policy members_read on public.ship_request_inbox
  for select to authenticated using (public.is_member());
create policy members_update on public.ship_request_inbox
  for update to authenticated using (public.is_member()) with check (public.is_member());

create policy members_read on public.ship_request_legs
  for select to authenticated using (public.is_member());
create policy members_update on public.ship_request_legs
  for update to authenticated using (public.is_member()) with check (public.is_member());

create policy members_read on public.ship_quotes
  for select to authenticated using (public.is_member());
create policy members_insert on public.ship_quotes
  for insert to authenticated with check (public.is_member());

create policy members_read on public.ship_pull_state
  for select to authenticated using (public.is_member());

-- The schema's default privileges would also grant DELETE (and, on the inbox
-- and legs, INSERT) to authenticated; only the pull creates requests.
revoke all on public.ship_request_inbox, public.ship_request_legs, public.ship_quotes, public.ship_pull_state
  from public, anon, authenticated, service_role;
grant select, update on public.ship_request_inbox, public.ship_request_legs to authenticated;
grant select, insert on public.ship_quotes to authenticated;
grant select on public.ship_pull_state to authenticated;
grant select, insert, update on public.ship_request_inbox, public.ship_request_legs, public.ship_quotes, public.ship_pull_state
  to service_role;
