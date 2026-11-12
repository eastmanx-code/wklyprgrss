-- A minute-by-minute record of whether the site answered.
--
-- On 2026-11-10 the app stopped answering for four minutes at close. The only
-- proof was a hosting log that is kept for a day, and it took a text from a
-- manager to find out at all. This keeps our own record, from outside the
-- host: once a minute the database asks https://wklyprgrss.com/api/health and
-- writes down what came back. That address touches no data and no session, so
-- an answer means the server is up and a miss means it is not.
--
-- pg_net sends the request in the background, so one tick cannot both ask and
-- hear the answer. Each tick first writes down the answers to the questions
-- earlier ticks asked, then asks the next one. A check is therefore settled
-- about a minute after it was asked, and `up` is null until then.
--
-- What this cannot see: if the database itself is down the ticks stop, and the
-- record shows a gap rather than a miss. The outside check in
-- .github/workflows/uptime.yml covers that side, and is the one that sends
-- mail.
--
-- Service role only. RLS on with no policies, like the other owner-only tables.

create extension if not exists pg_net;

create table if not exists public.uptime_checks (
  id bigint generated always as identity primary key,
  asked_at timestamptz not null default now(),
  request_id bigint,
  up boolean,
  status integer,
  took_ms integer,
  error text
);

create index if not exists uptime_checks_asked_at
  on public.uptime_checks (asked_at desc);

alter table public.uptime_checks enable row level security;

comment on table public.uptime_checks is
  'One row a minute: did https://wklyprgrss.com/api/health answer. up is null until the next tick reads the answer. took_ms is rough: it includes up to a second of waiting in the pg_net queue. Written by public.uptime_tick() on a pg_cron schedule. Service role only.';

create or replace function public.uptime_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  -- The answers to what earlier ticks asked. A timeout has no status code, so
  -- the comparison is coalesced: no answer is a miss, not an unknown.
  update public.uptime_checks c
     set up = coalesce(r.status_code = 200, false),
         status = r.status_code,
         took_ms = greatest(0, (extract(epoch from (r.created - c.asked_at)) * 1000)::integer),
         error = case when r.timed_out then 'timed out' else r.error_msg end
    from net._http_response r
   where c.up is null
     and r.id = c.request_id;

  -- pg_net keeps answers for a few hours and should always have one by now.
  -- If it does not, say so rather than leave the row open for good.
  update public.uptime_checks
     set up = false,
         error = 'no answer recorded'
   where up is null
     and asked_at < now() - interval '3 minutes';

  insert into public.uptime_checks (request_id)
  values (
    net.http_get(
      url := 'https://wklyprgrss.com/api/health',
      timeout_milliseconds := 8000
    )
  );
end
$fn$;

revoke all on function public.uptime_tick() from public, anon, authenticated;

comment on function public.uptime_tick() is
  'Reads the answers to earlier uptime checks, then asks the next one. Run once a minute by pg_cron.';

-- Each run of misses as one line: when it began, the last miss, how many.
-- Consecutive misses share the count of answers that came before them.
create or replace view public.uptime_outages
with (security_invoker = true) as
with marked as (
  select asked_at, up, status, error,
         sum(case when up then 1 else 0 end) over (order by asked_at) as answers_before
    from public.uptime_checks
   where up is not null
)
select min(asked_at) as began,
       max(asked_at) as last_miss,
       count(*)::integer as misses,
       max(status) as status,
       max(error) as error
  from marked
 where not up
 group by answers_before;

comment on view public.uptime_outages is
  'Runs of consecutive missed uptime checks, one row each. A single miss is one bad minute; several in a row is an outage.';

select cron.schedule('uptime_tick', '* * * * *', 'select public.uptime_tick()');

-- Ninety days is about 130,000 small rows. Older than that is not a question
-- anybody asks.
select cron.schedule(
  'uptime_checks_retention',
  '21 9 * * *',
  $$delete from public.uptime_checks where asked_at < now() - interval '90 days'$$
);
