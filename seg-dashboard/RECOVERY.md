# SEG Performance dashboard — recovery notes

> **Stale as of 2026-10-02.** This describes the 1 Oct source. The live Worker and page were deployed
> again after that (new routes, new secrets, an Alert Setup page). Use it for history only; do not
> deploy from this repo. See `handoff/HANDOFF.md`.

This folder is a **recovery checkpoint** for the SEG (Swiss Education Group)
performance dashboard. The original source was lost when the build container
that produced it was reclaimed; everything here was pulled back from the **live
Cloudflare deployment** on 2026-10-01. Keep it in git so it can never be lost
again.

## What the dashboard is

- A **Cloudflare Worker + Static Assets (SPA)** named `seg-dashboard`.
- Live URL: `https://seg-dashboard.seg-dashboard.workers.dev` (password protected,
  basic-auth realm **"SEG Performance"**).
- Account: `phoebe@peel-digital.com` / `bbc8c9f67b33609ec79d39279749024d`.
- Shows SEG paid-media performance (Google Ads + Meta) sourced from Funnel,
  plus budget, keywords, benchmarks, and a review/comment layer.
- Reviewed by **Piers** in Slack `#seg-reporting-dashboard`; his feedback is the
  open bug list (below).

## Architecture

```
Request ─▶ Worker (worker/index.js)           ← runs first (run_worker_first)
            ├─ auth: basic-auth DASH_PASSWORD, or seg_key cookie = DASH_KEY,
            │         or ?k=<DASH_KEY> (sets the cookie, 1y)
            ├─ /api/*  → reads JSON blobs from KV namespace SEG_DATA
            └─ anything else → env.ASSETS.fetch()  → the SPA (public/)
```

- **Backend** = `worker/index.js` (recovered, 1 module). Small: auth + a thin
  JSON API over KV + static-asset passthrough. **No business logic lives here.**
- **Frontend** = the static assets (SPA). **All dashboard logic** — pages,
  India YoY, country/channel filters, scorecards, budget page — lives here.
  **This is where every open bug is, and it is NOT yet recovered** (see below).

### Worker API (all GET unless noted; all require auth)
| Route | KV key | Notes |
|---|---|---|
| `/api/live` | `live` | main Google+Meta data cube (see schema) |
| `/api/meta` | `meta` | Meta sync metadata (currently has no rows) |
| `/api/metafreq` | `metafreq` | Meta frequency by campaign |
| `/api/bench` | `bench` | benchmarks keyed `SCHOOL|COUNTRY` |
| `/api/setup` | `setup` | per-campaign `{enabled, dailyBudget, lastUpdated}` |
| `/api/keywords` | `keywords` | keyword cube |
| `/api/budgetlive` | `budgetlive` | monthly planned budget rows |
| `/api/negbase` | `negbase` | negative-keyword base by school |
| `/api/archive` | `arch:*` | concatenates archived snapshots (currently none) |
| `/api/notes?week=YYYY-Www` | `notes:<week>` | GET/POST annotations |
| `/api/actions` | `actions` | GET/POST |
| `/api/comments` | `comments` | GET/POST review comments |
| `/api/notify` (POST) | — | relays `{text}` to Slack webhook |

### Bindings / secrets
- `ASSETS` (assets), `SEG_DATA` (KV `003c141e9f4545afb5a6f9cbabc20415`).
- Secrets: `DASH_PASSWORD`, `DASH_KEY`, `SLACK_WEBHOOK_URL` (set via
  `wrangler secret put`; never committed).

## `live` data cube schema (`/api/live`)
Columnar cube, current month only (window 2026-09-02 → 2026-09-30), `n≈43849`
cells, `grain="day"`.
- **dims** (categorical, stored as index→value lists): `date, channel
  (Meta|Google), school (HIM|CAAS|CRCS|SHMS), country, region, country_level,
  activity, level, program, campaign, ad_group, ad, theme, audience, ad_format`
- **cols** (per-cell arrays): the 15 dims above (as indices) + metrics
  `cost, impr, clicks, sessions, leads, gl, reg, app, acc, budget`
- **No campaign-type dimension** (Search/YouTube/GDN/PMax) and **no prior-year
  window** are stored — relevant to two of the open bugs.

Data snapshots captured 2026-10-01 are kept **local only** (gitignored
`data-snapshots/`, since they are live business data); re-pull any of them with
the script in "How to re-pull data".

