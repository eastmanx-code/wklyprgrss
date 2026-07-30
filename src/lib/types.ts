export type Venue = {
  id: string;
  code: string;
  name: string;
  pin: string;
};

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
  created_at: string;
};

export type WeekStatus = "PASS" | "PENDING" | "FAIL";

export type VenueWeekSummary = {
  venue: Venue;
  doneCount: number;
  activeCount: number;
  status: WeekStatus;
  failStreak: number;
};
