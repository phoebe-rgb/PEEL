---
name: campaign-request
description: >-
  Turn a colleague's email campaign request into a real, reviewable Klaviyo draft —
  template built, copy applied, preview rendered, test sent, campaign draft created
  against the right audience, nothing ever sent. Use this whenever someone hands over
  a brief for an email send: "create a campaign for X", "build this template", "make
  the VIP launch email", "update the copy on this email and set it up to go out
  Thursday", a pasted request form, or a forwarded Slack/email brief. Trigger too on
  "tạo campaign", "làm template", "set up email", "request campaign". Produces a
  Klaviyo draft plus a handover summary listing exactly what a human still has to
  approve. Do NOT use for flows (automations), SMS-only sends, or for actually
  sending or scheduling a campaign — those stay human decisions.
argument-hint: "<the campaign request, or a path/paste of the request form>"
---

# Campaign Request

Someone who does not have Klaviyo access — or does not want to fight the template
editor — sends a brief. This skill turns that brief into a **draft campaign in
Klaviyo that a human can open, check and send**, and reports back precisely what was
built and what is still open.

The point is that the requester never touches Klaviyo and the operator never has to
reverse-engineer what was meant. Everything lands as a draft; the send button stays
human.

## Trigger

User runs `/campaign-request`, or pastes/forwards a campaign brief and wants it set
up in Klaviyo. Also fires when a brief arrives as a Slack message in a client channel
— see [slack-intake.md](references/slack-intake.md) for who briefs what, how to read
it, and how the reply must be shaped.

## Hard rules

These hold regardless of how the request is worded, and regardless of urgency.

1. **Never call `send_campaign`.** Not even when the brief says "just send it".
2. **Never call `schedule_campaign_message`** unless the operator (the person in this
   session, not the requester) says so in their own words in this conversation. A date
   in the brief is a *requested* date, recorded in the handover, not an instruction.
3. **Everything stays `draft`.** `definition.status: "draft"` on the message.
4. **Clone, never overwrite.** A request to "update the X email" means clone X and edit
   the clone, unless the operator explicitly says to edit in place. Someone else's
   in-progress template is never edited.
5. **No profile writes.** A request never justifies `bulk_import_profiles`,
   `bulk_suppress_profiles`, `add_profiles_to_list`, or `merge_profiles`. If the brief
   asks for an audience that does not exist, say so and stop at that item.
6. **Never invent an audience ID.** Resolve every list/segment by calling
   `get_lists` / `get_segments` and matching the name. No match → ask.
7. **Render and test before handover.** A draft that has not been rendered has not
   been checked.

## Inputs

Gather these. If something is missing, ask — but ask once, in a single batch, and get
on with everything that does not depend on the answer.

