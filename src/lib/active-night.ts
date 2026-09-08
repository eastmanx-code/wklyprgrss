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
  const tonight = currentNight(now);
  if (!inCarryWindow(now)) return tonight;

  const previous = shiftNights(tonight, -1);
  const { data } = await db()
    .from("close_nights")
    .select("id, certified_at")
    .eq("checklist_id", checklistId)
    .eq("night", previous)
    .maybeSingle();
  const row = data as { id: string; certified_at: string | null } | null;
  if (!row) return tonight;

  // The last thing that happened on it, whichever it was. A signature is
  // activity: reopening a night you signed ten minutes ago is the case this
  // has to keep reachable.
  const { data: ticks } = await db()
    .from("close_ticks")
    .select("created_at")
    .eq("night_id", row.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const lastTick =
    ((ticks ?? []) as { created_at: string }[])[0]?.created_at ?? null;

  const latest =
    [lastTick, row.certified_at]
      .filter((at): at is string => Boolean(at))
      .sort()
      .pop() ?? null;

  return carriesForward(latest, now) ? previous : tonight;
}
