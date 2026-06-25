-- merge_venues / merge_shows: reassign every reference from a duplicate record
-- to the kept one (dedup junction rows), fill the keeper's empty fields from the
-- duplicate, then delete the duplicate. Used by the Merge tool.

create or replace function public.merge_venues(p_target uuid, p_source uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_target = p_source or p_target is null or p_source is null then return; end if;
  update public.shows      set venue_id = p_target          where venue_id = p_source;
  update public.shipments  set venue_id = p_target          where venue_id = p_source;
  update public.contacts   set venue_id = p_target          where venue_id = p_source;
  update public.tasks      set related_venue_id = p_target  where related_venue_id = p_source;
  insert into public.carrier_venues (carrier_id, venue_id)
    select carrier_id, p_target from public.carrier_venues where venue_id = p_source
    on conflict (carrier_id, venue_id) do nothing;
  delete from public.carrier_venues where venue_id = p_source;
  update public.venues t set
    address                   = coalesce(t.address, s.address),
    city                      = coalesce(t.city, s.city),
    state                     = coalesce(t.state, s.state),
    dock_notes                = coalesce(t.dock_notes, s.dock_notes),
    union_rules               = coalesce(t.union_rules, s.union_rules),
    delivery_restrictions     = coalesce(t.delivery_restrictions, s.delivery_restrictions),
    parking_and_staging_notes = coalesce(t.parking_and_staging_notes, s.parking_and_staging_notes),
    general_notes             = coalesce(t.general_notes, s.general_notes)
  from public.venues s where t.id = p_target and s.id = p_source;
  delete from public.venues where id = p_source;
end $$;

create or replace function public.merge_shows(p_target uuid, p_source uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_target = p_source or p_target is null or p_source is null then return; end if;
  update public.shipments     set show_id = p_target         where show_id = p_source;
  update public.contacts      set show_id = p_target         where show_id = p_source;
  update public.tasks         set related_show_id = p_target where related_show_id = p_source;
  update public.documents     set show_id = p_target         where show_id = p_source;
  update public.show_debriefs set show_id = p_target         where show_id = p_source;
  insert into public.show_exhibitors (show_id, exhibitor_id)
    select p_target, exhibitor_id from public.show_exhibitors where show_id = p_source
    on conflict (show_id, exhibitor_id) do nothing;
  delete from public.show_exhibitors where show_id = p_source;
  insert into public.carrier_shows (carrier_id, show_id)
    select carrier_id, p_target from public.carrier_shows where show_id = p_source
    on conflict (carrier_id, show_id) do nothing;
  delete from public.carrier_shows where show_id = p_source;
  update public.shows t set
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
  from public.shows s where t.id = p_target and s.id = p_source;
  delete from public.shows where id = p_source;
end $$;
