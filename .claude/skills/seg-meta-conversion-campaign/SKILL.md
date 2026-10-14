---
name: seg-meta-conversion-campaign
description: "Build an SEG (Swiss Education Group: CAAS, SHMS, HIM, CRCS) ad-hoc CONVERSION / retargeting Meta campaign end-to-end via the Meta Ads MCP: webinar, open day, seminar or application-deadline pushes. Use when asked to build or duplicate a Meta conversion/retargeting campaign for an SEG event, set up webinar or open-day ads, add 9:16 story images per placement, add UTM tracking, target the best historical countries, switch geo to worldwide, or duplicate ads across ad sets. Builds campaign, ad sets, single-image creatives and ads, everything PAUSED, and never touches the account's Review and publish drafts queue. Distinct from seg-meta-copy / seg-us-act-meta-copy (copy) and seg-meta-monthly-budget (budgets).\n"
---

# SEG Meta conversion / retargeting campaign builder (API)

Build a SEG ad-hoc **conversion** (event/webinar/open-day) Meta campaign directly on the
live ad account via the **Meta Ads MCP** (`ads_*` tools; server id looks like
`00389a09-8088-4b8d-a5d4-531d9ffc095d`). Everything is created **PAUSED** for client
sign-off. This skill is the hard-won playbook from the SHMS "Business of Luxury" webinar
build (Aug 2026) — the copy discipline is in the [[seg-shms-luxury-webinar-campaign]] and
[[seg-us-act-meta-copy]] memories; this file is the **mechanics + gotchas**.

## Golden rules (read first)
1. **Everything PAUSED.** `ads_create_ad` creates PAUSED. Only un-pause on explicit client approval, and only after checking the schedule vs. the event date.
2. **NEVER click / trigger the account's global "Review and publish (N)".** SEG accounts carry dozens of unrelated UI drafts. All API writes (`ads_create_*`, `ads_update_entity`) apply directly to live objects and do NOT enter that draft queue — that's exactly why we use the API, not the Ads Manager UI. Do NOT use `source_ad_id` to duplicate (it creates DRAFTS that hit the queue) — recreate with an explicit `creative` instead.
3. **Verify visually, never assume.** Dynamic-creative (`asset_feed_spec`) ads return a preview **iframe with NO rendered image** from `ads_get_ad_preview`. To truly confirm an image/placement, open the `preview_url` in **ego-lite** and screenshot it (see "Verify a render"). See [[feedback-verify-dont-assume-render]].
4. Keep one `client_conversation_id` (20 alphanum chars) across every Meta Ads tool call in the session.

- **No Meta auto-content, ever (PEEL rule).** Every creative MUST explicitly opt out of: `creative_sourcing_spec` (`website_media_spec`, `website_summary_spec`, `catalog` → OPT_OUT), `media_sourcing_spec: []`, `degrees_of_freedom_spec.creative_features_spec` (the **full 82-key OPT_OUT list** in `meta-ads-creation/references/creative-features-optout.json`; a partial list causes 2446880 "WhatsApp number required"), `biz_ai.capabilities.prompts` OPT_OUT and `contextual_multi_ads` OPT_OUT. Never click the trash icon on Related media in Ads Manager: it writes more than 30 per-item opt-outs, and publish fails with error 105. Without these, Ads Manager attaches **"Related media"** (dozens of other account images) and AI "selling points". Duplicating in Ads Manager turns them back on (`DUPLICATION_UPGRADE`). Never reuse an old `creative_id` to copy an ad: deprecated CTA `link_title/link_description` makes publishing fail with error #1815589, so rebuild inline. The full block and QC checklist are in the `meta-ads-creation` skill, `references/ai-optouts.md`.
- **Don't change ad-set or campaign status** unless asked. Paused ad sets are usually intentional.

## Reusable IDs (SHMS example — swap per school/campaign)
- Ad account `1763026957318451` (SEG, CHF). SHMS Page `108901562465426`.
- Confirm the account is queryable first if unsure: `ads_get_ad_accounts` → `is_queryable`.

