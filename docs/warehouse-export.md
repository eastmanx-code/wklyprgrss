# Scores export — for the CH data warehouse

A read-only JSON endpoint carrying the weekly walkthrough scores, for the
warehouse loader to pull on its normal cadence.

Pulled rather than pushed, on purpose. Every other source in `ch-ops-prod` —
Toast, Sage, TaskMaverick, Ottimate, Reviews — is pulled by a loader on the
daily rebuild. Matching that keeps Google credentials out of this app
entirely, leaves backfill and replay with whoever runs the loader, and makes a
failure visible in the orchestration rather than silent in a Netlify function.

## Request

```
GET https://wklyprgrss.com/api/scores?weeks=12
Authorization: Bearer <token>
```

| Parameter | Default | Notes |
| --- | --- | --- |
| `weeks` | `1` | How many weeks back, ending with the current one. 1–26 weekly, 1–8 daily. |
| `week` | — | A single week by its Monday, `YYYY-MM-DD`. Overrides `weeks`. |
| `grain` | `week` | `week` for one row per venue per week, `day` for one row per venue per day. |

Responses: `200` with rows, `400` on a bad parameter, `401` on a bad or
missing token, `503` if the token is not configured on the server. An unset
token means the endpoint is **off**, not open.

Rows come back oldest week first.

## Response

```json
{
  "source": "wklyprgrss",
  "generated_at": "2026-08-14T02:41:07.115Z",
  "week_starts": ["2026-08-03", "2026-08-10"],
  "row_count": 42,
  "rows": [ ... ]
}
```

One row per venue **per house** per week, keyed on
`(week_ending, venue_code, house)`. Re-pulling a window is idempotent — the
same window always produces the same keys, so a loader can replay any range
without creating duplicates.

**The key changed on 2026-08-20.** `house` was added and it is part of the key,
not a detail on the row. A loader still upserting on `(week_ending,
venue_code)` will keep whichever half arrived last and silently lose the other,
so the row count per venue per week doubles and the primary key has to widen
before the next pull.

| Field | Type | Meaning |
| --- | --- | --- |
| `week_start` | DATE | Monday. How this app keys a week. |
| `week_ending` | DATE | Sunday. **Join on this** — it is what the warehouse uses. |
| `venue_code` | STRING | This app's code, verbatim. See mapping below. |
| `house` | STRING | `FOH` (dining room) or `HOH` (kitchen). Part of the key. |
| `scored` | BOOL | Whether this house's numbers counted that week. See below. |
| `items_on_board` | INT | Tasks on this house's board. |
| `filed_count` | INT | Tasks with a new photo and comment that week. The pass/fail gate. |
| `approved_count` | INT | Signed off after review. **The score.** |
| `sent_back_count` | INT | Rejected, to be done again. |
| `awaiting_review_count` | INT | Filed, no verdict yet. |
| `rolling_count` | INT | Filed, but the leader said it needs another cycle. |
| `status` | STRING | `PASS`, `PENDING`, `FAIL`. |
| `graded` | BOOL | Whether the week has been closed out for this venue. |
| `graded_by` | STRING | Who closed it. Null when ungraded. |
| `graded_at` | TIMESTAMP | When. Null when ungraded. |
| `first_filed_at` | TIMESTAMP | First entry of the week. Null if nothing was filed. |
| `last_filed_at` | TIMESTAMP | Last entry of the week. |
| `deadline_at` | TIMESTAMP | The week's cutoff, Thursday 4pm Pacific. |
| `deadline_passed` | BOOL | Whether that cutoff is behind us. |

## Three things the loader has to handle

**1. `BABY` is not a warehouse code.** Twenty of the twenty-one codes match
`ch_warehouse_staging.canonical_venues` exactly. `BABY` does not exist there —
Baby Grand is `BBGR`, `HAWK` and `FLLN`, split inconsistently across sources,
and TaskMaverick already rolls all three into `BBGR`. Map `BABY` → `BBGR` in
staging, the same way every other source's venue key is mapped. Left unmapped,
Baby Grand drops silently out of every venue join — and it is the venue with
the worst record, so it is the one least affordable to lose.

