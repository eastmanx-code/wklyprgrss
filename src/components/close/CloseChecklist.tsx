"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { compressToJpeg, decodeMessage } from "@/lib/compress";
import {
  blobFor,
  canQueue,
  enqueue,
  enqueueProof,
  flush,
  pending as pendingWork,
  proofKey,
  queued,
  tickKey,
  type Op,
  type ProofOp,
  type TickOp,
} from "@/lib/outbox";
import type { CloseItem, ProofKind } from "@/lib/close-checklist";
import {
  captureTarget,
  certifyNight,
  recordCapture,
  reopenNight,
  saveNote,
  tickItem,
} from "@/app/close/actions";

export type SavedNight = {
  /** item id -> initials */
  ticks: Record<string, string>;
  /** "itemId:shotIndex" -> what was captured */
  proof: Record<
    string,
    { kind: string; body: string | null; url: string | null }
  >;
  certifiedBy: string | null;
  certifiedAt: string | null;
  /** Certifications this night has already had, oldest first. */
  history: {
    certifiedBy: string | null;
    certifiedAt: string | null;
    reason: string | null;
  }[];
};

type Capture = { url: string; kind: "photo" | "video" };

/**
 * What the device is holding, in words.
 *
 * "3 saved on this device" does not say whether the photograph made it, which
 * is the one thing worth knowing when the signal drops mid-shot.
 */
function describeHeld(ticks: number, proof: number): string {
  const parts: string[] = [];
  if (ticks > 0) parts.push(`${ticks} ${ticks === 1 ? "tick" : "ticks"}`);
  if (proof > 0) parts.push(`${proof} ${proof === 1 ? "photo" : "photos"}`);
  return parts.join(" and ");
}

/** One capture slot: item number and which of that item's shots. */
const slotKey = (item: number, shot: number) => `${item}:${shot}`;

/**
 * A close checklist, for review. Nothing is saved yet.
 *
 * Two rules shape the whole thing. Evidence is the check: an item that owes a
 * photo or a video cannot be hand-ticked, and capturing the proof is what
 * completes it. And the initials on every tick are what make a shared iPad
 * legible afterwards — four people work a close, and "who did the restrooms"
 * has to have an answer.
 */