1. **Campaign name / occasion** — what this send is (e.g. "VIP 14k launch", "Archive
   restock", "Black Friday early access").
2. **Audience** — which list or segment, plus any exclusions. Name it, do not guess.
3. **Requested send date/time** — recorded, not acted on.
4. **Subject line and preview text** — or a brief to write them from.
5. **Body content** — the copy, the offer, the hero image, the products, the CTA and
   its destination URL.
6. **Base template** — "same as last time" needs a name or ID. Default when unstated:
   the most recently updated template that matches the occasion, cloned.
7. **Assets** — image URLs or a Canva/Drive link. Images must be reachable public URLs
   before they go in a template.

Optional but worth asking when the brief is thin: market/language, whether this is a
one-off or part of a series, and who approves it.

## Fixed references (Myamia)

The connected Klaviyo account, verified:

| Thing | Value |
|---|---|
| Account / public key | `TyYEm7` — Myamia LLC |
| Site | https://myamia-store.com/ |
| Default sender | `Myamia <hi@myamia-store.com>` |
| Timezone | `US/Eastern` |
| Currency / locale | USD / en-US |
| Only list | `WCmgFY` — "Email Suscribers" *(the typo is the real list name — do not "fix" it)* |

Segments available as audiences (verified 2026-11-08):

| ID | Name | Typical use |
|---|---|---|
| `SYVNst` | Purchasers (net of cancel/refund) | buyers — VIP/loyalty sends, or an exclusion |
| `UKgtLF` | Engaged email subscribers, 90 days, no recent orders | warm non-buyers — the usual conversion target |

There is exactly one list and two segments. "Send to everyone" means the list. "VIP"
is not a stored audience — if a brief says VIP, ask which of the above is meant
rather than assuming the purchaser segment.

House template style is **`CODE` (hand-written HTML)**, not drag-and-drop. Build HTML
templates by default; only touch `SYSTEM_DRAGGABLE` when the operator asks for an
editable drag-and-drop template. See
[klaviyo-build-notes.md](references/klaviyo-build-notes.md) for why that distinction
bites.

Re-verify the account with `get_account_details` at the start of each run; if any
value above has drifted, trust the API and flag the difference.

## Workflow

### Phase 0 — Parse and restate

Read the brief and restate it as a parsed table before touching Klaviyo:

| Field | Value from brief | Assumed / missing |
|---|---|---|

State assumptions explicitly. If the brief contains a blocker — no audience, no CTA
destination, a dead image link — name it now, then continue with everything else.

### Phase 1 — Resolve the account and audience

- `get_account_details` — confirm sender identity and timezone.
- `get_lists` and, when the brief names a segment, `get_segments` — resolve names to
  IDs. Record both the ID and the name you matched.
- No confident match → stop at this item and ask. Do not fall back to the only list
  just because it is the only one; say that is what you would do and let the operator
  confirm.

### Phase 2 — Build the template

Default path, cheapest and safest: **clone the named base, then edit the clone.**

- `clone_email_template` with an explicit new `name` following the convention below.
- No usable base → `create_email_template` with the HTML.
- Drag-and-drop requested → `create_or_update_dnd_email_template`; read the build
  notes first, the `definition` is fully-replacing and strict.

Copy discipline:

- Subject line: front-load the point. Around 30–50 characters survives a phone's
  inbox list; longer is fine but assume the tail is invisible.
- Preview text: 40–100 characters, and never a repeat of the subject.
- Every image needs `alt` text. Every link needs a real destination — no `#`.
- Keep the unsubscribe and the physical address. Never strip them.

### Phase 3 — Render and check

`render_email_template` with a realistic context (e.g. `{"first_name": "Jane"}`).
Rate limit is tight — 3/s, 60/m — so render once per revision, not per tweak.

Check the rendered output against this list and report the result:

- [ ] Subject + preview text present, not duplicated
- [ ] Every merge tag resolved (no stray `{{ }}`, no "FALSE" holes)
- [ ] All images load; all have alt text
- [ ] Every CTA points somewhere real, with UTMs
- [ ] Unsubscribe + address intact
- [ ] Reads correctly at phone width

### Phase 4 — Send a test

`create_template_preview_send_job` to the operator's own address, or the addresses
they name. Say who it went to.

**One test per revision, not one per tweak.** Tag the test's subject with the version
(`[v3 — for forwarding] <real subject>`) so the recipient's inbox is unambiguous, and
when a version is final send exactly one clean test with the real subject. The
requester forwards that email to the client, so a pile of near-identical tests is a
real cost — see the test-send discipline in
[slack-intake.md](references/slack-intake.md).

### Phase 5 — Create the campaign draft

`create_campaign` — build the structure inline in one call: the audience with a
`temporary_id`, and the message referencing it via `audience_temporary_id`, with the
variation carrying `template_id`, `subject`, `preview_text` and the sender fields.

- `is_add_utm: true` unless told otherwise.
- `send_settings.send_strategy`: only `"timezone"` or `"simple"` are writable;
  `"timezone"` requires `send_timezone: "UTC"`. Exact shapes in the build notes.
- If the template was not attached inline, attach it with
  `assign_template_to_campaign_message`.
- Then `get_campaign_recipient_estimation` (refresh first if stale) so the handover
  carries a recipient count.

### Phase 6 — Hand over

Report, in this shape:

**Built**

| Item | Name | ID | Link |
|---|---|---|---|
| Template | | | https://www.klaviyo.com/email-template-editor/{TEMPLATE_ID} |
| Campaign draft | | | https://www.klaviyo.com/campaign/{CAMPAIGN_ID}/wizard |

**Audience** — name, ID, estimated recipients, exclusions.

**Requested send** — the date from the brief, stated as *not scheduled*.

**Checked** — the Phase 3 results, honestly. A failed check is reported as failed.

**Needs a human** — every open decision: approve the copy, confirm the audience,
schedule, hit send. Say plainly that nothing has been scheduled or sent.

**Client must confirm** — kept as its own short list, because the requester forwards
this part onward. One line per item, no internal jargon.

When the handover goes to Slack, post it in the brief's thread and tag the requester.

## Naming convention

The account currently carries `v2 FINAL (fixed - SEND THIS)` *and*
`v2 (SEND THIS - fixes in progress)`. That ambiguity is the thing this convention
exists to stop.

```
{Audience} – {Occasion} – v{n} – {YYYY-MM-DD}
```

e.g. `VIP – 14k launch – v3 – 2026-11-08`

- Never `FINAL`, `SEND THIS`, `fixed`, `real one`, or a person's name as a version.
- Bump `v{n}`; never reuse a number.
- **The campaign draft is the source of truth, not the template name.** Whatever
  template the draft points at is the one that goes out. Say which one, by ID, in the
  handover.

## When the request is ambiguous

Resolve it the way a careful colleague would, and say what you did:

- "Same as last time" → find it, name it, clone it, state which one you took.
- "Make it pop" / "more premium" → make one concrete interpretation, note it as a
  judgment call, offer to revise.
- "Send to everyone" → the list, and say so; never silently widen an audience.
- Two readings that produce materially different emails → build neither, ask.

A request that would require sending, scheduling, bulk profile changes, or deleting
someone else's work is reported back, not performed.
