/**
 * The Night Hawk MOD close, Edition 1 — transcribed from the checklist the
 * venue runs today.
 *
 * Hard-coded on purpose. This is a prototype for review: getting the shape of
 * the thing in front of a GM is worth more right now than a table to edit it
 * in, and the shape is what we still have questions about.
 */

/**
 * A note is proof too. Some of this checklist has nothing to photograph — what
 * a crew member actually said is the record, and a tick alone loses it.
 */
export type ProofKind = "photo" | "video" | "note";

/** One capture, with the thing it has to show. */
export type Shot = { kind: ProofKind; prompt: string };

export type CloseItem = {
  /** Row id once the list comes from the table. */
  id?: string;
  /** Displayed, and how MODs already refer to these to each other. */
  number: number;
  title: string;
  /** The standard for what "done" means. Not separately ticked. */
  detail: string[];
  /**
   * The captures this item owes — a list, because two things that both need
   * proving are usually nowhere near each other. A safe count screen and a
   * secured drawer cannot be got into one frame, and asking for it produces
   * either a bad photo of both or an honest photo of one.
   *
   * Each shot names what it has to show. That prompt is the whole mechanism:
   * a covered lens is obviously wrong against "the back door, closed and
   * locked, with the latch visible", and nothing has to judge the picture.
   *
   * The item completes when every shot is taken, not the first.
   */
  proof?: Shot[];
};

export const CLOSE_CHECKLIST: CloseItem[] = [
  {
    number: 1,
    title: "Positive moment check-ins",
    detail: [
      "Checked in with at least 2 crew members about a positive moment from their shift.",
    ],
    proof: [
      {
        kind: "note",
        prompt:
          "Who you spoke to and what the moment was. Dictate it with the mic on your keyboard if that is quicker.",
      },
    ],
  },
  {
    number: 2,
    title: "POS & voids",
    detail: ["POS comps and voids closed."],
  },
  {
    number: 3,
    title: "Cash handling complete",
    detail: [
      "Server cash received and counted.",
      "All money counted and placed in safe, bar drawer verified.",
      "iPads and equipment stored and charging.",
    ],
    proof: [
      { kind: "photo", prompt: "The safe count screen" },
      { kind: "photo", prompt: "The secured drawer" },
      { kind: "photo", prompt: "iPads and equipment on their chargers" },
    ],
  },
  {
    number: 4,
    title: "Full close restroom walkthrough",
    detail: [
      "Restrooms thorough clean and stocking, all trash emptied.",
      "Towels removed, multifold towels in place of towels to avoid waste.",
      "Double check that the opening team will have stock of all shrine supplies: mouthwash, cups, mints, tampons — and alert all leaders if this will not be the case.",
    ],
    proof: [
      { kind: "photo", prompt: "Each restroom, clean, with the trash emptied" },
      {
        kind: "photo",
        prompt: "The shrine, stocked for the opening team",
      },
    ],
  },
  {
    number: 5,
    title: "Full close checklist & ambiance walkthrough",
    detail: [
      "All available checklists checked for completion.",
      "Music off, but not in the lobby.",
      "Lobby lighting set to overnight.",
      "Lighting set to PM settings for Night Hawk.",
      "All fireplaces off.",
      "All tiki torches off.",
      "All waterfall fire features off.",
    ],
  },
  {
    number: 6,
    title: "Stanchions polished",
    detail: [
      "All stanchions throughout the venue polished, smudge-free.",
      "All stanchions tight and ready for AM service, and AM MOD.",
      "Ropes clipped across main entry.",
      "Lobby side stanchions in the array of one partially covering stair width, and one in street to match front.",
    ],
  },
  {
    number: 7,
    title: "Perimeter & gardens clean",
    detail: [
      "All gardens checked for trash, trash pulled.",
      "Front side of building swept.",
      "Whole perimeter walked and clean.",
      "Ensure no glass to dumpster after 10PM and that there is no trash around dumpsters, all items are in, all of our items are broken down. Assign to a team member if not.",
    ],
  },
  {
    number: 8,
    title: "Closing report written",
    detail: [
      "Recorded everything valuable for openers. This is the note the AM MOD reviews and signs in Open Daily. Include anything the next shift needs.",
    ],
    proof: [
      { kind: "photo", prompt: "The written closing report, readable end to end" },
    ],
  },
  {
    number: 9,
    title: "Back door & kitchen entrance",
    detail: ["Back door and kitchen entrance secured."],
    proof: [
      {
        kind: "photo",
        prompt: "The back door, closed and locked, with the latch visible",
      },
      { kind: "photo", prompt: "The kitchen entrance, secured" },
    ],
  },
  {
    number: 10,
    title: "Maintenance & final walk",
    detail: [
      "Everything in good condition and functioning. Property issues logged with photo to MOD chat and here.",
    ],
    proof: [
      {
        kind: "video",
        prompt:
          "Walk the space and record it: restrooms clean, dumpster area clear, music off, fire off. Say out loud anything that needs attention.",
      },
    ],
  },
];

export const CLOSE_TOTAL = CLOSE_CHECKLIST.length;
