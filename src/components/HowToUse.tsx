/**
 * Help content, scoped deliberately to uploading. How the work gets sourced,
 * assigned and executed lives in the CH Figma Protocol — repeating it here
 * would just be a second copy to keep in sync.
 */

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="label mt-[5px] w-4 shrink-0">{n}</span>
      <span className="note leading-relaxed">{children}</span>
    </li>
  );
}

function Term({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4">
      <span className="w-20 shrink-0 pt-[2px]">
        <span className="pill pill-pending">{label}</span>
      </span>
      <span className="note leading-relaxed">{children}</span>
    </li>
  );
}

export function LeaderGuide({
  target,
  deadlineLabel,
}: {
  target: number;
  deadlineLabel: string;
}) {
  return (
    <>
      <section className="panel mb-3">
        <h2 className="text-lg font-medium tracking-tight">The rule</h2>
        <p className="note mt-4 leading-relaxed">
          By {deadlineLabel}, all {target} items need a{" "}
          <strong>new photo</strong> and a <strong>new comment</strong>. Nothing
          carries forward. Missing either one fails the item.
        </p>
      </section>

      <section className="panel mb-3">
        <h2 className="text-lg font-medium tracking-tight">Uploading</h2>
        <ol className="mt-5 space-y-4">
          <Step n={1}>Tap a card and take or choose the photo.</Step>
          <Step n={2}>
            Say whether it&apos;s done or needs one more cycle.
          </Step>
          <Step n={3}>Put your name in, and whoever helped you.</Step>
          <Step n={4}>
            Write the comment. Never blank — if it&apos;s done say so, if it
            isn&apos;t say why, if it&apos;s blocked say what&apos;s blocking
            it. &ldquo;Didn&apos;t get to this&rdquo; still counts.
          </Step>
          <Step n={5}>
            Submit. Nothing is overwritten — it adds to the item&apos;s history.
          </Step>
        </ol>
      </section>

      <section className="panel mb-3">
        <h2 className="text-lg font-medium tracking-tight">Badges</h2>
        <ul className="mt-5 space-y-4">
          <Term label="Done">Photo and comment are in for this week.</Term>
          <Term label="Rolling">
            You marked it one more cycle. Counts for this week; the item
            continues.
          </Term>
          <Term label="Pending">
            Nothing uploaded yet. Fails after the deadline.
          </Term>
          <Term label="Redo">
            Sent back. Upload a new photo and comment to clear it.
          </Term>
        </ul>
      </section>

      <section className="panel">
        <h2 className="text-lg font-medium tracking-tight">Everyone&apos;s board</h2>
        <p className="note mt-4 leading-relaxed">
          You can open any other venue and see what they uploaded. One team
          seeing another&apos;s work raises the bar for everyone.
        </p>
      </section>
    </>
  );
}

export function AdminGuide({ deadlineLabel }: { deadlineLabel: string }) {
  return (
    <>
      <section className="panel mb-3">
        <h2 className="text-lg font-medium tracking-tight">Reviewing</h2>
        <ol className="mt-5 space-y-4">
          <Step n={1}>
            Venues sort worst first — failing, then least done. Start at the
            top.
          </Step>
          <Step n={2}>
            Open a venue to see the week as a grid. Approve one at a time, or
            approve the lot.
          </Step>
          <Step n={3}>
            Send back anything with a bad photo. It stops counting and the
            leader sees REDO until they redo it.
          </Step>
          <Step n={4}>
            You can&apos;t approve work marked one more cycle — the leader has
            to call it finished first.
          </Step>
          <Step n={5}>
            Manage venue holds the items, their order and the PIN.
          </Step>
        </ol>
      </section>

      <section className="panel">
        <h2 className="text-lg font-medium tracking-tight">
          Approving doesn&apos;t decide pass or fail
        </h2>
        <p className="note mt-4 leading-relaxed">
          A venue passes by uploading a photo and comment on every item before{" "}
          {deadlineLabel}, whether or not you&apos;ve got to it. Nobody fails
          because you were busy.
        </p>
      </section>
    </>
  );
}
