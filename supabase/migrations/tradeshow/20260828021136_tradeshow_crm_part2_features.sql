-- Applied to DTS Database (qshciqxpkirlkmrwucnk) as migration 20260828021136 "tradeshow_crm_part2_features".
-- Recovered verbatim from supabase_migrations.schema_migrations. Do not edit: this is the record of what ran.

-- Tradeshow CRM part 2/3: migrations 0005–0033 rewritten to the tradeshow schema.
alter table tradeshow.shows
  add column if not exists show_start_date date,
  add column if not exists show_end_date date;

drop view if exists tradeshow.shows_with_status;
create view tradeshow.shows_with_status as
  select s.*, tradeshow.show_status(s) as status
  from tradeshow.shows s;
alter view tradeshow.shows_with_status set (security_invoker = true);
grant select on tradeshow.shows_with_status to authenticated, service_role;

alter table tradeshow.shipments
  add column if not exists package_type text,
  add column if not exists tracking_url text;

alter table tradeshow.shipments
  add column if not exists destination_address text;

create table if not exists tradeshow.tms_load_candidates (
  id uuid primary key default gen_random_uuid(),
  load_number text not null unique,
  tms_status text,
  mode text,
  pickup_location text,
  delivery_location text,
  carrier_name text,
  pieces integer,
  weight numeric,
  ai_is_candidate boolean not null default false,
  ai_confidence text,
  ai_reason text,
  matched_venue text,
  review_status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tradeshow.tms_load_candidates enable row level security;

drop policy if exists "authenticated read candidates" on tradeshow.tms_load_candidates;
create policy "authenticated read candidates"
  on tradeshow.tms_load_candidates for select to authenticated using (true);

drop policy if exists "authenticated update candidates" on tradeshow.tms_load_candidates;
create policy "authenticated update candidates"
  on tradeshow.tms_load_candidates for update to authenticated using (true) with check (true);

grant select, update on tradeshow.tms_load_candidates to authenticated;
grant all on tradeshow.tms_load_candidates to service_role;

alter table tradeshow.shipments
  add column if not exists billed_amount  numeric(12,2),
  add column if not exists cost_amount    numeric(12,2),
  add column if not exists margin         numeric(12,2)
    generated always as (billed_amount - cost_amount) stored,
  add column if not exists po_ref         text,
  add column if not exists shipper_number text;

alter table tradeshow.tms_load_candidates
  add column if not exists customer_name text;

alter table tradeshow.tms_load_candidates
  add column if not exists po_ref         text,
  add column if not exists shipper_number text,
  add column if not exists billed_amount  numeric(12,2),
  add column if not exists cost_amount    numeric(12,2);

alter table tradeshow.shipments
  add column if not exists venue_id uuid references tradeshow.venues (id) on delete set null;

create index if not exists idx_shipments_venue_id on tradeshow.shipments (venue_id);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'shipment_direction' and typnamespace = 'tradeshow'::regnamespace) then
    create type tradeshow.shipment_direction as enum ('move_in', 'move_out');
  end if;
end $$;

alter table tradeshow.shipments
  add column if not exists direction            tradeshow.shipment_direction,
  add column if not exists target_delivery_date date,
  add column if not exists show_date            date;

create index if not exists idx_shipments_direction on tradeshow.shipments (direction);
create index if not exists idx_shipments_target_delivery_date on tradeshow.shipments (target_delivery_date);

create table if not exists tradeshow.carrier_shows (
  id          uuid primary key default gen_random_uuid(),
  carrier_id  uuid not null references tradeshow.carriers (id) on delete cascade,
  show_id     uuid not null references tradeshow.shows (id)    on delete cascade,
  unique (carrier_id, show_id)
);

create index if not exists idx_carrier_shows_carrier on tradeshow.carrier_shows (carrier_id);
create index if not exists idx_carrier_shows_show    on tradeshow.carrier_shows (show_id);

alter table tradeshow.carrier_shows enable row level security;

drop policy if exists "carrier_shows: all (authenticated)" on tradeshow.carrier_shows;
create policy "carrier_shows: all (authenticated)"
  on tradeshow.carrier_shows for all to authenticated using (true) with check (true);

grant select, insert, update, delete on tradeshow.carrier_shows to authenticated, service_role;

alter table tradeshow.shows
  add column if not exists website_url        text,
  add column if not exists exhibitor_manual_url text,
  add column if not exists exhibitor_list_url   text;

