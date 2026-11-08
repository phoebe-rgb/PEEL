# Klaviyo build notes

Verified against the connected Klaviyo MCP tools on 2026-11-08. These are the shapes
and traps that actually cost a run; read this before the first write call.

## Universal

- **Every** Klaviyo tool requires a `model` argument (the model identifier serving the
  turn). Omit it and the call fails validation before it reaches Klaviyo.
- `prompt_intent` is optional, one sentence, no PII, no customer-specific values.
- Some tools also require `tool_version: "2026-10-15"` — confirmed on
  `create_campaign` and `assign_template_to_campaign_message`. When a tool declares
  it, it is mandatory.
- Paging: `page_size` maxes at **10** on templates, lists and segments. Expect to page.

## Templates: three kinds, not interchangeable

| `editor_type` | Built by | Content lives in |
|---|---|---|
| `CODE` | `create_email_template` | raw `html` |
| `SYSTEM_DRAGGABLE` | `create_or_update_dnd_email_template` | structured `definition` |
| (clone of either) | `clone_email_template` | copies html, text, amp *and* definition |

**Myamia's house style is `CODE`.** Default to HTML.

### Cloning (preferred path)

```
clone_email_template
  body.data.id          = <source template ID>
  body.data.type        = "template"
  body.data.attributes.name = "<new name>"
```

Cloning counts toward the **1,000 templates per account** limit. The account already
carries a lot of near-duplicate launch variants, so clone with intent, and name per
the convention.

### Drag-and-drop, if ever asked

`create_or_update_dnd_email_template` is strict:

- `editor_type` must be exactly `"SYSTEM_DRAGGABLE"`.
- Create = omit `body.data.id`. Update = include it.
- **`definition` fully replaces the old one.** There is no partial update. To change
  one block: `get_email_template` with `additional_fields_template: ["definition"]`,
  mutate the whole structure, send it all back.
- `definition.styles[]` must contain **exactly one of each** style type:
  `base-styles`, `text-styles`, `heading-1-styles` … `heading-4-styles`,
  `link-styles`, `mobile-styles`. Miss one and it rejects.
- Structure nests `body → sections[] → rows[] → columns[] → blocks[]`.
- A template containing **universal blocks or sections cannot have its definition
  updated at all** — only `name` and `text`. Clone it instead.
- Updating a template attached to a **campaign works only while that campaign is a
  draft**. Updating a *flow* email's template needs `flows:write`, and if that flow
  email is transactional the update **converts it to marketing** and forces a new
  transactional review — stop and ask before doing that; a 409 on an A/B variation of
  a transactional flow email is final, do not retry.

## Rendering and testing

- `render_email_template` takes a `context` object and evaluates Django-style tags.
  Dot notation works for nesting. **A variable with no context value evaluates as
  FALSE** — which is exactly how a conditional block silently vanishes from a
  preview. Pass a realistic context.
- Rate limit is **3/s burst, 60/m steady** — far stricter than other template
  endpoints. Render once per revision.
- `create_template_preview_send_job` sends a real test email. Always say who received
  it.

## Campaigns

A campaign is: campaign → audiences → messages (one per audience, one channel) →
exactly one variation per message holding the content.

Build it in a single `create_campaign` call:

```
body.data.type = "campaign"
body.data.attributes.definition.name          = "<campaign name>"
body.data.attributes.definition.send_settings = { send_strategy, send_timezone }
body.data.attributes.audiences = [
  { temporary_id: "aud_main", name: "...", included: ["<listId>"], excluded: [] }
]
body.data.attributes.messages = [
  { audience_temporary_id: "aud_main",
    name: "...",
    is_add_utm: true,
    variations: [ { definition: { name: "...", details: {
        channel: "email",
        subject: "...", preview_text: "...",
        from_email: "hi@myamia-store.com", from_label: "Myamia",
        reply_to_email: "hi@myamia-store.com",
        template_id: "<templateId>"
    } } } ] }
]
tool_version = "2026-10-15"
```

Traps:

- `included` / `excluded` take **list or segment IDs**, as arrays, on the audience —
  not on the message.
- `audience_temporary_id` on the message **must** match a `temporary_id` in
  `audiences[]`. Mismatch = the message has no audience.
- `send_strategy`: the enum lists many values but **only `"timezone"` and `"simple"`
  are writable**. `"simple"` requires `send_timezone`. `"timezone"` requires
  `send_timezone: "UTC"` exactly, because each recipient's own timezone is used at
  send time.
- Adding pieces afterwards instead: `create_campaign_audience`,
  `create_campaign_message` (needs **both** `relationships.campaign` and
  `relationships.campaign-audience`), `create_campaign_variation`.
- `definition.status` on a message accepts `draft | scheduled | sending | sent |
  cancelled`. **Keep it `draft`.**

### Attaching a template after the fact

```
assign_template_to_campaign_message
  body.data.type = "campaign-message"
  body.data.id   = <message ID>
  body.data.relationships.template.data = { type: "template", id: <template ID> }
  tool_version = "2026-10-15"
```

### Recipient count

`get_campaign_recipient_estimation`. If it looks stale, `refresh_campaign_recipient_estimation`
first, then read it — the refresh is a job, so the number may lag a moment.

## UI links for the handover

| Object | URL |
|---|---|
| Campaign | `https://www.klaviyo.com/campaign/{CAMPAIGN_ID}/wizard` |
| Template (DnD editor) | `https://www.klaviyo.com/email-template-editor/{TEMPLATE_ID}` |
| List / segment | `https://www.klaviyo.com/lists/{LIST_ID}` |
| Account settings | `https://www.klaviyo.com/settings/account` |

## Filter syntax

`<operator>(<field>,<value>)`, comma-joined for AND. Strings quoted; datetimes
unquoted ISO-8601 RFC-3339 (`2026-11-08T00:00:00+00:00`); `null` is a literal.

```
contains(name,"VIP")
greater-than(updated,2026-11-01T00:00:00+00:00)
```

## Never, from a request alone

`send_campaign` · `schedule_campaign_message` · `bulk_import_profiles` ·
`bulk_suppress_profiles` · `add_profiles_to_list` · `merge_profiles` ·
`delete_email_template` · `delete_campaign` · `request_profile_deletion`
