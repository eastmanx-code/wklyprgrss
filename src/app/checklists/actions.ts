"use server";

import { revalidatePath } from "next/cache";

import { sweepCaptures } from "@/lib/adopt";
import { isAdminPin } from "@/lib/admin-pin";
import { nameProblem, samePerson } from "@/lib/name";
import { closeVenueId } from "@/lib/close-venue";
import { activeNight } from "@/lib/active-night";
import { matchSlug } from "@/lib/slug";
import { PHOTO_BUCKET, db } from "@/lib/supabase";

export type CloseState = { error: string | null };

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** The venue this session may work on. */
async function venueId(): Promise<string | null> {
  return closeVenueId();
}

/** The checklist row, if this session may see it. */
async function checklistFor(slug: string) {
  const venue = await venueId();
  if (!venue) return null;
  // Matched in JS rather than with ilike: the slug is user input and ilike
  // treats % and _ as wildcards, so foh-%-close would match whatever role
  // came back first. The set is a handful of rows per venue.
  //
  // Compared against each list's own address rather than taken apart. This
  // was the third copy of that parsing, and the one that decides which list a
  // tick lands on, so a near miss here writes work against the wrong bar.
  const { data } = await db()
    .from("close_checklists")
    .select("id, house, role, phase, room")
    .eq("venue_id", venue)
    .eq("active", true);

  const match = matchSlug(
    (data ?? []) as {
      id: string;
      house: string;
      role: string;
      phase: string;
      room: string | null;
    }[],
    slug,
  );
  return match ? { id: match.id } : null;
}

/**
 * Tonight's row for a checklist, created on first touch.
 *
 * Created eagerly rather than on certify, because the whole point is that a
 * second person can pick the list up mid-shift — which needs somewhere for the
 * first person's work to already be.
 */
