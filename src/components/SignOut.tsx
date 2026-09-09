"use client";

import { logout } from "@/app/actions";
import { forgetPages } from "@/components/ServiceWorker";

/**
 * The way out, in one place.
 *
 * There were two of these — the corner menu's and the close bar's — and only
 * one of them could grow the thing that now has to happen on the way out:
 * dropping the pages the service worker cached. Four people share two phones
 * behind a bar, and the second one to log in must not be able to pull the
 * first one's venue back out of that cache by walking somewhere with no
 * signal.
 *
 * A client component so the cache can be told. The sign out itself is still
 * the same server action it always was.
 */
export function SignOut({
  className,
  formClassName,
  children,
}: {
  className: string;
  formClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <form action={logout} onSubmit={forgetPages} className={formClassName}>
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
