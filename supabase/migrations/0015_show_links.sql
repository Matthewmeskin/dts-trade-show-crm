-- External reference links for a show: the show's public website, the
-- exhibitor service manual, and the published exhibitor list.
alter table public.shows
  add column if not exists website_url        text,
  add column if not exists exhibitor_manual_url text,
  add column if not exists exhibitor_list_url   text;
