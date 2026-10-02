# SEG dashboard — handoff from cloud session to local Claude

> **READ FIRST (2026-10-02).** The live dashboard is newer than anything in this repo. Between
> the 1 Oct upload and 2 Oct 04:36 UTC the local project deployed three more times; the live Worker
> now has more routes and more secrets, and the live bundle is larger (it has the Alert Setup page).
> The copy in this repo (`worker/`, `wrangler.toml`, `frontend/`) is a snapshot of the 1 Oct source.
> **Do not deploy from this repo** — it would overwrite the newer Worker and page. The patches
> below are against the 1 Oct snapshot; apply them to the current local source (a `patch` that
> fails on `tracker.tsx` / `styles.css` means the local file changed: redo the change by hand from the
> description). Nothing here has been deployed.

This file is the full spec (it also holds older items: the market filter, India YoY, Piers, Funnel IDs). The message to send to local is `LOCAL_PROMPT.md` (same folder): it covers only the Actions page and the Alert Setup page, §1b–1d.
Everything is on branch `claude/hopeful-archimedes-7djwwm` of `phoebe-rgb/PEEL`. Nothing here was
deployed — the live site is unchanged.

## 1. Apply the code changes already made

Apply in this order, from the project root (the folder with `src/`):

```bash
patch -p1 < fix2-market-filter.patch                       # 1a, src/App.tsx
patch -p1 < actions-setup-high-and-type-filter.patch       # 1b, Actions page
```
Both were checked against the original uploaded zip: they apply cleanly, `tsc --strict` passes,
53 tests pass, `vite build` is clean, and the Actions page was exercised in a browser.

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
- **Platform follows the channel.** There is no separate Budget or Search keywords platform any
  more: budget actions are Google Ads / Meta / LinkedIn by their channel (a LinkedIn tab only shows
  when it has actions), negative-keyword actions are Google Ads. The action id is still hashed from the
  old name (`idNs` in `push`), so Done / Dismiss saved before the change still applies (checked in a
  browser: state saved by the old build stayed applied on the new one).
- **Every budget action is in the main table, never the backlog** (`pickWeek` in `lib/kinds.ts`):
  budget pacing, plan lines with no plan / not started, and approved budget moves. The top-8 per owner
  cap only applies to the other actions. With today's data that is 43 budget rows + the others, so the
  table is long (59 rows). Daily-budget changes count as Budget pacing, not Setup (owner decision).
- Where this meets the newer local source: the Alert Setup page now exists locally. Any action it
  creates must have `kind: 'Setup'` (then `withPriority` makes it High and it shows under the Setup
  filter) and `platform` = its channel via `platformOfChannel()`.

### 1c. False alert: "N active ads have no destination link" (boosted posts)

Cause, checked on the live data (`setupcheck`, 2 Oct): 29 active ads have no link and **all 29 are
boosted posts** (`urlSource = "boosted post (no link found)"`, ad name contains `BoostedPost`); the
other 239 ads have a link. A boosted post keeps its link in the Page post (the "Learn more" button),
so the Marketing API returns no `link_url` for it. Both ads in the report
(`PL_CAAS_FB_NURT_APAC_IN_ALL_ALL`: `…StudentLifeBeyondKitchen=10Sep26`, `…SammyStory-10Sep26`)
are boosted posts with call_to_action `LEARN_MORE`. What could not be checked: the URL behind the button.

The rule in the live bundle only tests `!(ad.website || ad.url || '').trim()`. Search the source for
`no destination link` and exempt boosted posts (the export already marks them):

```ts
const isBoostedPost = (a: { urlSource?: string }) => /^boosted post/i.test(a.urlSource ?? '');
const noLink = ads.filter((a) => !(a.website || a.url || '').trim() && !isBoostedPost(a));
// optional, low severity: "N boosted posts — the link cannot be read through the API, check the Learn more button"
```

### 1d. Alert Setup: check live campaigns only; "ad engagement" is not Advantage+ creative

