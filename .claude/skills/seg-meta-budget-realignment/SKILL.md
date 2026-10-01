---
name: seg-meta-budget-realignment
description: >-
  Realign SEG (Swiss Education Group) Meta/Facebook ad-set daily budgets to the
  new month's remaining budget, on the SEG ad account (CHF). Use this whenever
  the user wants to "update daily budget in Meta to align with the new month's
  budget", "re-pace SEG budgets", do the monthly SEG budget reset, or when the
  monthly scheduled routine fires. Covers three independent streams — (A) main
  ACT/Nurture campaigns from the Funnel/pivot budget file, (B) Social Boosting
  from the Google Sheet, (C) Retargeting from the fixed monthly plan — plus the
  CRM↔Meta ad-name mismatch diagnostic. Trigger even if the user only says
  "align SEG daily budgets", "remaining budget / days left", "budget tháng mới",
  "re-pace the Swiss schools", or names CAAS/SHMS/HIM/CRCS budgets on Meta. Do
  NOT use for Google Ads budgets or for non-SEG accounts.
---

# SEG Meta budget realignment (monthly)

Re-pace every live SEG Meta ad-set daily budget so the **remaining** budget for
the current period is spread evenly across the **days left in the month**, split
down to ad sets by current share with a tilt toward the better performers. This
is the monthly "align daily budget with the new month's budget" job.

The method is the same every time; only the numbers change. Pull fresh data on
each run — never reuse last month's figures.

## Core formula

```
daily_budget = remaining_budget / days_remaining_in_month
remaining_budget = planned_budget(period) − spend(period so far)
```

- `days_remaining_in_month`: on the 1st this is the whole month (Oct = 31).
  The team's convention here has been **31 for October**; confirm the divisor if
  it is ambiguous (the pivot file sometimes uses 30 — see "Divisor" below).
- Everything is **CHF**, in the ad account's minor unit (rappen) when writing to
  the API: 7.00 CHF → `daily_budget: 700`. Account **minimum is 0.83 CHF (83)**.

## Fixed references (SEG)

- **Meta ad account**: `1763026957318451` (name "SEG", CHF, min daily 83).
- **Funnel workspace**: `-OVwMtGNDkNfeFUS4d9G`. Budget plan lives in the Funnel
  Google-Sheets source *"SEG 2026 Paid Media Budget Breakdown - Live Budget"*
  (budget measure `cf1j3o0r06ace91_Budget`). The user usually also uploads a
  **pivot CSV** (`School, Country, Activity Type, Budget, Cost, Remaining Budget,
  Daily Budget`) — prefer that when given; it is Facebook-only across all
  activities. Note the source can be flagged DELAYED / have unparseable formula
  cells — validate before trusting.
- **Social Boosting sheet**: `1F3qzwBnHgoN-kPTaXmsZBoShaWVCLVY17SB2Zjzo01M`,
  tab **"Budgets 2026"** (sheetId `1062976233`). Rows: 4=CAAS, 5=SHMS, 6=HIM,
  7=CRCS RET, 8=CRCS PROS, 9=TOTAL. Month columns: C=Jan … J=Aug, **K=Sep, L=Oct**,
  M=Nov, N=Dec. "Actual spend" cells are green `RGB(0.8509804, 0.91764706, 0.827451)`;
  "Planned budget" cells are peach `RGB(0.9882353, 0.8980392, 0.8039216)`.
- **Funnel metrics** (CRM): cost `common-cost`, Lead `cf1j1duvi2djgtk_Lead`,
  Applied `cf1j3glr5v1q5f6_Applied`, Register `cf1j1gseb4f85jg_Register_for_Portal`;
  CPL/CPReg/CPApp are ratios of these.

## Scope & exclusions (confirm each run, these were the standing choices)

- **Stream A = all active campaigns EXCEPT Social Boosting and Retargeting.**
  Social Boosting and Retargeting are handled as their own streams (B, C).
- Only the **Facebook** channel, campaigns that are **ACTIVE** with at least one
  **ACTIVE ad set**. Budgets are **ABO** (set at ad-set level, not campaign).