export function CloseChecklist({
  slug,
  items,
  referenceUrls,
  saved,
}: {
  slug: string;
  items: CloseItem[];
  /** Storage path -> signed URL, for the reference shots. Minted server-side. */
  referenceUrls: Record<string, string>;
  saved: SavedNight;
}) {
  const router = useRouter();
  const CLOSE_CHECKLIST = items;
  const CLOSE_TOTAL = items.length;
  const shotsOfKind = (kind: ProofKind) =>
    items.flatMap((item) => item.proof ?? []).filter((s) => s.kind === kind)
      .length;
  const PHOTO_SHOTS = shotsOfKind("photo");
  const VIDEO_SHOTS = shotsOfKind("video");
  const NOTE_SHOTS = shotsOfKind("note");

  const [done, setDone] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(
      items.map((item) => [item.number, Boolean(saved.ticks[item.id ?? ""])]),
    ),
  );
  const [captures, setCaptures] = useState<Record<string, Capture>>(() =>
    Object.fromEntries(
      Object.entries(saved.proof)
        .filter(([, v]) => v.kind !== "note" && v.url)
        .map(([k, v]) => {
          const [itemId, shot] = k.split(":");
          const item = items.find((i) => i.id === itemId);
          return [
            slotKey(item?.number ?? 0, Number(shot)),
            { url: v.url as string, kind: v.kind as "photo" | "video" },
          ];
        }),
    ),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(saved.proof)
        .filter(([, v]) => v.kind === "note" && v.body)
        .map(([k, v]) => {
          const [itemId, shot] = k.split(":");
          const item = items.find((i) => i.id === itemId);
          return [slotKey(item?.number ?? 0, Number(shot)), v.body as string];
        }),
    ),
  );
  const [rowInitials, setRowInitials] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      items
        .filter((item) => saved.ticks[item.id ?? ""])
        .map((item) => [item.number, saved.ticks[item.id ?? ""]]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [initialsWanted, setInitialsWanted] = useState<number | null>(null);
  /** Tapped, and waiting on its initials before it does anything. */
  const [pending, setPending] = useState<number | null>(null);
  const [certifier, setCertifier] = useState(saved.certifiedBy ?? "");
  const [signed, setSigned] = useState(Boolean(saved.certifiedAt));
  const [certified, setCertified] = useState<string | null>(
    saved.certifiedAt ? `Certified by ${saved.certifiedBy ?? "—"}` : null,
  );
  const [shortfall, setShortfall] = useState<string | null>(null);
  /** Work written here that the server has not taken yet. */
  const [outstanding, setOutstanding] = useState(0);
  const [heldProof, setHeldProof] = useState(0);
  const [offline, setOffline] = useState(false);
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);
  /**
   * Whether the signing block is showing while work is still outstanding.
   *
   * It used to be on screen from the moment the list opened — the attestation,
   * the name field and the signature pad, all sitting under a list at nought
   * done. The whole difficulty this product exists to solve is getting people
   * to do the checklist rather than sign it, and a pad already waiting for a
   * finger is an invitation to do the second. Signing with items open is still
   * completely allowed; it now takes a deliberate tap to reach.
   */
  const [signingOpen, setSigningOpen] = useState(false);
  const [reopenPin, setReopenPin] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [reopenError, setReopenError] = useState<string | null>(null);

  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const notesRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const initialsRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const objectUrls = useRef<string[]>([]);
  const byPointer = useRef(false);
  const signatureRef = useRef<string | null>(null);
  /** True for a few seconds after this device does something, so a poll that
      set off before the change landed cannot come back and undo it. A flag on
      a timer rather than a timestamp: reading the clock during render is not
      allowed, and the question here is only "recently?". */
  const justTouched = useRef(false);
  const quiet = useRef<number | null>(null);
  const draining = useRef(false);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  /**
   * Send what is queued: on arrival, whenever the network comes back, and on
   * a slow timer for the case the browser never fires an online event, which
   * happens when a phone was asleep in a pocket rather than genuinely offline.
   *
   * The timer is thirty seconds because a queued tick is already safe on the
   * device; nothing is lost by taking half a minute to notice, and polling
   * harder on a phone in a cold room only spends battery.
   */
  useEffect(() => {
    if (!canQueue()) return;

    const mark = () => setOffline(!navigator.onLine);
    mark();

    void pendingWork().then((held) => {
      setOutstanding(held.total);
      setHeldProof(held.proof);
    });
    void rehydrate();
    void drain();

    const back = () => {
      mark();
      void drain();
    };
    const id = window.setInterval(() => void drain(), 30_000);
    window.addEventListener("online", back);
    window.addEventListener("offline", mark);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("online", back);
      window.removeEventListener("offline", mark);
    };
    // Mounted once. drain reads refs and state setters, both stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Four people work a close on four phones. Everything already persists, but
   * a device that was sitting on this page when someone else ticked item 3 had
   * no way to find out — so two MODs could each believe they were looking at
   * the night and be looking at different ones.
   *
   * Polled rather than subscribed. A close runs a couple of hours on a handful
   * of devices; fifteen seconds is well inside the time it takes to walk to
   * the next thing, and it costs one query rather than a realtime connection
   * to hold open on a phone that keeps sleeping. Only while the tab is
   * actually in front of someone.
   */
  useEffect(() => {
    const pull = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(pull, 15_000);
    document.addEventListener("visibilitychange", pull);
    window.addEventListener("focus", pull);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", pull);
      window.removeEventListener("focus", pull);
    };
  }, [router]);

  /**
   * Server state, merged in.
   *
   * Not while a save is in flight, and not within a few seconds of this
   * person's own last action: a poll that set off before their tick landed
   * would come back without it and undo it in front of them.
   *
   * Ticks follow the server exactly, including removals — someone un-ticking
   * the restrooms because they were not actually done has to reach the other
   * phones, or the next person signs an attestation that says ten of ten when
   * the record says nine. Captures and notes are only ever added: replacing a
   * photo this device just took would swap a local file for a signed URL and
   * reload the image for nothing, and rewriting a note would fight whoever is
   * typing it.
   */
  useEffect(() => {
    // Queued writes have not reached the server, so what the server just sent
    // back does not know about them. Letting it through would untick a row in
    // front of somebody who ticked it thirty seconds ago in a cold room, which
    // is the exact failure the queue exists to prevent.
    if (saving || justTouched.current || outstanding > 0) return;

    setDone((current) => {
      let changed = false;
      const next = { ...current };
      for (const item of items) {
        const on = Boolean(saved.ticks[item.id ?? ""]);
        if (on !== Boolean(next[item.number])) {
          next[item.number] = on;
          changed = true;
        }
      }
      return changed ? next : current;
    });

    setRowInitials((current) => {
      let changed = false;
      const next = { ...current };
      for (const item of items) {
        const theirs = saved.ticks[item.id ?? ""];
        if (theirs && next[item.number] !== theirs) {
          next[item.number] = theirs;
          changed = true;
        }
      }
      return changed ? next : current;
    });

    setCaptures((current) => {
      let changed = false;
      const next = { ...current };
      for (const [key, value] of Object.entries(saved.proof)) {
        if (value.kind === "note" || !value.url) continue;
        const [itemId, shot] = key.split(":");
        const number = items.find((i) => i.id === itemId)?.number;
        if (number === undefined) continue;
        const slot = slotKey(number, Number(shot));
        if (!next[slot]) {
          next[slot] = {
            url: value.url,
            kind: value.kind as "photo" | "video",
          };
          changed = true;
        }
      }
      return changed ? next : current;
    });

    setNotes((current) => {
      let changed = false;
      const next = { ...current };
      for (const [key, value] of Object.entries(saved.proof)) {
        if (value.kind !== "note" || !value.body) continue;
        const [itemId, shot] = key.split(":");
        const number = items.find((i) => i.id === itemId)?.number;
        if (number === undefined) continue;
        const slot = slotKey(number, Number(shot));
        if (!next[slot]) {
          next[slot] = value.body;
          changed = true;
        }
      }
      return changed ? next : current;
    });

    // Somebody else signed it. Lock, so this device cannot keep working a
    // night that is already a record.
    setCertified((current) =>
      saved.certifiedAt && current === null
        ? `Certified by ${saved.certifiedBy ?? "—"}`
        : current,
    );
  }, [saved, saving, items, outstanding]);

  /** A shot is met by a capture, or — for a note — by words in the box. */
  const shotFilled = (item: number, index: number, kind: ProofKind) =>
    kind === "note"
      ? Boolean(notes[slotKey(item, index)]?.trim())
      : Boolean(captures[slotKey(item, index)]);

  /** An item owing proof is complete only when every one of its shots is in. */
  const shotsTaken = (item: CloseItem) =>
    (item.proof ?? []).filter((shot, index) =>
      shotFilled(item.number, index, shot.kind),
    ).length;
  const doneCount = CLOSE_CHECKLIST.filter((item) => done[item.number]).length;
  const openItems = CLOSE_CHECKLIST.filter((item) => !done[item.number]);
  const untouched = doneCount === 0;

  /**
   * Never prefilled. Ten items initialled ten times is the point — a single
   * value applied to the whole night records who opened the app, not who did
   * the work, and the second is the only one worth keeping.
   */
  const initialsFor = (number: number) => rowInitials[number] ?? "";

  /** Nothing happens on a row until it is signed for. */
  function haveInitials(number: number) {
    if (initialsFor(number).trim()) return true;
    setInitialsWanted(number);
    setPending(number);
    initialsRefs.current[number]?.focus();
    return false;
  }

  /** One queued tick, in the shape the server action reads. */
  function sendable(op: TickOp): FormData {
    const data = new FormData();
    data.set("slug", op.slug);
    data.set("itemId", op.itemId);
    data.set("initials", op.initials);
    data.set("on", String(op.on));
    data.set("clientAt", op.clientAt);
    return data;
  }

  /**
   * One queued capture, all three steps of it.
   *
   * A photograph is not one write. The server mints a signed URL against
   * tonight's row, the bytes go straight to storage, and only then does a row
   * point at them. Any of the three can fail on a bad connection, and the
   * whole thing has to be safe to repeat: the first two steps leave nothing
   * behind worth keeping, and the third upserts on (night, item, shot), so a
   * retry overwrites its own earlier attempt rather than doubling it.
   *
   * A thrown error means the network; a returned one means the server said no.
   * The queue treats those differently and this has to preserve the
   * difference, so the fetch failures are rethrown rather than swallowed.
   */
  async function sendProof(op: ProofOp, blob: Blob) {
    const target = await captureTarget(
      op.slug,
      op.itemId,
      op.shotIndex,
      op.shot,
      op.extension,
    );
    if (target.error || !target.signedUrl || !target.path) {
      // The server had an opinion — a certified night, a list that moved.
      // Repeating the call will not change it.
      return { error: target.error ?? "Could not start the upload." };
    }

    const response = await fetch(target.signedUrl, {
      method: "PUT",
      headers: {
        "content-type":
          op.shot === "photo"
            ? "image/jpeg"
            : blob.type || "application/octet-stream",
      },
      body: blob,
    });
    if (!response.ok) throw new Error(`upload ${response.status}`);

    const data = new FormData();
    data.set("slug", op.slug);
    data.set("itemId", op.itemId);
    data.set("shotIndex", String(op.shotIndex));
    data.set("kind", op.shot);
    data.set("path", target.path);
    data.set("initials", op.initials);
    return recordCapture({ error: null }, data);
  }

  /**
   * Empty the queue, if anything is in it and the network will take it.
   *
   * Guarded against running twice at once: the interval, the online event and
   * a fresh tap can all arrive together, and three drains racing would send
   * the same tick three times. Harmless on the server, which upserts, but it
   * spends a phone's radio for nothing.
   */
  async function drain() {
    if (draining.current || !canQueue()) return;
    draining.current = true;
    try {
      const { refused, left } = await flush((op: Op, blob?: Blob) =>
        op.kind === "tick"
          ? tickItem({ error: null }, sendable(op))
          : sendProof(op, blob!),
      );
      setOutstanding(left.total);
      setHeldProof(left.proof);
      // A refusal is the one thing worth interrupting for. The work is gone
      // and the person who did it is the only one who can decide what now.
      if (refused.length > 0) setShortfall(refused[0]);
    } finally {
      draining.current = false;
    }
  }

  /**
   * A tick goes to the queue, not to the network.
   *
   * The tap has to land whether or not there is signal, because the place the
   * list gets walked is the cellar and the walk-in. Nothing here awaits the
   * server: the row is already ticked on screen by the time this runs, the
   * write is durable in the browser before this returns, and the sending is
   * somebody else's problem a few lines down.
   *
   * Falls back to the old direct call where IndexedDB is missing, which is
   * private windows on some browsers. Worse behaviour offline, same behaviour
   * on.
   */
  async function persistTick(item: CloseItem, on: boolean) {
    const op: TickOp = {
      kind: "tick",
      key: tickKey(slug, item.id ?? ""),
      slug,
      itemId: item.id ?? "",
      initials: initialsFor(item.number),
      on,
      clientAt: new Date().toISOString(),
    };

    if (!canQueue()) {
      setSaving(true);
      const result = await tickItem({ error: null }, sendable(op));
      setSaving(false);
      if (result.error) setShortfall(result.error);
      return;
    }

    await enqueue(op);
    const held = await pendingWork();
    setOutstanding(held.total);
    setHeldProof(held.proof);
    void drain();
  }

  /** Marks the moment, so the next poll defers to this device. */
  function touch() {
    justTouched.current = true;
    if (quiet.current !== null) window.clearTimeout(quiet.current);
    quiet.current = window.setTimeout(() => {
      justTouched.current = false;
    }, 4_000);
  }

  function toggle(item: CloseItem) {
    if (locked) return;
    touch();
    if (done[item.number]) {
      setDone((c) => ({ ...c, [item.number]: false }));
      if (item.proof) {
        setCaptures((c) => {
          const next = { ...c };
          item.proof!.forEach(
            (_, index) => delete next[slotKey(item.number, index)],
          );
          return next;
        });
        setNotes((c) => {
          const next = { ...c };
          item.proof!.forEach(
            (_, index) => delete next[slotKey(item.number, index)],
          );
          return next;
        });
      }
      void persistTick(item, false);
      return;
    }

    // Evidence is the check. Tapping the card jumps to the first shot still
    // outstanding rather than ticking anything.
    //
    // Before the initials gate, deliberately. Asking for a signature before
    // the camera would open meant the order was sign, then do — backwards, and
    // the exact habit this is meant to break. Do the job, then put your name
    // to it. Nothing is marked done unsigned either way: the gate below still
    // stands between the last shot and the tick.
    //
    // Length, not truthiness: an empty array is truthy, and this branch then
    // reached for shot zero of a list with no shots and threw inside a click
    // handler — so the card did nothing, forever, without saying so. Normalised
    // on the way in and on the way out now, but checked here too, because the
    // failure was silent and the next one should not be.
    if (item.proof && item.proof.length > 0) {
      const at = item.proof.findIndex(
        (shot, index) => !shotFilled(item.number, index, shot.kind),
      );
      // Only when something is still outstanding. This used to clamp -1 to 0,
      // so an item with every shot already in reopened the camera on the first
      // one instead of letting the tap be the signature — and the clamp is
      // what turned an empty proof list into a crash.
      if (at >= 0) {
        const key = slotKey(item.number, at);
        if (item.proof[at].kind === "note") notesRefs.current[key]?.focus();
        else inputs.current[key]?.click();
        return;
      }
    }

    // Nothing left to collect, so this tap is the signature.
    if (!haveInitials(item.number)) return;

    setDone((c) => ({ ...c, [item.number]: true }));
    void persistTick(item, true);
  }

  /**
   * Bring back the previews for captures still sitting on this device.
   *
   * The server's copy of the night knows nothing about a photograph that has
   * not gone up yet, so after a reload the thumbnail would be missing and the
   * shot would read as never taken — which is how somebody takes it twice, or
   * decides the camera is broken. The bytes are here; this points the image
   * back at them.
   */
  async function rehydrate() {
    if (!canQueue()) return;
    const held = await queued();
    for (const op of held) {
      if (op.kind !== "proof" || op.slug !== slug) continue;
      const item = items.find((row) => row.id === op.itemId);
      if (!item) continue;
      const blob = await blobFor(op.key);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      objectUrls.current.push(url);
      setCaptures((current) => ({
        ...current,
        [slotKey(item.number, op.shotIndex)]: { url, kind: op.shot },
      }));
    }
  }

  /**
   * A capture lands on the device, then goes up on its own.
   *
   * It used to hold the whole three-step upload open before the thumbnail
   * appeared: signed URL, bytes, row. On a good connection that is a second
   * of nothing happening, and on a bad one it is the shot being lost. Now the
   * bytes are safe here before this returns and the sending is the drain's
   * problem, so the picture appears immediately and a cellar with no signal
   * behaves exactly like a bar with five bars.
   *
   * That also means the tick gate can close on time. An item owing a
   * photograph cannot be hand-ticked, and the thing that satisfies the gate is
   * a capture being present — which is now true the moment it is taken rather
   * than whenever the network gets round to it.
   */
  async function onCapture(
    item: CloseItem,
    shotIndex: number,
    file: File | undefined,
  ) {
    if (locked || !file || !item.proof) return;
    const kind = item.proof[shotIndex].kind;
    if (kind === "note") return;

    touch();
    setSaving(true);

    let upload: Blob = file;
    if (kind === "photo") {
      try {
        upload = await compressToJpeg(file);
      } catch (error) {
        setSaving(false);
        setShortfall(decodeMessage(error));
        return;
      }
    }

    const op: ProofOp = {
      kind: "proof",
      key: proofKey(slug, item.id ?? "", shotIndex),
      slug,
      itemId: item.id ?? "",
      shotIndex,
      shot: kind,
      extension: kind === "video" ? (file.name.split(".").pop() ?? "") : "",
      initials: initialsFor(item.number),
      bytes: upload.size,
      clientAt: new Date().toISOString(),
    };

    if (canQueue()) {
      const stored = await enqueueProof(op, upload);
      if (stored.error) {
        setSaving(false);
        setShortfall(stored.error);
        return;
      }
    } else {
      // No store to keep it in, so it goes now or not at all.
      try {
        const result = await sendProof(op, upload);
        if (result.error) {
          setSaving(false);
          setShortfall(result.error);
          return;
        }
      } catch {
        setSaving(false);
        setShortfall("Could not upload that. Check your signal and try again.");
        return;
      }
    }

    const url = URL.createObjectURL(upload);
    objectUrls.current.push(url);
    const shotKey = slotKey(item.number, shotIndex);
    setCaptures((current) => ({ ...current, [shotKey]: { url, kind } }));
    setSaving(false);

    if (canQueue()) {
      const held = await pendingWork();
      setOutstanding(held.total);
      setHeldProof(held.proof);
      void drain();
    }

    // Worked out here rather than inside the updater. A state updater has to
    // be a pure function of what it is given — React is free to run it twice —
    // and the old version reached for the camera's focus and fired a save from
    // inside one.
    const all = item.proof.every((shot, index) =>
      shot.kind === "note"
        ? Boolean(notes[slotKey(item.number, index)]?.trim())
        : index === shotIndex || Boolean(captures[slotKey(item.number, index)]),
    );
    // The last shot is in. Now the signature — and if it is not there yet, ask
    // for it rather than leaving a finished job looking unfinished.
    if (all && haveInitials(item.number)) {
      setDone((c) => ({ ...c, [item.number]: true }));
      void persistTick(item, true);
    }
  }

  function certify() {
    if (locked) return;
    const missing: string[] = [];
    if (!certifier.trim()) missing.push("your name");
    if (!signed || !signatureRef.current) missing.push("your signature");
    if (missing.length > 0) {
      setShortfall(`Still needed: ${missing.join(" and ")}.`);
      return;
    }
    // The one gate. Signing with items open is the design; signing a night
    // nobody touched is almost certainly a mistake.
    if (untouched && !confirmingEmpty) {
      setShortfall(null);
      setConfirmingEmpty(true);
      return;
    }
    setShortfall(null);
    setConfirmingEmpty(false);
    void (async () => {
      const data = new FormData();
      data.set("slug", slug);
      data.set("certifiedBy", certifier.trim());
      data.set("attestation", attestationText);
      data.set("signature", signatureRef.current ?? "");
      data.set(
        "openAtSigning",
        JSON.stringify(openItems.map((i) => `${i.number} · ${i.title}`)),
      );
      setSaving(true);
      const r = await certifyNight({ error: null }, data);
      setSaving(false);
      if (r.error) {
        setShortfall(r.error);
        setCertified(null);
      }
    })();
    setCertified(
      // "all ten" was written when there was one hard-coded ten-line list.
      // A venue writes its own now, and a six-line list was being told it had
      // finished ten.
      doneCount === CLOSE_TOTAL
        ? `Certified · all ${CLOSE_TOTAL}`
        : `Certified · ${doneCount} of ${CLOSE_TOTAL}, ${CLOSE_TOTAL - doneCount} left open`,
    );
  }

  /**
   * Back to a working night. The ticks and the proof stay — reopening exists
   * because one thing was wrong, and making everyone redo the other nine is
   * how you teach a crew to sign first and check later.
   */
  async function reopen() {
    const data = new FormData();
    data.set("slug", slug);
    data.set("pin", reopenPin);
    data.set("reason", reopenReason);
    setSaving(true);
    const result = await reopenNight({ error: null }, data);
    setSaving(false);
    if (result.error) {
      setReopenError(result.error);
      return;
    }
    setReopenError(null);
    setReopenPin("");
    setReopenReason("");
    setCertified(null);
    setSigned(false);
    setCertifier("");
    signatureRef.current = null;
    // Local state unlocks the page immediately; the refresh is what brings
    // back the history the server just wrote. Without it the night reopens
    // and shows no sign it was ever signed, which is the opposite of the
    // point.
    router.refresh();
  }

  const who = certifier.trim() ? `I, ${certifier.trim()},` : "I";
  const attestationText =
    doneCount === CLOSE_TOTAL
      ? `${who} have completed every item on tonight's close. The venue is secured and ready for the opening team. I hold myself accountable for this team's work tonight.`
      : `${who} have completed ${doneCount} of the ${CLOSE_TOTAL} items on tonight's close, and I am signing with the following still open. I hold myself accountable for this team's work tonight, including what I am leaving open.`;
  /** Signed is finished. Nothing about the night moves after it is certified. */
  const locked = certified !== null;

  return (
    <div className="space-y-3">
      {/* Compact and pinned: it is on screen the whole way down, and the
          bottom of a phone belongs to the back/out bar. */}
      {locked ? (
        <section className="panel border-ink bg-ink text-paper px-4 py-3">
          <p className="text-title tracking-[0.08em]">{certified}</p>
          <p className="text-label mt-1 tracking-[0.08em] opacity-70">
            Closed out and locked. Nothing on this night can change now.
          </p>

          {/* Behind a disclosure, not a button on the banner. Reopening a
              signed night should take a decision, and the person who needs it
              will find it — the person who does not should not trip over it. */}
          <details className="mt-3">
            <summary className="text-label inline-flex min-h-11 cursor-pointer items-center tracking-[0.08em] underline underline-offset-4 opacity-70">
              Reopen with a manager PIN
            </summary>

            <div className="mt-3 space-y-3">
              <p className="text-label leading-relaxed tracking-[0.08em] opacity-70">
                The signature already on this night is kept. The record will
                show it was certified, reopened, and certified again.
              </p>
              <input
                className="field bg-paper/10 border-paper/25 text-paper placeholder:text-paper/40"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Manager PIN"
                type="password"
                value={reopenPin}
                onChange={(event) => setReopenPin(event.target.value)}
              />
              <input
                className="field bg-paper/10 border-paper/25 text-paper placeholder:text-paper/40"
                autoComplete="off"
                placeholder="Why (optional, kept with the record)"
                value={reopenReason}
                onChange={(event) => setReopenReason(event.target.value)}
              />
              {reopenError ? (
                <p role="alert" className="text-body text-warn">
                  {reopenError}
                </p>
              ) : null}
              <button
                type="button"
                className="bg-warn text-on-warn inline-flex min-h-11 items-center rounded px-4 text-body tracking-[0.08em]"
                disabled={saving}
                onClick={() => void reopen()}
              >
                {saving ? "Unlocking…" : "Unlock this night"}
              </button>
            </div>
          </details>
        </section>
      ) : null}

      {/* Says the tick is safe, which is the only thing anybody wants to know
          when the signal drops mid-list. Silence would read as the taps not
          landing, and somebody who thinks they lost six ticks starts again on
          paper. Nothing here is an error: a queued tick is stored on the
          device and goes up on its own. */}
      {outstanding > 0 || offline ? (
        <p
          className="bg-warn text-on-warn -mx-4 mb-1 px-4 py-2 text-label tracking-[0.08em]"
          role="status"
        >
          {outstanding > 0
            ? `${describeHeld(outstanding - heldProof, heldProof)} saved on this device${
                offline
                  ? " · no signal, it goes up when it returns"
                  : " · sending"
              }`
            : "No signal. Keep going, everything is saved here."}
        </p>
      ) : null}

      <section className="border-card-border bg-paper sticky top-0 z-30 -mx-4 mb-1 border-b px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-title tabular-nums tracking-[0.08em]">
            {doneCount}/{CLOSE_TOTAL} done
          </p>
          <p className="label">
            {[
              PHOTO_SHOTS ? `${PHOTO_SHOTS} photos` : null,
              VIDEO_SHOTS ? `${VIDEO_SHOTS} video` : null,
              NOTE_SHOTS ? `${NOTE_SHOTS} written` : null,
              "nothing is timed",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {/* One block per item, in order, showing which are open rather than how
            many. Filled left to right it read as a progress bar and item 7
            being the one nobody ever does was invisible. */}
        <div className="mt-2.5 flex gap-[3px]" aria-hidden>
          {CLOSE_CHECKLIST.map((item) => (
            <span
              key={item.number}
              className={`h-1.5 flex-1 rounded-[1px] ${
                done[item.number] ? "bg-ink" : "bg-warn/50"
              }`}
            />
          ))}
        </div>

        {/* Named, in the header, the whole way down the page. It was only in
            the panel at the bottom, which means you saw what you had missed
            after you had decided you were finished. */}
        {openItems.length > 0 ? (
          <p className="text-warn mt-2 text-[12px] leading-snug tracking-[0.08em]">
            <span className="opacity-70">Still open</span>{" "}
            {openItems.map((item) => item.number).join(" · ")}
          </p>
        ) : null}
      </section>

      <ul className="space-y-3">
        {CLOSE_CHECKLIST.map((item, index) => {
          const isDone = Boolean(done[item.number]);
          const shots = item.proof ?? [];
          const taken = shotsTaken(item);

          const mine = initialsFor(item.number);
          const wanted = initialsWanted === item.number && !mine.trim();

          /**
           * A heading, when this item starts a new run of one.
           *
           * Compared against the item before it rather than grouped into
           * buckets: the list is already in the order somebody walks it, and
           * bucketing would quietly reorder a list to suit its headings. A
           * heading that appears twice down the page is a list that says so.
           */
          const heading =
            item.section && item.section !== CLOSE_CHECKLIST[index - 1]?.section
              ? item.section
              : null;
          // How much of this run is done, because "FIRST CUTS 4/9" is the
          // question the person under that heading is actually asking.
          const run = heading
            ? CLOSE_CHECKLIST.filter((other) => other.section === item.section)
            : [];
          const runDone = run.filter((other) => done[other.number]).length;

          return (
            <li key={item.number} className="panel p-0">
              {heading ? (
                <p className="label border-divider text-warn flex items-baseline justify-between gap-3 border-b px-4 py-2.5">
                  <span className="break-words">{heading}</span>
                  <span className="shrink-0 tabular-nums">
                    {runDone}/{run.length}
                  </span>
                </p>
              ) : null}
              {/* Stacked on a phone, side by side from sm up.
                  The initials box is 88px of a 358px card, and beside a 28px
                  checkbox it left about 180px for the title — "Full close
                  restroom walkthrough" in four words a line. On a phone the
                  box drops to its own row under the task and the title gets
                  the whole width; on a tablet there is room for both and the
                  column of boxes is worth keeping. */}
              <div className="flex flex-col items-stretch sm:flex-row sm:items-start">
                <button
                  type="button"
                  onPointerDown={() => {
                    byPointer.current = true;
                  }}
                  onClick={(event) => {
                    toggle(item);
                    // Keyboard focus keeps its ring; a tap does not leave one
                    // behind on the card it just acted on.
                    if (byPointer.current) event.currentTarget.blur();
                    byPointer.current = false;
                  }}
                  aria-pressed={isDone}
                  className="flex w-full items-start gap-3.5 p-4 pb-2 text-left sm:pb-4"
                >
                  <span
                    aria-hidden
                    className={`mt-px grid size-7 shrink-0 place-items-center rounded border ${
                      isDone ? "bg-ink border-ink" : "border-muted"
                    }`}
                  >
                    {isDone ? (
                      <span className="text-paper text-sm leading-none">✓</span>
                    ) : null}
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <span className="label shrink-0 tabular-nums">
                        {item.number}
                      </span>
                      {/* Title stays white when checked — the card records what
                        was done, and a greyed title reads as cancelled. */}
                      <span className="text-title leading-tight tracking-[0.08em] break-words">
                        {item.title}
                      </span>
                      {/* Says how many, because three separate photographs is a
                        different job from one and a MOD scanning the list
                        should see that before opening the card. */}
                      {shots.length > 0 ? (
                        <span className="text-muted ring-muted/60 inline-flex h-[22px] shrink-0 items-center rounded px-2 text-label tracking-[0.08em] ring-1 ring-inset">
                          {shots.length > 1
                            ? `${taken}/${shots.length} ${shots[0].kind === "video" ? "videos" : "photos"}`
                            : shots[0].kind === "video"
                              ? "Video"
                              : shots[0].kind === "note"
                                ? "Written"
                                : "Photo"}
                        </span>
                      ) : null}
                    </span>

                    {/* Caps throughout — house style, no exceptions. Bulleted
                      when there is more than one line. */}
                    {item.detail.length === 1 ? (
                      <span
                        className={`text-[14px] leading-relaxed ${
                          isDone ? "text-ink/40" : "text-ink/65"
                        }`}
                      >
                        {item.detail[0]}
                      </span>
                    ) : (
                      <span
                        className={`flex flex-col gap-1 text-[13px] leading-snug ${
                          isDone ? "text-ink/40" : "text-ink/65"
                        }`}
                      >
                        {item.detail.map((line) => (
                          <span
                            key={line}
                            className="relative break-words pl-3.5 before:absolute before:top-[0.62em] before:left-0 before:h-px before:w-1.5 before:bg-current"
                          >
                            {line}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>

                {/* Not inside the button — an input cannot live in one — so it
                  sits beside it on a tablet and below it on a phone.

                  The whole cell lights up until it is filled, rather than a
                  stripe on the box: the thing being asked for is the area, and
                  a border on a dark field is easy to miss. On sm and up it is
                  a fixed width so the boxes hold a column whether or not the
                  prompt shows. */}
                <span
                  className={`mx-3 mb-3 flex shrink-0 items-center justify-end gap-3 rounded-lg px-2 py-1.5 sm:m-2 sm:w-[5.5rem] sm:flex-col sm:justify-start sm:gap-2 sm:px-0 sm:py-2 ${
                    wanted ? "bg-warn/15 ring-warn/50 ring-1" : ""
                  }`}
                >
                  <input
                    ref={(node) => {
                      initialsRefs.current[item.number] = node;
                    }}
                    className="field order-2 h-11 min-h-0 w-16 px-1.5 text-center tracking-[0.1em] sm:order-1"
                    placeholder="––"
                    maxLength={4}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={mine}
                    disabled={isDone || locked}
                    aria-label={`Initials for ${item.title}`}
                    onChange={(event) => {
                      setRowInitials((c) => ({
                        ...c,
                        [item.number]: event.target.value,
                      }));
                      if (event.target.value.trim()) setInitialsWanted(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                    onBlur={() => {
                      // Tapped first, initialled second — finish what the tap
                      // started rather than making them tap the card again.
                      if (
                        pending === item.number &&
                        initialsFor(item.number).trim()
                      ) {
                        setPending(null);
                        toggle(item);
                      }
                    }}
                  />
                  {/* Left of the box on a phone, under it on a tablet — either
                    way it reads into the thing it is asking for. */}
                  {/* Always labelled, not only once it is being asked for.
                    An unlabelled box with a "––" placeholder is a box nobody
                    knows the purpose of until the app tells them off, and now
                    that the signature comes after the work rather than
                    gatekeeping it, this is the control that finishes a line. */}
                  <span
                    className={`label order-1 text-center sm:order-2 ${
                      wanted ? "text-warn" : "text-muted"
                    }`}
                  >
                    {wanted ? "Initial it" : "Initials"}
                  </span>
                </span>
              </div>

              {/* What right looks like, above what the item owes.

                  Deliberately in that order: this is the thing you look at
                  before you start, and the capture controls are the thing you
                  reach for after. It reads as a strip of small pictures rather
                  than a gallery — a MOD wants to check the well against the
                  photo, not browse. Tapping one opens it full size.

                  A named shot nobody has photographed yet still shows. It says
                  what the standard is in words, which is where every one of
                  these started. */}
              {item.reference && item.reference.length > 0 ? (
                <div className="border-divider border-t px-4 py-4 sm:pl-[3.6rem]">
                  <p className="label mb-2.5">What right looks like</p>
                  <ul className="flex flex-wrap gap-3">
                    {item.reference.map((ref, index) => {
                      const url = ref.path
                        ? referenceUrls[ref.path]
                        : undefined;
                      return (
                        <li key={index} className="w-[8.5rem]">
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={ref.caption}
                                className="bg-inset h-24 w-full rounded object-cover"
                              />
                            </a>
                          ) : (
                            <span className="bg-inset label text-muted flex h-24 w-full items-center justify-center rounded px-2 text-center">
                              No photo yet
                            </span>
                          )}
                          <span className="text-ink/65 mt-1.5 block text-[12px] leading-snug break-words">
                            {ref.caption}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {/* One control per shot. Two things that both need proving are
                  rarely in the same place, so each names what it has to show
                  and is taken on its own. */}
              {shots.length > 0 ? (
                <div className="border-divider space-y-3.5 border-t px-4 py-5 sm:pl-[3.6rem]">
                  {shots.map((shot, index) => {
                    const key = slotKey(item.number, index);
                    const got = captures[key];
                    return (
                      <div
                        key={key}
                        className="flex flex-wrap items-start gap-x-3 gap-y-2"
                      >
                        <input
                          ref={(node) => {
                            inputs.current[key] = node;
                          }}
                          type="file"
                          accept={shot.kind === "video" ? "video/*" : "image/*"}
                          capture="environment"
                          className="sr-only"
                          onChange={(event) =>
                            onCapture(item, index, event.target.files?.[0])
                          }
                        />

                        {locked && !got && shot.kind !== "note" ? (
                          <p className="label text-muted">Not captured</p>
                        ) : shot.kind === "note" ? (
                          <div className="w-full">
                            <textarea
                              ref={(node) => {
                                notesRefs.current[key] = node;
                              }}
                              rows={3}
                              className="field w-full resize-none"
                              disabled={locked}
                              placeholder="What was said"
                              value={notes[key] ?? ""}
                              onChange={(event) => {
                                const text = event.target.value;
                                touch();
                                setNotes((c) => ({ ...c, [key]: text }));
                                // Written words are the capture. Completing the
                                // last shot completes the item, same as a photo.
                                const all = shots.every((other, otherIndex) =>
                                  otherIndex === index
                                    ? Boolean(text.trim())
                                    : shotFilled(
                                        item.number,
                                        otherIndex,
                                        other.kind,
                                      ),
                                );
                                if (all && initialsFor(item.number).trim()) {
                                  setDone((c) => ({
                                    ...c,
                                    [item.number]: true,
                                  }));
                                } else if (!all) {
                                  setDone((c) => ({
                                    ...c,
                                    [item.number]: false,
                                  }));
                                }
                              }}
                              aria-label={shot.prompt}
                              onBlur={async () => {
                                const data = new FormData();
                                data.set("slug", slug);
                                data.set("itemId", item.id ?? "");
                                data.set("shotIndex", String(index));
                                data.set("initials", initialsFor(item.number));
                                data.set("body", notes[key] ?? "");
                                setSaving(true);
                                const r = await saveNote({ error: null }, data);
                                setSaving(false);
                                if (r.error) {
                                  setShortfall(r.error);
                                  return;
                                }
                                const all = shots.every((other, otherIndex) =>
                                  otherIndex === index
                                    ? Boolean((notes[key] ?? "").trim())
                                    : shotFilled(
                                        item.number,
                                        otherIndex,
                                        other.kind,
                                      ),
                                );
                                // Written, but not yet signed for. Ask, rather
                                // than firing a save the server will refuse.
                                if (all && haveInitials(item.number)) {
                                  void persistTick(item, true);
                                }
                              }}
                            />
                          </div>
                        ) : got ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="pill pill-done">
                              {shot.kind === "video" ? "Recorded" : "Taken"}
                            </span>
                            {locked ? null : (
                              <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => inputs.current[key]?.click()}
                              >
                                Retake
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            // No initials gate. Take the photo first; the
                            // signature is asked for once the work is in.
                            onClick={() => inputs.current[key]?.click()}
                            className="bg-warn text-on-warn inline-flex min-h-11 items-center gap-2.5 rounded px-4 text-body tracking-[0.08em]"
                          >
                            <CaptureGlyph kind={shot.kind} />
                            {shot.kind === "video" ? "Record" : "Photograph"}
                          </button>
                        )}

                        {/* Beside the control, not under it. The spec is the
                            mechanism, so it keeps its width; putting it on the
                            same line as the button is what stops three shots
                            from costing half a screen. */}
                        <p className="text-ink/50 min-w-0 flex-1 self-center text-[12px] leading-snug">
                          {shot.prompt}
                        </p>

                        {got && shot.kind !== "note" ? (
                          <div className="w-full">
                            {got.kind === "video" ? (
                              <video
                                src={got.url}
                                controls
                                playsInline
                                className="bg-inset max-h-72 w-full rounded-lg"
                              />
                            ) : (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={got.url}
                                alt=""
                                className="bg-inset max-h-72 w-full rounded-lg object-contain"
                              />
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <section className="panel mt-5">
        <p className={openItems.length > 0 ? "label text-warn" : "label"}>
          {openItems.length > 0
            ? `Still open · ${openItems.length}`
            : `All ${CLOSE_TOTAL} complete`}
        </p>

        {/* A reopened night says so, on its face. The record is only worth
            keeping if somebody can read it without database access — and a
            second signature with no sign of the first is exactly the thing
            this was built to avoid. */}
        {saved.history.length > 0 ? (
          <div className="border-warn/40 mt-3 rounded-[8px] border p-4">
            <p className="label text-warn">
              Reopened{" "}
              {saved.history.length === 1
                ? "once"
                : `${saved.history.length} times`}
            </p>
            <ul className="mt-2 space-y-1.5">
              {saved.history.map((entry, index) => (
                <li key={index} className="label leading-snug">
                  Certified by {entry.certifiedBy ?? "—"}
                  {entry.certifiedAt
                    ? ` at ${new Date(entry.certifiedAt).toLocaleTimeString(
                        "en-US",
                        {
                          timeZone: "America/Los_Angeles",
                          hour: "numeric",
                          minute: "2-digit",
                        },
                      )}`
                    : ""}
                  {entry.reason ? ` · ${entry.reason}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Everything below is the signature. Held back until the work is
            done, the night is already a record, or somebody deliberately asks
            for it. */}
        {openItems.length === 0 || locked || signingOpen ? (
          <>
            <div className="border-ink mt-2.5 border-l-2 pl-4">
              <p className="attest">{attestationText}</p>
              {openItems.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {openItems.map((item) => (
                    /* Hanging indent: a wrapped title lines up under the title,
                   not under the number. */
                    <li
                      key={item.number}
                      className="text-warn text-label leading-snug tracking-[0.08em] break-words pl-7 -indent-7"
                    >
                      {item.number} · {item.title}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <label className="label" htmlFor="certifier">
                  MOD certifying (required)
                </label>
                <input
                  id="certifier"
                  className="field"
                  placeholder="Your name"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={certifier}
                  disabled={locked}
                  onChange={(event) => setCertifier(event.target.value)}
                />
              </div>

              <SignaturePad
                signed={signed}
                onSignedChange={setSigned}
                locked={locked}
                onInk={(dataUrl) => {
                  signatureRef.current = dataUrl;
                }}
              />

              {shortfall ? (
                <p role="alert" className="text-body text-warn">
                  {shortfall}
                </p>
              ) : null}

              {confirmingEmpty ? (
                <div className="border-warn/40 rounded-[8px] border p-4">
                  <p className="note text-warn">
                    Nothing was checked tonight. Sign anyway?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={certify}
                    >
                      Yes, sign it
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setConfirmingEmpty(false)}
                    >
                      Go back
                    </button>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                className="btn w-full"
                onClick={certify}
                disabled={locked || saving}
              >
                {saving
                  ? "Saving…"
                  : (certified ??
                    (doneCount === CLOSE_TOTAL
                      ? "Certify this close"
                      : `Certify with ${CLOSE_TOTAL - doneCount} open`))}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="btn-ghost mt-4"
            onClick={() => setSigningOpen(true)}
          >
            Sign with {openItems.length} open
          </button>
        )}
      </section>
    </div>
  );
}

function CaptureGlyph({ kind }: { kind: "photo" | "video" }) {
  return (
    <span
      aria-hidden
      className="relative h-[13px] w-4 shrink-0 rounded-[2px] border border-current"
    >
      <span
        className={`absolute inset-[3px] border border-current ${
          kind === "video" ? "rounded-full bg-current" : "rounded-full"
        }`}
      />
    </span>
  );
}

/** Drawn with a finger, kept with the night. */
function SignaturePad({
  signed,
  onSignedChange,
  locked,
  onInk,
}: {
  signed: boolean;
  onSignedChange: (value: boolean) => void;
  locked: boolean;
  onInk: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<{ x: number; y: number }[][]>([]);
  const drawing = useRef(false);

  function paint() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(rect.width * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--ink")
      .trim();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (const point of stroke.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  }

  useEffect(() => {
    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  });

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label">Signature (required)</p>
        {locked ? null : (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              strokes.current = [];
              onSignedChange(false);
              paint();
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div className="bg-panel border-card-border relative touch-none overflow-hidden rounded-lg border">
        <canvas
          ref={canvasRef}
          className="block h-40 w-full"
          onPointerDown={(event) => {
            if (locked) return;
            drawing.current = true;
            onSignedChange(true);
            strokes.current.push([pointFrom(event)]);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            strokes.current[strokes.current.length - 1]?.push(pointFrom(event));
            paint();
          }}
          onPointerUp={(event) => {
            drawing.current = false;
            onInk(event.currentTarget.toDataURL("image/png"));
          }}
          onPointerCancel={(event) => {
            drawing.current = false;
            onInk(event.currentTarget.toDataURL("image/png"));
          }}
          onPointerLeave={(event) => {
            if (!drawing.current) return;
            drawing.current = false;
            onInk(event.currentTarget.toDataURL("image/png"));
          }}
        />
        {!signed ? (
          <div className="label pointer-events-none absolute inset-0 grid place-items-center">
            Sign here with your finger
          </div>
        ) : null}
      </div>
      <p className="label">
        Kept with the night&apos;s record, alongside what was open when you
        signed.
      </p>
    </div>
  );
}
