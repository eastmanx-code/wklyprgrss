export type Venue = {
  id: string;
  code: string;
  name: string;
  pin: string;
  /**
   * The halves this venue actually runs.
   *
   * Four of them are bars with no kitchen. Scored on a house they do not have,
   * they would fail it every week forever — and since a venue wins a week only
   * by winning every house it is scored on, they could never win another one.
   * An empty board is a venue that has not done the work; a missing house is a
   * fact about the building. Only the second is an excuse, and this is it.
   */
  houses: House[];
};

/**
 * A venue without its PIN. Everything except the admin venue screen and the
 * login check uses this, so the PIN is never even read out of the database for
 * screens that have no business showing it.
 */
export type VenueSummary = Pick<Venue, "id" | "code" | "name" | "houses">;

/**
 * Which board an item belongs to.
 *
 * The walkthrough was one list of ten per venue until the kitchen got its own.
 * The two are never summed: a venue can keep a spotless dining room and a
 * filthy walk-in, and one number covering both would let the first hide the
 * second. Two people grade, one per house, and each signs their own.
 */
export type House = "FOH" | "HOH";

/** Board order. FOH first, everywhere it is shown. */
export const HOUSES: House[] = ["FOH", "HOH"];

/**
 * What a house is called on screen, spelled out.
 *
 * "Heart of house", not "kitchen". It is what the closing checklists call it
 * and what the people running it call it, and it keeps the pair symmetrical —
 * front and heart, FOH and HOH. "Kitchen" broke that symmetry and also read
 * as a room rather than as half the walkthrough.
 */
export function houseName(house: House): string {
  return house === "FOH" ? "Front of house" : "Heart of house";
}

/**
 * The three-letter form, for anywhere the words would crowd the number they
 * are labelling. Same string as the database column, which is the point: the
 * short label and the code people already use are one thing.
 */
export function houseShort(house: House): string {
  return house;
}

export type Item = {
  id: string;
  venue_id: string;
  title: string;
  position: number;
  active: boolean;
  house: House;
};

export type Submission = {
  id: string;
  item_id: string;
  week_start: string;
  /** Storage object path inside the private `photos` bucket, not a public URL. */
  photo_url: string;
  /**
   * Optional same-week "before" shot, for tasks executed inside the week. Null
   * on ongoing items, where the previous week's photo is the before.
   */
  before_photo_url: string | null;
  /**
   * When the image file was cleared from storage. The row itself is never
   * deleted — status, streaks and reports are computed from rows, not photos.
   */
  photo_purged_at: string | null;
  comment: string;
  /** Who wrote this update. Required. */
  author: string;
  /** Who else worked on it. Optional. */
  assisted_by: string | null;
  /**
   * Admin review state. `sent_back` means the item is not finished — it stops
   * counting as done for the week, so the leader has to redo it.
   */
  review: ReviewState;
  reviewed_at: string | null;
  /**
   * What the reviewer wants doing differently, when they said. Only ever set
   * on a rejection, and cleared the moment the work is approved.
   */
  review_note: string | null;
  /**
   * What the leader says about the work itself. `another_cycle` still counts
   * as this week's update — they showed up — but the task isn't finished, and
   * the admin cannot approve it.
   */
  progress: ProgressState;
  created_at: string;
};

export type ReviewState = "pending" | "approved" | "sent_back";
export type ProgressState = "done" | "another_cycle";

/**
 * There is no exemption for having no board. A venue with no items set up has
 * not been overlooked by the programme — building the ten is the first part of
 * the job, so an empty board scores nought out of ten like any other shortfall.
 * A venue genuinely not in the programme yet is marked inactive instead.
 */
export type WeekStatus = "PASS" | "PENDING" | "FAIL";

/** One house's week at one venue. Never added to the other house's. */
export type HouseWeek = {
  house: House;
  /** Submitted this week — the pass/fail gate. */
  doneCount: number;
  /** Approved this week — the score. */
  approvedCount: number;
  /**
   * Consecutive weeks this house has cleared the win line.
   *
   * A streak rather than a rank. Ranking twenty-one venues one to twenty-one
   * is the public shaming that is already ruled out here, and the research on
   * it agrees: constant rank-order comparison in high-pressure work raises
   * stress and pushes people toward quantity and toward hiding. A streak is a
   * venue measured against itself, every venue can hold one at the same time,
   * and it is a thing people protect rather than game.
   */
  winStreak: number;
  /**
   * Filed, and still waiting on a verdict.
   *
   * The grade stamp and the reviewing came apart: eight boards were stamped
   * closed with every one of their ten still untouched, and the screen had no
   * way to say so — a stamped board looked finished whether or not anybody had
   * ruled on a single item.
   */
  pendingCount: number;
  /**
   * Sent back and not redone: the newest filing for the item is the rejected
   * one, so nothing has replaced it.
   *
   * Deliberately not deducted from doneCount. They filed it and they hit the
   * deadline; whether the redo happened is a separate question and gets its
   * own column rather than quietly changing the first number.
   */
  redoCount: number;
  /**
   * Whether this house has any board at all.
   *
   * A venue with no kitchen list cannot file, so its nought means "there is
   * nothing here" — the opposite of a venue that had ten and filed none, and
   * they were drawing identically.
   */
  hasBoard: boolean;
  activeCount: number;
  status: WeekStatus;
  failStreak: number;
  /**
   * Whether this house's numbers count yet.
   *
   * A house shows on the board from the day it exists, but it is not scored
   * until its first live week. A venue names its own ten, so the kitchen
   * arrives empty and there is a week of deciding and walking first; counting
   * that week would have put a fresh 0/10 against every venue in the company
   * for a board nobody had built yet, and — because past weeks are scored
   * against the board as it stands now — would have back-dated the same zero
   * across the whole history.
   */
  scored: boolean;
};

export type VenueWeekSummary = {
  venue: VenueSummary;
  foh: HouseWeek;
  hoh: HouseWeek;
  /** Both houses in board order, for anything that draws them. */
  houses: HouseWeek[];
  /**
   * The houses that count this week, in board order. Everything that adds
   * houses up reads this rather than picking fields, so a house still in
   * practice cannot leak into a total by being forgotten at one call site.
   */
  scored: HouseWeek[];
  /** The worse of the counting houses — one house failing fails the venue. */
  status: WeekStatus;
  /** The longest run of missed weeks across the counting houses. */
  failStreak: number;
  /**
   * Consecutive weeks this venue cleared the line in every house that counted
   * that week. Judged per week, so the weeks before the kitchen went live ask
   * only what was being asked then.
   */
  runWeeks: number;
};
