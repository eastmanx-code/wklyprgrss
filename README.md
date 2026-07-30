# Weekly Walkthrough

Replaces the Figma progress board for a 27-venue hospitality group. Each venue
leader updates their items weekly with a new photo and a new comment before the
deadline. Miss any item and the week fails.

Next.js (App Router) · Supabase Postgres + Storage · Netlify.

## Setup

**1. Create the Supabase project.** In the SQL editor, run
[`supabase/schema.sql`](supabase/schema.sql). It creates the three tables,
enables RLS with no policies, and adds the read indexes.

**2. Create the storage bucket.** Name it `photos`. **Private** — leave "Public
bucket" off. The app serves every image through a short-lived signed URL minted
on the server.

**3. Environment variables.** Copy `.env.example` to `.env.local` and fill in:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Never expose to the browser. |
| `ADMIN_PIN` | PIN for the admin screens |
| `DEADLINE_DAY` | `0`=Sun … `6`=Sat, Pacific |
| `DEADLINE_HOUR` | `0`–`23`, Pacific |

Thursday 3pm Pacific is `DEADLINE_DAY=4`, `DEADLINE_HOUR=15`.

**4. Seed the venues.**

```bash
npm run seed
```

Inserts the 27 venue codes with random 4-digit PINs and prints them **once**.
Copy them before closing the terminal. Re-running is safe; existing venues are
left alone. Items start empty — the admin adds them per venue.

**5. Run it.**

```bash
npm run dev
```

## Deploy

Push to GitHub, connect the repo in Netlify, and set the same five environment
variables in Netlify → Site configuration → Environment variables. Netlify
detects Next.js and needs no extra build configuration.

## How it works

### Roles

There is no Supabase Auth. A signed, HTTP-only session cookie records either
`{venue}` or `admin`. The signing key is derived from the service role key, so
no sixth environment variable is needed and rotating that key logs everyone out.

- **Leader** — picks a venue, enters the venue PIN, submits their own items.
- **Admin** — enters `ADMIN_PIN`, sees and manages every venue.

Shared venue PINs are not real authentication. That is an accepted limit for
progress photos.

### Weeks and deadlines

- A week runs Monday 00:00 Pacific to the deadline set by `DEADLINE_DAY` /
  `DEADLINE_HOUR`. The deadline day resolves *inside* the Monday-anchored week,
  so Sunday is the last day of the week rather than the first.
- An item is **DONE** for the week once a submission exists for it with that
  week's `week_start`. Photo and comment are both `not null`, so a row existing
  is proof both were given.
- A venue's week is **PASS** when every active item is done, **PENDING** while
  incomplete before the deadline, **FAIL** when incomplete after it.
- Status is computed at read time. No cron, no scheduled jobs.
- `created_at` and `week_start` both come from server time. The client clock is
  used only to render the countdown.

### Fail streak

Consecutive FAIL weeks counting back from the most recent week whose deadline
has passed. Two boundaries worth knowing, because the schema does not record
them:

- The walk stops at a venue's **first-ever submission**. Weeks before a venue
  started using the app are "no data", not failures — so a venue with no
  submissions at all shows a streak of `0`, not `26`.
- Historical weeks are scored against the venue's **current** active items. If
  you add an 11th item today, past weeks are judged against 11. Deactivating an
  item removes it from scoring but keeps its history.

Lookback is capped at 26 weeks.

### Photos

Compressed in the browser before upload: re-encoded to JPEG, max 1600px on the
long edge, quality stepped down until roughly 300KB. Going through a canvas is
also what converts an iPhone HEIC capture into something every browser renders.
The original never leaves the phone.

Objects are stored at `VENUE/ITEM/WEEK-unique.jpg` in the private bucket.
`submissions.photo_url` holds that **storage path**, not a URL — the URL is
signed per request and expires in an hour.

At ~300KB and 270 photos a week, Supabase's 1GB free tier holds about 3 months.
Supabase Pro is $25/mo for 100GB.

### Screens

| Route | Who | What |
| --- | --- | --- |
| `/` | anyone | Venue dropdown + PIN |
| `/venue` | leader | Week progress meter, countdown, item grid |
| `/venue/item/[id]` | leader | Submit photo + comment, read-only history |
| `/board` | leader, admin | Every venue's status this week |
| `/board/[id]` | leader, admin | Another venue's photos and comments, read-only |
| `/admin/login` | anyone | Admin PIN |
| `/admin` | admin | All venues, sorted FAIL and lowest completion first |
| `/admin/venue/[id]` | admin | Full history, add/rename/deactivate/reorder items, edit PIN |

## Not in v1

Reminders and notifications, ROD automation, exports, side-by-side week
comparison, per-user accounts, editing or deleting submissions.
