import "server-only";

import { db, selectAll } from "./supabase";

/**
 * The mega walkthroughs: their properties, their commitments, and the numbers
 * that say whether the work happened.
 *
 * A property is a building. A walkthrough is a dated visit that leaves a set of
 * commitments. A commitment is one open ask, closed by a signature with a photo
 * behind it. Nothing here is scored; a walkthrough is either worked off or it
 * is not, and this counts which.
 */

export type WalkCategory =
  | "food_safety"
  | "repair"
  | "checklist_add"
  | "checklist_rewrite"
  | "open_question"
  | "future_goal"
  | "covered";

export const CATEGORY_LABEL: Record<WalkCategory, string> = {
  food_safety: "Food safety",
  repair: "Repairs",
  checklist_add: "Checklist adds",
  checklist_rewrite: "Checklist rewrites",
  open_question: "Open questions",
  future_goal: "Future goals",
  covered: "Covered and found anyway",
};

/** The short badge on a row. */
export const CATEGORY_BADGE: Record<WalkCategory, string> = {
  food_safety: "Food safety",
  repair: "Repair",
  checklist_add: "Checklist",
  checklist_rewrite: "Rewrite",
  open_question: "Question",
  future_goal: "Goal",
  covered: "Covered",
};

/**
 * The four the ring counts and a photo closes. A person can photograph a clean
 * surface or a finished repair. They cannot photograph the answer to a question
 * or a goal that waits on a renovation, so those stay off the ring and out of
 * the sign off, in their own sections where they do not get rediscovered on
 * every walk.
 */
export const ACTIONABLE: readonly WalkCategory[] = [
  "food_safety",
  "repair",
  "checklist_add",
  "checklist_rewrite",
] as const;

export function isActionable(category: WalkCategory): boolean {
  return (ACTIONABLE as readonly string[]).includes(category);
}

/** Top to bottom on a property. Food safety first, the parking lots last. */
export const CATEGORY_ORDER: readonly WalkCategory[] = [
  "food_safety",
  "repair",
  "checklist_add",
  "checklist_rewrite",
  "open_question",
  "future_goal",
  "covered",
] as const;

export type WalkStatus =
  | "open"
  | "overdue"
  | "submitted"
  | "signed"
  | "question"
  | "answered"
  | "goal"
  | "covered";

export type WalkPhoto = {
  id: string;
  path: string;
  uploadedBy: string;
  uploadedAt: string;
};

export type Commitment = {
  id: string;
  walkthroughId: string;
  category: WalkCategory;
  commitment: string;
  owner: "Venue" | "B";
  due: string | null;
  repeatNote: string | null;
  position: number;
  signedAt: string | null;
  signedBy: string | null;
  note: string | null;
  reopenedAt: string | null;
  photos: WalkPhoto[];
  // Derived.
  actionable: boolean;
  status: WalkStatus;
  /** Days past due, 0 when not overdue or not dated. */
  daysOverdue: number;
  /** How many walkthroughs at this property have raised this same line. */
  repeatCount: number;
};

export type PropertySummary = {
  id: string;
  name: string;
  venueId: string | null;
  lastWalk: string | null;
  walkedBy: string | null;
  // Ring is signed over actionable.
  actionable: number;
  signed: number;
  submitted: number;
  overdue: number;
  open: number;
  /** Actionable items still owned by B, open. */
  onB: number;
  /** Distinct actionable lines flagged as a repeat. */
  repeats: number;
  percent: number;
};

