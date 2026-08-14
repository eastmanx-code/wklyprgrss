import { timingSafeEqual } from "node:crypto";

import { venueWeekRows } from "@/lib/scores";
import { currentWeekStart, shiftWeeks } from "@/lib/week";

export const dynamic = "force-dynamic";

const MAX_WEEKS = 26;
const WEEK_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Constant-time, and safe on length.
 *
 * `timingSafeEqual` throws when the buffers differ in length, which would turn
 * a wrong-length token into a 500 and leak the right length through the
 * difference in response.
 */
function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function unauthorized(): Response {
  return Response.json(
    { error: "Unauthorized" },
    { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
  );
}

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
 * Rows are keyed on (week_ending, venue_code), so re-pulling a window is
 * idempotent — a loader can replay any range without making duplicates.
 */
export async function GET(request: Request): Promise<Response> {
  const expected = process.env.SCORES_API_TOKEN;
  // Fails closed. An unset token must never mean "open to everyone", which is
  // what checking `given === expected` on two undefineds would have meant.
  if (!expected) {
    return Response.json(
      { error: "Not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!given || !tokenMatches(given, expected)) return unauthorized();

  const params = new URL(request.url).searchParams;
  const single = params.get("week");
  const weeksParam = params.get("weeks");

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
    if (!Number.isInteger(asked) || asked < 1 || asked > MAX_WEEKS) {
      return Response.json(
        { error: `weeks must be a whole number from 1 to ${MAX_WEEKS}` },
        { status: 400 },
      );
    }
    const current = currentWeekStart();
    // Oldest first, so a loader appending in order gets chronological rows.
    weekStarts = Array.from({ length: asked }, (_, i) =>
      shiftWeeks(current, -(asked - 1 - i)),
    );
  }

  const rows = await venueWeekRows(weekStarts);

  return Response.json(
    {
      source: "wklyprgrss",
      generated_at: new Date().toISOString(),
      week_starts: weekStarts,
      row_count: rows.length,
      rows,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
