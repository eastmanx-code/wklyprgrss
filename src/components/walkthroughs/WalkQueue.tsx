"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { canQueue, flushWalk, pendingWalk } from "@/lib/outbox";
import { onWalkDrain, sendWalkPhoto } from "@/lib/walk-send";

/**
 * The one owner of the walkthrough photo queue, mounted once per board.
 *
 * The cards enqueue; this drains. Keeping the drain in a single place is the
 * whole point: a drain per card would mean twenty timers on a twenty-item board
 * all draining the same queue at once, racing to send and drop the same photo
 * and each seeing only half of what happened. One drainer sends serially, tells
 * the truth once, and shows what is still held and what could not be saved for
 * the board rather than for any one row.
 *
 * It drains on load, when the connection comes back, whenever a card nudges it
 * after queuing a photo, and every thirty seconds while anything is waiting.
 */
export function WalkQueue() {
  const router = useRouter();
  const [waiting, setWaiting] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const draining = useRef(false);

  useEffect(() => {
    async function drain() {
      if (draining.current || !canQueue()) return;
      draining.current = true;
      try {
        const { sent, refused, lost, left } = await flushWalk(sendWalkPhoto);
        setWaiting(left);
        if (refused.length > 0) setProblem(refused[0].error);
        else if (lost.length > 0) {
          setProblem(
            lost.length === 1
              ? "One photo did not save and has to be added again."
              : `${lost.length} photos did not save and have to be added again.`,
          );
        } else setProblem(null);
        // A photo that landed is a row the server renders, so pull the board in.
        if (sent > 0) router.refresh();
      } finally {
        draining.current = false;
      }
    }

    void (async () => {
      setWaiting(await pendingWalk());
      await drain();
    })();
    const off = onWalkDrain(() => void drain());
    const onOnline = () => void drain();
    window.addEventListener("online", onOnline);
    const iv = window.setInterval(() => void drain(), 30_000);
    return () => {
      off();
      window.removeEventListener("online", onOnline);
      window.clearInterval(iv);
    };
    // Mounted once. drain reads the ref and the setters, all stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (waiting === 0 && !problem) return null;

  return (
    <div className="bg-inset ring-card-border mb-4 space-y-1 rounded-[6px] p-3 ring-1">
      {waiting > 0 ? (
        <p className="label">
          {waiting === 1
            ? "1 photo waiting to upload"
            : `${waiting} photos waiting to upload`}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-body text-warn">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