**2. `LAFA` is `candidate`, not `active`** (`is_tracked = false`) — Lafayette
Hotel Operations. Real, and it walks like the rest, but it will not blend into
"all tracked venues" totals without a caveat.

**3. Weeks are keyed differently on each side.** This app opens a week on
Monday; the warehouse closes one on Sunday. The week of Monday 2026-08-10 is
the warehouse's `2026-08-16`. Both are in every row — join on `week_ending`.

## Two things to know about the numbers

**A venue with no board scores nought out of ten, not nought out of nought.**
Building the ten is the first part of the job, so a venue that never set a list
up is the bottom of the scoring rather than outside it. `items_on_board` reads
`10` for such a venue and `status` reads `FAIL` once the deadline has passed.
A venue genuinely not in the programme yet is marked inactive and does not
appear at all.

**Historical weeks are scored against the current board.** A venue's
`items_on_board` is what it has on the board today, not what it had in the
week being reported. The schema keeps no history of board size, so a venue
that has since changed its list will show that list's size against older
weeks. Recent weeks are unaffected in practice; deep backfill is approximate
on that column alone. Every other figure is exact.

**`filed_count` and `approved_count` answer different questions.** Filing is
what a venue did; approving is a judgement made about it afterwards, usually
on or after the Thursday. Before a review pass, a fully compliant venue reads
`filed_count = 10, approved_count = 0`. A tracker showing "score" during the
week should read `filed_count`, and switch to `approved_count` only once
`graded = true`.

## What a row means depends on when you ask

A week is not a fixed thing that appears finished on Sunday night. It fills in
over four days, gets judged on the fifth, and the judgement lands after the
week is already over. Every field below is live at the moment of the request.

| When (Pacific) | What is true | What a tracker should show |
| --- | --- | --- |
| Mon 00:00 | New week opens. Every count is zero. | Nothing yet — not a failure. |
| Mon–Thu | `filed_count` climbs as venues walk their boards. `approved_count` is almost always `0`. | `filed_count / items_on_board`. |
| Thu 16:00 | `deadline_passed` flips true. `filed_count` is final in practice. | Who made ten, who did not. |
| Thu eve – Fri | Review happens. `approved_count`, `sent_back_count`, `awaiting_review_count` populate. `graded` flips true per venue. | Switch the headline to `approved_count`. |
| The following week | Late grading still lands on the **previous** week's rows. | Keep re-reading recent weeks. |

**Do not show `approved_count` as "the score" before the review.** Filing is
what a venue did; approving is a judgement made about it afterwards. Read
mid-week, a perfect venue is `filed_count = 10, approved_count = 0`, and a
tracker keyed on approvals will show the whole company at zero for four days
out of five. Read `filed_count` until `graded = true`, then `approved_count`.

**Rows are not frozen when the week ends.** Grading happens on or after the
Thursday, and sometimes days later. A loader that only ever pulls the current
week will freeze last week's approvals at whatever they were on Sunday and
never see the grade arrive.

**So pull a window, not a week.** `?weeks=4` daily, upserting on
`(week_ending, venue_code, house)`, keeps recent history correct as verdicts
land while staying small — four weeks is about a hundred and seventy rows.

**Never sum or average the two houses.** They are separate lists of ten,
walked by different people and graded separately, and the whole reason the
board was split is that one number covering both lets a spotless dining room
hide a filthy walk-in. A venue passes a week by passing both halves. Roll up to
a venue with `MIN(status)` semantics — worst half wins — not with an average.

**`HOH` starts counting the week of 2026-08-24.** Each venue writes its own ten
for the kitchen, the same way it always has for the dining room, so the boards
arrive empty and there is a week of naming and walking before anything counts.
Rows for those weeks carry `scored = false`. Filter them out of any scoreboard:
counting them puts a fresh 0/10 against every venue in the company for a board
nobody had built yet. `FOH` is `scored = true` throughout.

## What it can answer

