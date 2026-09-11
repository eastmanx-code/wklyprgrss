---
name: onboard-close-lists
description: Turn a venue's paper or spreadsheet checklists into live close checklists in the app. Use when a new location is being onboarded to nightly checklists, or an existing venue's lists are being rebuilt from a source document.
---

# Onboard a venue's close checklists

One file per venue in `close-lists/CODE.json`, loaded with one command. The
file is the record of what the venue runs; the loader is idempotent, so the
file can be corrected and loaded again without losing the nights already
signed against it.

## What done looks like

1. `close-lists/CODE.json` exists, reviewed, committed.
2. Every list is live under the venue: `npm run load-close-lists -- --file close-lists/CODE.json`
   (or `--sql` and run the output through the database when the key is not on this machine).
3. The venue is switched on for checklists: `venues.close_active = true` (Checklists → Locations → the venue → switch on, or one update).
4. Manager PINs exist in `admin_pins` with `venue_id` set, one per named manager. Never invent names. Ask for the list of managers if it was not given.
5. A curl login as the venue (its `venues.pin`) shows every position on `/checklists`, and one list opens with its photo asks visible.
6. The GM gets three things: the venue link `/checklists/enter/<venue id>`, the venue PIN for the crew, and each manager's PIN. Plus one line: the night rolls at 4am, anything still open from tonight carries until then.

## Reading the source

Sources are Google Sheets or an xlsx with one tab per list. Read the whole thing before mapping. Then:

- **One list per position and phase.** Tab names say which: "HOST OPENING" is Host / open, "BARBACK CLOSING" is Barback / close. A list that spans a page break ("OPENING THE BAR PAGE 1" and "PAGE 2") is one list.
- **Phases** are `open`, `mid`, `close`. A full shift list that ends with closing tasks is `close`.
- **Weekly cleaning tabs** become one `Deep clean` / `mid` list per room, with each item under its weekday as `section` (`MONDAY` … `SUNDAY`). The app only asks for a weekday item on that weekday.
- **A weekday marker inside an ordinary list** ("**WEDNESDAY** I put the freezer on eco mode") is the same: strip the marker, set `section` to the day.
- **Manager lists.** "Closing the store / leads" and "Ambiance open" are the manager on duty. Use one role for both phases (`Lead`, or `Kitchen manager` for the kitchen's).
- **Drop** header rows, instruction rows, quotes, `#REF!`, `INITIAL:` cells, date columns, and any line that says "I had the MOD sign this checklist". The app is the signature.
- **Keep the venue's own words.** Do not rewrite items. Fix nothing but a broken sentence left by a stripped clause.
- **Time estimates** in a side column go into `detail` ("About 2 minutes").
- **Duplicates** within one list: keep the first. Titles are how items are matched on reload.

## Proof: the rule, so nobody has to ask

Photos are not optional and are not something to add later.

- Every item whose source says "take a photo", "post to WhatsApp", "take a picture" gets `proof: [{ "kind": "photo", "prompt": "…" }]`. Strip the WhatsApp clause from the title. The app is where the photo goes now.
- Every item that leaves something a manager would want to see gets a photo too: a cleaned surface, a locked door, a drained machine, a stocked station, a whiteboard, equipment off. Aim for three to six per list, more on a deep clean (one per item).
- Items with nothing to see stay initials only: clocking in, saying hello, checking in with someone, reading a sheet.
- A count or a list the item asks for ("how many caviar spoons", "the 86 list") is `kind: "note"`.
- **The prompt names what the picture has to show.** "The dish machine open and drained, racks stacked", not "photo". A prompt that says what right looks like is the whole check.
- `video` is for a walk of a space with the person saying out loud what needs attention.

## Spanish

- `role_es` on every list.
- `title_es` on every kitchen (HOH) item, and on any front of house list the venue says is a Spanish speaking crew. Write it the way the crew talks, not a dictionary.
- The app falls back to English where `title_es` is null, so a missing translation is not a broken list.

## The file

```json
{
  "venue": "STAR",
  "lists": [
    {
      "house": "FOH",
      "role": "Host",
      "role_es": "Anfitrión",
      "phase": "close",
      "items": [
        { "title": "I FINISHED ALL TABLES ON OPENTABLE" },
        {
          "title": "ALL THE IPADS ARE CHARGING.",
          "proof": [{ "kind": "photo", "prompt": "Every iPad on its charger" }]
        }
      ]
    },
    {
      "house": "FOH",
      "role": "Deep clean",
      "role_es": "Limpieza profunda",
      "phase": "mid",
      "room": "Cave bar",
      "items": [
        { "section": "MONDAY", "title": "I CLEANED BOTH REACH-IN FRIDGES.", "proof": [{ "kind": "photo", "prompt": "Both reach-in fridges, clean inside" }] }
      ]
    },
    {
      "house": "HOH",
      "role": "Dish",
      "role_es": "Lavaplatos",
      "phase": "close",
      "items": [
        { "title": "Dish machine left open and water drained.", "title_es": "La máquina de lavar abierta y sin agua.", "proof": [{ "kind": "photo", "prompt": "The dish machine open and drained, racks stacked" }] }
      ]
    }
  ]
}
```

Fields per item: `title` (required), `title_es`, `section`, `detail` (array of strings), `proof` (array of `{kind, prompt}`; kinds are `photo`, `video`, `note`).

## Loading

- `npm run load-close-lists -- --file close-lists/CODE.json` matches lists on venue + house + role + phase + room and items on title. Existing rows keep their id and history and take the file's position, section, Spanish, detail and proof. New rows are inserted.
- `--replace` retires items the file no longer has (never deletes).
- `--sql` prints the statements for running elsewhere.
- The loader refuses a file with a missing prompt, a repeated title, an unknown house or phase, or a list with no items. Fix the file, run again.

## After loading

- Switch the venue on and check `/checklists/locations` shows it.
- Log in with the venue PIN and open one list from each house on a phone width. Photo asks should be visible on the items that carry them.
- Tell the user what was loaded (lists and item counts per house, how many photo asks), what is still needed (manager names for PINs), and the link and PINs to hand to the GM.
