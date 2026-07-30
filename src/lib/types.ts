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
  created_at: string;
};

export type ReviewState = "pending" | "approved" | "sent_back";

export type WeekStatus = "PASS" | "PENDING" | "FAIL";

export type VenueWeekSummary = {
  venue: VenueSummary;
  doneCount: number;
  activeCount: number;
  status: WeekStatus;
  failStreak: number;
};