alter table tradeshow.shipments
  add column if not exists tms_customer_id text;

alter table tradeshow.shows
  add column if not exists advance_warehouse_address text,
  add column if not exists direct_to_show_address   text;

alter table tradeshow.shows
  add column if not exists advance_warehouse_name      text,
  add column if not exists advance_warehouse_care_of   text,
  add column if not exists advance_warehouse_street1    text,
  add column if not exists advance_warehouse_street2    text,
  add column if not exists advance_warehouse_city       text,
  add column if not exists advance_warehouse_state      text,
  add column if not exists advance_warehouse_zip        text,
  add column if not exists advance_warehouse_country     text,
  add column if not exists direct_to_show_name         text,
  add column if not exists direct_to_show_care_of      text,
  add column if not exists direct_to_show_street1       text,
  add column if not exists direct_to_show_street2       text,
  add column if not exists direct_to_show_city          text,
  add column if not exists direct_to_show_state         text,
  add column if not exists direct_to_show_zip           text,
  add column if not exists direct_to_show_country        text;

alter table tradeshow.shipments
  add column if not exists check_in_number text;

alter table tradeshow.documents
  add column if not exists shipment_id uuid references tradeshow.shipments (id) on delete cascade;

alter table tradeshow.documents alter column show_id drop not null;

create index if not exists idx_documents_shipment_id on tradeshow.documents (shipment_id);

alter table tradeshow.documents drop constraint if exists documents_show_or_shipment_chk;
alter table tradeshow.documents
  add constraint documents_show_or_shipment_chk
  check (show_id is not null or shipment_id is not null);

alter table tradeshow.shipments
  add column if not exists consignee_company  text,
  add column if not exists consignee_contact  text,
  add column if not exists consignee_phone    text,
  add column if not exists consignee_street1  text,
  add column if not exists consignee_street2  text,
  add column if not exists consignee_city     text,
  add column if not exists consignee_state    text,
  add column if not exists consignee_zip      text,
  add column if not exists consignee_country  text,
  add column if not exists booth_number       text;

alter table tradeshow.shipments
  add column if not exists tms_venue_raw   text,
  add column if not exists tms_venue_city  text,
  add column if not exists tms_venue_state text;

alter table tradeshow.shipments
  add column if not exists venue_auto_linked boolean not null default false,
  add column if not exists show_auto_linked  boolean not null default false;

create or replace function tradeshow.merge_venues(p_target uuid, p_source uuid)
returns void language plpgsql security definer set search_path = tradeshow as $$
begin
  if p_target = p_source or p_target is null or p_source is null then return; end if;
  update tradeshow.shows      set venue_id = p_target          where venue_id = p_source;
  update tradeshow.shipments  set venue_id = p_target          where venue_id = p_source;
  update tradeshow.contacts   set venue_id = p_target          where venue_id = p_source;
  update tradeshow.tasks      set related_venue_id = p_target  where related_venue_id = p_source;
  insert into tradeshow.carrier_venues (carrier_id, venue_id)
    select carrier_id, p_target from tradeshow.carrier_venues where venue_id = p_source
    on conflict (carrier_id, venue_id) do nothing;
  delete from tradeshow.carrier_venues where venue_id = p_source;
  update tradeshow.venues t set
    address                   = coalesce(t.address, s.address),
    city                      = coalesce(t.city, s.city),
    state                     = coalesce(t.state, s.state),
    dock_notes                = coalesce(t.dock_notes, s.dock_notes),
    union_rules               = coalesce(t.union_rules, s.union_rules),
    delivery_restrictions     = coalesce(t.delivery_restrictions, s.delivery_restrictions),
    parking_and_staging_notes = coalesce(t.parking_and_staging_notes, s.parking_and_staging_notes),
    general_notes             = coalesce(t.general_notes, s.general_notes)
  from tradeshow.venues s where t.id = p_target and s.id = p_source;
  delete from tradeshow.venues where id = p_source;
end $$;

