-- Sales / lead-gen pipeline fields on shows. The start-call (−60d), email-team
-- (−14d) and week-before (−7d) dates are derived from show_start_date in app
-- code, not stored.
alter table public.shows
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