- **Skip** (do not fund), unless the user says otherwise:
  - Campaigns whose ad sets are all PAUSED (e.g. CAAS US ACT) → no active ad set
    to receive budget; flag it, don't reactivate without approval.
  - Campaigns with no budget line in the plan (e.g. CRCS Kazakhstan AppliedAI).
  - Paused campaigns that have a plan line (e.g. VN / UAE ACT) → leave paused.
  - Event / dated CONV campaigns (Open Day, Webinar with a date) → leave as-is;
    `/days_remaining` is wrong for them (they end mid-month).
  - HIM Retargeting and HIM Social Boosting (standing exclusion — reconfirm).

## Divisor (important)

The team ran October at **/31** (full month) to match Retargeting. The uploaded
pivot file's own "Daily Budget" column computes **/30**, so Meta will sit ~3.2%
below that column by design — this is **not an error**. If the user later wants
Meta to match the file exactly, scale every ad set by `31/30`. Always state which
divisor you used in the summary.

---

# Stream A — Main ACT / Nurture campaigns

1. **Pull the plan.** From the pivot CSV (or Funnel budget source) take, per
   `School × Country × Activity`, the **Remaining Budget**. Compute
   `daily = Remaining / days_remaining`.
2. **Pull live structure.** `ads_get_ad_entities` level=campaign (fields incl.
   `effective_status`, `objective`, `amount_spent` over the period) to list
   active campaigns; then level=adset for the in-scope campaigns (fields
   `name, effective_status, daily_budget, campaign_id, amount_spent`).
3. **Map plan line → campaign(s)** by name. SEG naming is
   `PL_<School>_FB_<Activity>_<Region>_<Country>_<Program/Segment>...`
   (ACT→ACT, NURTURE→NURT, CONVERT→CONV). One plan line can map to **two
   campaigns** (e.g. CAAS/SHMS India ACT run a **Master's (MAS)** and a
   **Parents** campaign) → split that line's daily between them **by their
   period spend proportion** first, then down to ad sets.
4. **Split campaign target to ad sets** = current ad-set daily share **plus a
   performance tilt** toward the better performers: blend
   `0.5 × current_share + 0.5 × result_share`, then clamp each to the 0.83 floor.
   - "result" = Meta `results`/leads for lead campaigns, `reach` (lower CPM
     better) for awareness/Nurture. Pull via level=adset with fields
     `results, cost_per_result` over a stable window (e.g. last full quarter).
   - **CRM CPApp/CVR is the ideal tilt metric but is unavailable at ad-set level
     until the ad-name rule (Stream D) is fixed** — Funnel returns 0 Leads/
     Applied per Facebook ad set. Until then tilt on Meta CPL/results and say so.
5. **Exception — CAAS India Master's:** split its target **70/30 in favour of
   the older Advantage+ ad set** (the one named `..._AdvantagePlus` with no
   suffix), 30% to `..._AdvantagePlus_NewAds`. This overrides the proportional
   tilt for that campaign.
6. Apply (see "Execution mechanics"), verify, report.

Use a small Python script for the arithmetic (floor clamp, 70/30, two-campaign
splits) — hand arithmetic across ~25 ad sets is error-prone with real money.

---

# Stream B — Social Boosting (Google Sheet)

Schools in the sheet: CAAS, SHMS, HIM, **CRCS RET = CRCS Nurt**, **CRCS PROS =
CRCS ACT**. Standing mapping (reconfirm): **HIM = skip**; **SHMS = combine** the
NURT SocialBoosting campaign **+** the CONV Euro SocialBoosting campaign.

1. **B1 — actual Sep/prev-month cost.** Pull each school's prev-month spend from
   Meta (the Social Boosting campaigns), write it into that month's column (K for
   Sep) and **recolor the cell green** to match the actuals, via
   `Google_Sheets.update_spreadsheet` `updateCells` (set `userEnteredValue` +
   `userEnteredFormat.backgroundColor` to the green above). Read the green/sheetId
   fresh with `get_spreadsheet includeGridData` before writing.
2. **B2 — reset next month's budget:**
   `Oct_new = Oct_current + (prev_month_planned − prev_month_actual)`
   (roll the unspent remainder forward). Write it to the Oct column (L).