create or replace function tradeshow.merge_shows(p_target uuid, p_source uuid)
returns void language plpgsql security definer set search_path = tradeshow as $$
begin
  if p_target = p_source or p_target is null or p_source is null then return; end if;
  update tradeshow.shipments     set show_id = p_target         where show_id = p_source;
  update tradeshow.contacts      set show_id = p_target         where show_id = p_source;
  update tradeshow.tasks         set related_show_id = p_target where related_show_id = p_source;
  update tradeshow.documents     set show_id = p_target         where show_id = p_source;
  update tradeshow.show_debriefs set show_id = p_target         where show_id = p_source;
  insert into tradeshow.show_exhibitors (show_id, exhibitor_id)
    select p_target, exhibitor_id from tradeshow.show_exhibitors where show_id = p_source
    on conflict (show_id, exhibitor_id) do nothing;
  delete from tradeshow.show_exhibitors where show_id = p_source;
  insert into tradeshow.carrier_shows (carrier_id, show_id)
    select carrier_id, p_target from tradeshow.carrier_shows where show_id = p_source
    on conflict (carrier_id, show_id) do nothing;
  delete from tradeshow.carrier_shows where show_id = p_source;
  update tradeshow.shows t set
    edition_year             = coalesce(t.edition_year, s.edition_year),
    industry_vertical        = coalesce(t.industry_vertical, s.industry_vertical),
    show_management_company   = coalesce(t.show_management_company, s.show_management_company),
    venue_id                 = coalesce(t.venue_id, s.venue_id),
    gsc_contact_id           = coalesce(t.gsc_contact_id, s.gsc_contact_id),
    website_url              = coalesce(t.website_url, s.website_url),
    exhibitor_manual_url     = coalesce(t.exhibitor_manual_url, s.exhibitor_manual_url),
    exhibitor_list_url       = coalesce(t.exhibitor_list_url, s.exhibitor_list_url),
    show_start_date          = coalesce(t.show_start_date, s.show_start_date),
    show_end_date            = coalesce(t.show_end_date, s.show_end_date),
    move_in_start            = coalesce(t.move_in_start, s.move_in_start),
    move_in_end              = coalesce(t.move_in_end, s.move_in_end),
    move_out_start           = coalesce(t.move_out_start, s.move_out_start),
    move_out_end             = coalesce(t.move_out_end, s.move_out_end),
    advance_warehouse_open   = coalesce(t.advance_warehouse_open, s.advance_warehouse_open),
    advance_warehouse_cutoff = coalesce(t.advance_warehouse_cutoff, s.advance_warehouse_cutoff),
    competitor_notes         = coalesce(t.competitor_notes, s.competitor_notes),
    general_notes            = coalesce(t.general_notes, s.general_notes)
  from tradeshow.shows s where t.id = p_target and s.id = p_source;
  delete from tradeshow.shows where id = p_source;
end $$;

alter table tradeshow.shipments
  add column if not exists tms_created_at timestamptz;

alter table tradeshow.carriers
  add column if not exists bill_to_company  text,
  add column if not exists bill_to_address1 text,
  add column if not exists bill_to_address2 text,
  add column if not exists bill_to_city     text,
  add column if not exists bill_to_state    text,
  add column if not exists bill_to_zip      text,
  add column if not exists bill_to_phone    text;

alter table tradeshow.shows
  add column if not exists exhibitor_count           integer,
  add column if not exists decorator                 text,
  add column if not exists advance_warehouse_window  text,
  add column if not exists direct_to_show_window     text,
  add column if not exists sales_people              text,
  add column if not exists lead_gen_owner            text,
  add column if not exists lead_gen_start_date       date,
  add column if not exists lead_gen_completion_date  date,
  add column if not exists emailed_two_weeks         boolean not null default false,
  add column if not exists instantly_created         boolean not null default false,
  add column if not exists move_in_schedule_url      text;

alter table tradeshow.shows
  add column if not exists marshalling_yard_name     text,
  add column if not exists marshalling_yard_care_of  text,
  add column if not exists marshalling_yard_street1  text,
  add column if not exists marshalling_yard_street2  text,
  add column if not exists marshalling_yard_city     text,
  add column if not exists marshalling_yard_state    text,
  add column if not exists marshalling_yard_zip      text,
  add column if not exists marshalling_yard_country  text,
  add column if not exists marshalling_yard_address  text,
  add column if not exists marshalling_yard_open     date,
  add column if not exists marshalling_yard_cutoff   date;

alter table tradeshow.carrier_shows
  add column if not exists preferred boolean not null default false;

alter table tradeshow.tms_load_candidates
  add column if not exists tms_customer_id text;

comment on column tradeshow.tms_load_candidates.tms_customer_id is
  'Hyperion customer number, used to build the shipment-profile deep link.';

alter type tradeshow.document_type add value if not exists 'MHA';

