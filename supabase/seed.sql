-- =============================================================================
-- DTS Trade Show CRM — Optional demo seed
-- Loads a small, coherent sample dataset so the dashboard and pages have
-- something to show: one active show, two upcoming shows, exhibitors with
-- varied shipment states, and a couple of tasks. Tasks are assigned to the
-- earliest-created user profile (your admin). Safe to run on an empty database.
--
-- The dates are written relative to a "today" of 2026-06-16. Adjust them (or the
-- base date) if you run this much later, so the active/upcoming logic still
-- demonstrates well.
--
-- To remove everything this created, see the TRUNCATE block at the bottom
-- (commented out).
-- =============================================================================

do $$
declare
  u uuid := (select id from public.profiles order by created_at limit 1);
  v_venue uuid; v_carrier uuid;
  s_active uuid; s_up1 uuid; s_up2 uuid;
  e_acme uuid; e_globex uuid; e_initech uuid; e_umbrella uuid; e_stark uuid;
begin
  insert into public.venues (venue_name, city, state, address, dock_notes)
  values ('Las Vegas Convention Center', 'Las Vegas', 'NV', '3150 Paradise Rd',
          'Marshalling yard required; no overnight staging.')
  returning id into v_venue;

  insert into public.carriers (carrier_name, trade_show_notes)
  values ('Roadrunner Freight', 'Reliable on West Coast advance warehouse deliveries.')
  returning id into v_carrier;

  insert into public.shows (show_name, edition_year, industry_vertical, show_management_company, venue_id,
    advance_warehouse_open, advance_warehouse_cutoff, move_in_start, move_in_end,
    move_out_start, move_out_end, direct_to_show_start, direct_to_show_end,
    estimated_revenue, actual_revenue)
  values ('TechWorld Expo', 2026, 'Technology', 'Freeman', v_venue,
    '2026-06-08','2026-06-12','2026-06-15','2026-06-16','2026-06-20','2026-06-21','2026-06-15','2026-06-16',
    250000, null)
  returning id into s_active;

  insert into public.shows (show_name, edition_year, industry_vertical, show_management_company, venue_id,
    advance_warehouse_open, advance_warehouse_cutoff, move_in_start, move_in_end, move_out_start, move_out_end,
    estimated_revenue)
  values ('MedTech Summit', 2026, 'Healthcare', 'GES', v_venue,
    '2026-06-20','2026-06-17','2026-07-01','2026-07-02','2026-07-05','2026-07-06', 180000)
  returning id into s_up1;

  insert into public.shows (show_name, edition_year, industry_vertical, show_management_company, venue_id,
    advance_warehouse_open, advance_warehouse_cutoff, move_in_start, move_in_end, move_out_start, move_out_end,
    estimated_revenue)
  values ('Logistics & Supply Chain Forum', 2026, 'Logistics', 'Freeman', v_venue,
    '2026-07-28','2026-07-25','2026-08-10','2026-08-11','2026-08-14','2026-08-15', 320000)
  returning id into s_up2;

  insert into public.exhibitors (company_name, industry) values ('Acme Robotics','Manufacturing') returning id into e_acme;
  insert into public.exhibitors (company_name, industry) values ('Globex Medical','Healthcare') returning id into e_globex;
  insert into public.exhibitors (company_name, industry) values ('Initech Software','Technology') returning id into e_initech;
  insert into public.exhibitors (company_name, industry) values ('Umbrella Logistics','Logistics') returning id into e_umbrella;
  insert into public.exhibitors (company_name, industry) values ('Stark Industrial','Manufacturing') returning id into e_stark;

  insert into public.show_exhibitors (show_id, exhibitor_id) values
    (s_active, e_acme), (s_active, e_globex), (s_active, e_initech), (s_active, e_umbrella), (s_active, e_stark);

  insert into public.shipments (show_id, exhibitor_id, carrier_id, destination_type, pieces, weight, mode, status,
    pickup_date, estimated_delivery_date, actual_delivery_date, pro_number) values
    (s_active, e_acme,    v_carrier, 'advance_warehouse', 4, 1200, 'FTL',       'delivered', '2026-06-09','2026-06-11','2026-06-11','RR100001'),
    (s_active, e_globex,  v_carrier, 'advance_warehouse', 2, 600,  'LTL',       'in_transit','2026-06-14','2026-06-17', null, 'RR100002'),
    (s_active, e_initech, v_carrier, 'direct_to_show',    6, 2200, 'expedited', 'issue',     '2026-06-13','2026-06-16', null, 'RR100003'),
    (s_active, e_stark,   v_carrier, 'advance_warehouse', 3, 900,  'LTL',       'quoted',    '2026-06-17', null, null, null);

  update public.shipments set accessorials_flagged = true,
         notes = 'Liftgate + residential pickup; reweigh disputed.'
   where exhibitor_id = e_initech and show_id = s_active;

  insert into public.tasks (title, description, due_date, assigned_to, created_by, status, priority,
    related_show_id, related_exhibitor_id) values
    ('Resolve Initech reweigh dispute', 'Carrier flagged accessorials; confirm corrected BOL.', '2026-06-16', u, u, 'open', 'high', s_active, e_initech),
    ('Chase Stark Industrial BOL', 'Still quoted, pickup tomorrow — confirm booking.', '2026-06-15', u, u, 'in_progress', 'medium', s_active, e_stark),
    ('Send MedTech advance warehouse forms', 'Cutoff is tomorrow.', '2026-06-17', u, u, 'open', 'high', s_up1, null);
end $$;

-- To wipe this demo data (leaves user profiles intact), run:
-- truncate table public.shipments, public.show_exhibitors, public.tasks,
--   public.documents, public.show_debriefs, public.contacts,
--   public.carrier_venues, public.shows, public.exhibitors,
--   public.venues, public.carriers restart identity cascade;
