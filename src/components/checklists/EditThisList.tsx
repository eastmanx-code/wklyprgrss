"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { T } from "@/components/Lang";

/**
 * The way into a list's own editor, from the corner rather than the foot.
 *
 * "Edit the list" lives at the very bottom of a checklist on purpose: the
 * person holding a phone at one in the morning is walking the list, not
 * writing it, and an edit control under the title is a mis-tap waiting to
 * happen. That is right for the close and wrong for the one week a venue is
 * setting up, when the job *is* the editing and the way in sits below
 * thirty-four items nobody wants to scroll past to find it.
 *
 * So it appears in the menu as well, which is already on every screen and is
 * already the place you go when you want something other than the list in
 * front of you. The link at the foot stays where it is.
 *
 * A client component because the menu is rendered in the layout and the layout
 * does not know which list you are on. This does, from the path.
 */

/** Everything under /checklists that is a screen rather than a checklist. */
const NOT_A_LIST = new Set([
  "locations",
  "compliance",
  "rollup",
  "position",
  "enter",
]);

export function EditThisList() {
  const pathname = usePathname();

  // Exactly /checklists/<slug>. Not the index itself, not the reports, and
  // not the editor, which would be a link to the page you are standing on.
  const parts = pathname.split("/").filter(Boolean);
  const onAList =
    parts.length === 2 &&
    parts[0] === "checklists" &&
    !NOT_A_LIST.has(parts[1]);

  if (!onAList) return null;

  return (
    <Link href={`${pathname}/edit`} className="btn-ghost whitespace-nowrap">
      <T en="Edit list" es="Editar lista" />
    </Link>
  );
}

/**
 * "How to", pointed at the product you are actually in.
 *
 * The link sits in the menu on every screen and used to lead to the weekly
 * board's instructions from inside a checklist, which taught a bartender
 * halfway through a close that the help was written for somebody else. The
 * page holds both guides; this decides which one it opens on.
 */
export function HelpLink() {
  const pathname = usePathname();
  const onTheLists =
    pathname === "/checklists" || pathname.startsWith("/checklists/");

  return (
    <Link
      href={onTheLists ? "/help?for=checklists" : "/help"}
      className="btn-ghost whitespace-nowrap"
    >
      <T en="How to" es="Cómo usar" />
    </Link>
  );
}