/** Today in Pacific, as YYYY-MM-DD, for the overdue line. */
export function todayPacific(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** The state of one commitment, given today. */
function deriveStatus(
  row: {
    category: WalkCategory;
    due: string | null;
    signed_at: string | null;
    hasPhoto: boolean;
  },
  today: string,
): { status: WalkStatus; daysOverdue: number } {
  if (row.category === "covered") return { status: "covered", daysOverdue: 0 };
  if (row.category === "future_goal") return { status: "goal", daysOverdue: 0 };

  const overdue = row.due ? daysBetween(row.due, today) : 0;
  const isOverdue = row.due !== null && overdue > 0;

  if (row.category === "open_question") {
    // A question is answered in words, not signed with a photo. Once somebody
    // has put an answer to it, it is closed; until then it still nags when it
    // is late.
    if (row.signed_at) return { status: "answered", daysOverdue: 0 };
    return { status: "question", daysOverdue: isOverdue ? overdue : 0 };
  }

  if (row.signed_at) return { status: "signed", daysOverdue: 0 };
  if (row.hasPhoto) return { status: "submitted", daysOverdue: 0 };
  if (isOverdue) return { status: "overdue", daysOverdue: overdue };
  return { status: "open", daysOverdue: 0 };
}

type PropertyRow = {
  id: string;
  name: string;
  venue_id: string | null;
  active: boolean;
};
type WalkthroughRow = {
  id: string;
  property_id: string;
  walked_on: string;
  walked_by: string | null;
};
type CommitmentRow = {
  id: string;
  walkthrough_id: string;
  category: WalkCategory;
  commitment: string;
  owner: string;
  due: string | null;
  repeat_note: string | null;
  position: number;
  signed_at: string | null;
  signed_by: string | null;
  note: string | null;
  reopened_at: string | null;
};

/** A normalized key for spotting the same line raised on two different walks. */
function repeatKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Every property with the numbers the landing rings need. One pass over the
 * commitments; 200 rows is nothing and paging them per property would be four
 * round trips to save nothing.
 */
export async function loadPortfolio(): Promise<{
  properties: PropertySummary[];
  today: string;
}> {
  const today = todayPacific();

  const [props, walks, commitments, photos] = await Promise.all([
    db().from("walk_properties").select("id, name, venue_id, active"),
    db().from("walkthroughs").select("id, property_id, walked_on, walked_by"),
    selectAll<CommitmentRow>((from, to) =>
      db()
        .from("walk_commitments")
        .select(
          "id, walkthrough_id, category, commitment, owner, due, repeat_note, position, signed_at, signed_by, note, reopened_at",
        )
        .range(from, to),
    ),
    db().from("walk_photos").select("commitment_id"),
  ]);

  const propertyRows = ((props.data ?? []) as PropertyRow[]).filter(
    (p) => p.active,
  );
  const walkRows = (walks.data ?? []) as WalkthroughRow[];
  const photoCount = new Map<string, number>();
  for (const row of (photos.data ?? []) as { commitment_id: string }[]) {
    photoCount.set(row.commitment_id, (photoCount.get(row.commitment_id) ?? 0) + 1);
  }

  // walkthrough -> property, and the latest walk date per property.
  const walkProperty = new Map<string, string>();
  const lastWalk = new Map<string, { on: string; by: string | null }>();
  for (const w of walkRows) {
    walkProperty.set(w.id, w.property_id);
    const seen = lastWalk.get(w.property_id);
    if (!seen || w.walked_on > seen.on) {
      lastWalk.set(w.property_id, { on: w.walked_on, by: w.walked_by });
    }
  }

  const blank = () => ({
    actionable: 0,
    signed: 0,
    submitted: 0,
    overdue: 0,
    open: 0,
    onB: 0,
    repeatKeys: new Set<string>(),
  });
  const acc = new Map<string, ReturnType<typeof blank>>();
  for (const p of propertyRows) acc.set(p.id, blank());

  for (const c of commitments) {
    const propertyId = walkProperty.get(c.walkthrough_id);
    if (!propertyId) continue;
    const a = acc.get(propertyId);
    // B's own repairs and vendor jobs live in ClickUp, not here. This page is
    // only what a manager checks off, so only the venue's work counts.
    if (!a || !isActionable(c.category) || c.owner === "B") continue;
    const { status } = deriveStatus(
      {
        category: c.category,
        due: c.due,
        signed_at: c.signed_at,
        hasPhoto: (photoCount.get(c.id) ?? 0) > 0,
      },
      today,
    );
    a.actionable += 1;
    if (status === "signed") a.signed += 1;
    else if (status === "submitted") a.submitted += 1;
    else if (status === "overdue") a.overdue += 1;
    else a.open += 1;
    if (status !== "signed" && c.owner === "B") a.onB += 1;
    if (c.repeat_note?.trim()) a.repeatKeys.add(repeatKey(c.commitment));
  }

  const properties = propertyRows
    .map((p): PropertySummary => {
      const a = acc.get(p.id) ?? blank();
      const walk = lastWalk.get(p.id) ?? null;
      return {
        id: p.id,
        name: p.name,
        venueId: p.venue_id,
        lastWalk: walk?.on ?? null,
        walkedBy: walk?.by ?? null,
        actionable: a.actionable,
        signed: a.signed,
        submitted: a.submitted,
        overdue: a.overdue,
        open: a.open + a.submitted,
        onB: a.onB,
        repeats: a.repeatKeys.size,
        percent: a.actionable
          ? Math.round((a.signed / a.actionable) * 100)
          : 0,
      };
    })
    // Worst first: most overdue on top, then least signed.
    .sort(
      (x, y) => y.overdue - x.overdue || x.percent - y.percent ||
        x.name.localeCompare(y.name),
    );

  return { properties, today };
}

export type PortfolioTotals = {
  actionable: number;
  signed: number;
  submitted: number;
  overdue: number;
  open: number;
  onB: number;
  repeats: number;
  properties: number;
  percent: number;
};

export function portfolioTotals(properties: PropertySummary[]): PortfolioTotals {
  const t = properties.reduce(
    (s, p) => {
      s.actionable += p.actionable;
      s.signed += p.signed;
      s.submitted += p.submitted;
      s.overdue += p.overdue;
      s.onB += p.onB;
      s.repeats += p.repeats;
      return s;
    },
    { actionable: 0, signed: 0, submitted: 0, overdue: 0, onB: 0, repeats: 0 },
  );
  return {
    ...t,
    open: t.overdue + t.submitted + (t.actionable - t.signed - t.overdue - t.submitted),
    properties: properties.length,
    percent: t.actionable ? Math.round((t.signed / t.actionable) * 100) : 0,
  };
}

/**
 * Does this venue have any active walkthrough property?
 *
 * Used to decide whether to offer the walkthroughs door to a venue's crew. It
 * is the same venue scope the sign-off action already enforces, so the door is
 * never shown to somebody the action would then refuse.
 */
export async function venueHasWalkthrough(
  venueId: string | null,
): Promise<boolean> {
  if (!venueId) return false;
  const { count } = await db()
    .from("walk_properties")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .eq("active", true);
  return Boolean(count && count > 0);
}

/**
 * One line of the change log: an edit somebody made to a property's
 * walkthrough. Shown to managers and admins, never to a leader.
 */
export type WalkEvent = {
  id: string;
  kind: string;
  actor: string;
  detail: string | null;
  createdAt: string;
  /** The item it touched, or null once that item has been removed. */
  commitment: string | null;
};

/** How each kind of edit reads in the log. Unknown kinds fall back to raw. */
export const EVENT_LABEL: Record<string, string> = {
  photo_added: "Photo added",
  photo_removed: "Photo removed",
  signed: "Signed off",
  question_answered: "Question answered",
  reopened: "Reopened",
};

/**
 * The recent edits on one property, newest first. Two small queries: the log
 * rows, then the titles of the items they name, so a line reads "Photo removed
 * · under the POS" rather than a bare id.
 */
export async function loadWalkLog(
  propertyId: string,
  limit = 50,
): Promise<WalkEvent[]> {
  const { data } = await db()
    .from("walk_events")
    .select("id, kind, actor, detail, created_at, commitment_id")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as {
    id: string;
    kind: string;
    actor: string;
    detail: string | null;
    created_at: string;
    commitment_id: string | null;
  }[];

  const ids = [
    ...new Set(rows.map((r) => r.commitment_id).filter(Boolean)),
  ] as string[];
  const titles = new Map<string, string>();
  if (ids.length > 0) {
    const { data: cs } = await db()
      .from("walk_commitments")
      .select("id, commitment")
      .in("id", ids);
    for (const c of (cs ?? []) as { id: string; commitment: string }[]) {
      titles.set(c.id, c.commitment);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    actor: r.actor,
    detail: r.detail,
    createdAt: r.created_at,
    commitment: r.commitment_id ? (titles.get(r.commitment_id) ?? null) : null,
  }));
}