## Open bugs (Piers' review) — to fix in the frontend
1. **India YoY wrong.** Dashboard shows spend +136% / leads +500%; Funnel shows
   ~+29% (spend 31,955 vs 24,784; leads 2,973 vs 2,305). The cube holds only the
   current month and no `arch:` baseline exists — YoY is comparing against the
   wrong/missing baseline.
2. **Country filter leaks.** A USA campaign shows 552 spend under the India
   filter (Funnel: 0 in India) — roll-up/attribution bug in the frontend.
3. **Google shows only Search.** India also runs YouTube, GDN and PMax; the
   breakdown only surfaces Search (no campaign-type split in the cube).
4. **Funnel score** needs a tooltip documenting its formula.
5. Requested changes: drill-down tables with a values-only toggle; add
   Program/Audience breakdowns; drop the "CHF" label where noted.
6. Explanations owed: Reg/App/Acc rate math, leads without UTM, boosted posts.
7. Infra: LinkedIn connections (SHMS, CAAS) lost permission in Funnel since
   2026-08-31 → LinkedIn reads 0 (needs re-auth in Funnel, not a code fix).

## New work requested (2026-10-01)
- **New "Alert Setup" dashboard page** that runs the setup QA currently done by
  a Google Apps Script, but **for both Meta and PPC** (script was Google/ACT
  only). Sources:
  - PPC setup: `SEG - Perfomance` sheet `1KGhN3AYhMNly1MmnI3YUAiCIZtWihUaAJnwTI-lx1Lk`
    tabs `CAAS_Setup / SHMS_Setup / CRCS_Setup / HIM_Setup`
    (cols incl. `Campaign, campaign type, target location, Budget daily, URL ad final`).
  - Meta setup: `SEG Meta tracking set up` sheet
    `1Tp4Kapdg7nacBoLLgIfr8UTTiAC6e3kjs8BkcbcwVYY` tabs `📁 Campaigns / 📦 Ad Sets / 🎨 Ads`
    (Ad Sets cols incl. `adset_name, daily_budget, countries, effective_status`).
  - **Final-URL check** against the authoritative landing-page list:
    `SEG Master Doc` sheet `15kXVWZ_sITHEDHCOy-KXvi9FFtM3EZQA_LyN2sgjmVc`
    tab `Landing page` (`ACtivity, School, Page, Language, Status, Link, …`).
    Match special pages by School + Page(market) + Language; otherwise use the
    `Generic` page.
  - Reference logic: the Apps Script (name parser, URL matcher, Gemini location
    check, Slack alert) — see the task thread.
- **Budget page:** compute "CHF/day now" from the **`Budget daily` columns in the
  `_Setup` sheets** (the real deployed daily budget), compared to Target daily
  budget — not from the KV `setup.dailyBudget`.
- In-flight before this handoff (from the local session): direct-leads × GA4
  table; and pending approvals (15:05 `CRM_Raw` export schedule, 2 GA4 channel
  fields into Funnel, Slack Mon/Tue/Thu message templates).

## What is still missing
- **The original frontend SOURCE (React/Vite project: `src/*.tsx`, etc.).**
  The built SPA was pulled from the live site into `public/` (gitignored):
  `index.html` + `assets/index-*.js` (836 KB **minified**) + CSS, plus
  `public/data/*.json` (hist_weekly/hist_daily/keywords/budget… — 26 MB). But the
  deployment ships **no sourcemap** (`*.js.map` returns the SPA index via the
  single-page-application fallback), so only minified output is recoverable from
  Cloudflare. Fixing logic bugs (India YoY, country filter, Google channel
  split) and adding the Alert Setup page require the original source, which lives
  only on the machine that runs `wrangler deploy`. A fix made in the minified
  bundle would also be overwritten by the next local deploy, so the source must
  come from local (push the project to a branch/repo).
- `index.js.map` (worker sourcemap) — not served; bundled `worker/index.js` is
  the source of truth for the backend.

## How to redeploy
1. Recover `public/` (above).
2. `cd seg-dashboard && npx wrangler deploy` (needs `CLOUDFLARE_API_TOKEN` in env).
3. Secrets persist on the Worker; only set them again if they changed.

## How to re-pull data / source from Cloudflare
Recovery scripts used (need `CLOUDFLARE_API_TOKEN` in env) — kept in the session
scratchpad; the key calls are:
- Worker module: `GET /accounts/{acct}/workers/scripts/seg-dashboard` (multipart).
- Settings/bindings: `.../seg-dashboard/settings`.
- KV values: `GET /accounts/{acct}/storage/kv/namespaces/{ns}/values/{key}`.
