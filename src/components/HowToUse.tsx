/**
 * The contents of the help page. Written as steps, not features — the crew
 * needs to know what to do, not what the app can do.
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
        <h2 className="text-lg font-medium tracking-tight">Your week</h2>
        <ol className="mt-5 space-y-4">
          <Step n={1}>
            Every week you owe {target} items. Each one needs a new photo
            <strong> and </strong> a new comment — a photo on its own
            doesn&apos;t count.
          </Step>
          <Step n={2}>
            Everything is due {deadlineLabel}. Miss even one item and the whole
            week is marked failed, so don&apos;t leave it all to the last hour.
          </Step>
          <Step n={3}>
            Tap a card, take the photo with your phone, then say whether the job
            is finished or needs another cycle.
          </Step>
          <Step n={4}>
            Put your name in, and the name of anyone who helped you. Then write
            what actually changed this week.
          </Step>
          <Step n={5}>
            The card flips to DONE. Nothing is ever overwritten — submitting
            again just adds to that item&apos;s history.
          </Step>
        </ol>
      </section>

      <section className="panel mb-3">
        <h2 className="text-lg font-medium tracking-tight">What the badges mean</h2>
        <ul className="mt-5 space-y-4">
          <Term label="Done">Photo and comment are in for this week.</Term>
          <Term label="Pending">
            Still owed. It counts against you after the deadline.
          </Term>
          <Term label="Rolling">
            You said it needs another cycle. It counts for this week, but the
            job isn&apos;t finished and can&apos;t be signed off.
          </Term>
          <Term label="Redo">
            Sent back. Take a new photo and write a new comment to clear it.
          </Term>
        </ul>
      </section>

      <section className="panel">
        <h2 className="text-lg font-medium tracking-tight">Everyone&apos;s board</h2>
        <p className="note mt-4 leading-relaxed">
          You can open any other venue and see exactly what they photographed
          and what they wrote. That&apos;s the point — if someone&apos;s walk-in
          looks better than yours, go and see how they did it.
        </p>
      </section>
    </>
  );
}

export function AdminGuide({ deadlineLabel }: { deadlineLabel: string }) {
  return (
    <>
      <section className="panel mb-3">
        <h2 className="text-lg font-medium tracking-tight">Reviewing the week</h2>
        <ol className="mt-5 space-y-4">
          <Step n={1}>
            Venues are sorted worst first — anything failing, then whoever has
            done the least. The top of the list is where to look.
          </Step>
          <Step n={2}>
            Open a venue to see this week as a grid. Approve each item, or
            approve the lot in one go.
          </Step>
          <Step n={3}>
            Send something back if it isn&apos;t good enough. That stops it
            counting for the week and the leader sees REDO until they redo it.
          </Step>
          <Step n={4}>
            You can&apos;t approve work a leader marked &ldquo;one more
            cycle&rdquo; — they have to call it finished first.
          </Step>
          <Step n={5}>
            Manage venue holds the item list, the running order and the PIN.
            Only you can see a PIN, and only after pressing Show.
          </Step>
        </ol>
      </section>

      <section className="panel">
        <h2 className="text-lg font-medium tracking-tight">
          Approving doesn&apos;t decide pass or fail
        </h2>
        <p className="note mt-4 leading-relaxed">
          A venue passes by submitting everything before {deadlineLabel},
          whether or not you&apos;ve got to it. Nobody fails because you were
          busy. Review is about quality, not compliance.
        </p>
      </section>
    </>
  );
}
