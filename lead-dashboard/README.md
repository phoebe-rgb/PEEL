# SEG Lead Tracking — auto compare Netlify vs CRM

Live dashboard + daily Slack alert that reconcile leads captured on **Netlify Forms**
against leads that actually reached the **CRM (Salesforce)**. This is what Funnel can't do
(Funnel is manual, no notification).

## How it works

> A Netlify lead whose **email** is not found in the Salesforce export = **lost lead**.
> No pending/grace bucket — if it isn't in the CRM, it's lost.

- Matching key: **email** (lowercase). If the export later adds a **Submission Id** column,
  its UUIDs are picked up automatically as a stronger key (`getCrmKeys` returns `emails`+`ids`;
  `classify` matches email OR event_id).
- The CRM source must be the **all-time** Salesforce lead export. A returning applicant who
  first registered long ago updates their OLD lead (original date kept), so a recent-window-only
  export would flag them as false "lost". All-time avoids that.
- The dashboard page (`public/index.html`) fetches `/.netlify/functions/leads` on load, so it
  is always live. The alert function reports only the **previous day's** lost leads.

## Components

| File | Role |
|------|------|
| `public/index.html` | Live dashboard — fetches the function, SEG theme, filters (school / country / channel / date), lost-lead table + CSV. |
| `netlify/functions/leads.mjs` | JSON API: current Netlify leads + CRM match status + summary. |
| `netlify/functions/lost-lead-alert.mjs` | **Scheduled** — reports yesterday's lost leads as a Slack DM (counts + dashboard link, no PII). |
| `netlify/functions/_lib.mjs` | Shared: Netlify Forms pull, CRM CSV read, matched/lost classify. |
| `netlify.toml` | Build config + schedule. |

## Environment variables (set on Netlify)

| Var | Required | Description |
|-----|:---:|-------------|
| `NETLIFY_API_TOKEN` | ✅ | Netlify personal access token (User settings → Applications → New access token). Lets the functions read Forms on the 4 SEG sites. |
| `SALESFORCE_CSV_URL` | ✅ | CSV URL of the **all-time** Salesforce lead export (date + email). A Google Sheet, refreshed daily by Funnel, **Published to web → CSV** (or Share → Anyone with the link → Viewer, using `.../export?format=csv&gid=<tab>`). |
| `SLACK_BOT_TOKEN` | ✅ | Slack bot token (`xoxb-…`) with scopes `chat:write` + `im:write`, to DM Phoebe. |
| `SLACK_DM_USER_ID` | ✅ | Phoebe's Slack member ID (e.g. `U0123ABC`) — the DM recipient. |
| `DASHBOARD_URL` | ✅ | Link to this (password-protected) dashboard, included in the alert. |
| `ALERT_TZ` | ❌ | Timezone for "yesterday" (default `Asia/Ho_Chi_Minh`). |
| `SLACK_WEBHOOK_URL` | ❌ | Fallback if no bot token — posts to a channel instead of a DM. |
| `SITE_MAP` | ❌ | JSON `{siteId:"BRAND"}` to change the sites. Defaults to the 4 SEG sites. |

4 SEG sites are built in: CAAS (`36b518a4…`), SHMS (`0643bf0d…`), HIM (`a29a7635…`), CRCS (`45589786…`).

## Deploy

```bash
# from lead-dashboard/
netlify sites:create --name seg-lead-tracking      # or reuse an existing site
netlify env:set NETLIFY_API_TOKEN  "xxxx"
netlify env:set SALESFORCE_CSV_URL "https://docs.google.com/spreadsheets/d/<ALL_TIME_SHEET>/export?format=csv&gid=<tab>"
netlify env:set SLACK_BOT_TOKEN    "xoxb-…"
netlify env:set SLACK_DM_USER_ID   "U0123ABC"
netlify env:set DASHBOARD_URL      "https://seg-lead-tracking.netlify.app"
netlify deploy --prod
```

**First run (one-off):** open `/.netlify/functions/lost-lead-alert?all=1` once — this reports the
ENTIRE backlog of lost leads. After that, the daily schedule (no param) reports only the
previous day's new lost leads.

Test the alert any time (without waiting for the schedule): open `/.netlify/functions/lost-lead-alert`
in the browser, or `netlify functions:invoke lost-lead-alert`.

The schedule (twice daily, after the 08:15 & 14:15 exports) is in `netlify.toml` — Netlify cron is
UTC, so adjust the hours to your export timezone.

## ⚠️ Security

The page and data contain **real lead contact details**. Turn on **password protection**
(Site configuration → Access & security → Visitor access) or restrict to the team via SSO —
**never leave it public**. Password protection is a single site password (no username).

## Getting the CRM match to 100%

Matching is by email, which is close but not perfect (typo'd emails, merged CRM records).
Ask the freelancer to add a **Submission Id** column to the export → matching by `event_id`
becomes exact.
