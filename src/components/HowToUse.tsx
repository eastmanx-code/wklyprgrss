/**
 * The help page contents, written to match the CH Figma Protocol rather than
 * describing the app's features. The rules here are the protocol's rules: a
 * current photo and a current comment on every item, every week.
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
          By {deadlineLabel}, every active item must have a{" "}
          <strong>current photo</strong> and a <strong>current comment</strong>.
          New week, new photo. New week, new comment. Nothing carries forward
          without being reposted.
        </p>
        <p className="note mt-4 leading-relaxed">
          The fail condition is not that the work wasn&apos;t perfect. The fail
          condition is <strong>no current photo and no current comment</strong>.
          Silence is the only thing that fails you.
        </p>
      </section>

      <section className="panel mb-3">
        <h2 className="text-lg font-medium tracking-tight">Each week</h2>
        <ol className="mt-5 space-y-4">
          <Step n={1}>
            You have {target} items. Every one needs a new photo and a new
            comment before the deadline.
          </Step>
          <Step n={2}>
            Tap a card and take the photo. Same angle as last week where you
            can — that&apos;s what makes the change readable.
          </Step>
          <Step n={3}>
            Say whether it&apos;s done or needs another cycle. That decides
            whether the item closes out or continues into next week.
          </Step>
          <Step n={4}>
            Put your name in, and whoever helped you. The work should have a
            name on it.
          </Step>
          <Step n={5}>
            Write the comment. Never leave it blank — if it&apos;s done and
            good, say that. If it isn&apos;t done, say why. If it&apos;s
            blocked, say what&apos;s blocking it.
          </Step>
        </ol>
      </section>

      <section className="panel mb-3">
        <h2 className="text-lg font-medium tracking-tight">
          If nothing changed, the comment still changes
        </h2>
        <p className="note mt-4 leading-relaxed">
          &ldquo;Didn&apos;t get to this this week&rdquo; or &ldquo;still
          waiting on the carpet cleaner&rdquo; is a real update. It counts,
          because it tells leadership what happened. What doesn&apos;t count is
          saying nothing.
        </p>
      </section>

      <section className="panel mb-3">
        <h2 className="text-lg font-medium tracking-tight">How items roll</h2>
        <ul className="mt-5 space-y-4">
          <Term label="Done">
            The job is finished and good. The item can close out and a new one
            takes its place next week.
          </Term>
          <Term label="Rolling">
            You marked it &ldquo;one more cycle&rdquo;. It counts for this week,
            but the same item continues — repost the photo and comment every
            week until it&apos;s resolved.
          </Term>
          <Term label="Pending">
            Nothing submitted yet. Still owed, and it fails the week after the
            deadline.
          </Term>
          <Term label="Redo">
            Sent back. Usually the photo — bad light, out of focus, doesn&apos;t
            show the work. Take a new one and write a new comment.
          </Term>
        </ul>
      </section>

      <section className="panel">
        <h2 className="text-lg font-medium tracking-tight">Everyone&apos;s board</h2>
        <p className="note mt-4 leading-relaxed">
          You can open any other venue and see exactly what they photographed
          and what they wrote. That&apos;s the point. One team seeing
          another&apos;s work raises the bar for everyone.
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
            Send back anything with a bad photo. One redo and they learn; if
            they don&apos;t, it stopped being a photo problem.
          </Step>
          <Step n={4}>
            You can&apos;t approve work a leader marked &ldquo;one more
            cycle&rdquo; — they have to call it finished first.
          </Step>
          <Step n={5}>
            When an item is done and good, retire it under Manage venue and add
            its replacement. Rolling items stay put and continue.
          </Step>
        </ol>
      </section>

      <section className="panel mb-3">
        <h2 className="text-lg font-medium tracking-tight">
          Approving doesn&apos;t decide pass or fail
        </h2>
        <p className="note mt-4 leading-relaxed">
          A venue passes by getting a current photo and a current comment on
          every item before {deadlineLabel}, whether or not you&apos;ve got to
          it. Nobody fails because you were busy. Review is about quality, not
          compliance.
        </p>
      </section>

      <section className="panel">
        <h2 className="text-lg font-medium tracking-tight">What you should see</h2>
        <p className="note mt-4 leading-relaxed">
          After the deadline you should be able to look once and know what
          changed, what passed, what rolled and what is blocked. If a venue is
          leaving comments blank or reposting the same line, that&apos;s the
          thing to chase — not the tidiness of the work.
        </p>
      </section>
    </>
  );
}