## End-to-end workflow
1. **Copy** — conversion ≠ ACT: warm/retargeting, event urgency, HARD CTA (`SIGN_UP` "Save your seat"), angles not the ACT theme-matrix, per the [[seg-shms-luxury-webinar-campaign]] rules and per-school facts ([[seg-search-copy-client-facts]]).
2. **Campaign / ad sets** — usually **duplicate an existing** event campaign (Open Day etc.): OUTCOME_AWARENESS/AUCTION, **ABO** (no CBO), **no Advantage+** (`advantage_audience=0`, `targeting_relaxation lookalike/custom=0`, manual placements). ⚠ **Advantage+ Audience re-enables itself when the ad set is edited in the UI** — re-verify `targeting_automation.advantage_audience==0` after any UI change. **Audience structure (retargeting event):** split into separate ad sets so spend is controlled per quality tier — (a) **Web/LP visitors** ad set that **EXCLUDES** the Qualified-Leads audience; (b) **Qualified Leads** ad set (offline-events audience) with **NO web/LP exclusion** — you can't exclude web/LP from qualified leads because every qualified lead passed through the web or LP.
3. **Naming** — apply the SEG "UTMs & Campaign Naming" sheet (`1scyvRTKRx7zdbPcfnEX_62uqNmLkBIuO5hcogJnOkPg`). Campaign = `PL_<School>_FB_CONV_<Region>_<Country>_<Level>_<Program>_<Notes>`. Ad set = `<Region>_<City>_<Level>_<Program>_<AudType>_<AudDesc>_<Notes>`. Ad = `<Region>_<Theme>_IMG_EN_<Asset>_<CopyVer>`. Rename via `ads_update_entity` `{"name": …}` (campaign/ad_set/ad; `url_tags` is NOT editable here). **Region tag:** for a **global brand-protection-budget** campaign the client uses **`Global`** (NOT the sheet's generic worldwide `ALL`) — confirm which budget/label applies. **Event Notes + ad Theme use the open-day format `EventType-Theme/Name-Date`**, e.g. `Webinar-BusinessOfLuxury-26Aug26` (so the ad Theme field = `Webinar-BusinessOfLuxury-26Aug26`, not a bare "LuxuryWebinar").
4. **Images** — `ads_creative_upload_image` is **URL-only** (no local files, and Google **Drive share** links are rejected). Pipeline: put PNGs in a public Drive folder → use the `https://lh3.googleusercontent.com/d/<FILE_ID>=w1080` CDN URL (curl-verify HTTP 200 image/png first) → upload → capture `image_hash`. Feed = 1080×1080 (1:1); Story = 1080×1920 (9:16). See `references/drive_image_pipeline.py`.
5. **Creatives + ads** — build with `ads_create_ad` (pass the whole creative as the raw `creative` JSON string — the MCP forwards `object_story_spec`/`asset_feed_spec`/`url_tags` to the Graph API even though they aren't named params). **Per-placement different images (1:1 feed + 9:16 story) CANNOT be set via this MCP** — see the VERDICT below. So either build a **plain single-image** creative with the 1:1 feed asset (feed correct; Stories auto-crop the 1:1), or build the ad and have the client set the true 9:16 story per placement in the **Ads Manager UI**.
6. **Geo** — prefer targeting **top historical-origin countries** (from the school's "Historical In-house students" pivot) over literal worldwide; it's sharper for retargeting AND dodges the Universal Ads declaration bug (below). Updating `targeting` **replaces the whole spec** — read the current targeting first (`ads_get_ad_entities` fields `["id","name","targeting"]` filtered by `campaign.id`), then resend the FULL clean spec with only geo changed (drop `effective_*`/`page_types`). 
7. **UTM tracking** — add `url_tags` at the **creative** level (see below).
8. **Previews** → send `preview_url`s to client. **Verify story/reels renders** yourself (ego-lite screenshot).
9. **Duplicate to other ad sets** — recreate the 4 ads with explicit `creative` in the second ad set (NOT `source_ad_id`).

## asset_feed_spec — placement-customized image creative (1:1 feed + 9:16 story)
Pass inside `ads_create_ad`'s `creative` (raw JSON string). `object_story_spec` holds only `page_id`; the images/copy live in `asset_feed_spec`; `url_tags` is a sibling top-level creative field.
```jsonc
{
  "object_story_spec": {"page_id": "<PAGE_ID>"},
  "url_tags": "utm_source=Facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}",
  "asset_feed_spec": {
    "ad_formats": ["SINGLE_IMAGE"],
    "images": [
      {"hash": "<FEED_1x1_HASH>",  "adlabels": [{"name": "img_feed"}]},
      {"hash": "<STORY_9x16_HASH>", "adlabels": [{"name": "img_story"}]}
    ],
    "bodies": [{"text": "<primary text>"}],
    "titles": [{"text": "<headline>"}],
    "descriptions": [{"text": "<description>"}],
    "link_urls": [{"website_url": "https://lp.<school>.com/<event>"}],
    "call_to_action_types": ["SIGN_UP"],
    "asset_customization_rules": [ /* ⚠ can't be sent via this MCP — see VERDICT below; use plain single-image, or set per-placement media in the Ads Manager UI */ ]
  }
}
```

### ⚠ VERDICT — per-placement image customization is NOT possible via this MCP (confirmed 2026-08-18)
Goal: 9:16 story image on FB/IG **story + reels**, 1:1 feed image everywhere else.
- A rule set with only two non-default rules (feed rule with a broad but **non-empty** `customization_spec`) is ACCEPTED by Meta but renders WRONG — Stories fall back to the **1:1 square** (boxed on a dark card, appears with the Sign-up CTA), not the 9:16.
- Meta's validation demands: **"Default Asset Customization Rule (with lowest priority) with empty `customization_spec` is required."** Attempts with `{"priority":1,"image_label":{"name":"img_feed"},"customization_spec":{}}` (empty object) STILL returned that same error — the empty `{}` is likely being dropped in transit or the priority/shape is wrong.
- **RESOLVED / VERDICT (2026-08-18): per-placement image customization is NOT achievable through this MCP.** Meta requires that **exactly one** `asset_customization_rule` match **every** ad format — proven by the preview error "Ad asset feed invalid target rule count for format: … 0 target rule(s) for MOBILE_FEED_STANDARD, but exactly 1 target rule for this format is expected." To cover formats you don't enumerate, Meta **mandates a default rule with an EMPTY `customization_spec` and lowest priority** ("Missing Default Asset Customization Rule … with empty customization_spec is required"). But the MCP **silently drops the empty `{}` object** in transit, so that default rule can never be sent — every variation (empty `{}`, `is_default`, explicit non-overlapping positions, platforms-only) failed across 4 attempts. Net: `asset_feed_spec` with `asset_customization_rules` renders the WRONG image per placement and can't be corrected via the API.
  - **Do this instead:** (a) build ads as **plain single-image** with the 1:1 feed asset (feed correct; Stories auto-crop the 1:1 — acceptable), OR (b) set the true per-placement media (1:1 Feeds, 9:16 Stories/Reels) in the **Ads Manager UI** ("Edit per placement"). The UI is the only reliable route for a *different* 9:16 story image. Whichever, **verify the render via ego-lite screenshot** — dynamic-creative previews return an iframe with no image.

## UTM tracking
`url_tags` is **immutable on an existing ad** (`ads_update_entity` rejects `url_tags` at `entity_type=ad`) and creatives are immutable — so to add/change it you must **rebuild the creative** with `url_tags` baked in and recreate the ad, then ARCHIVE the old one. Meta macros `{{campaign.name}} / {{adset.name}} / {{ad.name}}` auto-fill from the names, so keep the naming convention clean.

## Other confirmed gotchas
- **Delete an ad:** status `REMOVED` is rejected ("invalid adgroup_status"); use **`ARCHIVED`** via `ads_update_entity`.
- **Worldwide geo (`geo_locations.country_groups:["worldwide"]`)** requires a **Universal Ads declaration** — Meta errors "use TAIWAN_UNIVERSAL". Setting `regional_regulated_categories:["TAIWAN_UNIVERSAL"(,"SINGAPORE_UNIVERSAL")]` via `ads_update_entity` returned repeated **INTERNAL** errors (broken via MCP). Workaround: **target an explicit country list that excludes Taiwan & Singapore** (they trigger the declaration) — no declaration needed, writes cleanly. Also exclude Russia (Meta doesn't deliver) and know China under-delivers (FB blocked in-country).
- **Thailand min age:** targeting Thailand with a custom audience forces `age_min ≥ 20` ("targeting options unavailable for young people"). Bump `age_min` to 20.
- **`ads_get_creatives` / `ads_get_ad_images`** don't return `asset_feed_spec`; `ads_get_ad_images` with `hashes` + `fields:["hash","name","width","height"]` confirms image dims.
- Fresh ads show `PENDING_REVIEW` even while PAUSED — normal, they don't deliver while paused.

## Pre-launch checks (do before un-pausing)
Run the full **[SEG Conversion Campaign — Pre-Launch Audit](references/conversion-campaign-audit.md)** (naming, ad-set structure/audiences, Advantage+ off, geo, creative format, UTM, tracking, launch safety) against the live campaign before sign-off — it's the boss-review checklist codified. Key gates:
- **Landing-page pixel + event tracking (critical for a CONVERSION campaign).** The event LP (`lp.<school>.com/<event>`, usually a Netlify build) needs the **Facebook pixel installed AND a Lead/registration event** firing on submit — otherwise LP-visitor audiences don't grow and registrations aren't tracked as conversions. The retargeting *audiences* run off the **main-site** pixels (e.g. SHMS `1796991563891948`, `2021401795060303`), but the LP has its own gap. This is a landing-page fix (client/dev on Netlify), not an ad-account one.
- **Re-verify geo after any UI edit.** A UI audience/targeting restructure can **wipe `geo_locations`** — re-read the ad sets and re-apply the country list if it's gone.
- **Re-verify `advantage_audience==0`** (UI edits re-enable it).
- **Confirm the schedule vs. the event date** before un-pausing. Everything stays PAUSED until sign-off.

## Verify a render (ego-lite)
`ads_get_ad_preview` → take the `preview_url` (decode `&amp;`→`&`) → in `ego-browser nodejs`: `openOrReuseTab(url,{wait:true})`, `wait(5)`, then `cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})`, write the base64 to a file with `const {writeFileSync}=await import('node:fs')`, and **Read** that PNG. The lightweight `preview_iframe.php` page screenshots fine even though the full Ads Manager editor times out in ego/Chrome.
