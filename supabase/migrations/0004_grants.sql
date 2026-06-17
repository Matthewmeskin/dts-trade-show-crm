-- =============================================================================
-- DTS Trade Show CRM — 0004 Role grants
-- PostgREST checks table-level privileges BEFORE evaluating RLS. This Supabase
-- project did not auto-grant DML on the public tables to the API roles, so
-- without this every authenticated request 401s ("permission denied for
-- table ..."). RLS still governs which ROWS each user can see/change; these
-- grants just open the gate so RLS can run. anon intentionally gets no DML.
-- Run AFTER 0003_storage.sql.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- authenticated: full DML on business data; RLS policies (0002) narrow it.
grant select, insert, update, delete
  on all tables in schema public
  to authenticated;

-- service_role: trusted server-side use (e.g. the phase-two n8n/TMS endpoint).
-- Bypasses RLS but still needs table grants.
grant select, insert, update, delete
  on all tables in schema public
  to service_role;

-- The status view (security_invoker) — covered by ALL TABLES above, kept
-- explicit for clarity.
grant select on public.shows_with_status to authenticated, service_role;

-- Ensure tables created by future migrations inherit the same grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
