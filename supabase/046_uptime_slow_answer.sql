-- A slow answer is a miss.
--
-- 044 counted a check as up whenever the site answered 200, however long it
-- took. On 2026-11-16, from 12:30 to 12:36 AM Pacific, the store page held the
-- database's connections and the app took 25.9 s, 3.7 s and 5.5 s to answer the
-- health check. All three counted as up, no push went out, and the first word
-- of it was a phone photo of the "not answering" page the next morning.
--
-- A healthy check takes about 40 ms, and the slowest one in a hundred about
-- 420 ms. Anything over 3 seconds now counts as a miss, the same as no answer.
-- Over the week before this change that line was crossed three times, all
-- three inside that outage, so it adds no false alarms on the record so far.
-- Replayed against that night, checks at 12:33, 12:34 and 12:35 miss and the
-- push goes out on the second.
--
-- What this still cannot do: the two checks at 12:31 and 12:32 never started,
-- because the database was the part that was starved. A tick that does not run
-- cannot count itself as a miss.
--
-- Applied to the live database on 2026-11-20. Only the function changes.

create or replace function public.uptime_tick()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
  -- An answer slower than this is a miss. A healthy check takes about 40 ms
  -- and the slowest one in a hundred about 420 ms. On 2026-11-16 the app took
  -- 25.9 s, 3.7 s and 5.5 s to answer and every one of them counted as up.
  slow_ms constant integer := 3000;
begin
  update public.uptime_checks c
     set up = coalesce(
           r.status_code = 200
           and greatest(0, (extract(epoch from (r.created - c.asked_at)) * 1000)::integer) <= slow_ms,
           false),
         status = r.status_code,
         took_ms = greatest(0, (extract(epoch from (r.created - c.asked_at)) * 1000)::integer),
         error = case
           when r.timed_out then 'timed out'
           when r.status_code = 200
            and greatest(0, (extract(epoch from (r.created - c.asked_at)) * 1000)::integer) > slow_ms
             then 'slow answer'
           else r.error_msg
         end
    from net._http_response r
   where c.up is null
     and r.id = c.request_id;

  update public.uptime_checks
     set up = false,
         error = 'no answer recorded'
   where up is null
     and asked_at < now() - interval '3 minutes';

  select * into a from public.uptime_alert where id;
  in_drill := coalesce(a.drill_until > now(), false);

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
        'Not answering, or too slow to use, since '
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
$function$;
