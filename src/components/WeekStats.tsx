import { Card } from "./Card";
import { isWin, WEEKLY_ITEM_TARGET } from "@/lib/status";
import type { House, VenueWeekSummary } from "@/lib/types";

/**
 * The week in four tiles, before any list.
 *
 * The shape every dashboard guide lands on and the one this page never had: a
 * strip of a few figures across the top, then the detail underneath. It is
 * also the only layout that survives the jump from a phone to a laptop without
 * being redrawn — the tiles are a grid that reflows from one column to four,
 * rather than a table being squeezed.
 *
 * Four, not eight. Each one is a question somebody actually asks on a Friday:
 * what is left for me, how did the company do, who is on a run, and what has
 * been rejected and never fixed.
 */
function Tile({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "ink" | "warn" | "muted";
}) {
  return (
    <div className="bg-inset min-w-0 rounded-[6px] p-4">
      <p className="label">{label}</p>
      <p
        className={`text-metric mt-2 leading-[1.1] tracking-normal tabular-nums ${
          tone === "warn"
            ? "text-warn"
            : tone === "muted"
              ? "text-muted"
              : "text-ink"
        }`}
      >
        {value}
      </p>
      {sub ? <p className="label mt-1.5 truncate">{sub}</p> : null}
    </div>
  );
}

export function WeekStats({
  rows,
  gradedByHouse,
  audience = "leader",
}: {
  rows: VenueWeekSummary[];
  gradedByHouse?: Map<House, Map<string, string>>;
  /**
   * Who is reading.
   *
   * The review queue belongs to whoever grades, and this card is on the
   * leaders' board as well as the admin screen. "Waiting on you" in front of
   * a venue manager names the wrong person: they cannot approve anything, and
   * a number addressed to them that they cannot move is worse than no number.
   * Same fact, said about the company rather than at the reader.
   */
  audience?: "admin" | "leader";
}) {
  const isAdmin = audience === "admin";
  const scoredHouses = rows.flatMap((row) => row.scored);

  // What is still owed to somebody.
  const toReview = scoredHouses.reduce((n, h) => n + h.pendingCount, 0);
  // Walked from the rows, because a house line does not carry its own venue.
  const ungraded = rows.reduce(
    (n, row) =>
      n +
      row.scored.filter(
        (h) => h.hasBoard && !gradedByHouse?.get(h.house)?.has(row.venue.id),
      ).length,
    0,
  );

  // How the company did, counted in halves rather than venues: a dining room
  // at ten and a kitchen at two is not "one venue at six".
  const judged = scoredHouses.filter((h) => h.hasBoard && h.pendingCount === 0);
  const wins = judged.filter((h) => isWin(h.approvedCount, h.activeCount));

  // The longest run going, and who is on it. Named because a streak is the
  // one number here worth being seen holding.
  const best = rows
    .map((row) => ({ code: row.venue.code, streak: row.runWeeks }))
    .sort((a, b) => b.streak - a.streak)[0];
  const onARun = rows.filter((row) => row.runWeeks >= 2).length;

  const perfect = judged.filter(
    (h) => h.approvedCount >= WEEKLY_ITEM_TARGET,
  ).length;

  return (
    <Card
      className="col-span-12"
      title="The week"
      hint="A board passes at 8 of its 10 signed off"
    >
      {/* auto-fit rather than fixed columns: one across on a phone, two on a
          large phone, four on a laptop, with nothing to configure per screen. */}
      {/* Three, in the words people use. "22 of 35 halves cleared the line"
          was language invented for the screen: nobody calls a kitchen a half
          or a pass a line, and a figure somebody has to translate is one they
          stop reading.

          The count of work sent back and never redone is gone from here. It
          is a real number and it belongs on the venue that owes it, where
          somebody can do something about it — at the top of the company
          dashboard it is a backlog with nobody's name on it. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-3">
        <Tile
          label={isAdmin ? "To review" : "With the graders"}
          value={toReview}
          sub={
            toReview > 0
              ? ungraded > 0
                ? `${ungraded} not graded yet`
                : "photos waiting"
              : "nothing waiting"
          }
          tone={toReview > 0 ? "warn" : "ink"}
        />
        <Tile
          label="Boards passed"
          value={`${wins.length} of ${judged.length}`}
          sub={
            perfect > 0 ? `${perfect} got all ten` : "8 of 10 signed off passes"
          }
        />
        <Tile
          label="Best run"
          value={best && best.streak > 0 ? `${best.streak} weeks` : "—"}
          sub={
            best && best.streak > 0
              ? `${best.code}${onARun > 1 ? ` · ${onARun} venues going` : ""}`
              : "nobody on a run yet"
          }
        />
      </div>
    </Card>
  );
}
