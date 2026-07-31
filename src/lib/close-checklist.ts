/**
 * The Night Hawk MOD close, Edition 1 — transcribed from the checklist the
 * venue runs today.
 *
 * Hard-coded on purpose. This is a prototype for review: getting the shape of
 * the thing in front of a GM is worth more right now than a table to edit it
 * in, and the shape is what we still have questions about.
 */

export type ProofKind = "photo" | "video";

export type CloseItem = {
  /** Displayed, and how MODs already refer to these to each other. */
  number: number;
  title: string;
  /** The standard for what "done" means. Not separately ticked. */
  detail: string[];
  /**
   * What has to be captured, and what has to be in frame. The prompt is the
   * whole point: a photo you can't take without being told what to shoot is
   * much harder to fill with a covered lens than a generic camera icon is.
   */
  proof?: { kind: ProofKind; prompt: string };
};

export const CLOSE_CHECKLIST: CloseItem[] = [
  {
    number: 1,
    title: "Positive moment check-ins",
    detail: [
      "Checked in with at least 2 crew members about a positive moment from their shift.",
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
    proof: { kind: "photo", prompt: "The safe count screen and the secured drawer, both in frame" },
  },
  {
    number: 4,
    title: "Full close restroom walkthrough",
    detail: [
      "Restrooms thorough clean and stocking, all trash emptied.",
      "Towels removed, multifold towels in place of towels to avoid waste.",
      "Double check that the opening team will have stock of all shrine supplies: mouthwash, cups, mints, tampons — and alert all leaders if this will not be the case.",
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
    proof: { kind: "photo", prompt: "The written closing report, readable end to end" },
  },
  {
    number: 9,
    title: "Back door & kitchen entrance",
    detail: ["Back door and kitchen entrance secured."],
    proof: { kind: "photo", prompt: "The back door, closed and locked, with the latch visible" },
  },
  {
    number: 10,
    title: "Maintenance & final walk",
    detail: [
      "Everything in good condition and functioning. Property issues logged with photo to MOD chat and here.",
    ],
    proof: {
      kind: "video",
      prompt:
        "Walk the space and record it: restrooms clean, dumpster area clear, music off, fire off. Say out loud anything that needs attention.",
    },
  },
];

export const CLOSE_TOTAL = CLOSE_CHECKLIST.length;