Owner rules, 2 Oct (both in the Alert Setup page source, which only the local project has).

**Live only.** The page today checks every campaign that is *configured* on: PPC `state === 'ENABLED'`,
Meta `status === 'ACTIVE'`. That includes campaigns that deliver nothing. Check only live ones:
live = spend > 0 in the last 7 days of the `live` cube (same campaign name, `+` ↔ space normalised
for Meta). On 2 Oct (window 26 Sep – 2 Oct) this drops 9 of 126 ENABLED PPC campaigns and 1 of 25
ACTIVE Meta campaigns:

- PPC: `PL_CAAS_GA_ACT_Europe_FR_FR_BAC_Culinary_Programs`; SHMS `…UAE_EN_ALL_ALL_Hospitality-Switzerland`,
  `…UAE_EN_ALL_ALL_Brand`, `…UAE_EN_SD_PD_Programs`, `…EMEA_GR_EN_ALL_ALL_Brand`, `…APAC_MM_EN_SD_PD_Programs`;
  HIM `…APAC_MM_EN_ALL_ALL_Programs`, `…APAC_ID_EN_ALL_ALL_BusinessSchoolSwitzerland`,
  `…Scandi_SE_EN_ALL_ALL_BusinessSchoolSwitzerland`.
- Meta: `PL_CAAS_FB_ACT_Americas_US_SD_ALL`.

```ts
// spend7[campaign] from the live cube: sum of cost over the last 7 days up to the latest data day
const isLive = (campaign: string) => (spend7.get(campaign.replace(/\+/g, ' ')) ?? 0) > 0;
const ppcToCheck  = ppc.filter((r) => r.state === 'ENABLED' && isLive(r.campaign));
const metaToCheck = metaCampaigns.filter((c) => c.status === 'ACTIVE' && isLive(c.name));
// ad sets and ads inherit from their campaign; keep their own ACTIVE test as well.
```

Show a small grey line under the page title: "Checked: N live campaigns · M enabled campaigns with no spend in 7 days skipped"
so a skipped campaign is never silently invisible. A campaign that has just been created and has not
spent yet will be skipped until its first spend; that is the intended behaviour.

**Indonesia, live campaigns only** (this replaces my earlier count): SHMS 5 Google/Meta ID campaigns,
CAAS 6, HIM 1 are all live and spending. HIM `…ID_EN_ALL_ALL_BusinessSchoolSwitzerland` has no spend
in 30 days, so it is skipped. The Landing page sheet now has Indonesia = Live for CAAS (E9) and HIM (E30);
SHMS has no Indonesia row.

**Ad engagement is not Advantage+ creative.** The `Advantage+` rule (`adv|${advOn}` in the bundle)
flags any ad whose `advOn` is not `none…`. `advOn` is the list of `creative_features_spec` keys that
are on. Ignore the engagement key, `inline_comment` ("relevant comments"), before testing and before
printing the `found` text:

```ts
const IGNORED_ADV = new Set(['inline_comment']); // ad engagement: allowed, not an Advantage+ creative enhancement
const advKeys = (e: { advOn?: string }) =>
  (e.advOn ?? '').split(',').map((s) => s.trim()).filter((s) => s && !/^none/i.test(s) && !IGNORED_ADV.has(s));
// rule: advKeys(e).length > 0  → key `adv|${advKeys(e).join(', ')}`, found: advKeys(e).join(', ')
```

Effect on today's data: 10 active ads carry `inline_comment`, but each also has other enhancements
(`standard_enhancements`, `product_extensions`, `show_destination_blurbs`, `ads_with_benefits`, …),
so they stay flagged for those; only the `found` text and the grouping change. If the owner means a
different key by "ad engagement", add it to `IGNORED_ADV`. The `🎨 Ads` sheet has no such column
(`adv_music`, `adv_image_*`, `adv_text_improvements`, `adv_related_videos`, `adv_3d_animation` only),
so if the page ever reads the sheet instead of the API, nothing more is needed there.

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
