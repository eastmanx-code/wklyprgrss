import { NextResponse } from "next/server";

import { notAdminGoesTo } from "@/lib/app";
import { snapshot } from "@/lib/peoplevine";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Any panel on the membership board, as a file.
 *
 * B, 2026-11-02: "Need the ability to take any area and make it a download as
 * CSV or XLS too." A list nobody can get out of the page is a list one person
 * reads; a file is something the membership team can work down and tick off.
 *
 * CSV rather than XLSX. Excel, Numbers and Sheets all open it, it needs no
 * library, and it cannot carry a formula that breaks on somebody else's
 * machine. The file is named .csv and declared as text/csv, so nothing
 * pretends to be a spreadsheet it is not.
 *
 * It reads the same snapshot the page does, so a column can never drift from
 * what was on screen.
 */

/**
 * One CSV field.
 *
 * THE LEADING APOSTROPHE IS NOT COSMETIC. A value starting with =, +, - or @
 * is executed as a formula when the file is opened in Excel, which is how a
 * spreadsheet of member names becomes a way to run something on the opener's
 * machine. Prefixing breaks that without changing what a person reads.
 */
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function csv(headers: string[], rows: unknown[][]): string {
  // A BOM, so Excel on Windows reads it as UTF-8 rather than mangling an
  // accented name. Every member list here has some.
  return (
    "﻿" +
    [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") +
    "\r\n"
  );
}

const SECTIONS = [
  "waiting",
  "failing-active",
  "failing-dormant",
  "past-due",
  "declines",
  "programs",
  "revenue",
  "pipeline",
] as const;

type Section = (typeof SECTIONS)[number];

export async function GET(request: Request) {
  const session = await getSession();
  if (session?.role !== "admin") {
    // The same door the page uses. This carries member names and balances, so
    // it is not a public URL just because it returns a file.
    //
    // The search string is rebuilt rather than inherited: redirecting with the
    // request URL as the base carried ?section=waiting onto the login page,
    // which told the door nothing and stranded whoever clicked. Send them to
    // the board, not back to a file download they have no session for.
    const door = new URL(notAdminGoesTo(Boolean(session)), request.url);
    door.search = door.pathname === "/admin/login" ? "?next=/members" : "";
    return NextResponse.redirect(door);
  }

  const asked = new URL(request.url).searchParams.get("section") ?? "";
  if (!SECTIONS.includes(asked as Section)) {
    return NextResponse.json(
      { error: "unknown section", sections: SECTIONS },
      { status: 400 },
    );
  }
  const section = asked as Section;
  const snap = await snapshot();

  let headers: string[] = [];
  let rows: unknown[][] = [];

  if (section === "waiting") {
    headers = ["Name", "Email", "Applied", "Days waiting", "Customer id"];
    rows = snap.waitingOnIntro.map((q) => [
      q.name,
      q.email,
      q.appliedOn,
      q.days,
      q.customer_id,
    ]);
  } else if (section === "failing-active" || section === "failing-dormant") {
    const list =
      section === "failing-active"
        ? (snap.dues?.failingActive ?? [])
        : (snap.dues?.failingDormant ?? []);
    headers = [
      "Name",
      "Email",
      "Programme",
      "Monthly price",
      "Failing since",
      "Days failing",
      "Last visit",
      "Days since visit",
      "Still a member",
      "Customer id",
    ];
    rows = list.map((f) => [
      f.name,
      f.email,
      f.program,
      f.monthlyPrice,
      f.since,
      f.days,
      f.lastVisit,
      f.lastVisitDays,
      f.stillAMember ? "yes" : "no",
      f.customer_id,
    ]);
  } else if (section === "past-due") {
    headers = ["Name", "Open invoices", "Past due", "Oldest days", "Customer id"];
    rows = snap.pastDueMembers.map((r) => [
      r.name,
      r.invoices,
      r.pastDue,
      r.oldestDays,
      r.customer_id,
    ]);
  } else if (section === "declines") {
    headers = ["Name", "Amount", "When", "Card", "Last four", "Attempts"];
    rows = snap.declines30.rows.map((d) => [
      d.name,
      d.amount,
      d.when ? d.when.slice(0, 10) : "",
      d.brand,
      d.lastFour,
      d.tries,
    ]);
  } else if (section === "programs") {
    headers = [
      "Programme",
      "Monthly price",
      "Active",
      "Failing",
      "Suspended",
      "Monthly dues",
      "Dues at risk",
    ];
    rows = (snap.dues?.programs ?? []).map((p) => [
      p.title,
      p.monthly_price,
      p.active_members,
      p.failed_members,
      p.suspended_members,
      p.monthly_dues,
      p.dues_at_risk,
    ]);
  } else if (section === "revenue") {
    headers = ["Month", "Dues collected", "Food and drink", "Other billing", "Total"];
    rows = (snap.revenue?.months ?? []).map((m) => [
      m.month,
      m.dues_collected,
      m.pos_spend,
      m.other_collected,
      m.dues_collected + m.pos_spend + m.other_collected,
    ]);
  } else {
    headers = ["Stage", "People", "Applied in 90 days", "Oldest days"];
    rows = snap.stages.map((s) => [s.label, s.people, s.live, s.oldestDays]);
  }

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reading-club-${section}-${day}.csv"`,
      // Never cached: it names people and what they owe, and a stale copy in a
      // shared cache is both wrong and a leak.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
