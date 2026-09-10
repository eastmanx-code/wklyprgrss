"use server";

import { redirect } from "next/navigation";

import { pinHolder, type PinHolder } from "@/lib/admin-pin";
import { safeNext } from "@/lib/app";
import {
  endSession,
  pinMatches,
  startAdminSession,
  startLeaderSession,
  startManagerSession,
} from "@/lib/session";
import { getVenue } from "@/lib/status";

/**
 * `code` names which refusal it was, so the form can say it in the reader's
 * language. The English stays on `error` because a server action does not know
 * what language the phone is set to, and the door is the one screen somebody
 * reaches before the app knows anything about them.
 */
export type FormState = { error: string | null; code?: "pin" | "venue" };

/** Deliberately identical for unknown venue and wrong PIN. */
const GENERIC_ERROR = "That PIN doesn't match. Try again.";

export async function leaderLogin(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const venueId = String(formData.get("venueId") ?? "");
  const pin = String(formData.get("pin") ?? "");

  if (!pin) return { error: GENERIC_ERROR, code: "pin" };
  // A manager PIN with no venue picked. The venue is the crew's half of the
  // form, and a manager at this door has nothing to pick: their PIN already
  // says who they are. Asking for a venue first read as being locked out.
  if (!venueId) {
    const holder = await pinHolder(pin);
    if (holder) {
      await openFor(holder);
      redirect(safeNext(String(formData.get("next") ?? "") || undefined));
    }
    return { error: "Choose a venue first.", code: "venue" };
  }

  const venue = await getVenue(venueId);
  if (!venue) return { error: GENERIC_ERROR, code: "pin" };

  if (!pinMatches(pin, venue.pin)) {
    /**
     * A manager PIN typed at the crew door.
     *
     * There are two doors and they look the same, so a manager reaches for the
     * one in front of them and gets "that PIN doesn't match", which reads as
     * "your PIN is wrong" rather than "wrong door". That happened three times
     * in one afternoon: once trying to add items, once trying to reopen a
     * night, and once at this screen with the right code in hand.
     *
     * The PIN already says which person it belongs to. It should not also
     * require knowing which screen to be standing on. So a code that opens the
     * admin door opens it from here too, and the crew door is unchanged for
     * everybody holding the venue code.
     *
     * Not a new way in. Anyone who could do this could already do it at the
     * admin screen, which is linked at the foot of this one.
     */
    const holder = await pinHolder(pin);
    if (holder) {
      await openFor(holder);
      redirect(safeNext(String(formData.get("next") ?? "") || undefined));
    }
    return { error: GENERIC_ERROR, code: "pin" };
  }

  await startLeaderSession(venue.id);
  // Where the link asked for, when it asked. A QR in the prep room lands on
  // the checklists rather than on a home screen nobody there has a use for.
  redirect(safeNext(String(formData.get("next") ?? "") || undefined));
}

export async function adminLogin(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const pin = String(formData.get("pin") ?? "");
  const holder = await pinHolder(pin);
  if (!holder) return { error: GENERIC_ERROR };

  await openFor(holder);
  redirect("/home");
}

/**
 * The session a code opens.
 *
 * One helper for both doors. A manager code used to start an admin session,
 * which is how four bar managers ended up holding every venue in the group
 * and the screen that mints admin codes, and a second copy of this rule is a
 * second place for that to happen again.
 */
async function openFor(holder: PinHolder): Promise<void> {
  if (holder.kind === "manager") await startManagerSession(holder.venueId);
  else await startAdminSession(holder.house);
}

export async function logout() {
  await endSession();
  redirect("/");
}
