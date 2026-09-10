import Link from "next/link";

import { DeadlineCountdown } from "./DeadlineCountdown";
import { ThemeToggle } from "./ThemeToggle";
import { EditThisList, HelpLink } from "@/components/checklists/EditThisList";
import { LangSwitch, T } from "@/components/Lang";
import { SignOut } from "@/components/SignOut";
import { getSession, mayManage } from "@/lib/session";
import { currentWeekStart, deadlineFor } from "@/lib/week";

/**
 * Persistent corner controls: where you are in the week, how to get back, help,
 * a way out, and the theme. Reachable from every screen, so no page is a dead
 * end — which was the state of the board and item pages before.
 *
 * Collapsed to a single chip, because six controls in a row had grown wide
 * enough to be the widest thing on the screen and to sit over the content on a
 * tablet. It opens on hover where there is a pointer and on a tap where there
 * isn't: a <details> gives the tap for free, and the hover is one CSS rule on
 * top. No client component, so it stays on the server like the rest of the bar.
 */
export async function CornerMenu() {
  const session = await getSession();
  const deadlineMs = deadlineFor(currentWeekStart()).getTime();

  // Home is the same door for both roles now: the screen that asks which
  // product you are here for. What differs is the second link. An admin's
  // "all venues" is the grading board; a leader's is everybody's scores.
  const isAdmin = session?.role === "admin";
  const canEdit = mayManage(session);
  const home = session ? "/home" : null;

  return (
    /* Sized to its content now rather than pinned across the phone, so the
       collapsed state is genuinely small. */
    <nav className="fixed right-4 bottom-4 z-50">
      <details className="ww-menu">
        {/* A filled disc, the word running around its rim. The accent is the
            button, not the lettering on it — a yellow word on a dark chip was
            the quietest thing in the corner. */}
        {/* Two lines rather than a word bent round the rim: at a size you can
            read on a phone, curved type needed a disc half again as big. The
            accent is the button itself, not the lettering on it. */}
        <summary className="bg-warn text-on-warn grid size-16 shrink-0 place-items-center rounded-full leading-none">
          <span className="text-center text-[11px] leading-none font-medium tracking-[0.08em] whitespace-nowrap">
            Menu
          </span>
          <span className="sr-only">Menu</span>
        </summary>

        {/* In flow beside the button, not laid over it. Absolute, it covered the
            only control that could close it again — which is why the menu
            opened and then never shut. */}
        <div className="border-card-border bg-surface/90 ww-menu-items h-14 items-center justify-end gap-2 rounded-[8px] border px-2 backdrop-blur-md lg:gap-3 lg:px-3">
          <span className="hidden lg:contents">
            <DeadlineCountdown deadlineMs={deadlineMs} />
            <span className="bg-card-border h-6 w-px" aria-hidden />
          </span>

          {home ? (
            <Link href={home} className="btn-ghost">
              <T en="Home" es="Inicio" />
            </Link>
          ) : null}

          {session ? (
            <Link
              href={isAdmin ? "/admin" : "/board"}
              className="btn-ghost whitespace-nowrap"
            >
              {isAdmin ? (
                <T en="All venues" es="Todos los lugares" />
              ) : (
                <T en="All" es="Todos" />
              )}
            </Link>
          ) : null}

          {/* Named for what it is. It read "Hood checklists 1.0" from the
              days when one venue was piloting them; the lists are a leader's
              own venue now, so the venue in the label was wrong for twenty of
              the twenty-one reading it. */}
          {session ? (
            <Link href="/checklists" className="btn-ghost">
              <T en="Checklists" es="Listas" />
            </Link>
          ) : null}

          {/* Only while standing on a checklist, and it renders nothing
              anywhere else. The way into the editor is otherwise the link at
              the foot of the list, below every item on it, which is right for
              somebody walking it at one in the morning and useless for the
              person setting one up. */}
          {/* Managers only, like the link at the foot of a list. This one was
              shown to anybody signed in, so the crew holding the venue code
              off the QR by the rack were being offered a door that refuses
              them — the exact thing the foot of the list stopped doing. */}
          {canEdit ? <EditThisList /> : null}

          <HelpLink />

          <span className="bg-card-border h-6 w-px" aria-hidden />

          {/* Here rather than on the checklists screen, because the language
              somebody reads is not a property of one screen in one product.
              This bar is on every page, so the switch is too. */}
          <LangSwitch />

          <span className="bg-card-border h-6 w-px" aria-hidden />

          {session ? (
            <SignOut className="btn-ghost">
              <T en="Out" es="Salir" />
            </SignOut>
          ) : null}

          <ThemeToggle />
        </div>
      </details>
    </nav>
  );
}
