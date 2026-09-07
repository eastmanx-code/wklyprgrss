/**
 * Help content for both products: the weekly board, and the nightly close.
 *
 * The weekly guide is scoped deliberately to uploading. How the work gets
 * sourced, assigned and executed lives in the CH Figma Protocol — repeating it
 * here would just be a second copy to keep in sync.
 *
 * The close guide exists because "How to" sits in the corner menu on every
 * screen, including inside a checklist, and until now it explained the weekly
 * board to a bartender halfway through a close. A page about the wrong product
 * is worse than no page: the first thing it teaches is that the help is not
 * for you.
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
  houses,
  deadlineLabel,
}: {
  target: number;
  /** How many boards are being scored — one until the kitchen goes live. */
  houses: number;
  deadlineLabel: string;
}) {
  return (
    <>
      <p className="note leading-relaxed">
        By {deadlineLabel}, all {target} items
        {houses > 1 ? " in each half" : ""} need a <strong>new photo</strong>{" "}
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
  houses,
  deadlineLabel,
}: {
  target: number;
  /** How many boards are being scored — one until the kitchen goes live. */
  houses: number;
  deadlineLabel: string;
}) {
  return (
    <>
      <section className="panel mb-3">
        <h2 className="text-body font-medium">The rule</h2>
        <p className="note mt-4 leading-relaxed">
          By {deadlineLabel}, all {target} items
          {houses > 1 ? " in each half" : ""} need a <strong>new photo</strong>{" "}
          and a <strong>new comment</strong>. Nothing carries forward. Missing
          either one fails the item.
        </p>
      </section>

      {houses > 1 ? (
        <section className="panel mb-3">
          <h2 className="text-body font-medium">Two boards, two scores</h2>
          <p className="note mt-4 leading-relaxed">
            Front of house and the kitchen are separate lists of {target}, each
            walked and graded by a different person. They are never added
            together — a spotless dining room does not cover a kitchen that was
            not walked, and the week passes only if both halves do.
          </p>
        </section>
      ) : null}

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

/**
 * Walking a checklist, for the person holding the phone at one in the morning.
 *
 * Ordered by when they need it rather than by how the thing is built: the
 * photo gate first because it is the only rule that stops somebody, then the
 * walk, then losing signal, then signing. The two manager sections come last
 * because a bartender never needs them and a manager will scroll.
 */
export function CloseGuide() {
  return (
    <>
      <section className="panel mb-3">
        <h2 className="text-body font-medium">The rule</h2>
        <p className="note mt-4 leading-relaxed">
          An item that asks for a photo{" "}
          <strong>cannot be ticked by hand</strong>. Taking the photo is what
          completes it. A tick says somebody remembered. A photo says it
          happened.
        </p>
      </section>

      <section className="panel mb-3">
        <h2 className="text-body font-medium">Walking a list</h2>
        <ol className="mt-5 space-y-4">
          <Step n={1}>
            Pick your position, then the list you are on: open, mid or close.
          </Step>
          <Step n={2}>
            Tap an item and put your initials in. It saves the moment you tap.
          </Step>
          <Step n={3}>
            Initials go on every item, not once at the start. Four people work a
            close on one phone, and &ldquo;who did the restrooms&rdquo; has to
            have an answer.
          </Step>
          <Step n={4}>
            Where an item asks for a photo, a video or a note, that is what
            finishes it. There is no way to mark it done without one.
          </Step>
        </ol>
      </section>

      <section className="panel mb-3">
        <h2 className="text-body font-medium">If the signal drops</h2>
        <p className="note mt-4 leading-relaxed">
          Keep going. Ticks and photos are saved on the phone and go up on their
          own once you are back in range, and a line at the top of the list says
          what it is still holding.
        </p>
        <p className="note mt-3 leading-relaxed">
          One catch: open the app while you still have signal. It cannot load
          from cold with none.
        </p>
      </section>

      <section className="panel mb-3">
        <h2 className="text-body font-medium">Signing off</h2>
        <p className="note mt-4 leading-relaxed">
          The MOD signs at the end. You type your name, sign, and the app
          records exactly what you are putting your name to, naming anything not
          done. Once it is signed the list is locked and nothing on it can
          change.
        </p>
        <p className="note mt-3 leading-relaxed">
          If the phone is still holding work, the signature waits until that
          work has gone up. Signing over it would lose it.
        </p>
      </section>

      <section className="panel mb-3">
        <h2 className="text-body font-medium">Writing a list</h2>
        <p className="note mt-4 leading-relaxed">
          <strong>Edit list</strong> is in the menu while you are on one, and
          again at the foot of it. A venue owns its own lists: you invent the
          position, write the items, say which ones owe a photograph, and retire
          them when the job changes.
        </p>
      </section>

      <section className="panel">
        <h2 className="text-body font-medium">Reference photos</h2>
        <p className="note mt-4 leading-relaxed">
          The other direction from proof. Proof is what an item owes at the end
          of the night. A reference is what <strong>right</strong> looks like,
          and the crew sees it while they are doing the job. Open an item in the
          editor and add one, up to four an item.
        </p>
        <p className="note mt-3 leading-relaxed">
          Shoot them on your own bar. Whoever runs it knows what a correct well
          looks like there, and a picture taken anywhere else is a different
          bar. It also means they get retaken the week the layout changes, by
          the person who changed it.
        </p>
      </section>
    </>
  );
}
