-- The three tables with no lock, and the six views that walked around it.
--
-- Every table in this database is service-role only: row level security on,
-- no policies, so nothing gets in without the server key. That is the design
-- and it is why the linter's twenty-four "RLS enabled, no policy" notices are
-- the app working rather than the app broken.
--
-- Three tables were never given the lock. tech_requests, source_read_log and
-- sevenshifts_seen_ledger sat in the public schema readable and writable by
-- the publishable key. Nobody could reach them without that key, and this app
-- has never put it in a browser, so it was an unlocked door rather than an
-- open one. Doors like that stay unlocked until the key turns up somewhere it
-- should not.
--
-- The six views were the more interesting half, and the dashboard buried them
-- underneath the three. A view defined SECURITY DEFINER runs as its owner, so
-- it reads its tables as postgres and hands the rows to whoever asked. That is
-- a hole punched straight through row level security that was already switched
-- on: txt_feed and sevenshifts_logbook are locked, and txt_feed_work,
-- txt_feed_counts and sevenshifts_logbook_days were serving their contents
-- anyway. Fixing the tables without the views would have left the door open
-- and moved the sign.
--
-- security_invoker makes a view read as whoever is asking, so the lock on the
-- table underneath applies. The service role bypasses row level security, so
-- the app and the agents are unaffected. Checked before applying: every keyed
-- request in the previous twenty-four hours came from a secret key, none from
-- a publishable one, and none of these six views was queried at all.

alter table public.tech_requests enable row level security;
alter table public.source_read_log enable row level security;
alter table public.sevenshifts_seen_ledger enable row level security;

alter view public.tech_requests_open set (security_invoker = on);
alter view public.tech_requests_unverified set (security_invoker = on);
alter view public.source_coverage set (security_invoker = on);
alter view public.sevenshifts_logbook_days set (security_invoker = on);
alter view public.txt_feed_work set (security_invoker = on);
alter view public.txt_feed_counts set (security_invoker = on);

-- A function with a mutable search_path can be pointed at a different schema
-- by whoever calls it. This one only stamps a timestamp, so the reach is
-- small, but pinning it costs nothing.
alter function public.tech_requests_touch() set search_path = public, pg_temp;
