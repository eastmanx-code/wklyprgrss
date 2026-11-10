import { notFound, redirect } from "next/navigation";

import { Dial } from "@/components/Dial";
import { BackLink } from "@/components/ui";
import { CommitmentTile } from "@/components/walkthroughs/CommitmentTile";
import { WalkQueue } from "@/components/walkthroughs/WalkQueue";
import { isDocPath, signedUrls } from "@/lib/photos";
import { getSession, mayManage, mayReachVenue } from "@/lib/session";
import {
  CATEGORY_BADGE,
  CATEGORY_LABEL,
  EVENT_LABEL,
  isActionable,
  loadProperty,
  loadWalkLog,
  type Commitment,
  type WalkCategory,
  type WalkEvent,
} from "@/lib/walkthroughs";

export const dynamic = "force-dynamic";

function fmtDate(date: string | null): string {
  if (!date) return "—";
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed)) return date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

/**
 * One property's latest walkthrough, worked the way a close list is worked.
 *
 * The commitments are grouped by category, overdue at the top of each group and
 * the signed ones at the bottom, still on the page so the property can see what
 * it has closed out. Food safety leads; the two parking lots, goals and the
 * covered notes, sit at the bottom where they do not get rediscovered.
 */
export default async function PropertyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await getSession();
  if (!session) redirect("/");

  const property = await loadProperty(slug);
  if (!property) notFound();

  // A manager reaches only their own building.
  if (
    session.role !== "admin" &&
    (property.venueId == null || !mayReachVenue(session, property.venueId))
  ) {
    redirect("/walkthroughs");
  }

  // Sign photo paths for this property in one pass.
  const paths = property.groups.flatMap((g) =>
    g.items.flatMap((i) => i.photos.map((p) => p.path)),
  );
  const urls = paths.length > 0 ? await signedUrls(paths) : new Map();

  const s = property.summary;
  const behind = s.overdue > 0;
  const photoCount = paths.length;
  const isAdmin = session.role === "admin";
  // The change log is a manager's view, not a leader's: a leader signs the
  // work, a manager answers for it. Load it only for those who see it.
  const canSeeLog = mayManage(session);
  const events = canSeeLog ? await loadWalkLog(property.id) : [];

  // Tasks due, broken out by category, so the header says where the work is.
  const dueByCategory = property.groups
    .filter((g) => isActionable(g.category))
    .map((g) => ({
      category: g.category,
      open: g.items.filter((i) => i.status !== "signed").length,
      overdue: g.items.filter((i) => i.status === "overdue").length,
    }))
    .filter((c) => c.open > 0)
    // Biggest pile of work first, so the bars read top to bottom.
    .sort((a, b) => b.open - a.open);
  // The longest bar sets the scale the rest are drawn against.
  const maxDue = Math.max(1, ...dueByCategory.map((c) => c.open));

  return (
    <main className="close-flow">
      <BackLink href="/walkthroughs">All properties</BackLink>

      <header className="mt-4 mb-5">
        <p className="label">
          {property.name} · walked {fmtDate(property.lastWalk)}
          {property.walkedBy ? ` · ${property.walkedBy}` : ""}
        </p>
        <h1 className="text-metric mt-2 font-medium">Walkthrough</h1>
      </header>

      {/* The one drainer for this board's photo queue, and the only place it is
          shown what is still waiting to upload. */}
      <WalkQueue />

      {/* One metrics panel: the building's ring and headline counts up top,
          then the same numbers broken out by category underneath, so the whole
          state of the walk reads as one block rather than a ring and a scatter
          of chips. */}
      <div className="panel mb-6 p-5 sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-8">
          {/* Dial and headline count. */}
          <div className="flex items-center gap-5 md:shrink-0">
            <div className="w-24 shrink-0">
              <Dial
                percent={s.percent}
                tone={behind ? "var(--warn)" : "var(--ink)"}
                caption=""
                label={`${s.signed}/${s.actionable}`}
                size={96}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[17px] text-ink font-medium leading-snug">
                {s.signed} of {s.actionable} signed off
              </p>
              <p className="label mt-1.5 text-[12px]">
                {s.overdue > 0 ? (
                  <span className="text-warn">{s.overdue} overdue</span>
                ) : (
                  "none overdue"
                )}
                {" · "}
                {photoCount} {photoCount === 1 ? "photo" : "photos"}
              </p>
            </div>
          </div>

          {/* The same numbers by category, filling the rest of the band on a
              wide screen and dropping under the dial on a phone. */}
          {dueByCategory.length > 0 ? (
            <div className="border-divider flex-1 space-y-2.5 border-t pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-8">
              {dueByCategory.map((c) => (
                <div key={c.category} className="flex items-center gap-3">
                  <span className="label w-28 shrink-0 truncate text-[11px] text-muted">
                    {CATEGORY_BADGE[c.category]}
                  </span>
                  {/* Bar length is how much is due; the warn part is how much of
                      that is overdue. */}
                  <div className="bg-inset h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="flex h-full"
                      style={{ width: `${Math.max((c.open / maxDue) * 100, 4)}%` }}
                    >
                      <div
                        className="h-full bg-warn"
                        style={{ width: `${(c.overdue / c.open) * 100}%` }}
                      />
                      <div
                        className="bg-ink/55 h-full"
                        style={{ width: `${((c.open - c.overdue) / c.open) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="label w-20 shrink-0 text-right text-[11px] tabular-nums">
                    <span className="text-ink">{c.open}</span>
                    {c.overdue > 0 ? (
                      <span className="text-warn"> · {c.overdue} late</span>
                    ) : (
                      <span className="text-muted"> due</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-10">
        {property.groups.map((group) => (
          <section key={group.category}>
            <h2 className="card-title mb-4 text-[18px]">
              {CATEGORY_LABEL[group.category]}
              <span className="label ml-2 text-[12px] text-muted">
                {group.items.length}
              </span>
            </h2>
            {/* One grid, uniform tiles: a square photo or a square add-a-photo
                well up top, so a done card and a to-do card are the same size. */}
            <ul className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {group.items.map((item) => (
                <CommitmentRow
                  key={item.id}
                  item={item}
                  urls={urls}
                  observed={property.lastWalk}
                  isAdmin={isAdmin}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {canSeeLog ? <ChangeLog events={events} /> : null}
    </main>
  );
}

/** Date and time in Pacific for a log line, e.g. "Sep 19 · 3:04 PM". */
function fmtWhen(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return `${day} · ${time}`;
}

/**
 * The change log, managers and admins only. Every edit since the table was
 * built: a photo added or pulled back off, a sign-off, an answer, a reopen.
 * Collapsed by default so it does not crowd the work; open it to see who
 * touched what. This is the accountability behind the remove button.
 */
function ChangeLog({ events }: { events: WalkEvent[] }) {
  return (
    <details className="panel mt-8 p-5">
      <summary className="card-title cursor-pointer select-none">
        Change log
        <span className="label text-muted ml-2">{events.length}</span>
      </summary>
      {events.length === 0 ? (
        <p className="label text-muted mt-3">No edits recorded yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {events.map((e) => (
            <li key={e.id} className="text-body leading-snug">
              <span className="text-ink">{EVENT_LABEL[e.kind] ?? e.kind}</span>
              <span className="text-muted"> by {e.actor}</span>
              {e.commitment ? (
                <span className="text-muted"> · {e.commitment}</span>
              ) : null}
              {e.detail ? (
                <span className="text-muted"> · {e.detail}</span>
              ) : null}
              <span className="label text-muted block">
                {fmtWhen(e.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

const SPECIAL: WalkCategory[] = ["open_question", "future_goal", "covered"];

/**
 * One commitment, as a uniform tile that opens into a full detail sheet.
 *
 * The server side is only the shaping: sign the photo URLs, flatten the item to
 * the plain fields the tile needs, and hand it off. Everything a manager does
 * with it, reading the full finding and working it, happens in the client tile
 * and the sheet it opens, because the finding does not fit a tile and the whole
 * card has to be one tap target.
 */
function CommitmentRow({
  item,
  urls,
  observed,
  isAdmin,
}: {
  item: Commitment;
  urls: Map<string, string>;
  observed: string | null;
  isAdmin: boolean;
}) {
  const photos = item.photos
    .map((p) => ({
      id: p.id,
      url: urls.get(p.path),
      isDoc: isDocPath(p.path),
    }))
    .filter((p): p is { id: string; url: string; isDoc: boolean } =>
      Boolean(p.url),
    );

  return (
    <CommitmentTile
      id={item.id}
      badge={CATEGORY_BADGE[item.category]}
      commitment={item.commitment}
      due={item.due}
      status={item.status}
      daysOverdue={item.daysOverdue}
      actionable={item.actionable}
      question={item.category === "open_question"}
      special={SPECIAL.includes(item.category)}
      signedBy={item.signedBy}
      signedAt={item.signedAt}
      note={item.note}
      repeatCount={item.repeatCount}
      photos={photos}
      observed={observed}
      isAdmin={isAdmin}
    />
  );
}
