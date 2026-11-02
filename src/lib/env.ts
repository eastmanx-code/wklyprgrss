import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return value;
}

function requiredInt(name: string, min: number, max: number): number {
  const raw = required(name);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export const SUPABASE_URL = () => required("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_SERVICE_ROLE_KEY = () =>
  required("SUPABASE_SERVICE_ROLE_KEY");
/**
 * One or more admin PINs, comma-separated — so a test code can be issued and
 * revoked without disturbing the real one.
 */
export const ADMIN_PINS = (): string[] =>
  required("ADMIN_PIN")
    .split(",")
    .map((pin) => pin.trim())
    .filter(Boolean);

/**
 * The secret in /members/<key>: the membership board on a link that needs no
 * login, for review.
 *
 * OPTIONAL ON PURPOSE. Unset means that route 404s, so a missing variable
 * cannot put member names and balances on an open URL. It lives in the Netlify
 * environment and never in the repo, which is public.
 */
export const MEMBERS_VIEW_KEY = (): string | null =>
  process.env.MEMBERS_VIEW_KEY?.trim() || null;

/** 0 = Sunday .. 6 = Saturday, Pacific. */
export const DEADLINE_DAY = () => requiredInt("DEADLINE_DAY", 0, 6);
/** 0-23, Pacific. */
export const DEADLINE_HOUR = () => requiredInt("DEADLINE_HOUR", 0, 23);