async function nightId(checklistId: string): Promise<string | null> {
  // Where the work belongs, not what the calendar says. Between four and
  // seven in the morning those differ, and the difference is a shift's record
  // split in half.
  const night = await activeNight(checklistId);

  // Upsert rather than check-then-insert. Two people ticking in the same
  // second both saw no row and both inserted; the second lost the unique
  // constraint and was told the night could not be opened — in precisely the
  // concurrent case this whole feature exists for.
  const { data } = await db()
    .from("close_nights")
    .upsert(
      { checklist_id: checklistId, night },
      { onConflict: "checklist_id,night", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (data) return (data as { id: string }).id;

  // Upsert can still lose a race against a concurrent insert; read it back.
  const { data: existing } = await db()
    .from("close_nights")
    .select("id")
    .eq("checklist_id", checklistId)
    .eq("night", night)
    .maybeSingle();
  return (existing as { id: string } | null)?.id ?? null;
}

/** A certified night is a record. Nothing may be written to it. */
async function isLocked(id: string): Promise<boolean> {
  const { data } = await db()
    .from("close_nights")
    .select("certified_at")
    .eq("id", id)
    .maybeSingle();
  return Boolean(
    (data as { certified_at: string | null } | null)?.certified_at,
  );
}

export async function tickItem(
  _prev: CloseState,
  formData: FormData,
): Promise<CloseState> {
  const slug = String(formData.get("slug") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const initials = String(formData.get("initials") ?? "")
    .trim()
    .toUpperCase();
  const on = String(formData.get("on") ?? "") === "true";
  /**
   * When the device says this happened, which is not when it arrived.
   *
   * Recorded, never trusted and never used to decide anything: a phone clock
   * is wrong as often as it is right and can be set by hand. `created_at` is
   * the server's own stamp and stays the one the reports count on. Holding
   * both is what lets a night show a tick that claims eleven forty and landed
   * at quarter past two, which on a record whose whole value is being true is
   * the interesting case rather than a rounding error.
   */
  const clientAt = String(formData.get("clientAt") ?? "");
  const stamped =
    clientAt && !Number.isNaN(Date.parse(clientAt))
      ? new Date(clientAt).toISOString()
      : null;

  if (!initials) return { error: "Initial it first." };

  const list = await checklistFor(slug);
  if (!list) return { error: "That checklist is not available." };
  const night = await nightId(list.id);
  if (!night) return { error: "Could not open tonight." };
  if (await isLocked(night)) return { error: "Tonight is already certified." };

  if (on) {
    const { error } = await db()
      .from("close_ticks")
      .upsert(
        { night_id: night, item_id: itemId, initials, client_at: stamped },
        { onConflict: "night_id,item_id" },
      );
    if (error) return { error: "Could not save that." };

    // Proof can now be collected before the row is signed for — you take the
    // photograph and then put your name to it, rather than the other way
    // round. The tick is where the name arrives, so any shot still unsigned
    // gets it here. Shots already carrying initials keep them: on an item two
    // people worked, the one who took the photograph is the one who took it.
    await db()
      .from("close_proof")
      .update({ initials })
      .eq("night_id", night)
      .eq("item_id", itemId)
      .is("initials", null);
  } else {
    await db()
      .from("close_ticks")
      .delete()
      .eq("night_id", night)
      .eq("item_id", itemId);
    await db()
      .from("close_proof")
      .delete()
      .eq("night_id", night)
      .eq("item_id", itemId);
  }

  revalidatePath(`/checklists/${slug}`);
  return { error: null };
}

/** A written note is proof: same table, words instead of a file. */
export async function saveNote(
  _prev: CloseState,
  formData: FormData,
): Promise<CloseState> {
  const slug = String(formData.get("slug") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const shotIndex = Number(formData.get("shotIndex") ?? 0);
  const initials = String(formData.get("initials") ?? "")
    .trim()
    .toUpperCase();
  const body = String(formData.get("body") ?? "").trim();

  // No initials required to write the note. Evidence can land before the
  // signature; the tick is what has to be signed, and it backfills this row.

  const list = await checklistFor(slug);
  if (!list) return { error: "That checklist is not available." };
  const night = await nightId(list.id);
  if (!night) return { error: "Could not open tonight." };
  if (await isLocked(night)) return { error: "Tonight is already certified." };

  if (!body) {
    await db()
      .from("close_proof")
      .delete()
      .eq("night_id", night)
      .eq("item_id", itemId)
      .eq("shot_index", shotIndex);
  } else {
    await db()
      .from("close_proof")
      .upsert(
        {
          night_id: night,
          item_id: itemId,
          shot_index: shotIndex,
          kind: "note",
          body,
          // Null, not "", so the tick's backfill can find it.
          initials: initials || null,
        },
        { onConflict: "night_id,item_id,shot_index" },
      );
  }

  revalidatePath(`/checklists/${slug}`);
  return { error: null };
}

/**
 * A short-lived, path-scoped upload URL, so the file goes straight to storage
 * and the action only ever carries text — the same shape the weekly photos
 * use. The path is generated here, never accepted from the browser.
 */
export async function captureTarget(
  slug: string,
  itemId: string,
  shotIndex: number,
  kind: "photo" | "video",
  /** The real extension, for video — an iPhone records .mov, not .mp4. */
  extension = "",
): Promise<{ error: string | null; path?: string; signedUrl?: string }> {
  const list = await checklistFor(slug);
  if (!list) return { error: "That checklist is not available." };
  const night = await nightId(list.id);
  if (!night) return { error: "Could not open tonight." };
  if (await isLocked(night)) return { error: "Tonight is already certified." };

  // Photos are re-encoded to JPEG in the browser before they get here, so
  // jpg is nearly always right. Nearly: a photograph the phone could not
  // re-encode is sent whole rather than refused, and it arrives saying so.
  // Filing that under .jpg would leave a picture nobody can open. Video is
  // uploaded as shot.
  const safe = extension
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 5)
    .toLowerCase();
  const ext = kind === "photo" ? safe || "jpg" : safe || "mov";
  const path = `close/${night}/${itemId}/${shotIndex}-${Date.now()}.${ext}`;
  const { data, error } = await db()
    .storage.from(PHOTO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { error: "Could not start the upload." };
  return { error: null, path, signedUrl: data.signedUrl };
}

/** Records a capture once the file itself is already in storage. */
export async function recordCapture(
  _prev: CloseState,
  formData: FormData,
): Promise<CloseState> {
  const slug = String(formData.get("slug") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const shotIndex = Number(formData.get("shotIndex") ?? 0);
  const kind = String(formData.get("kind") ?? "photo");
  const path = String(formData.get("path") ?? "");
  const initials = String(formData.get("initials") ?? "")
    .trim()
    .toUpperCase();

  // No initials required. Evidence can land before the signature — the tick
  // is what has to be signed, and it backfills these rows when it happens.
  if (kind !== "photo" && kind !== "video") return { error: "Bad capture." };

  const list = await checklistFor(slug);
  if (!list) return { error: "That checklist is not available." };
  const night = await nightId(list.id);
  if (!night) return { error: "Could not open tonight." };
  if (await isLocked(night)) return { error: "Tonight is already certified." };
  if (!path.startsWith(`close/${night}/${itemId}/`)) {
    return { error: "Something went wrong. Try again." };
  }

  await db()
    .from("close_proof")
    .upsert(
      {
        night_id: night,
        item_id: itemId,
        shot_index: shotIndex,
        kind,
        storage_path: path,
        // Null, not "", so the tick's backfill can find it.
        initials: initials || null,
      },
      { onConflict: "night_id,item_id,shot_index" },
    );

  revalidatePath(`/checklists/${slug}`);
  return { error: null };
}

/** Signing closes the night out. After this it is a record, not a document. */
/**
 * The list as it stands, frozen for the signature.
 *
 * A certified night stops depending on the live tables and becomes a document:
 * these lines, this wording, this proof asked for, ticked by these people. The
 * report recomputed an old night against today's list, so rewriting a line
 * quietly re-measured every night already recorded, and retiring one erased
 * the fact that the job had ever been owed.
 *
 * Editing tonight's list stays free. It simply no longer reaches backwards.
 */
async function listAtSigning(checklistId: string, nightRow: string) {
  const { data: items } = await db()
    .from("close_items")
    .select("id, position, title, detail, proof")
    .eq("checklist_id", checklistId)
    .eq("active", true)
    .order("position");

  const { data: ticks } = await db()
    .from("close_ticks")
    .select("item_id, initials, created_at")
    .eq("night_id", nightRow);

  const tick = new Map(
    (
      (ticks ?? []) as {
        item_id: string;
        initials: string;
        created_at: string;
      }[]
    ).map((t) => [t.item_id, t]),
  );

  return (
    (items ?? []) as {
      id: string;
      position: number;
      title: string;
      detail: string[];
      proof: unknown;
    }[]
  ).map((item) => {
    const t = tick.get(item.id);
    return {
      item_id: item.id,
      position: item.position,
      title: item.title,
      detail: item.detail,
      proof: item.proof,
      ticked: Boolean(t),
      initials: t?.initials ?? null,
      ticked_at: t?.created_at ?? null,
    };
  });
}

export async function certifyNight(
  _prev: CloseState,
  formData: FormData,
): Promise<CloseState> {
  const slug = String(formData.get("slug") ?? "");
  const who = String(formData.get("certifiedBy") ?? "").trim();
  const attestation = String(formData.get("attestation") ?? "").trim();
  const signature = String(formData.get("signature") ?? "");
  const openAtSigning = String(formData.get("openAtSigning") ?? "[]");
  const device = String(formData.get("device") ?? "").slice(0, 40);

  // "NULL" and "no MOD ON DUTY" both came through this box on the first night.
  // The second is not somebody messing about, it is a person reporting the
  // truth in the only field they had.
  const problem = nameProblem(who);
  if (problem) return { error: problem };
  if (!signature) return { error: "A signature is required." };

  const list = await checklistFor(slug);
  if (!list) return { error: "That checklist is not available." };
  const night = await nightId(list.id);
  if (!night) return { error: "Could not open tonight." };
  if (await isLocked(night)) return { error: "Tonight is already certified." };

  // Before the snapshot, not after. A photograph that reached storage and
  // never got its row is evidence the server already holds, and freezing a
  // record that calls that item open would be signing a lie into the one
  // document nobody can edit afterwards.
  await sweepCaptures(list.id, night);

  const frozen = await listAtSigning(list.id, night);

  const { error } = await db()
    .from("close_nights")
    .update({
      certified_at: new Date().toISOString(),
      certified_by: who,
      certified_device: device || null,
      // Written once, never updated. See supabase/014_close_signed_list.sql.
      list_at_signing: frozen,
      // Verbatim: if the wording ever changes, the record still shows what
      // this person put their name to.
      attestation,
      signature,
      open_at_signing: safeJson(openAtSigning),
    })
    .eq("id", night);

  if (error) return { error: "Could not certify that. Try again." };

  revalidatePath(`/checklists/${slug}`);
  return { error: null };
}

/**
 * The second signature: somebody else on the crew saying the work is done.
 *
 * The first night showed what one signature actually recorded. Seven of the
 * eight signed lists were signed by the person whose initials are on every
 * tick, and at close nobody signed anybody else's work. The single signature
 * was recording who was holding the phone, not who checked the bar.
 *
 * Not a manager's signature, by decision. There is no manager guaranteed at
 * close, and the rule from the people who run the floor is that closers sign
 * off for one another. So this asks for a second person, whoever that is: a
 * lead if one is in the space, the other closer if not.
 *
 * No PIN. A PIN would make this a permission, and it is not one, it is a
 * witness. Everybody who can work the list can also check somebody else's, and
 * putting a code in front of it at three in the morning would mean the list
 * that most needs a second pair of eyes is the one that cannot get them.
 *
 * Typed rather than proven, so the device is recorded and compared with the
 * one that signed the work. This stops nobody. It means the report can see
 * that both signatures came off the same phone forty seconds apart, which is
 * the shape of one person signing twice, and say so rather than counting it as
 * checked.
 */
export async function verifyNight(
  _prev: CloseState,
  formData: FormData,
): Promise<CloseState> {
  const slug = String(formData.get("slug") ?? "");
  const who = String(formData.get("verifiedBy") ?? "").trim();
  const signature = String(formData.get("signature") ?? "");
  const device = String(formData.get("device") ?? "").slice(0, 40);

  const problem = nameProblem(who);
  if (problem) return { error: problem };
  if (!signature) return { error: "A signature is required." };

  const list = await checklistFor(slug);
  if (!list) return { error: "That checklist is not available." };
  const night = await activeNight(list.id);

  const { data } = await db()
    .from("close_nights")
    .select("id, certified_at, certified_by, verified_at")
    .eq("checklist_id", list.id)
    .eq("night", night)
    .maybeSingle();
  const row = data as {
    id: string;
    certified_at: string | null;
    certified_by: string | null;
    verified_at: string | null;
  } | null;

  // Order matters. Checking work nobody has signed for is checking a claim
  // that has not been made yet.
  if (!row?.certified_at) {
    return { error: "Nobody has signed this list yet." };
  }
  if (row.verified_at) return { error: "This list is already checked." };

  // The one thing worth refusing outright. Everything subtler than an exact
  // repeat is left to the device stamp, because a rule that guesses wrong
  // blocks a real second signer with no way round it.
  if (samePerson(row.certified_by ?? "", who)) {
    return {
      error: "Somebody else has to check this. Get the other closer to sign.",
    };
  }

  const { error } = await db()
    .from("close_nights")
    .update({
      verified_at: new Date().toISOString(),
      verified_by: who,
      verified_signature: signature,
      verified_device: device || null,
    })
    .eq("id", row.id);

  if (error) return { error: "Could not save that. Try again." };

  revalidatePath(`/checklists/${slug}`);
  return { error: null };
}

/**
 * Unlocks a certified night, on a manager's PIN.
 *
 * Someone signs at 1am, then finds the back door was never actually checked.
 * Without this the only honest options are to leave the record wrong or to
 * call whoever has database access, and the first one is what actually
 * happens.
 *
 * The signature is not discarded. It moves into history, so the record shows
 * that Brian certified at 1:04, a manager reopened it, and it was certified
 * again — which is more useful than either version alone, and is the reason
 * this is an unlock rather than a delete.
 *
 * Admin PINs for now. A manager who is not an admin cannot do this yet, and
 * that is the next question to answer rather than something to guess at.
 */
export async function reopenNight(
  _prev: CloseState,
  formData: FormData,
): Promise<CloseState> {
  const slug = String(formData.get("slug") ?? "");
  const pin = String(formData.get("pin") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!(await isAdminPin(pin))) {
    return { error: "That PIN doesn't match. Try again." };
  }

  const list = await checklistFor(slug);
  if (!list) return { error: "That checklist is not available." };

  const { data } = await db()
    .from("close_nights")
    .select(
      "id, certified_at, certified_by, attestation, signature, open_at_signing, history",
    )
    .eq("checklist_id", list.id)
    .eq("night", await activeNight(list.id))
    .maybeSingle();

  const row = data as {
    id: string;
    certified_at: string | null;
    certified_by: string | null;
    attestation: string | null;
    signature: string | null;
    open_at_signing: unknown;
    history: unknown[] | null;
  } | null;

  if (!row) return { error: "Nothing has been recorded tonight." };
  if (!row.certified_at) return { error: "Tonight is not locked." };

  const { error } = await db()
    .from("close_nights")
    .update({
      history: [
        ...(row.history ?? []),
        {
          certified_at: row.certified_at,
          certified_by: row.certified_by,
          attestation: row.attestation,
          signature: row.signature,
          open_at_signing: row.open_at_signing,
          reopened_at: new Date().toISOString(),
          reason: reason || null,
        },
      ],
      certified_at: null,
      certified_by: null,
      attestation: null,
      signature: null,
      open_at_signing: null,
    })
    .eq("id", row.id)
    // Only unlock the night we just read. Two managers on the same PIN would
    // otherwise write history twice and the second would archive an empty
    // signature over the first.
    .not("certified_at", "is", null);

  if (error) return { error: "Could not reopen that. Try again." };

  revalidatePath(`/checklists/${slug}`);
  return { error: null };
}

/**
 * Why a capture did not make it, as the phone saw it.
 *
 * The app could not answer that on the first live night. Three photographs
 * failed and the only witness was a device that wrote nothing down, so the
 * investigation ran on a text message and two wrong guesses.
 *
 * Deliberately forgiving. Every one of these arrives from a phone already
 * having a bad time, and a report that argues with its own input is a report
 * that goes missing exactly when it matters. Anything unparseable is dropped
 * quietly and the caller is told it went fine, because there is nothing the
 * person holding the phone could do about it either way.
 *
 * It names a step and a device and never a person. No screen reads it.
 */
export async function reportTrouble(rows: unknown): Promise<CloseState> {
  const venue = await venueId();
  if (!venue) return { error: null };

  const all = Array.isArray(rows) ? rows.slice(0, 40) : [];
  if (all.length === 0) return { error: null };

  const STEPS = new Set(["read", "store", "send", "record", "vanished"]);
  const text = (value: unknown, cap: number) =>
    typeof value === "string" && value.trim() ? value.slice(0, cap) : null;
  const number = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  // The id columns are uuids with foreign keys on them, and the timestamp is
  // a timestamptz. One malformed value from one phone would fail the insert
  // for every row in the batch, including the good ones, so the shapes are
  // checked here rather than left to Postgres to refuse.
  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuid = (value: unknown) => {
    const held = text(value, 40);
    return held && UUID.test(held) ? held : null;
  };
  const stamp = (value: unknown) => {
    const held = text(value, 40);
    return held && !Number.isNaN(Date.parse(held)) ? held : null;
  };

  // One lookup per list rather than per row. A phone that lost signal for ten
  // minutes reports ten refusals against the same list.
  const nightOf = new Map<string, string | null>();
  async function nightFor(slug: string | null): Promise<string | null> {
    if (!slug) return null;
    if (nightOf.has(slug)) return nightOf.get(slug) ?? null;
    let found: string | null = null;
    const list = await checklistFor(slug);
    if (list) {
      // Read, never create. The night row is a record of work; a failed
      // upload must not be the thing that opens one.
      const { data } = await db()
        .from("close_nights")
        .select("id")
        .eq("checklist_id", list.id)
        .eq("night", await activeNight(list.id))
        .maybeSingle();
      found = (data as { id: string } | null)?.id ?? null;
    }
    nightOf.set(slug, found);
    return found;
  }

  const write: Record<string, unknown>[] = [];
  for (const raw of all) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const step = text(row.step, 20);
    if (!step || !STEPS.has(step)) continue;
    const slug = text(row.slug, 120);
    write.push({
      night_id: await nightFor(slug),
      slug,
      item_id: uuid(row.itemId),
      shot_index: number(row.shotIndex),
      step,
      detail: text(row.detail, 500),
      bytes: number(row.bytes),
      recovered: row.recovered === true,
      user_agent: text(row.userAgent, 400),
      client_at: stamp(row.clientAt),
    });
  }

  if (write.length > 0) await db().from("close_trouble").insert(write);
  return { error: null };
}