3. **B3 — daily:** `daily = Oct_new / days_remaining`.
4. **B4 — apply to ad sets** of each school's Social Boosting campaign(s), split
   by current ad-set share (for SHMS, pool both campaigns' ad sets). Verify.

The Google Sheets editor connector must be connected to the session. If only
Google Drive is present, the fill+recolor is blocked — tell the user to connect
Google Sheets at https://claude.ai/customize/connectors and start a new session;
compute what you can meanwhile.

---

# Stream C — Retargeting (fixed monthly plan)

Monthly plan (CHF) the user provided — **confirm/refresh each run**:
- CAAS: Jul 160 | Aug 160 | Sep 240 | Oct 240 | Nov 240 | Dec 240
- HIM:  Jul 100 | Aug 100 | Sep 189 | Oct 189 | Nov 189 | Dec 189
- SHMS: Jul 62  | Aug 62  | Sep 60  | Oct 62  | Nov 60  | Dec 62

`Oct_real = (plan Aug + Sep + Oct) − spend(Aug 1 → now)`, then
`daily = Oct_real / days_remaining`, split to ad sets by current share.
HIM Retargeting campaign has been **PAUSED** — leave paused unless told to enable
(enabling starts real spend). If remaining is too small to keep every ad set at
the 0.83 floor, flag it and get a decision (consolidate / floor / pause).

---

# Stream D — CRM ↔ Meta ad-name mismatch (diagnostic + fix)

Symptom: Funnel can't attribute CRM Leads/Applications to Facebook **ad sets**
(returns 0) because the CRM (Salesforce) ad name carries a `– Copy` suffix that
the Meta ad name doesn't — the join key differs. This blocks the real CPApp/CVR
tilt in Stream A.

This is a **Funnel-side config fix** (Funnel MCP here is read-only — cannot create
rules). Deliverable: tell the user/Funnel team to add a Funnel **Find & Replace
(regex)** rule on the **Ad Name** field of **both** the Salesforce and Facebook
sources: pattern `\s*[–-]\s*[Cc]opy\b.*$` → empty. You can pull and hand over the
list of offending ad names with `ads_get_ad_entities` level=ad (look for names
containing "Copy"; note Meta sometimes uses an en-dash "–").

---

# Execution mechanics (every budget write)

1. `ads_update_entity` entity_type=ad_set, `fields={"daily_budget": <cents>}`.
   This MCP stages the change as a **draft** (`is_draft: true`); it does **not**
   go live yet. `status_forced_to_paused` should be false — if true, the ad set
   was paused by the edit and must be re-activated.
2. Publish the drafts: `ads_activate_entity` entity_type=ad_set with **all** the
   edited ad-set ids in `object_ids` (one call). Status comes back `PUBLISHING`
   (handed off, not confirmed).
3. **Verify live**: `ads_get_ad_entities` with the ids and
   `fields=["name","effective_status","daily_budget"]`; confirm each new value and
   that `effective_status` is ACTIVE. Retry any `INTERNAL`/retryable failure once.
4. Always include `client_conversation_id` (one 20-char id per conversation) and
   `advertiser_request` (the user's own words) on every Meta call.

Guardrails: never drop an ad set below 0.83; never silently pause a serving ad
set; keep each fix minimal; one validated publish beats several speculative ones.

---

# Autonomous / scheduled runs

When fired by the monthly routine (fresh cloud session, nobody watching), there
is no one to answer confirmations, so:
- Follow the **standing decisions** above (exclusions, /31, HIM skip, SHMS
  combined, CAAS MAS 70/30). If a genuinely new ambiguity appears (a new campaign
  with no plan line, a plan line with no live campaign, remaining that can't meet
  the floor), **do not guess on real money** — skip that item, apply the rest,
  and flag it clearly in the summary.
- Pull all inputs fresh (plan from Funnel/pivot, spend + structure from Meta,
  Social Boosting from the sheet). If the pivot CSV is not provided in an
  autonomous run, read the Funnel budget source instead.
- If `propose-only` mode is requested, do everything except the Meta writes:
  produce the full per-ad-set plan + update the sheet, and send it for approval.

# Reporting

Finish with a boss-facing English summary: what changed (per stream, key moves),
the divisor used, sharp pace-downs to watch, and anything skipped/flagged
(especially the Stream D ad-name fix while it's outstanding). Offer a
before→after log if useful.
