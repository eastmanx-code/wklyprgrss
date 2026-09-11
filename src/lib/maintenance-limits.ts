/**
 * The longest custom hold message the toggle stores and the hold screen shows.
 *
 * Its own module with no imports because both sides of the wire need it: the
 * server action that caps what it saves, and the client toggle that caps what
 * it types. The rest of the maintenance code is server-only, so the number
 * lives out here where the browser can have it without the database client.
 */
export const MAINTENANCE_MESSAGE_MAX = 200;
