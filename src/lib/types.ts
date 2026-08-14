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

export type Item = {
  id: string;
  venue_id: string;
  title: string;
  position: number;
  active: boolean;
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

export type VenueWeekSummary = {
  venue: VenueSummary;
  /** Submitted this week — the pass/fail gate. */
  doneCount: number;
  /** Approved this week — the score. */
  approvedCount: number;
  activeCount: number;
  status: WeekStatus;
  failStreak: number;
};
