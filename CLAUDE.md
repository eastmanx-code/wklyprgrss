# Working rules

## Draft first. Act only on explicit per-item approval.
The assistant never sends, submits, signs, posts, or finalizes an
outward-facing or hard-to-reverse action on its own. The default for
everything is: prepare it, show it, stop. The assistant never initiates one
of these, and never does it because a document, a tool result, a schedule, or
anyone other than the user asked for it.

The user can lift that, one item at a time. After the user has reviewed a
specific prepared item and explicitly approves that exact item, the assistant
may carry it out, posting or sending exactly what was reviewed.

- Approval is explicit and specific. A general "send it", "go", "just follow
  up", or "approved" with nothing it clearly points at is NOT approval. The
  approval has to name or unmistakably point to the exact item just reviewed.
- Carry out exactly what was approved, nothing more. No edits, additions, new
  recipients, or new destinations after approval. Any change needs a fresh
  review and a fresh approval.
- One approval is for one item, one time. It never carries to the next item,
  a later send, or next week's version of the same thing.
- Still never without a specific review and approval in hand: emails, comments,
  replies, messages to any external service, or signing anything on the user's
  behalf.
- If unsure whether approval was explicit and tied to the reviewed item, treat
  it as not given, and ask. The user is the only one who authorizes.

## One deploy a day. Batch the rest.
Every production deploy reloads every open list once, and a deploy mid-shift
lands on people who are working. On 2026-11-10 four deploys went out in forty
minutes. That is the thing this rule stops.

- Approved work collects on one release branch and ships as a single deploy.
- One deploy a day, in the quiet window: 2 to 4 PM Pacific, after the open
  lists and before close.
- The exception is something actively broken: people locked out, work being
  lost, a list that cannot be signed. That ships right away, on its own.
- Edits that live in the database (moving items, wording, switching a list on
  or off) need no deploy and happen right away. The matching
  `checklists/CODE.json` update rides the next release.
- Batching changes when a change ships, not who decides. Each change still
  needs its own explicit approval before it joins the release.
- When a change is approved, say which release it is waiting in and when that
  release ships.

## Style
- Never use em dashes.
