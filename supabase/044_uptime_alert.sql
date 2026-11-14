-- The uptime record sends its own alert, to a phone.
--
-- 043 keeps a row a minute on whether the site answered, and left the alert to
-- a scheduled GitHub run. That run did not start on its own for two hours after
-- it was merged, and the mail from a failed test run never arrived. The record
-- is the part that runs every minute without fail, so the alert moves here.
--
-- When two checks in a row miss, one push goes out: the app is down, and since
-- when. When the next check answers, a second push says it is back and how long
-- it was gone. Nothing is sent in between, so a long outage is two
-- notifications, not one a minute.
--
-- The push goes through ntfy.sh, which needs no account: the phone subscribes
-- to a topic name and anything posted to that name arrives. The name is the
-- only secret, so it is NOT in this file. This repository is public. It is set
-- by hand in public.uptime_alert.topic, and while it is empty nothing is sent.
--
-- A drill proves the whole path without waiting for a real outage. Setting
-- drill_until a few minutes ahead makes the tick ask an address that does not
-- exist; the misses are marked as drill rows, the pushes say DRILL, and the
-- outage view leaves them out. A drill ends itself when the time passes.
--
--   update public.uptime_alert set drill_until = now() + interval '4 minutes';
--
-- What this cannot do: if the database is down the ticks stop and nothing is
-- sent. The app is down too in that case.
--
-- Service role only. RLS on with no policies, like the other owner-only tables.

alter table public.uptime_checks
  add column if not exists drill boolean not null default false;

create table if not exists public.uptime_alert (
  id boolean primary key default true,
  topic text,
  drill_until timestamptz,
  down_since timestamptz,
  down_drill boolean not null default false,
  constraint uptime_alert_singleton check (id)
);

alter table public.uptime_alert enable row level security;

insert into public.uptime_alert (id) values (true) on conflict (id) do nothing;

comment on table public.uptime_alert is
  'Single row. topic is the private ntfy.sh topic the outage push goes to (empty means send nothing; never commit it). drill_until in the future runs a fire drill. down_since is set while an outage is open, so the push goes once when it starts and once when it ends. Service role only.';

create or replace function public.uptime_notify(p_title text, p_message text, p_priority integer)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  t text;
begin
  select topic into t from public.uptime_alert where id;
  if t is null or t = '' then
    return;
  end if;

  perform net.http_post(
    url := 'https://ntfy.sh',
    body := jsonb_build_object(
      'topic', t,
      'title', p_title,
      'message', p_message,
      'priority', p_priority
    ),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 8000
  );
end
$fn$;

revoke all on function public.uptime_notify(text, text, integer) from public, anon, authenticated;

create or replace function public.uptime_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  a public.uptime_alert%rowtype;
  in_drill boolean;
  misses integer;
  settled integer;
  first_miss timestamptz;
  latest_at timestamptz;
  latest_up boolean;
  any_drill boolean;
  mins integer;
  tag text;
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

  select * into a from public.uptime_alert where id;
  in_drill := coalesce(a.drill_until > now(), false);

  -- The alert. In its own block: whatever goes wrong in here, the record
  -- above and the next question below still happen.
  begin
    select count(*),
           count(*) filter (where not s.up),
           min(s.asked_at),
           max(s.asked_at),
           (array_agg(s.up order by s.asked_at desc))[1],
           bool_or(s.drill)
      into settled, misses, first_miss, latest_at, latest_up, any_drill
      from (
        select up, asked_at, drill
          from public.uptime_checks
         where up is not null
         order by asked_at desc
         limit 2
      ) s;

    if a.down_since is null and settled = 2 and misses = 2 then
      update public.uptime_alert
         set down_since = first_miss, down_drill = any_drill
       where id;
      tag := case when any_drill then 'DRILL: ' else '' end;
      perform public.uptime_notify(
        tag || 'Checklist app is DOWN',
        'Not answering since '
          || to_char(first_miss at time zone 'America/Los_Angeles', 'FMHH12:MI AM')
          || '. Two checks in a row missed.',
        5
      );
    elsif a.down_since is not null and latest_up then
      mins := greatest(1, round(extract(epoch from (latest_at - a.down_since)) / 60)::integer);
      tag := case when a.down_drill then 'DRILL: ' else '' end;
      update public.uptime_alert
         set down_since = null, down_drill = false
       where id;
      perform public.uptime_notify(
        tag || 'Checklist app is back',
        'Answering again at '
          || to_char(latest_at at time zone 'America/Los_Angeles', 'FMHH12:MI AM')
          || '. Down about ' || mins || case when mins = 1 then ' minute.' else ' minutes.' end,
        3
      );
    end if;
  exception when others then
    null;
  end;

  insert into public.uptime_checks (request_id, drill)
  values (
    net.http_get(
      url := case
        when in_drill then 'https://wklyprgrss.com/api/health-drill'
        else 'https://wklyprgrss.com/api/health'
      end,
      timeout_milliseconds := 8000
    ),
    in_drill
  );
end
$fn$;

revoke all on function public.uptime_tick() from public, anon, authenticated;

-- Each run of misses as one line: when it began, the last miss, how many.
-- Consecutive misses share the count of answers that came before them.
-- Drill rows are left out: a fire drill is not an outage.
create or replace view public.uptime_outages
with (security_invoker = true) as
with marked as (
  select asked_at, up, status, error,
         sum(case when up then 1 else 0 end) over (order by asked_at) as answers_before
    from public.uptime_checks
   where up is not null
     and not drill
)
select min(asked_at) as began,
       max(asked_at) as last_miss,
       count(*)::integer as misses,
       max(status) as status,
       max(error) as error
  from marked
 where not up
 group by answers_before;