export type PropertyDetail = {
  id: string;
  name: string;
  venueId: string | null;
  lastWalk: string | null;
  walkedBy: string | null;
  groups: { category: WalkCategory; items: Commitment[] }[];
  summary: PropertySummary;
};

/**
 * One property, its latest walkthrough opened up. Commitments grouped by
 * category in board order, overdue sorted to the top of its group and the
 * signed ones sunk to the bottom, still visible so the property can see what it
 * has closed out.
 */
export async function loadProperty(
  propertyId: string,
): Promise<PropertyDetail | null> {
  const today = todayPacific();

  const { data: propData } = await db()
    .from("walk_properties")
    .select("id, name, venue_id, active")
    .eq("id", propertyId)
    .maybeSingle();
  const property = propData as PropertyRow | null;
  if (!property) return null;

  const { data: walkData } = await db()
    .from("walkthroughs")
    .select("id, property_id, walked_on, walked_by")
    .eq("property_id", propertyId)
    .order("walked_on", { ascending: false });
  const walks = (walkData ?? []) as WalkthroughRow[];
  if (walks.length === 0) {
    return {
      id: property.id,
      name: property.name,
      venueId: property.venue_id,
      lastWalk: null,
      walkedBy: null,
      groups: [],
      summary: emptySummary(property),
    };
  }
  const latest = walks[0];

  const ids = walks.map((w) => w.id);
  const { data: commitData } = await db()
    .from("walk_commitments")
    .select(
      "id, walkthrough_id, category, commitment, owner, due, repeat_note, position, signed_at, signed_by, note, reopened_at",
    )
    .in("walkthrough_id", ids)
    .order("position");
  const allCommits = (commitData ?? []) as CommitmentRow[];

  const { data: photoData } = allCommits.length
    ? await db()
        .from("walk_photos")
        .select("id, commitment_id, path, uploaded_by, uploaded_at")
        .in(
          "commitment_id",
          allCommits.map((c) => c.id),
        )
    : { data: [] };

  // How many walkthroughs raised each normalized line, for the repeat flag.
  const raisedOn = new Map<string, Set<string>>();
  for (const c of allCommits) {
    const key = repeatKey(c.commitment);
    if (!raisedOn.has(key)) raisedOn.set(key, new Set());
    raisedOn.get(key)!.add(c.walkthrough_id);
  }

  const photosByItem = new Map<string, WalkPhoto[]>();
  for (const row of (photoData ?? []) as {
    id: string;
    commitment_id: string;
    path: string;
    uploaded_by: string;
    uploaded_at: string;
  }[]) {
    const list = photosByItem.get(row.commitment_id) ?? [];
    list.push({
      id: row.id,
      path: row.path,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
    });
    photosByItem.set(row.commitment_id, list);
  }

  const items: Commitment[] = allCommits
    // Only the venue's work. B's repairs are tracked in ClickUp, not here.
    .filter((c) => c.walkthrough_id === latest.id && c.owner !== "B")
    .map((c) => {
      const photos = photosByItem.get(c.id) ?? [];
      const { status, daysOverdue } = deriveStatus(
        {
          category: c.category,
          due: c.due,
          signed_at: c.signed_at,
          hasPhoto: photos.length > 0,
        },
        today,
      );
      return {
        id: c.id,
        walkthroughId: c.walkthrough_id,
        category: c.category,
        commitment: c.commitment,
        owner: c.owner === "B" ? "B" : "Venue",
        due: c.due,
        repeatNote: c.repeat_note,
        position: c.position,
        signedAt: c.signed_at,
        signedBy: c.signed_by,
        note: c.note,
        reopenedAt: c.reopened_at,
        photos,
        actionable: isActionable(c.category),
        status,
        daysOverdue,
        repeatCount: raisedOn.get(repeatKey(c.commitment))?.size ?? 1,
      };
    });

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: items
      .filter((i) => i.category === category)
      .sort((a, b) => {
        // Overdue to the top, signed to the bottom, then by due date, then order.
        const rank = (i: Commitment) =>
          i.status === "overdue" ? 0 : i.status === "signed" ? 2 : 1;
        return (
          rank(a) - rank(b) ||
          (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
          a.position - b.position
        );
      }),
  })).filter((g) => g.items.length > 0);

  const { properties } = await loadPortfolio();
  const summary =
    properties.find((p) => p.id === propertyId) ?? emptySummary(property);

  return {
    id: property.id,
    name: property.name,
    venueId: property.venue_id,
    lastWalk: latest.walked_on,
    walkedBy: latest.walked_by,
    groups,
    summary,
  };
}

function emptySummary(p: PropertyRow): PropertySummary {
  return {
    id: p.id,
    name: p.name,
    venueId: p.venue_id,
    lastWalk: null,
    walkedBy: null,
    actionable: 0,
    signed: 0,
    submitted: 0,
    overdue: 0,
    open: 0,
    onB: 0,
    repeats: 0,
    percent: 0,
  };
}
