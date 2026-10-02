# SEG dashboard — handoff from cloud session to local Claude

Paste this whole file to the local Claude Code session that owns the dashboard project
(the one that runs `npm run build` + `wrangler deploy`). Nothing here was deployed —
the live site is unchanged. The cloud session could not push to GitHub, so these
changes travel as files.

## 1. Apply the code changes already made

Apply in this order, from the project root (the folder with `src/`):

```bash
patch -p1 < fix2-market-filter.patch                       # 1a, src/App.tsx
patch -p1 < actions-setup-high-and-type-filter.patch       # 1b, Actions page
```
Both were checked against the original uploaded zip: they apply cleanly, `tsc --strict` passes,
42 tests pass, `vite build` is clean, and the Actions page was exercised in a browser.

### 1b. Actions page: set-up is High + filter by type of problem

- New `src/lib/kinds.ts` (+ `kinds.test.ts`): every action now has a type — Setup, Performance,
  Scale, Budget pacing, Keywords, Feedback, Reallocation. `withPriority()` forces **Setup → High**.
- `src/tracker.tsx`: a **Type** filter row (with counts) next to the platform tabs. The two filters
  narrow each other and apply to To do, Backlog, Done and Dismissed. Type shows under the platform chip.
  Within the same priority, Setup is sorted first. The type is saved with Done / Dismiss.
- What counts as **Setup** today: Budget lines with **No plan** (spending without a plan line) or
  **Not started** (plan not launched), and comments flagged "Needs action" that mention
  set-up / tracking / UTM / pixel / final URL / target location. Older saved actions without a type
  are classified from their text (`storedKind`).
- The Alert Setup checks (URL, target location, daily budget set up) do not exist yet. When they
  are built, give their actions `kind: 'Setup'` and they will be High and filterable with no
  other change.

### 1a. Market filter (fix #2)

`fix2-market-filter.patch` (or the full `App.tsx` next to it) — `src/App.tsx` only.

