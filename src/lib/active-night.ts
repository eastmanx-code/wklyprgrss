import "server-only";

import {
  carriesForward,
  currentNight,
  inCarryWindow,
  shiftNights,
} from "./night";
import { db } from "./supabase";

/**
 * Which night this checklist is actually on right now.
 *
 * `currentNight` answers the calendar question and is the right answer
 * everywhere a report is being read. It is the wrong answer to the only other
 * question anybody asks of it, which is: where does the work in front of me
 * belong? At 4am those two stop agreeing, and a crew still walking a close had
 * the board empty itself and the rest of the shift filed under the next night.
 *
 * So the work follows the shift. If the night before is still live — somebody
 * ticked it or signed it within the last hour and a half, and we are inside
 * the few hours after the changeover — that is the night, and it stays the
 * night until it goes quiet.
 *
 * Activity rather than a rule about phases, because activity is the thing that
 * actually distinguishes the two cases. A close running past four was touched
 * minutes ago. A prep open starting at six is looking at a list last touched a
 * day ago, and gets today, which is correct.
 *
 * Free outside the window: the hour is checked before anything is queried, so
 * for twenty-one hours a day this costs one comparison and behaves exactly as
 * it did before.
 */
export async function activeNight(
  checklistId: string,
  now: Date = new Date(),
): Promise<string> {
  const nights = await activeNightsFor([checklistId], now);
  return nights.get(checklistId) ?? currentNight(now);
}

/**
 * The same answer for several lists at once, in two queries rather than two
 * per list.
 *
 * The screens that show a building's lists together (the crew's front page,
 * a position's open, mid and close) asked the calendar instead, so at 4:08
 * they flipped to the new night and showed every list blank while the close
 * was still being walked one tap away. A manager read that as a cutoff. Each
 * list is decided on its own activity, exactly as the list itself is.
 */
export async function activeNightsFor(
  checklistIds: string[],
  now: Date = new Date(),
): Promise<Map<string, string>> {
  const tonight = currentNight(now);
  const nights = new Map(checklistIds.map((id) => [id, tonight]));
  if (checklistIds.length === 0 || !inCarryWindow(now)) return nights;

  const previous = shiftNights(tonight, -1);
  const { data } = await db()
    .from("close_nights")
    .select("id, checklist_id, certified_at")
    .in("checklist_id", checklistIds)
    .eq("night", previous);
  const rows = (data ?? []) as {
    id: string;
    checklist_id: string;
    certified_at: string | null;
  }[];
  if (rows.length === 0) return nights;

  // The last tick on each of those nights. One query for all of them; the
  // rows are few (one per list) and the ticks are indexed by night.
  const { data: tickRows } = await db()
    .from("close_ticks")
    .select("night_id, created_at")
    .in(
      "night_id",
      rows.map((r) => r.id),
    )
    .order("created_at", { ascending: false });
  const lastTick = new Map<string, string>();
  for (const t of (tickRows ?? []) as {
    night_id: string;
    created_at: string;
  }[]) {
    if (!lastTick.has(t.night_id)) lastTick.set(t.night_id, t.created_at);
  }

  for (const row of rows) {
    // The last thing that happened on it, whichever it was. A signature is
    // activity: reopening a night you signed ten minutes ago is the case
    // this has to keep reachable.
    const latest =
      [lastTick.get(row.id), row.certified_at]
        .filter((at): at is string => Boolean(at))
        .sort()
        .pop() ?? null;
    if (carriesForward(latest, now)) nights.set(row.checklist_id, previous);
  }
  return nights;
}
