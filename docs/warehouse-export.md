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
| `weeks` | `1` | How many weeks back, ending with the current one. 1–26. |
| `week` | — | A single week by its Monday, `YYYY-MM-DD`. Overrides `weeks`. |

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

One row per venue per week, keyed on `(week_ending, venue_code)`. Re-pulling a
window is idempotent — the same window always produces the same keys, so a
loader can replay any range without creating duplicates.

| Field | Type | Meaning |
| --- | --- | --- |
| `week_start` | DATE | Monday. How this app keys a week. |
| `week_ending` | DATE | Sunday. **Join on this** — it is what the warehouse uses. |
| `venue_code` | STRING | This app's code, verbatim. See mapping below. |
| `items_on_board` | INT | Tasks on the venue's board. |
| `filed_count` | INT | Tasks with a new photo and comment that week. The pass/fail gate. |
| `approved_count` | INT | Signed off after review. **The score.** |
| `sent_back_count` | INT | Rejected, to be done again. |
| `awaiting_review_count` | INT | Filed, no verdict yet. |
| `rolling_count` | INT | Filed, but the leader said it needs another cycle. |
| `status` | STRING | `PASS`, `PENDING`, `FAIL`, `SETUP`. |
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