create table tradeshow.mha_submissions (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  submitter_name    text not null,
  submitter_phone   text not null,
  submitter_email   text not null,
  company_name      text not null,
  load_number_input text,
  load_id           uuid references tradeshow.shipments(id),
  match_method      text check (match_method in ('exact', 'fuzzy', 'none')),
  storage_path      text not null,
  file_mime         text not null,
  file_bytes        integer not null,
  status            text not null default 'pending'
                      check (status in ('pending', 'passed', 'warning', 'failed', 'error'))
);

create table tradeshow.mha_review_results (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references tradeshow.mha_submissions(id) on delete cascade,
  created_at    timestamptz not null default now(),
  gc_detected   text,
  model         text not null,
  extracted     jsonb not null,
  checks        jsonb not null,
  overall       text not null check (overall in ('passed', 'warning', 'failed'))
);

create index mha_submissions_load_id_idx on tradeshow.mha_submissions (load_id);
create index mha_review_results_submission_id_idx on tradeshow.mha_review_results (submission_id);

alter table tradeshow.mha_submissions    enable row level security;
alter table tradeshow.mha_review_results enable row level security;

create policy "mha_submissions: all (authenticated)"
  on tradeshow.mha_submissions for all to authenticated using (true) with check (true);

create policy "mha_review_results: all (authenticated)"
  on tradeshow.mha_review_results for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('mha-uploads', 'mha-uploads', false)
on conflict (id) do nothing;

create policy "tradeshow: mha-uploads bucket: read (authenticated)"
  on storage.objects for select to authenticated
  using (bucket_id = 'mha-uploads');

create policy "tradeshow: mha-uploads bucket: insert (authenticated)"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mha-uploads');

create policy "tradeshow: mha-uploads bucket: update (authenticated)"
  on storage.objects for update to authenticated
  using (bucket_id = 'mha-uploads') with check (bucket_id = 'mha-uploads');

create policy "tradeshow: mha-uploads bucket: delete (authenticated)"
  on storage.objects for delete to authenticated
  using (bucket_id = 'mha-uploads');

create type tradeshow.forced_reason as enum (
  'carrier_no_show',
  'paperwork_error',
  'missed_check_in',
  'other'
);

alter table tradeshow.shipments
  add column forced             boolean not null default false,
  add column forced_reason      tradeshow.forced_reason,
  add column forced_reason_other text,
  add column forced_at          timestamptz,
  add column forced_by          uuid references tradeshow.profiles(id);

comment on column tradeshow.shipments.forced is
  'True when this move-out was force-shipped by the general contractor (carrier no-show / paperwork error).';

create index shipments_forced_idx on tradeshow.shipments (forced) where forced;
create index shipments_move_out_delivered_idx
  on tradeshow.shipments (direction, status)
  where direction = 'move_out';

alter table tradeshow.profiles
  add column phone                  text,
  add column title                  text,
  add column is_mha_default_contact boolean not null default false;

create table tradeshow.show_assignees (
  id         uuid primary key default gen_random_uuid(),
  show_id    uuid not null references tradeshow.shows(id) on delete cascade,
  user_id    uuid not null references tradeshow.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (show_id, user_id)
);

alter table tradeshow.show_assignees enable row level security;
create policy "show_assignees: all (authenticated)"
  on tradeshow.show_assignees for all to authenticated using (true) with check (true);

create index show_assignees_show_id_idx on tradeshow.show_assignees (show_id);
create index show_assignees_user_id_idx on tradeshow.show_assignees (user_id);

alter table tradeshow.mha_submissions
  add column show_id uuid references tradeshow.shows(id);

alter table tradeshow.shipments alter column venue_auto_linked set default true;
alter table tradeshow.shipments alter column show_auto_linked  set default true;

create table tradeshow.activity_log (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  user_id      uuid references tradeshow.profiles(id),
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  entity_label text,
  summary      text,
  details      jsonb
);

create index activity_log_created_idx on tradeshow.activity_log (created_at desc);
create index activity_log_entity_idx on tradeshow.activity_log (entity_type, entity_id);
create index activity_log_user_idx on tradeshow.activity_log (user_id);

alter table tradeshow.activity_log enable row level security;

create policy "activity_log: read (authenticated)"
  on tradeshow.activity_log for select to authenticated using (true);

create policy "activity_log: insert (authenticated)"
  on tradeshow.activity_log for insert to authenticated with check (true);