- The top filter bar filtered by `country` (the user's **geo**), while every breakdown
  table and Funnel report by `market` (the campaign's **target** country, parsed from the
  campaign name). That is why a USA campaign showed 552 spend under India.
- Filter dims are now `['school', 'channel', 'market']`; market codes are shown as names
  (IN → India) via `marketName`; `SAVE_KEY` bumped to `v3` so an old saved `country`
  filter is dropped.

```bash
cd <project>            # the folder with src/ and wrangler.toml
patch -p1 < fix2-market-filter.patch     # or just copy App.tsx over src/App.tsx
npm run build           # was clean in the cloud: vite build OK
```

## 2. Decisions confirmed by the owner

| Topic | Decision |
|---|---|
| Current-year leads | Correct. Do not change them. |
| Prior-year (2025) leads | Wrong — undercounted (see §3). Fix the history. |
| "Paid" channels | Adwords (Search), **PMax**, YouTube, Display/GDN, Facebook, LinkedIn. Exclude Import agent, Direct_Lead, Affiliates, Import RM, organic. |
| How leads are attributed | By **Country + channel**, NOT by requiring a campaign/UTM match. |
| ACT filter | A campaign is ACT only if the Activity-Type token of its name is `ACT` (`Advertiser_Brand_Channel_ActivityType_Region_Country_Language_Level_Program_NOTES`). A PMax campaign named `_ACT_` counts. India YT/GDN/PMax campaigns are named BRAND/CONV/NURT, so "Google shows only Search" is by design — reply to Piers, not a bug. |
| Lead metrics source | Salesforce only. Funnel source `034025b2-d0b8-488a-886e-9b8dd1841d39` ("Leads with Converted info"). The "2022-2025 leads" source is No Access, so very old leads may be missing — check. |
| Pull rule | Pull Funnel fields directly, except Country, which uses the custom dimension below. |
| Deploy | Wait until all fixes are batched, then deploy once. |

## 3. Root cause of India YoY (+136% spend, +500% leads)

Verified against Funnel (workspace SEG `-OVwMtGNDkNfeFUS4d9G`):

- The cube (`public/data/hist_weekly.json`) shows India ACT 2025 (4 Aug–28 Sep) leads = **477**.
- Funnel, Salesforce, Country = India, 1 Aug–30 Sep 2025, by `traffic-source`:
  Adwords 2,201 · Facebook 126 · LinkedIn 41 · YouTube 9 → **2,377 paid leads** (Piers saw ~2,305).
  Non-paid: Import agent 1,540 · Direct_Lead 223 · Affiliates 8 · Import RM 5.
- So the 2025 history drops most paid leads because it only counts leads whose campaign/UTM
  matches a campaign row. Fix = attribute leads by Country + channel.
- Open question for the owner: Phoebe's earlier reply to Piers says 2025 India **Meta spend**
  is low (CHF 1,626) and last year's India Meta campaigns may sit in another ad account that
  is not in Funnel. That is a spend issue, separate from the lead undercount. Check it.

## 4. Funnel field IDs (workspace `-OVwMtGNDkNfeFUS4d9G`)

Note: the Funnel MCP tools `search_fields` / `get_workspace_context` were failing with a
"missing resultType" protocol error; `query_data` worked when the exact IDs were supplied.

| Cube column | Funnel ID |
|---|---|
| country (use this) | `dim-1j1dujqc8iu4p_Country` — custom: Salesforce lead country (contains "Viet" → Vietnam), LinkedIn by campaign-name tokens, GA4 country, others via the sheet Country columns then country code |
| channel | `traffic-source` |
| campaign | `campaign` |
| ad_group / ad set | `dim-1j3ojisfn118r_Audience` (LinkedIn: use `linkedin_api-campaign`) |
| ad | `ad` |
| cost / impr / clicks | `common-cost` / `common-impressions` / `common-clicks` |
| leads | `cf1j1duvi2djgtk_Lead` (Created Date) |
| gl | `cf1j457im7n2pst_Good_Leads` (from `dim-1j3qv0d0tb7g8_Lead_Status`) |
| reg | `cf1j1gseb4f85jg_Register_for_Portal` (Converted Date) |
| app | `cf1j3glr5v1q5f6_Applied` |
| acc | `cf1j1dv6ttig2lb_Accepted` |
| budget | `cf1j3o0r06ace91_Budget` |
| sessions | `cf1jadg3rdndbci_Session` (built on `googleanalytics-ga4:sessionStartEvents`; `…:sessions` is empty) |

Sanity numbers (Funnel, custom Country dim, spend matches exactly):
India spend 4 Aug–28 Sep 2025 = 24,784 · 3 Aug–27 Sep 2026 = 31,955 (these are geo-country
spend; compare with the market-based cube before trusting either).
Salesforce India leads 3 Aug–27 Sep 2026: Lead 4,232 · GL 552 · Reg 281 · App 67 · Acc 2
(all channels, including non-paid and no-UTM — paid-only will be lower).

## 5. To do (in this order)

1. **Rebuild 2024-08 → 2026-08 history** so leads/GL/Reg/App/Acc follow §2 (Country + paid
   channel, no campaign requirement). Spend/impr/clicks still come by campaign/ad group/ad.
   Re-check India 4 Aug–28 Sep 2025 leads ≈ 2.3–2.4k afterwards.
2. Leads with no campaign need a row with empty campaign/ad group so Piers can filter by
   audience and still see a "(no value)" row and ALL leads in the YoY.
3. Reply to Piers in `#seg-reporting-dashboard` (Google = ACT only by design; 552 leak fixed;
   YoY cause + status).
4. Remaining Piers requests: add **Program** to the Google comparison toggle (leads/pipeline
   with YoY), add **Audience** to the Meta comparison, drop "CHF" from cost cells, a social
   boosting on/off toggle for Meta spend, longer period than a week on Search Keywords, and
   a warning that the suggested negative keywords look relevant.
5. **New "Alert Setup" page** — see §6.
6. Budget page: "CHF/day now" must come from the `Budget daily` columns of the `*_Setup`
   sheets (the budget actually set up), compared against the target daily budget.
7. Build, `wrangler deploy` once, then verify.

## 6. Alert Setup page (new)

Port the owner's Apps Script `checkSetupSheetsWithGemini` into a dashboard page, for **PPC
and Meta** (the script was Google/ACT only). Keep the existing ACT-only filter.

Sources (read-only):
- PPC: sheet `1KGhN3AYhMNly1MmnI3YUAiCIZtWihUaAJnwTI-lx1Lk`, tabs `CAAS_Setup`, `SHMS_Setup`,
  `CRCS_Setup`, `HIM_Setup` — columns include `Campaign`, `campaign type`, `target location`,
  `Budget daily`, `URL ad final`.
- Meta: sheet `1Tp4Kapdg7nacBoLLgIfr8UTTiAC6e3kjs8BkcbcwVYY`, tabs `📁 Campaigns`, `📦 Ad Sets`
  (gid 361334113), `🎨 Ads` — Ad Sets has `adset_name`, `daily_budget`, `countries`,
  `effective_status`.
- Final-URL truth: sheet `15kXVWZ_sITHEDHCOy-KXvi9FFtM3EZQA_LyN2sgjmVc`, tab `Landing page`
  (gid 1279750889): columns `Activity, School, Page, Language, Status, Link`. A final URL must
  equal the page for the right **school + market + language** when a special page exists;
  otherwise it must be the school's **Generic** page. No other URL logic.

Checks (from the script): parse the campaign name (advertiser, brand, channel, activity,
region, country, language, level, program); ACT only; missing final URL / target location;
URL vs the Landing page sheet; target location vs the campaign country (treat Global / region
targets as skipped); budget: compare daily budget set up in the `*_Setup` sheets with the
target. Output = issues grouped by type (Location, URL, Other, Budget) with severity.

Security: the Apps Script that was pasted in chat contains a live Slack webhook URL and a
Gemini API key. Do NOT copy them into the repo or the bundle; load them from Worker secrets
(`wrangler secret put`) and rotate both, since they were exposed in a chat.

## 7. Don't lose it again

The source of the dashboard had no repo and the build container was lost once. Commit the
local project to a repo (the cloud session kept a copy under `seg-dashboard/frontend/` and
`seg-dashboard/worker/`) and keep `wrangler.toml` + a `package.json` with it (the uploaded zip
had no `package.json`; a reconstructed one is at `seg-dashboard/frontend/package.json`).
