-- 1) Marshalling yard freight address + date window on shows (mirrors the
--    advance-warehouse / direct-to-show blocks).
alter table public.shows
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

-- 2) Preferred-carrier flag on the show <-> carrier link.
alter table public.carrier_shows
  add column if not exists preferred boolean not null default false;
