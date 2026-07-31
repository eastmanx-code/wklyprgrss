import Link from "next/link";

import { logout } from "@/app/actions";

/**
 * The bar at the bottom of every close screen.
 *
 * Three things it now does that the copies didn't. It clears the home
 * indicator — `bottom-4` on an iPhone put it under the swipe strip, so the
 * gesture and the Out button shared the same 20 points and the gesture won.
 * Its buttons fill the width on a phone rather than huddling at the right of a
 * full-width bar, which is the only reason it was full-width in the first
 * place. And it is one component: three copies of a fixed element is three
 * chances for the page's bottom padding to stop matching the bar's height.
 *
 * The padding that keeps content out from under it lives here too, as a
 * spacer, so a page cannot forget it.
 */
export function CloseBar({ back }: { back: string }) {
  return (
    <>
      {/* Reserves the bar's own height in the flow. A fixed element takes no
          space, and the last item on a checklist was sitting under it. */}
      <div className="h-[calc(4.5rem+env(safe-area-inset-bottom))]" aria-hidden />

      <nav className="border-card-border bg-surface/90 fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex h-14 items-center gap-2 rounded-[8px] border px-2 backdrop-blur-md sm:left-auto sm:gap-3 sm:px-3">
        {/* min-h-11, not the ghost button's own 32px. These are the two
            controls closest to the bottom edge of a phone held one-handed at
            2am, which is the worst place in the interface to be 12px short of
            a thumb. */}
        <Link href={back} className="btn-ghost min-h-11 flex-1 sm:min-h-0 sm:flex-none">
          Back
        </Link>
        <form action={logout} className="flex-1 sm:flex-none">
          <button type="submit" className="btn-ghost min-h-11 w-full sm:min-h-0 sm:w-auto">
            Out
          </button>
        </form>
      </nav>
    </>
  );
}
