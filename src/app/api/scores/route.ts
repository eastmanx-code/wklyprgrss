import { requireToken } from "@/lib/api-auth";
import { venueDayRows, venueWeekRows } from "@/lib/scores";
import { currentWeekStart, shiftWeeks } from "@/lib/week";

export const dynamic = "force-dynamic";

const MAX_WEEKS = 26;
// Seven rows a day per venue rather than one a week, so the same window is
// seven times the payload. Held lower to keep a careless ?weeks=26 from
// returning four thousand rows nobody asked for.
const MAX_WEEKS_DAILY = 8;
const WEEK_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Scores, for the warehouse.
 *
 * Read-only and numbers only — no photographs, no comments, no names of the
 * people who did the work, no PINs. A tracker needs to say how a venue did;
 * it does not need the evidence, and the evidence is the part that would
 * matter if this token ever went astray.
 *
 * Pulled rather than pushed, because every other source in that warehouse is
 * pulled: it keeps Google credentials out of this app entirely, and leaves
 * backfill and replay in the hands of whoever runs the loader.
 *
 *   GET /api/scores?weeks=12
 *   GET /api/scores?week=2026-08-10
 *   Authorization: Bearer <token>
 *
 * Rows are keyed on (week_ending, venue_code, house), so re-pulling a window is
 * idempotent — a loader can replay any range without making duplicates.
 *
 * The house is part of the key, not a detail on the row. The dining room and
 * the kitchen are walked by different people against separate lists of ten and
 * graded separately; a loader that dropped the column and upserted on venue
 * and week alone would keep whichever of the two arrived last and silently
 * lose the other.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = requireToken(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const single = params.get("week");
  const weeksParam = params.get("weeks");
  const grain = params.get("grain") ?? "week";

  if (grain !== "week" && grain !== "day") {
    return Response.json(
      { error: "grain must be week or day" },
      { status: 400 },
    );
  }
  const maxWeeks = grain === "day" ? MAX_WEEKS_DAILY : MAX_WEEKS;

  let weekStarts: string[];
  if (single) {
    if (!WEEK_PATTERN.test(single)) {
      return Response.json(
        { error: "week must be a YYYY-MM-DD Monday" },
        { status: 400 },
      );
    }
    weekStarts = [single];
  } else {
    const asked = weeksParam ? Number(weeksParam) : 1;
    if (!Number.isInteger(asked) || asked < 1 || asked > maxWeeks) {
      return Response.json(
        { error: `weeks must be a whole number from 1 to ${maxWeeks}` },
        { status: 400 },
      );
    }
    const current = currentWeekStart();
    // Oldest first, so a loader appending in order gets chronological rows.
    weekStarts = Array.from({ length: asked }, (_, i) =>
      shiftWeeks(current, -(asked - 1 - i)),
    );
  }

  const rows =
    grain === "day"
      ? await venueDayRows(weekStarts)
      : await venueWeekRows(weekStarts);

  return Response.json(
    {
      source: "wklyprgrss",
      grain,
      generated_at: new Date().toISOString(),
      week_starts: weekStarts,
      row_count: rows.length,
      rows,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
