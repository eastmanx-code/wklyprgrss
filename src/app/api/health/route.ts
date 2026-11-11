export const dynamic = "force-dynamic";

/**
 * Is the app answering.
 *
 *   GET /api/health  ->  200 { ok: true, at }
 *
 * For a monitor outside the building to ask once a minute, so the first person
 * to learn the site is down is not a bartender at 11:30 at night. It runs the
 * same server code path as every page, so it fails when they fail, and it
 * touches no database and no session, so asking costs next to nothing and
 * gives nothing away.
 */
export function GET(): Response {
  return Response.json(
    { ok: true, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