Directly, per venue per week: did they do the work (`filed_count` against
`items_on_board`), did it pass (`approved_count`, `status`), how much got
rejected (`sent_back_count`), is anything still undecided
(`awaiting_review_count`), is the week closed (`graded`, `graded_by`,
`graded_at`), and when the work was actually filed (`first_filed_at`,
`last_filed_at`).

Derivable across venues and weeks:

- **Company completion** — `SUM(filed_count) / SUM(items_on_board)`.
- **Win rate** — venues at or above 80% of their board approved. That ratio is
  the app's own definition of a win.
- **Miss streaks** — consecutive weeks a venue failed, from the history.
- **Turnaround** — `deadline_at - last_filed_at`: how close to the wire a
  venue finished.
- **Procrastination** — `first_filed_at` against the Monday. This is the
  measure that showed thirteen of twenty venues not starting until the
  deadline day itself.
- **Grading latency** — `graded_at - deadline_at`: how long review takes after
  the cutoff.
- **Rejection rate** — `sent_back_count / filed_count` over time, per venue,
  which separates a venue filing carelessly from one filing well.

What it cannot answer, by design: what the tasks were, what the photographs
showed, what anyone wrote, or who did the work. That detail stays in the app.

## Daily grain

```
GET https://wklyprgrss.com/api/scores?grain=day&weeks=4
```

One row per venue per house per day, keyed on `(date, venue_code, house)`.
Derived from the
timestamps already on every entry, so it is exact and it reaches backwards
over all of history — there is nothing to start collecting and nothing lost
if a load is missed.

Worth being clear about why it is not built by snapshotting the weekly rows
daily: that series could only ever begin the day it was switched on, and the
idempotent upsert the weekly grain is designed for would overwrite each day
with the next.

| Field | Type | Meaning |
| --- | --- | --- |
| `date` | DATE | Calendar day, Pacific. |
| `day_of_week` | STRING | `Monday` … `Sunday`. |
| `week_start` / `week_ending` | DATE | The week this day belongs to. |
| `venue_code` | STRING | As above. |
| `house` | STRING | `FOH` or `HOH`. Part of the key, same rule as the weekly grain. |
| `scored` | BOOL | Whether this house's numbers counted that week. |
| `items_on_board` | INT | Tasks on this house's board. |
| `entries_filed` | INT | Entries filed that day. Raw activity — a re-file counts again. |
| `items_covered_to_date` | INT | Distinct tasks with an entry this week, as at the end of that day. **The progress curve.** |
| `entries_approved` | INT | Verdicts given that day. This is the admin's work, not the venue's. |
| `entries_sent_back` | INT | Rejections given that day. |
| `is_deadline_day` | BOOL | Whether that day carries the week's cutoff. |

Days that have not happened yet are not emitted — a zero on a Saturday that
is still two days away reads as a venue that failed on Saturday.

Dates are Pacific, not UTC. An entry filed at 8pm Pacific on a Wednesday is
stored as Thursday in UTC; counting off the raw timestamp would move a third
of a normal evening into the next day, and on the deadline day it would move
it past the deadline.

**What it shows that the weekly grain cannot.** The week of 2026-08-10, every
venue together:

| Day | Filed | Approved | Sent back |
| --- | --- | --- | --- |
| Mon | 0 | 0 | 0 |
| Tue | 0 | 0 | 0 |
| Wed | 61 | 0 | 0 |
| Thu (deadline) | 134 | 174 | 20 |

Weekly, that is "nineteen of twenty-one passed". Daily, it is a programme
that runs on Thursday. A venue that walked its building all week and one that
did everything in sixteen minutes on Thursday afternoon are identical in the
weekly grain and obvious in this one.

## Suggested landing

Following the conventions already in the warehouse — `fct_ctuit_log_completion_weekly`,
`fct_turn_venue_score_weekly` — this belongs as `fct_walkthrough_venue_weekly`
in `ch_warehouse_marts`, partitioned on `week_ending`, built by dbt from the
raw pull.

## Rotating the token

Set `SCORES_API_TOKEN` in the Netlify project's environment and redeploy.
Changing it revokes the old one immediately. It grants read access to scores
only — no photographs, no comments, no names of the people who did the work,
no PINs.
