"use client";

import { useRef, useState } from "react";

import { carryAllVenues } from "@/app/admin/actions";
import type { House } from "@/lib/types";
import { houseName } from "@/lib/types";

export type HouseCarryCount = {
  house: House;
  /** How many of this house's boards are already carried this week. */
  carried: number;
  /** How many venues owe this house. */
  total: number;
};

/**
 * Carry a whole house's week in one move — for when its grader is out.
 *
 * The mirror of grading all venues, for the opposite situation: nobody can rule
 * on this house this week, so hold every one of its boards rather than let them
 * fail for the grade that cannot happen. Collapsed by default, because it is the
 * exception and not the weekly path.
 */
export function CarryAll({
  weekStart,
  weekLabel,
  houses,
}: {
  weekStart: string;
  weekLabel: string;
  houses: HouseCarryCount[];
}) {
  const [by, setBy] = useState("");
  const [needName, setNeedName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  function requireName(event: React.FormEvent<HTMLFormElement>) {
    if (by.trim()) return;
    event.preventDefault();
    setNeedName(true);
    nameRef.current?.focus();
  }

  const offerable = houses.filter((house) => house.total > 0);
  if (offerable.length === 0) return null;

  return (
    <details className="group col-span-12 mb-2">
      <summary className="label text-muted hover:text-ink inline-flex cursor-pointer list-none items-center gap-2">
        <span className="group-open:hidden">+ </span>
        Grader out this week? Carry a house
      </summary>
      <section className="panel border-warn/30 mt-3">
        <p className="card-title">Carry the week · {weekLabel}</p>
        <p className="note text-muted mt-1 leading-relaxed">
          Holds every board in a house instead of failing it for a grade that
          cannot happen. Each carried board keeps the ten it was filed against,
          so rebuilding next week cannot lose it. Grade it normally when the
          grader is back and the carry lifts.
        </p>

        <div className="mt-4">
          <label htmlFor="carryAllBy" className="label">
            Your name
          </label>
          <input
            id="carryAllBy"
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

        <div className="mt-3 flex flex-wrap gap-2">
          {offerable.map((house) => (
            <form key={house.house} action={carryAllVenues} onSubmit={requireName}>
              <input type="hidden" name="weekStart" value={weekStart} />
              <input type="hidden" name="house" value={house.house} />
              <input type="hidden" name="by" value={by} />
              <button type="submit" className="btn-ghost min-h-11">
                Carry {houseName(house.house).toLowerCase()} · all venues
                {house.carried > 0 ? ` (${house.carried}/${house.total} held)` : ""}
              </button>
            </form>
          ))}
        </div>
      </section>
    </details>
  );
}
