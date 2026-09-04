import Link from "next/link";
import { redirect } from "next/navigation";

import { closeVenueId } from "@/lib/close-venue";
import { nightCompliance } from "@/lib/compliance";
import { currentNight, formatNight, isNightOver } from "@/lib/night";
import { previousNight } from "@/lib/close-status";
import { getSession } from "@/lib/session";
import { WEEKLY_ITEM_TARGET, getLeaderBoard, getVenue } from "@/lib/status";
import { db } from "@/lib/supabase";
import { formatDeadline } from "@/lib/week";

export const dynamic = "force-dynamic";

/**
 * The two things a venue is asked for, on one screen.
 *
 * There are two products behind one login now — the week's ten photographs and
 * the nightly lists — and the second was only reachable from a corner menu,
 * which is to say it was reachable by whoever had been told it existed. A
 * leader signing in at four in the afternoon is going to one of these two
 * places and the app should ask which rather than assume.
 *
 * Each card carries the one number that decides whether you need to open it,
 * so the choice can be made without opening either.
 */
export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role === "admin") return <AdminHome />;

  const venue = await getVenue(session.venueId);
  if (!venue) redirect("/");

  const board = await getLeaderBoard(venue.id, venue.houses);

  // What the week still wants: the halves owe ten each, and anything sent
  // back is owed on top of whatever has not been filed yet.
  const owed = venue.houses.length * WEEKLY_ITEM_TARGET;
  const filed = venue.houses.reduce(
    (n, house) =>
      n + (board.houses.find((h) => h.house === house)?.doneItemIds.size ?? 0),
    0,
  );
  const sentBack = venue.houses.reduce(
    (n, house) =>
      n +
      (board.houses.find((h) => h.house === house)?.sentBackItemIds.size ?? 0),
    0,
  );

  // Tonight's lists, and how many are already signed.
  const closeVenue = await closeVenueId(session);
  const { data: listRows } = closeVenue
    ? await db()
        .from("close_checklists")
        .select("id")
        .eq("venue_id", closeVenue)
        .eq("active", true)
    : { data: [] };
  const lists = (listRows ?? []) as { id: string }[];

  let signed = 0;
  if (lists.length > 0) {
    const { data: nightRows } = await db()
      .from("close_nights")
      .select("checklist_id, certified_at")
      .eq("night", currentNight())
      .in(
        "checklist_id",
        lists.map((l) => l.id),
      );
    signed = ((nightRows ?? []) as { certified_at: string | null }[]).filter(
      (r) => r.certified_at,
    ).length;
  }

  const weekOpen = filed < owed || sentBack > 0;
  const nightOpen = lists.length > 0 && signed < lists.length;

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <header className="mt-4 mb-6">
        <p className="label">
          {venue.name && venue.name !== venue.code ? venue.name : venue.code}
        </p>
        <h1 className="text-metric mt-2 font-medium">Where to?</h1>
      </header>

      <ul className="space-y-3">
        {/* Ordered by the clock, not by importance: the nightly list is the
            thing in front of somebody opening this during a shift, and the
            week is the thing they come back to. */}
        <Card
          href="/close"
          title="Checklists"
          lit={nightOpen}
          note={
            lists.length === 0
              ? "Nothing set up yet · start your first list"
              : signed === lists.length
                ? `All ${lists.length} signed for tonight`
                : `${lists.length - signed} of ${lists.length} still open tonight`
          }
        />

        <Card
          href="/venue"
          title="Weekly progress"
          lit={weekOpen}
          note={
            sentBack > 0
              ? `${filed} of ${owed} filed · ${sentBack} sent back`
              : filed >= owed
                ? `All ${owed} filed · due ${formatDeadline(board.weekStart)}`
                : `${filed} of ${owed} filed · due ${formatDeadline(board.weekStart)}`
          }
        />
      </ul>

      <p className="label mt-6">
        Lit means something is still open. Deadline{" "}
        {formatDeadline(board.weekStart)}, and the night closes when every list
        is signed.
      </p>
    </main>
  );
}

/**
 * The same question asked of an admin, in their order.
 *
 * Compliance leads. A leader opens this during a shift and is going to walk a
 * list or file a photograph; an admin opens it in the morning and the first
 * thing they want is what went wrong last night, which is a report and not a
 * task. Putting the week first would put the thing they check on Thursday
 * above the thing they check every day.
 *
 * Last night rather than tonight, for the same reason. At nine in the morning
 * the night in progress is empty and the night that finished is the one with
 * the answer in it.
 */
async function AdminHome() {
  // The night with a verdict on it. Before the roll at 4am that is still last
  // night; after it, the one that just ended.
  const tonight = currentNight();
  const night = isNightOver(tonight) ? tonight : previousNight(tonight);

  const venues = await nightCompliance(night);
  const failingVenues = venues.filter((v) => v.tier === "fail").length;
  const failedLists = venues.reduce((n, v) => n + v.failed, 0);

  return (
    <main className="close-flow mx-auto max-w-2xl pb-4">
      <header className="mt-4 mb-6">
        <p className="label">Admin</p>
        <h1 className="text-metric mt-2 font-medium">Where to?</h1>
      </header>

      <ul className="space-y-3">
        <Card
          href={`/close/compliance?night=${night}`}
          title="Close compliance"
          lit={failedLists > 0}
          note={
            venues.length === 0
              ? `${formatNight(night)} · no venue was running a list`
              : failedLists > 0
                ? `${formatNight(night)} · ${failedLists} ${
                    failedLists === 1 ? "list" : "lists"
                  } failed across ${failingVenues} ${
                    failingVenues === 1 ? "venue" : "venues"
                  }`
                : `${formatNight(night)} · nothing failed`
          }
        />

        <Card
          href="/admin"
          title="Weekly progress"
          lit={false}
          note="Every venue's board, and the grading queue"
        />

        <Card
          href="/close/locations"
          title="Checklists"
          lit={false}
          note="Pick a location, then a position"
        />
      </ul>

      <p className="label mt-6">
        Lit means something wants looking at. Compliance reads the night that
        has finished, not the one in progress.
      </p>
    </main>
  );
}

/**
 * One of the two doors.
 *
 * The second line does not take `.label` on a lit card. That class carries its
 * own colour — half-strength white — which is legible on the dark page it was
 * written for and close to invisible laid over the olive: white at fifty
 * percent on #bcbc1e is under two to one. On a lit card the ink is named
 * outright and dropped to three quarters, which keeps it secondary to the
 * heading without asking anybody to squint at the only number on the card.
 */
function Card({
  href,
  title,
  note,
  lit,
}: {
  href: string;
  title: string;
  note: string;
  lit: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`flex min-h-32 flex-col justify-between gap-3 rounded-[6px] p-5 ${
          lit
            ? "bg-warn text-on-warn hover:bg-warn/90"
            : "bg-inset ring-divider hover:ring-muted/40 ring-1 ring-inset"
        }`}
      >
        <span className="text-metric leading-tight">{title}</span>
        <span
          className={
            lit ? "text-on-warn text-label tracking-[0.08em]" : "label"
          }
        >
          {note}
        </span>
      </Link>
    </li>
  );
}
