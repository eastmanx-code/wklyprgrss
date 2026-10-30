"use server";

import crypto from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { MAINTENANCE_MESSAGE_MAX, setMaintenance } from "@/lib/maintenance";
import { findOrphans, removeOrphans } from "@/lib/orphans";
import { forgetSignedUrl } from "@/lib/photos";
import { getSession, mayGrade, mayReachVenue } from "@/lib/session";
import { ITEM_COLUMNS, awaitingReview, boardAutoFailed } from "@/lib/status";
import { isDeadlinePassed, mostRecentCompletedWeek } from "@/lib/week";
import { PHOTO_BUCKET, db } from "@/lib/supabase";
import type { House, Item } from "@/lib/types";

export type AdminState = { error: string | null; createdItemId?: string };

const OK: AdminState = { error: null };
const MAX_TITLE_LENGTH = 120;
const MAX_NOTE_LENGTH = 500;

async function isAdmin(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

/**
 * May the signed-in admin rule on this half? Two people grade, one half
 * each, and a verdict or a grade on the other half is refused here, not
 * just hidden. The half of a submission is the half of its item.
 */
async function ownsHouse(house: House): Promise<boolean> {
  return mayGrade(await getSession(), house);
}

async function houseOfSubmission(submissionId: string): Promise<House | null> {
  const { data } = await db()
    .from("submissions")
    .select("item_id")
    .eq("id", submissionId)
    .maybeSingle();
  const itemId = (data as { item_id: string } | null)?.item_id;
  if (!itemId) return null;
  const { data: item } = await db()
    .from("items")
    .select("house")
    .eq("id", itemId)
    .maybeSingle();
  const house = (item as { house: string } | null)?.house;
  return house === "FOH" || house === "HOH" ? house : null;
}

/**
 * Item management is open to the venue itself as well as the admin — a venue
 * owns its own list. Approving is the one thing that stays admin-only, so it
 * keeps using isAdmin().
 */
async function canManage(venueId: string): Promise<boolean> {
  return mayReachVenue(await getSession(), venueId);
}

/** The venue an item belongs to, for permission checks. */
async function venueOfItem(itemId: string): Promise<string | null> {
  const { data } = await db()
    .from("items")
    .select("venue_id")
    .eq("id", itemId)
    .maybeSingle();
  return (data as { venue_id: string } | null)?.venue_id ?? null;
}

/**
 * The two screens the person taking the action is actually on.
 *
 * It used to clear five. The other three — the leader board, a venue's board
 * page, a leader's own screen — are other people in other browsers, and a
 * revalidate here cannot reach their router cache. Every route in this app is
 * force-dynamic, so none of them is cached on the server either: those calls
 * bought nothing and were paid for on every approval.
 */
function refresh(venueId: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/venue/${venueId}`);
}

/**
 * A venue's items, optionally one house's.
 *
 * Positions run 1..n *within* a house, so anything that renumbers or reorders
 * has to be told which one. Asked for the venue, both houses come back in
 * board order — front of house, then the kitchen.
 */
async function itemsFor(venueId: string, house?: House): Promise<Item[]> {
  let query = db().from("items").select(ITEM_COLUMNS).eq("venue_id", venueId);
  if (house) query = query.eq("house", house);
  const { data, error } = await query
    .order("house")
    .order("position")
    .order("title");
  if (error) throw new Error(error.message);
  return (data ?? []) as Item[];
}

/** The house an item is on, for the calls that renumber around it. */
async function houseOfItem(itemId: string): Promise<House | null> {
  const { data } = await db()
    .from("items")
    .select("house")
    .eq("id", itemId)
    .maybeSingle();
  return (data as { house: House } | null)?.house ?? null;
}

/**
 * Rewrite positions to a clean 1..n so reordering stays predictable.
 *
 * Always called with one house's items. Handed both, it would renumber the
 * kitchen 11..20 and the two lists would interleave on every board that reads
 * them in position order.
 */
async function normalizePositions(items: Item[]) {
  await Promise.all(
    items.map((item, index) =>
      item.position === index + 1
        ? Promise.resolve()
        : db()
            .from("items")
            .update({ position: index + 1 })
            .eq("id", item.id),
    ),
  );
}

export async function addItem(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const venueId = String(formData.get("venueId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  // Unrecognised means front of house, which is where every item lived before
  // the kitchen existed. Never a third value: an item on a board nothing
  // renders is an item nobody will ever walk.
  const house: House = formData.get("house") === "HOH" ? "HOH" : "FOH";
  if (!venueId) return { error: "Missing venue." };
  if (!(await canManage(venueId))) return { error: "Not signed in." };
  if (!title) return { error: "Give the item a title." };
  if (title.length > MAX_TITLE_LENGTH)
    return { error: "That title is too long." };

  const existing = await itemsFor(venueId, house);
  // Returns the row so the caller can send the leader straight to its upload
  // screen: naming an item and never photographing it is the failure mode
  // this whole setup step exists to avoid.
  const { data, error } = await db()
    .from("items")
    .insert({
      venue_id: venueId,
      title,
      house,
      position: existing.length + 1,
      active: true,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not add that item." };

  refresh(venueId);
  return { error: null, createdItemId: data.id as string };
}

export async function renameItem(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const itemId = String(formData.get("itemId") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  // Check against the item's real venue, not the one the form claims.
  const owner = await venueOfItem(itemId);
  if (!owner || !(await canManage(owner))) return { error: "Not signed in." };
  if (!title) return { error: "Title can't be empty." };
  if (title.length > MAX_TITLE_LENGTH)
    return { error: "That title is too long." };

  const { error } = await db().from("items").update({ title }).eq("id", itemId);
  if (error) return { error: "Could not rename that item." };

  refresh(venueId);
  return OK;
}

/** Deactivating hides the item going forward and keeps all of its history. */
export async function setItemActive(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  const owner = await venueOfItem(itemId);
  if (!owner || !(await canManage(owner))) return;

  const house = await houseOfItem(itemId);
  await db().from("items").update({ active }).eq("id", itemId);
  if (house) await normalizePositions(await itemsFor(venueId, house));
  refresh(venueId);

  // Retiring from the item's own page leaves you standing on a page that now
  // correctly 404s, so the caller can ask to be taken somewhere real.
  const redirectTo = String(formData.get("redirectTo") ?? "");
  if (redirectTo.startsWith("/")) redirect(redirectTo);
}

export async function moveItem(formData: FormData) {
  const itemId = String(formData.get("itemId") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const direction = String(formData.get("direction") ?? "");

  const owner = await venueOfItem(itemId);
  if (!owner || !(await canManage(owner))) return;

  // Within its own house. Moved against the venue, the top item of the kitchen
  // would have swapped with the last item of the dining room.
  const house = await houseOfItem(itemId);
  if (!house) return;
  const items = await itemsFor(venueId, house);
  const index = items.findIndex((item) => item.id === itemId);
  if (index < 0) return;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) return;

  [items[index], items[target]] = [items[target], items[index]];
  await normalizePositions(items);
  refresh(venueId);
}

/**
 * Approve or send back a single submission. Sending one back stops it counting
 * towards the week, so the item goes back to PENDING and the leader must redo
 * it — that is what gives review teeth.
 */
export async function reviewSubmission(formData: FormData) {
  if (!(await isAdmin())) return;

  const submissionId = String(formData.get("submissionId") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  // Only sent by the grading screen, which knows which card it is on.
  const itemId = String(formData.get("itemId") ?? "");
  const review = String(formData.get("review") ?? "");
  if (!["pending", "approved", "sent_back"].includes(review)) return;

  const ownHouse = await houseOfSubmission(submissionId);
  if (!ownHouse || !(await ownsHouse(ownHouse))) return;

  // Enforced on the server too, not just by hiding the button: the leader has
  // to declare the work done before it can be approved.
  if (review === "approved") {
    const { data: submission } = await db()
      .from("submissions")
      .select("progress")
      .eq("id", submissionId)
      .is("cleared_at", null)
      .maybeSingle();
    if (!submission || submission.progress !== "done") return;
  }

  /**
   * The reason, when there is one, and only on a rejection.
   *
   * Cleared on approval rather than left behind: a note saying what was wrong
   * has no meaning once the work has been signed off, and leaving it attached
   * would show the leader a complaint about work you just accepted.
   */
  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, MAX_NOTE_LENGTH);

  await db()
    .from("submissions")
    .update({
      review,
      /**
       * Back to pending is back to undecided, so the timestamp goes with it.
       *
       * It is not cosmetic: the daily scores count an approval by the day its
       * `reviewed_at` falls on, so a pending row carrying the stamp of the
       * decision that was just withdrawn would keep being counted as that
       * day's sign-off. The leader's own amend path already clears it this
       * way.
       */
      reviewed_at: review === "pending" ? null : new Date().toISOString(),
      review_note: review === "sent_back" ? note || null : null,
    })
    .eq("id", submissionId);

  refresh(venueId);

  // Grading is a queue, so a verdict should hand over the next one rather than
  // leave the reviewer on a card they have finished with. Only the grading
  // screen asks for this: on the venue board the next task is already on
  // screen, and jumping would take the reviewer away from the list they are
  // working down.
  const house = String(formData.get("house") ?? "");
  if (formData.get("advance") === "1" && isHouse(house)) {
    const next = await nextToReview(venueId, house, itemId);
    redirect(next ? `/venue/item/${next}` : `/admin/venue/${venueId}`);
  }
}

function isHouse(value: string): value is House {
  return value === "FOH" || value === "HOH";
}

/** The next task in this half still waiting on a verdict, or nothing. */
async function nextToReview(
  venueId: string,
  house: House,
  exceptItemId: string,
): Promise<string | null> {
  const queue = await awaitingReview(venueId, house);
  return queue.find((item) => item.id !== exceptItemId)?.id ?? null;
}

/** Approve everything still pending for this venue's current week, in one go. */
export async function approveAllForVenue(formData: FormData) {
  if (!(await isAdmin())) return;

  const venueId = String(formData.get("venueId") ?? "");
  const weekStart = String(formData.get("weekStart") ?? "");
  if (!venueId || !weekStart) return;

  // One house's work, because one person reviewed it. Approve-all across the
  // venue would have signed off the kitchen in the dining room's name — which
  // is precisely the conflation the split board exists to prevent.
  const house: House = formData.get("house") === "HOH" ? "HOH" : "FOH";
  if (!(await ownsHouse(house))) return;
  const items = await itemsFor(venueId, house);
  const itemIds = items.map((item) => item.id);
  if (itemIds.length === 0) return;

  // Only the newest submission per item counts. Approving every pending row
  // for the week would sign off submissions a later one has already replaced —
  // including ones whose current state is "another cycle".
  // Every week, not just this one. An unfinished task carries forward, so the
  // work waiting on a decision is not always the work filed this week — and a
  // button reading "approve all" that silently skipped last week's backlog was
  // the reason the backlog kept growing.
  void weekStart;
  const { data: week } = await db()
    .from("submissions")
    .select("id, item_id, review, progress, created_at")
    .in("item_id", itemIds)
    .is("cleared_at", null)
    .order("created_at", { ascending: false });

  const newestPerItem = new Map<
    string,
    { id: string; review: string; progress: string }
  >();
  for (const row of week ?? []) {
    if (!newestPerItem.has(row.item_id)) newestPerItem.set(row.item_id, row);
  }

  const approvable = [...newestPerItem.values()]
    .filter((row) => row.review === "pending" && row.progress === "done")
    .map((row) => row.id);

  if (approvable.length > 0) {
    await db()
      .from("submissions")
      .update({ review: "approved", reviewed_at: new Date().toISOString() })
      .in("id", approvable);
  }

  refresh(venueId);
}

/**
 * Clears a venue's board back to empty: every item retired, every photo file
 * deleted from storage, ten fresh slots waiting.
 *
 * Submission rows survive. They carry the comments, the names, the dates and
 * the pass/fail history that streaks and the CSV are computed from — if a wipe
 * deleted those, a venue could erase a run of failed weeks by pressing one
 * button. Photos are the disposable part; the ledger is not.
 *
 * Admin only, unlike the rest of item management.
 */
export async function wipeVenue(formData: FormData) {
  if (!(await isAdmin())) return;

  const venueId = String(formData.get("venueId") ?? "");
  const confirmation = String(formData.get("confirm") ?? "");
  if (!venueId || confirmation !== "WIPE") return;

  const items = await itemsFor(venueId);
  const itemIds = items.map((item) => item.id);

  if (itemIds.length > 0) {
    const { data: subs } = await db()
      .from("submissions")
      .select("id, photo_url, doc_url, before_photo_url")
      .in("item_id", itemIds)
      .is("photo_purged_at", null);

    const paths = (subs ?? []).flatMap(
      (s) =>
        [s.photo_url, s.doc_url, s.before_photo_url].filter(
          Boolean,
        ) as string[],
    );

    // Chunked: storage rejects very large delete batches.
    for (let i = 0; i < paths.length; i += 100) {
      await db()
        .storage.from(PHOTO_BUCKET)
        .remove(paths.slice(i, i + 100));
    }

    // The one case where a path stops meaning what it meant. Signed URLs are
    // held between renders because an object is written once and never
    // rewritten — deleting the object is the exception, so it has to say so.
    for (const path of paths) forgetSignedUrl(path);

    if ((subs ?? []).length > 0) {
      await db()
        .from("submissions")
        .update({ photo_purged_at: new Date().toISOString() })
        .in(
          "id",
          (subs ?? []).map((s) => s.id),
        );
    }

    await db().from("items").update({ active: false }).in("id", itemIds);
  }

  refresh(venueId);
}

/**
 * Adds a code. Admin only, obviously.
 *
 * A venue makes it a manager's: that venue's lists and reports, plus editing
 * and reopening, and nothing else. No venue makes it a full admin code, which
 * is every venue, the grading board and this screen.
 *
 * The venue is checked against the table rather than trusted. It arrives from
 * a select, but a select is a form field and a form field is whatever the
 * person sending it wants it to be, and a code scoped to an id that is not a
 * venue would be a code that opens nothing and reads as if it should.
 */
export async function addAdminPin(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  if (!(await isAdmin())) return { error: "Not signed in." };

  const pin = String(formData.get("pin") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const venueId = String(formData.get("venueId") ?? "").trim();
  if (!/^\d{6}$/.test(pin)) return { error: "Code must be 6 digits." };
  if (!label) return { error: "Give it a name, so you know what to revoke." };
  if (label.length > MAX_TITLE_LENGTH)
    return { error: "That name is too long." };

  if (venueId) {
    const { data } = await db()
      .from("venues")
      .select("id")
      .eq("id", venueId)
      .maybeSingle();
    if (!data) return { error: "That venue is not there." };
  }

  const { error } = await db()
    .from("admin_pins")
    .insert({ pin, label, venue_id: venueId || null });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "That code is already in use."
          : "Could not add that code.",
    };
  }

  revalidatePath("/admin");
  return OK;
}

/**
 * Photographs nothing points at: how many, and then gone.
 *
 * Two presses on purpose. It is the only thing in this product that deletes a
 * photograph nobody asked to delete, so the first press only counts them and
 * the second one has to be aimed at a number the person has read.
 *
 * The list is taken again inside the delete rather than carried across from
 * the screen — between looking and pressing, somebody can have finished a
 * shift.
 */
export type OrphanState = {
  error: string | null;
  found?: { count: number; bytes: number };
  removed?: { count: number; bytes: number };
};

export async function sweepOrphans(
  _prev: OrphanState,
  formData: FormData,
): Promise<OrphanState> {
  if (!(await isAdmin())) return { error: "Not signed in." };

  try {
    if (String(formData.get("confirm") ?? "") !== "yes") {
      const found = await findOrphans();
      return {
        error: null,
        found: {
          count: found.length,
          bytes: found.reduce((n, file) => n + file.bytes, 0),
        },
      };
    }

    const { removed, bytes } = await removeOrphans();
    return { error: null, removed: { count: removed, bytes } };
  } catch {
    return { error: "Could not read storage. Try again." };
  }
}

/**
 * Open or close a venue's self-serve signup.
 *
 * Closed by default, and closed again once a venue's managers are all in, so
 * the public door is only answering while somebody is meant to be walking
 * through it. The link keeps working the moment it is reopened.
 */
export async function setSignupOpen(formData: FormData) {
  if (!(await isAdmin())) return;

  const venueId = String(formData.get("venueId") ?? "");
  const open = String(formData.get("open") ?? "") === "yes";
  if (!venueId) return;

  await db().from("venues").update({ signup_open: open }).eq("id", venueId);
  revalidatePath("/admin/codes");
}

/**
 * Mint a fresh signup link for a venue, retiring the old one.
 *
 * For when a link has been somewhere it should not have. The codes already
 * made from the old link keep working; only the door stops answering at the
 * old address.
 */
export async function rotateSignupToken(formData: FormData) {
  if (!(await isAdmin())) return;

  const venueId = String(formData.get("venueId") ?? "");
  if (!venueId) return;

  await db()
    .from("venues")
    .update({ signup_token: crypto.randomUUID() })
    .eq("id", venueId);
  revalidatePath("/admin/codes");
}

/** Revokes a code. The env master key isn't in this table, so it stays. */
export async function revokeAdminPin(formData: FormData) {
  if (!(await isAdmin())) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db().from("admin_pins").delete().eq("id", id);
  revalidatePath("/admin");
}

export async function updateVenuePin(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  if (!(await isAdmin())) return { error: "Not signed in." };

  const venueId = String(formData.get("venueId") ?? "");
  const pin = String(formData.get("pin") ?? "").trim();
  if (!/^\d{6}$/.test(pin)) return { error: "PIN must be 6 digits." };

  const { error } = await db().from("venues").update({ pin }).eq("id", venueId);
  if (error) return { error: "Could not update that PIN." };

  refresh(venueId);
  return OK;
}

/**
 * Marks a venue's week graded.
 *
 * Leaders were told "once graded, one tap clears finished work". Until now
 * nothing in the app meant graded, so Reset Board was available the moment a
 * single task was approved — a venue could clear its board before the week had
 * been looked at as a whole, which is the opposite of what they were promised.
 *
 * Admin only, and it carries a name: a grade is somebody's judgement of a
 * week's work, and the venue it lands on should be able to see whose.
 */
/**
 * Whether any filed, finished card in this half is still awaiting a verdict.
 *
 * Newest filing per item only: a task sent back and refiled is one card, and
 * the decision that matters is the one on the version that stands now.
 */
async function hasUnreviewed(
  venueId: string,
  house: House,
  weekStart: string,
): Promise<boolean> {
  const items = await itemsFor(venueId, house);
  const itemIds = items.map((item) => item.id);
  if (itemIds.length === 0) return false;

  const { data } = await db()
    .from("submissions")
    .select("item_id, review, progress, created_at")
    .in("item_id", itemIds)
    .eq("week_start", weekStart)
    .is("cleared_at", null)
    .order("created_at", { ascending: false });

  const newest = new Map<string, { review: string; progress: string }>();
  for (const row of (data ?? []) as {
    item_id: string;
    review: string;
    progress: string;
  }[]) {
    if (!newest.has(row.item_id)) newest.set(row.item_id, row);
  }

  // A board that auto-failed on the count has nothing to rule on: the week is a
  // locked fail that refiles next week, so its filed cards cannot change the
  // verdict and must not be able to hold the grade shut. newest.size is the
  // filed count — one entry per item with a surviving submission this week.
  // This is the rule behind the grade button the page now leaves enabled; the
  // courtesy and the rule have to agree, or the button would do nothing.
  if (boardAutoFailed(newest.size, weekStart, new Date())) return false;

  return [...newest.values()].some(
    (row) => row.review === "pending" && row.progress === "done",
  );
}

export async function gradeWeek(formData: FormData) {
  if (!(await isAdmin())) return;

  const venueId = String(formData.get("venueId") ?? "");
  const weekStart = String(formData.get("weekStart") ?? "");
  const by = String(formData.get("by") ?? "").trim() || "admin";
  // One house at a time, and each signs its own. Two people walk now — one the
  // dining room, one the kitchen — and a single grade per venue meant whoever
  // finished second overwrote the first: the record showed one name and
  // silently lost the other.
  const house: House = formData.get("house") === "HOH" ? "HOH" : "FOH";
  if (!venueId || !weekStart) return;
  if (!(await ownsHouse(house))) return;

  // Not before the week is over. Grading a week still being worked closes it
  // on people who have until Thursday 4pm to file — and the reset it unlocks
  // would let a venue clear a board it is still meant to be filling. The
  // screen only ever offers a finished week; this is the rule behind that.
  if (!isDeadlinePassed(weekStart)) return;

  /**
   * And not before every card has a verdict.
   *
   * A grade is a grade: it says somebody looked at the work. Grading and
   * ruling on the items were two separate buttons and nothing joined them, so
   * on Thursday twenty-one boards were stamped in an hour while only thirteen
   * had been gone through — eight venues ended up carrying a grade over ten
   * untouched filings, and scored off approvals they read as nought when the
   * same eight had read tens and nines the week before.
   *
   * Only work claiming to be finished counts. An item the leader has marked
   * for another cycle is not waiting on a decision and must not be able to
   * lock the grade shut for the rest of the week.
   *
   * Enforced here and not only by disabling the button, because the button is
   * a courtesy and this is the rule.
   */
  if (await hasUnreviewed(venueId, house, weekStart)) return;

  // Idempotent: grading twice is not two grades.
  await db()
    .from("graded_weeks")
    .upsert(
      { venue_id: venueId, week_start: weekStart, house, graded_by: by },
      { onConflict: "venue_id,week_start,house" },
    );

  // A grade supersedes a carry: the week that was held has now been ruled on,
  // so it is graded, not deferred.
  await db()
    .from("carried_weeks")
    .delete()
    .eq("venue_id", venueId)
    .eq("week_start", weekStart)
    .eq("house", house);

  refresh(venueId);

  // A grade is the end of that half for the person who gave it, so it hands
  // back the main board. It used to stay put until both halves were graded,
  // on the reasoning that the other half was on the same screen; but two
  // people grade now, one half each, and the other half is not theirs.
  redirect("/admin");
}

/** Takes a grade back, if it went on the wrong week. */
export async function ungradeWeek(formData: FormData) {
  if (!(await isAdmin())) return;

  const venueId = String(formData.get("venueId") ?? "");
  const weekStart = String(formData.get("weekStart") ?? "");
  const house: House = formData.get("house") === "HOH" ? "HOH" : "FOH";
  if (!venueId || !weekStart) return;
  if (!(await ownsHouse(house))) return;

  await db()
    .from("graded_weeks")
    .delete()
    .eq("venue_id", venueId)
    .eq("week_start", weekStart)
    .eq("house", house);

  refresh(venueId);
}

/**
 * Grades the finished week for every active venue at once.
 *
 * Grading one venue at a time is twenty-one taps of bookkeeping on top of the
 * review that already happened — and the first week it existed it was missed
 * entirely, which left every board reading "waiting on the grade" while the
 * admin had in fact graded on the Thursday.
 *
 * The record stays per venue, so a single venue can still be graded or ungraded
 * on its own. This just closes the week in one move, which is how it is
 * actually done.
 */
export async function gradeAllVenues(formData: FormData) {
  if (!(await isAdmin())) return;

  const weekStart = String(formData.get("weekStart") ?? "");
  const by = String(formData.get("by") ?? "").trim() || "admin";
  // The house this grader walked. Grading both at once would put one person's
  // name against a walk they did not do — which is the signature this record
  // exists to carry.
  const house: House = formData.get("house") === "HOH" ? "HOH" : "FOH";
  if (!weekStart) return;
  if (!(await ownsHouse(house))) return;
  if (!isDeadlinePassed(weekStart)) return;

  // Only the venues that owe this house. Grading all of them would put a
  // kitchen grade on four bars that have no kitchen, and the record would say
  // somebody walked a room that does not exist.
  const { data: venues } = await db()
    .from("venues")
    .select("id, houses")
    .eq("active", true)
    .contains("houses", [house]);
  const rows = ((venues ?? []) as { id: string }[]).map((venue) => ({
    venue_id: venue.id,
    week_start: weekStart,
    house,
    graded_by: by,
  }));
  if (rows.length === 0) return;

  await db()
    .from("graded_weeks")
    .upsert(rows, { onConflict: "venue_id,week_start,house" });

  revalidatePath("/admin");
  revalidatePath("/venue");
  revalidatePath("/board");
}

/**
 * Carry a week for one house at one venue.
 *
 * Deferring grading, not skipping it. A carried board is held rather than
 * failed for the grade that could not happen in time, and scored against the
 * cards it was filed against so a rebuild for the next week cannot orphan it.
 * Unlike grading, it does not wait on every card being ruled on — the whole
 * point is that nobody could rule on them yet.
 */
export async function carryWeek(formData: FormData) {
  if (!(await isAdmin())) return;

  const venueId = String(formData.get("venueId") ?? "");
  const weekStart = String(formData.get("weekStart") ?? "");
  const by = String(formData.get("by") ?? "").trim() || "admin";
  const house: House = formData.get("house") === "HOH" ? "HOH" : "FOH";
  if (!venueId || !weekStart) return;
  if (!(await ownsHouse(house))) return;

  await db()
    .from("carried_weeks")
    .upsert(
      { venue_id: venueId, week_start: weekStart, house, carried_by: by },
      { onConflict: "venue_id,week_start,house" },
    );

  refresh(venueId);
}

/** Lifts a carry, if the week turned out to be gradeable after all. */
export async function uncarryWeek(formData: FormData) {
  if (!(await isAdmin())) return;

  const venueId = String(formData.get("venueId") ?? "");
  const weekStart = String(formData.get("weekStart") ?? "");
  const house: House = formData.get("house") === "HOH" ? "HOH" : "FOH";
  if (!venueId || !weekStart) return;
  if (!(await ownsHouse(house))) return;

  await db()
    .from("carried_weeks")
    .delete()
    .eq("venue_id", venueId)
    .eq("week_start", weekStart)
    .eq("house", house);

  refresh(venueId);
}

/**
 * Carry a week for one house across every venue that owes it.
 *
 * For the common case the whole thing exists for: a house's grader is away for
 * the week, so none of their boards can be ruled on. One move holds them all
 * instead of failing the lot, the mirror of Grade All.
 */
export async function carryAllVenues(formData: FormData) {
  if (!(await isAdmin())) return;

  const weekStart = String(formData.get("weekStart") ?? "");
  const by = String(formData.get("by") ?? "").trim() || "admin";
  const house: House = formData.get("house") === "HOH" ? "HOH" : "FOH";
  if (!weekStart) return;
  if (!(await ownsHouse(house))) return;

  // Only the venues that owe this house, the same rule as grading all: a carry
  // on a kitchen a bar does not have would be a held week for a board that was
  // never walked.
  const { data: venues } = await db()
    .from("venues")
    .select("id, houses")
    .eq("active", true)
    .contains("houses", [house]);
  const rows = ((venues ?? []) as { id: string }[]).map((venue) => ({
    venue_id: venue.id,
    week_start: weekStart,
    house,
    carried_by: by,
  }));
  if (rows.length === 0) return;

  await db()
    .from("carried_weeks")
    .upsert(rows, { onConflict: "venue_id,week_start,house" });

  revalidatePath("/admin");
  revalidatePath("/venue");
  revalidatePath("/board");
}

export type MaintenanceState = {
  error: string | null;
  locked?: boolean;
  message?: string | null;
};

/**
 * Throw or clear the site-wide maintenance hold.
 *
 * Admin only, and re-checked here rather than trusted from the page: this is
 * the one control that can put a stop screen in front of every crew at once, so
 * a manager code, which cannot reach this screen, must not be able to reach the
 * action behind it either. A refusal reports the current state unchanged so the
 * toggle re-renders honestly instead of flipping on a request that did nothing.
 *
 * The message rides along so an admin can say what the wait is for; blank falls
 * back to the hold's own words. `on` is read from the button pressed, so On and
 * Off are two submits of one form and there is no third "current" state to get
 * out of step with the switch.
 */
export async function setMaintenanceLock(
  _prev: MaintenanceState,
  formData: FormData,
): Promise<MaintenanceState> {
  const locked = formData.get("on") === "yes";
  const message = String(formData.get("message") ?? "").slice(
    0,
    MAINTENANCE_MESSAGE_MAX,
  );

  const session = await getSession();
  if (session?.role !== "admin") {
    return { error: "Admins only." };
  }

  const by = session.house ? `admin (${session.house})` : "admin";
  try {
    await setMaintenance(locked, message, by);
  } catch {
    return { error: "That didn't save. Try again." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/codes");
  return { error: null, locked, message: message.trim() || null };
}

/**
 * Whether the master grade-all gate has been set up.
 *
 * Reads only whether a code and a name exist, never the code itself, so the
 * admin screen can say "set" or "not set" without the PIN crossing the wire.
 */
export async function masterGradeConfigured(): Promise<{
  set: boolean;
  grader: string | null;
}> {
  if (!(await isAdmin())) return { set: false, grader: null };
  const { data } = await db()
    .from("master_grade")
    .select("pin, grader")
    .maybeSingle();
  const row = data as { pin: string | null; grader: string | null } | null;
  return {
    set: Boolean(row?.pin && row.grader),
    grader: row?.grader?.trim() || null,
  };
}

/**
 * Set or change the master grade code and the name it stamps.
 *
 * The one place the code is written, and only an admin reaches it. Six digits
 * like every other PIN in the app; the name is whatever goes on the record when
 * the button is pressed.
 */
export async function setMasterGradePin(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  if (!(await isAdmin())) return { error: "Not signed in." };
  const pin = String(formData.get("pin") ?? "").trim();
  const grader = String(formData.get("grader") ?? "").trim();
  if (!/^\d{6}$/.test(pin)) return { error: "Code must be 6 digits." };
  if (!grader) return { error: "Put the name it should stamp." };
  const { error } = await db()
    .from("master_grade")
    .upsert(
      { id: true, pin, grader, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
  if (error) return { error: "That didn't save. Try again." };
  revalidatePath("/admin/codes");
  return { error: null };
}

export type MasterGradeResult = {
  error: string | null;
  week?: string;
  approved?: number;
  boards?: number;
};

/**
 * Grade the whole company's finished week in one move.
 *
 * Behind the master code, not the admin session alone: every admin can see the
 * button, only the owner's code runs it. For the most recent finished week it
 * approves every item a venue filed and still has waiting, across both houses,
 * then closes the week for every venue with the configured name on it — the
 * twenty-plus boards of bookkeeping that follow a scan, done at once.
 *
 * Reversible: a verdict or a grade can still be changed per venue afterwards.
 */
export async function masterGradeAll(pin: string): Promise<MasterGradeResult> {
  if (!(await isAdmin())) return { error: "Not signed in." };

  const { data: cfg } = await db()
    .from("master_grade")
    .select("pin, grader")
    .maybeSingle();
  const stored = cfg as { pin: string | null; grader: string | null } | null;
  if (!stored?.pin || !stored.grader) {
    return { error: "No master code set yet. Set it in Admin first." };
  }
  if (pin.trim() !== stored.pin) return { error: "Wrong code." };
  const grader = stored.grader.trim();

  const week = mostRecentCompletedWeek();
  // The most recent finished week is past its deadline by definition; this is
  // belt and braces so a clock edge can never grade a week still being filed.
  if (!isDeadlinePassed(week)) return { error: "No finished week to grade yet." };

  const { data: venueRows } = await db()
    .from("venues")
    .select("id, houses")
    .eq("active", true);
  const venues = (venueRows ?? []) as { id: string; houses: House[] }[];

  const now = new Date().toISOString();
  let approved = 0;

  // Approve what is filed and still waiting, per venue and house — the same
  // newest-per-item rule the single-venue button uses, so a superseded row or
  // one marked for another cycle is never signed off.
  for (const venue of venues) {
    for (const house of venue.houses) {
      const items = await itemsFor(venue.id, house);
      const itemIds = items.map((item) => item.id);
      if (itemIds.length === 0) continue;
      const { data: subs } = await db()
        .from("submissions")
        .select("id, item_id, review, progress, created_at")
        .in("item_id", itemIds)
        .is("cleared_at", null)
        .order("created_at", { ascending: false });
      const newest = new Map<
        string,
        { id: string; review: string; progress: string }
      >();
      for (const row of (subs ?? []) as {
        id: string;
        item_id: string;
        review: string;
        progress: string;
      }[]) {
        if (!newest.has(row.item_id)) newest.set(row.item_id, row);
      }
      const approvable = [...newest.values()]
        .filter((row) => row.review === "pending" && row.progress === "done")
        .map((row) => row.id);
      if (approvable.length > 0) {
        await db()
          .from("submissions")
          .update({ review: "approved", reviewed_at: now })
          .in("id", approvable);
        approved += approvable.length;
      }
    }
  }

  // Close the week for every venue and house in one upsert, the name on all.
  const rows = venues.flatMap((venue) =>
    venue.houses.map((house) => ({
      venue_id: venue.id,
      week_start: week,
      house,
      graded_by: grader,
    })),
  );
  if (rows.length > 0) {
    await db()
      .from("graded_weeks")
      .upsert(rows, { onConflict: "venue_id,week_start,house" });
  }

  revalidatePath("/admin");
  revalidatePath("/venue");
  revalidatePath("/board");
  return { error: null, week, approved, boards: rows.length };
}
