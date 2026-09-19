import { notFound, redirect } from "next/navigation";

import { Dial } from "@/components/Dial";
import { BackLink } from "@/components/ui";
import { CommitmentActions } from "@/components/walkthroughs/CommitmentActions";
import { QuestionAnswer } from "@/components/walkthroughs/QuestionAnswer";
import { signedUrls } from "@/lib/photos";
import { getSession, mayReachVenue } from "@/lib/session";
import {
  CATEGORY_BADGE,
  CATEGORY_LABEL,
  isActionable,
  loadProperty,
  type Commitment,
  type WalkCategory,
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
    <main className="close-flow mx-auto max-w-2xl">
      <BackLink href="/walkthroughs">All properties</BackLink>

      <header className="mt-4 mb-5">
        <p className="label">
          {property.name} · walked {fmtDate(property.lastWalk)}
          {property.walkedBy ? ` · ${property.walkedBy}` : ""}
        </p>
        <h1 className="text-metric mt-2 font-medium">Walkthrough</h1>
      </header>

      {/* The building's own ring, small, with the counts that make it. */}
      <div className="panel mb-5 flex items-center gap-5 p-5">
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
          <p className="text-body text-ink leading-snug">
            {s.signed} of {s.actionable} signed off
          </p>
          <p className="label mt-1">
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

      {/* Tasks due, by category, so you see where the work sits at a glance. */}
      {dueByCategory.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {dueByCategory.map((c) => (
            <span
              key={c.category}
              className="bg-inset text-label inline-flex items-center gap-2 rounded px-3 py-2 tracking-[0.08em]"
            >
              <span className="text-ink">{CATEGORY_BADGE[c.category]}</span>
              <span className="text-muted tabular-nums">{c.open} due</span>
              {c.overdue > 0 ? (
                <span className="text-warn tabular-nums">
                  {c.overdue} overdue
                </span>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      <div className="space-y-8">
        {property.groups.map((group) => (
          <section key={group.category}>
            <h2 className="card-title mb-3">
              {CATEGORY_LABEL[group.category]}
              <span className="label text-muted ml-2">{group.items.length}</span>
            </h2>
            <ul className="space-y-3">
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
    </main>
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
    .map((p) => ({ id: p.id, url: urls.get(p.path) }))
    .filter((p): p is { id: string; url: string } => Boolean(p.url));
  const photoStrip =
    photos.length > 0 ? (
      <div className="mt-3 flex flex-wrap gap-2">
        {photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={p.url}
            alt=""
            className="h-16 w-16 rounded-[4px] object-cover"
          />
        ))}
      </div>
    ) : null;

  return (
    <li
      className={`rounded-[6px] p-4 ${
        overdue
          ? "bg-warn/10 ring-warn/40 ring-1"
          : signed || answered
            ? "bg-inset opacity-80"
            : "bg-inset"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body text-ink leading-snug break-words">
            {item.commitment}
          </p>

          {/* Badges: category, and the two dates. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge>{CATEGORY_BADGE[item.category]}</Badge>
            <span className="label">seen {fmtDate(observed)}</span>
            {item.category !== "future_goal" ? (
              <span className={`label ${overdue ? "text-warn" : ""}`}>
                due {fmtDate(item.due)}
                {overdue ? ` · ${item.daysOverdue}d late` : ""}
              </span>
            ) : null}
          </div>

          {item.signedBy ? (
            <p className="label mt-2">
              {question ? "Answered by " : "Signed "}
              {item.signedBy} · {fmtDate(item.signedAt?.slice(0, 10) ?? null)}
            </p>
          ) : null}
          {item.note ? (
            <p className="note text-muted mt-1 leading-relaxed">{item.note}</p>
          ) : null}
        </div>

        <StatusPill item={item} />
      </div>

      {/* Actionable rows get the check-off: photograph it, then sign. A
          question is answered in words instead, so an open one gets the answer
          box and a closed one shows its answer above. Goals and covered notes
          are never closed here, so they show their proof if any and nothing
          else. */}
      {question ? (
        answered ? (
          photoStrip
        ) : (
          <QuestionAnswer id={item.id} />
        )
      ) : special ? (
        photoStrip
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-panel text-muted inline-flex items-center rounded px-2 py-0.5 text-label tracking-[0.08em]">
      {children}
    </span>
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
