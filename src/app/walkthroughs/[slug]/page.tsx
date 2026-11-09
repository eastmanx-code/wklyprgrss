import { notFound, redirect } from "next/navigation";

import { Dial } from "@/components/Dial";
import { BackLink } from "@/components/ui";
import { CommitmentActions } from "@/components/walkthroughs/CommitmentActions";
import { WalkQueue } from "@/components/walkthroughs/WalkQueue";
import { PhotoGrid } from "@/components/walkthroughs/PhotoGrid";
import { QuestionAnswer } from "@/components/walkthroughs/QuestionAnswer";
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
    .filter((c) => c.open > 0);

  return (
    <main className="close-flow mx-auto max-w-7xl">
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
      <div className="panel mb-6 max-w-3xl p-5 sm:p-6">
        <div className="flex items-center gap-5">
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

        {dueByCategory.length > 0 ? (
          <div className="border-divider mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-4">
            {dueByCategory.map((c) => (
              <div key={c.category}>
                <p className="label text-[11px] text-muted">
                  {CATEGORY_BADGE[c.category]}
                </p>
                <p className="mt-1.5 text-[18px] text-ink tabular-nums leading-none">
                  {c.open}
                  <span className="label ml-1 text-[11px] text-muted">due</span>
                </p>
                <p
                  className={`label mt-1 text-[11px] tabular-nums ${
                    c.overdue > 0 ? "text-warn" : "text-muted"
                  }`}
                >
                  {c.overdue > 0 ? `${c.overdue} overdue` : "on time"}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-8">
        {property.groups.map((group) => (
          <section key={group.category}>
            <h2 className="card-title mb-4 text-[18px]">
              {CATEGORY_LABEL[group.category]}
              <span className="label ml-2 text-[12px] text-muted">
                {group.items.length}
              </span>
            </h2>
            <ul className="grid grid-cols-2 items-start gap-3 md:grid-cols-3 xl:grid-cols-4">
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
 * One commitment. The ask in plain words, its badges, the date it was seen and
 * the date it is due, and its state. A repeat is called out hard because an item
 * on its third walk is a different problem from a new one.
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
  const overdue = item.status === "overdue";
  const signed = item.status === "signed";
  const answered = item.status === "answered";
  const question = item.category === "open_question";
  const special = SPECIAL.includes(item.category);
  const photos = item.photos
    .map((p) => ({
      id: p.id,
      url: urls.get(p.path),
      isDoc: isDocPath(p.path),
    }))
    .filter((p): p is { id: string; url: string; isDoc: boolean } =>
      Boolean(p.url),
    );
  const metaLine = (small: boolean) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={`label ${small ? "text-[11px]" : "text-[12px]"}`}>
        seen {fmtDate(observed)}
      </span>
      {item.category !== "future_goal" ? (
        <span
          className={`label ${small ? "text-[11px]" : "text-[12px]"} ${
            overdue ? "text-warn" : ""
          }`}
        >
          due {fmtDate(item.due)}
          {overdue ? ` · ${item.daysOverdue}d late` : ""}
        </span>
      ) : null}
    </div>
  );

  // A to-do carries a form or an answer box, so it runs full width where there
  // is room to work. Everything done or display-only becomes a photo-led tile.
  const isRow = (question && !answered) || (!special && !signed);

  if (isRow) {
    return (
      <li
        className={`col-span-full rounded-[10px] p-5 ${
          overdue ? "bg-warn/10 ring-warn/40 ring-1" : "bg-inset"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[16px] text-ink leading-relaxed break-words">
              {item.commitment}
            </p>
            <div className="mt-2.5">{metaLine(false)}</div>
            {item.note ? (
              <p className="note mt-2 leading-relaxed text-ink/75">
                {item.note}
              </p>
            ) : null}
          </div>
          <StatusPill item={item} />
        </div>

        {question ? (
          <QuestionAnswer id={item.id} />
        ) : (
          <CommitmentActions
            id={item.id}
            signed={signed}
            canReopen={isAdmin}
            initialPhotos={photos}
          />
        )}
      </li>
    );
  }

  // Photo-led tile: the picture is the headline, the words sit under it.
  return (
    <li
      className={`flex flex-col gap-2 rounded-[10px] p-3 ${
        overdue ? "bg-warn/10 ring-warn/40 ring-1" : "bg-inset"
      }`}
    >
      {photos.length > 0 ? <PhotoGrid photos={photos} cols={1} /> : null}
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-4 text-[14px] text-ink leading-snug break-words">
          {item.commitment}
        </p>
        <StatusPill item={item} />
      </div>
      {metaLine(true)}
      {item.signedBy ? (
        <p className="label text-[11px]">
          {question ? "Answered by " : "Signed "}
          {item.signedBy} · {fmtDate(item.signedAt?.slice(0, 10) ?? null)}
        </p>
      ) : null}
      {item.note ? (
        <p className="note text-[12px] leading-relaxed text-ink/75">
          {item.note}
        </p>
      ) : null}
      {signed && !special ? (
        <CommitmentActions
          id={item.id}
          signed
          canReopen={isAdmin}
          initialPhotos={photos}
          hidePhotos
        />
      ) : null}
    </li>
  );
}

function StatusPill({ item }: { item: Commitment }) {
  const map: Record<string, { text: string; cls: string }> = {
    signed: { text: "Signed", cls: "pill-done" },
    submitted: { text: "Submitted", cls: "bg-panel text-ink" },
    overdue: { text: "Overdue", cls: "bg-warn text-on-warn" },
    open: { text: "Open", cls: "bg-panel text-muted" },
    question: { text: "Question", cls: "bg-panel text-muted" },
    answered: { text: "Answered", cls: "pill-done" },
    goal: { text: "Goal", cls: "bg-panel text-muted" },
    covered: { text: "Covered", cls: "bg-panel text-muted" },
  };
  const pill = map[item.status] ?? map.open;
  return (
    <span
      className={`pill shrink-0 ${pill.cls}`}
      style={{ height: 24 }}
    >
      {pill.text}
    </span>
  );
}
