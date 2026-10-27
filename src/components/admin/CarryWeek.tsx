"use client";

import { useRef, useState } from "react";

import { carryWeek, uncarryWeek } from "@/app/admin/actions";
import type { House } from "@/lib/types";
import { houseName } from "@/lib/types";

export type HouseCarry = {
  house: House;
  carriedBy: string | null;
  /** A graded week needs no carry — the grade is the real thing. */
  graded: boolean;
  scored: boolean;
};

/**
 * Carry one venue's week, one house at a time — for when that house's grader
 * could not rule on it in time.
 *
 * Held, not failed: the board keeps the ten it was filed against and shows its
 * score with a "carried" tag until someone grades it. Collapsed by default,
 * since a normal week is graded, not carried.
 */
export function CarryWeek({
  venueId,
  weekStart,
  weekLabel,
  houses,
  mine = null,
}: {
  venueId: string;
  weekStart: string;
  weekLabel: string;
  houses: HouseCarry[];
  mine?: House | null;
}) {
  const own = (house: House) => !mine || mine === house;
  const [by, setBy] = useState("");
  const [needName, setNeedName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  function requireName(event: React.FormEvent<HTMLFormElement>) {
    if (by.trim()) return;
    event.preventDefault();
    setNeedName(true);
    nameRef.current?.focus();
  }

  // A house only shows here when it is this admin's to act on and not already
  // graded. If none qualify and nothing is carried, the panel stays away.
  const offerable = houses.filter(
    (house) => own(house.house) && !house.graded,
  );
  const anyCarried = houses.some((house) => house.carriedBy);
  if (offerable.length === 0 && !anyCarried) return null;

  const needName_ = offerable.some((house) => !house.carriedBy);

  return (
    <details className="group mb-6">
      <summary className="label text-muted hover:text-ink inline-flex cursor-pointer list-none items-center gap-2">
        <span className="group-open:hidden">+ </span>
        {anyCarried ? "Carried this week" : "Carry this week"}
      </summary>
      <section className="panel border-warn/30 mt-3">
        <p className="card-title">Carry the week · {weekLabel}</p>
        <p className="note text-muted mt-1 leading-relaxed">
          For when a house&apos;s grader is out. The board is held, not failed:
          it keeps the ten it was filed against and shows its score as carried
          until it is graded.
        </p>

        {needName_ ? (
          <div className="mt-4">
            <label htmlFor="carryBy" className="label">
              Your name
            </label>
            <input
              id="carryBy"
              ref={nameRef}
              value={by}
              onChange={(event) => {
                setBy(event.target.value);
                if (needName) setNeedName(false);
              }}
              autoComplete="name"
              className="field mt-1 w-full"
              placeholder="Who is carrying this"
              aria-invalid={needName}
            />
            {needName ? (
              <p role="alert" className="text-body text-warn mt-2">
                Put your name in before you carry. It goes on the record.
              </p>
            ) : null}
          </div>
        ) : null}

        <ul className="mt-4 space-y-2">
          {houses.map((house) => (
            <li
              key={house.house}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p className="note min-w-0">
                {houseName(house.house)}
                {house.scored ? "" : " · practice"}
                {house.graded ? (
                  <span className="text-muted"> · graded</span>
                ) : house.carriedBy ? (
                  <span className="text-muted"> · carried by {house.carriedBy}</span>
                ) : null}
              </p>

              {house.graded || !own(house.house) ? (
                <span className="label shrink-0">
                  {house.graded ? "Graded" : "Not yours"}
                </span>
              ) : house.carriedBy ? (
                <form action={uncarryWeek} className="shrink-0">
                  <input type="hidden" name="venueId" value={venueId} />
                  <input type="hidden" name="weekStart" value={weekStart} />
                  <input type="hidden" name="house" value={house.house} />
                  <button type="submit" className="btn-ghost min-h-11">
                    Lift carry
                  </button>
                </form>
              ) : (
                <form action={carryWeek} onSubmit={requireName} className="shrink-0">
                  <input type="hidden" name="venueId" value={venueId} />
                  <input type="hidden" name="weekStart" value={weekStart} />
                  <input type="hidden" name="house" value={house.house} />
                  <input type="hidden" name="by" value={by} />
                  <button type="submit" className="btn-ghost min-h-11">
                    Carry {houseName(house.house).toLowerCase()}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </details>
  );
}
