import { requireToken } from "@/lib/api-auth";
import { closeStatus } from "@/lib/close-status";
import { currentNight, isNightOver } from "@/lib/night";

export const dynamic = "force-dynamic";

const NIGHT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Where every checklist stands, right now.
 *
 *   GET /api/close
 *   GET /api/close?night=2026-08-14
 *   Authorization: Bearer <token>
 *
 * Live rather than scheduled. Nothing pushes and nothing has to be delivered —
 * the state is readable at any moment, which is what a board on a wall or a
 * tile on a tracker actually needs, and it costs no provider, no send list and
 * nobody's phone number.
 *
 * Every active checklist appears whether or not anyone has opened it. A list
 * nobody touched is the row that matters most, and an endpoint returning only
 * lists somebody had started would report the quietest venue as the cleanest.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = requireToken(request);
  if (denied) return denied;

  const asked = new URL(request.url).searchParams.get("night");
  if (asked && !NIGHT_PATTERN.test(asked)) {
    return Response.json(
      { error: "night must be YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const night = asked ?? currentNight();
  const rows = await closeStatus(night);

  const signed = rows.filter((r) => r.certified).length;
  const untouched = rows.filter((r) => r.untouched).length;
  const empty = rows.filter((r) => r.empty).length;
  const owed = rows.reduce((n, r) => n + r.items_on_list, 0);
  const done = rows.reduce((n, r) => n + r.ticked, 0);

  return Response.json(
    {
      source: "wklyprgrss",
      surface: "close",
      generated_at: new Date().toISOString(),
      night,
      // A night still running is a progress report; a night that has ended is
      // a result. A consumer that cannot tell the two apart will call an
      // ordinary Tuesday evening a failure at 9pm.
      night_over: isNightOver(night),
      lists: rows.length,
      lists_signed: signed,
      lists_untouched: untouched,
      // A list somebody made and never wrote. Counted apart from untouched so
      // a setup mistake does not read as a venue ignoring its close.
      lists_empty: empty,
      items_owed: owed,
      items_done: done,
      rows,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
