export type Venue = {
  id: string;
  code: string;
  name: string;
  pin: string;
};

/**
 * A venue without its PIN. Everything except the admin venue screen and the
 * login check uses this, so the PIN is never even read out of the database for
 * screens that have no business showing it.
 */
export type VenueSummary = Pick<Venue, "id" | "code" | "name">;

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
 * What a house is called on screen. Nobody outside the office says "HOH".
 *
 * "Kitchen" rather than "heart of house", which is what the closing checklists
 * called it: it is the word the people walking it use, and the one the request
 * for this board used. The code stays HOH everywhere — in the column, the
 * slugs and the export — so nothing about the change is load-bearing.
 */
export function houseName(house: House): string {
  return house === "FOH" ? "Front of house" : "Kitchen";
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
};
