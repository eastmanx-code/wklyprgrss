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

function Term({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-4">
      <span className="w-20 shrink-0 pt-[2px]">
        <span className="pill pill-pending">{label}</span>
      </span>
      <span className="note leading-relaxed">{children}</span>
    </li>
  );
}

/**
 * The short version, for the sign-in dialog. Deliberately fits on a phone
 * without scrolling — anything that needs scrolling belongs on /help, not in a
 * modal someone has to get past to start work.
 */
export function HowToSummary({
  target,
  deadlineLabel,
}: {
  target: number;
  deadlineLabel: string;
}) {
  return (
    <>
      <p className="note leading-relaxed">
        By {deadlineLabel}, all {target} items need a <strong>new photo</strong>{" "}
        and a <strong>new comment</strong>. Nothing carries forward.
      </p>

      <ol className="mt-4 space-y-2">
        <Step n={1}>Tap a card and take the photo.</Step>
        <Step n={2}>Say if it&apos;s done or needs one more cycle.</Step>
        <Step n={3}>Your name, and whoever helped.</Step>
        <Step n={4}>Write what changed. Never blank.</Step>
      </ol>

      <p className="label mt-4 leading-relaxed">
        Full instructions any time under &ldquo;How to&rdquo;.
      </p>
    </>
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
        <h2 className="text-body font-medium">The rule</h2>
        <p className="note mt-4 leading-relaxed">
          By {deadlineLabel}, all {target} items need a{" "}
          <strong>new photo</strong> and a <strong>new comment</strong>. Nothing
          carries forward. Missing either one fails the item.
        </p>
      </section>

      <section className="panel mb-3">
        <h2 className="text-body font-medium">Uploading</h2>
        <ol className="mt-5 space-y-4">
          <Step n={1}>Tap a card and take or choose the photo.</Step>
          <Step n={2}>Say whether it&apos;s done or needs one more cycle.</Step>
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
        <h2 className="text-body font-medium">Badges</h2>
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
        <h2 className="text-body font-medium">Everyone&apos;s board</h2>
        <p className="note mt-4 leading-relaxed">
          You can open any other venue and see what they uploaded. One team
          seeing another&apos;s work raises the bar for everyone.
        </p>
      </section>
    </>
  );
}
