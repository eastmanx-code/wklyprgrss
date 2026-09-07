import { Card } from "@/components/Card";
import { Dial } from "@/components/Dial";
import { Trend } from "@/components/Trend";

/**
 * The shape behind the night: the ring, the run, and the two ends of the
 * field.
 *
 * The weekly board's own furniture, asked of nights instead of weeks. It sits
 * on both close reports — the locations screen a manager lands on and the
 * full report one tap in — the same way the board carries a ring on the
 * company dashboard and again on each venue.
 *
 * Every piece hides rather than drawing an empty version of itself. A line
 * needs two nights before it means anything and best against worst needs two
 * venues, or it is the same row printed twice. Today that leaves a ring at one
 * per cent and a sentence saying the run starts from the second night, which
 * is the truth and looks like it.
 */
export function RunCard({
  ticked,
  owed,
  nights,
  points,
  failed,
  labelLeft,
  labelRight,
  best,
  worst,
}: {
  ticked: number;
  owed: number;
  nights: number;
  points: { weekStart: string; percent: number; approvedPercent: number }[];
  /** Whether anything failed, which decides whether the ring is lit. */
  failed: boolean;
  labelLeft: string;
  labelRight: string;
  best: { code: string; score: number } | null;
  worst: { code: string; score: number } | null;
}) {
  const share = owed === 0 ? 0 : Math.round((ticked / owed) * 100);

  return (
    <Card title="The run" hint={`Last ${nights} nights`}>
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[176px_minmax(0,1fr)_auto]">
        <Dial
          percent={share}
          caption={`${ticked} of ${owed} items ticked`}
          tone={failed ? "var(--warn)" : "var(--ink)"}
        />

        {points.length > 1 ? (
          <Trend
            points={points}
            labelLeft={labelLeft}
            labelRight={labelRight}
            target={80}
          />
        ) : (
          <p className="note text-muted self-center leading-relaxed">
            One night of history. The run draws itself from the second.
          </p>
        )}

        {best && worst ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-1">
            <div>
              <p className="label">Best</p>
              <p className="text-title mt-1 tracking-[0.08em]">{best.code}</p>
              <p className="label mt-1 tabular-nums">{best.score}/10</p>
            </div>
            <div>
              <p className="label">Worst</p>
              <p className="text-title text-warn mt-1 tracking-[0.08em]">
                {worst.code}
              </p>
              <p className="label mt-1 tabular-nums">{worst.score}/10</p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
