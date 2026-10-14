# SEG Conversion Campaign — Pre-Launch Audit

Run this against any SEG ad-hoc **CONV** (event / webinar / open-day / seminar) Meta
campaign **before it goes to the client/boss and before un-pausing**. Every item is a
rule we've established or a point from a boss review. Mark ✅ / ❌ / N/A and fix ❌ first.

How to pull the live state to audit: `ads_get_ad_entities` at `campaign`/`adset`/`ad`
level filtered by `campaign.id`, fields `["id","name","targeting","effective_status"]`;
image dims via `ads_get_ad_images(hashes=…, fields=["hash","name","width","height"])`;
renders via `ads_get_ad_preview` → screenshot the `preview_url` in ego-lite (previews of
dynamic creatives return NO image — never eyeball canvas size).

---

## A. Campaign
- [ ] **Objective / buy type** — conversion objective, `AUCTION`, **ABO** (budget at ad-set, no CBO).
- [ ] **Budget source correct** — e.g. brand-protection budget for a *global* campaign (this is why the region tag is `Global`, not a country).
- [ ] **Naming** `PL_<School>_FB_CONV_<Region>_<Country>_<Level>_<Program>_<Notes>`
  - Region = **`Global`** for global brand-protection campaigns (NOT the sheet's generic worldwide `ALL`).
  - Notes = event format **`EventType-Theme/Name-Date`** → e.g. `Webinar-BusinessOfLuxury-26Aug26` (same format as open days).
- [ ] **Status = PAUSED.**

## B. Ad sets
- [ ] **Naming aligned across all ad sets** — geo/region tags consistent, `<Region>_<City>_<Level>_<Program>_<AudType>_<AudDesc>_<Notes>`.
- [ ] **Audience structure = one ad set per quality tier, split for spend control:**
  - Web/LP-visitors ad set **EXCLUDES** the Qualified-Leads audience (reach un-converted visitors).
  - Qualified-Leads ad set (offline-events audience) has **NO web/LP exclusion** — every qualified lead passed through web/LP, so excluding them would empty the audience.
- [ ] **Advantage+ Audience OFF** — `targeting_automation.advantage_audience == 0`. ⚠ Re-check this **after any UI edit** — the UI silently turns it back on.
- [ ] **Audience expansion off** — `targeting_relaxation_types` lookalike = 0, custom_audience = 0.
- [ ] **Placements** — manual (not Advantage+ placements) if that's the account standard; FB/IG/Threads as intended.
- [ ] **Geo present & correct** — `geo_locations` actually set (a UI audience/targeting restructure can **wipe it**); country list = the intended markets (e.g. top historical-origin countries).
- [ ] **Age** — if Thailand is targeted **with a custom audience**, `age_min ≥ 20` (Meta forces it).
- [ ] **Budget/day set**, and any start/end schedule aligns with the event date.

## C. Creatives / ads
- [ ] **Naming** `<Region>_<Theme>_IMG_EN_<Asset>_<CopyVer>` — Theme = the event name in the `EventType-Theme-Date` format.
- [ ] **Feed asset is the correct format** — **1:1 (1080×1080)** shows in Feeds (verify the render; a broken placement setup shows the 9:16 in feed).
- [ ] **Story/Reels asset is 9:16 (1080×1920)** — set **per placement in the Ads Manager UI** ("Edit per placement"); the API/MCP can't do per-placement different images (empty-spec default rule is dropped).
- [ ] **Render-verified** — screenshot Feed + Story/Reels previews; confirm the right aspect per placement (don't trust config or canvas size alone).
- [ ] **Copy = conversion tone** — event urgency, hard CTA ("Save your seat"/"Reserve your spot"), correct date/time/timezone, per-school facts accurate, no banned words.
- [ ] **Link = correct LP** (`lp.<school>.com/<event>`), **CTA = SIGN_UP**.
- [ ] **Advantage+ Creative enhancements OFF** per ad (the API opt-out field is deprecated — confirm in the UI).
- [ ] **UTM present** on every ad — `url_tags` = `utm_source=Facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}` (it's immutable on an existing ad — set at creative build time).

## D. Tracking & measurement (the campaign is worthless without this)
- [ ] **FB pixel installed on the LANDING PAGE** — `lp.<school>.com/<event>`, not just the main site. Netlify LPs often ship WITHOUT it.
- [ ] **Registration/Lead event fires** on the LP form submit, via the pixel (Standard event, e.g. `Lead`/`CompleteRegistration`).
- [ ] **Conversion event configured** for the campaign's optimization/reporting.
- [ ] **Retargeting audiences source from the right pixels** — e.g. SHMS `1796991563891948`, `2021401795060303`; qualified-leads from the offline-events set.

## E. Launch safety
- [ ] **Everything PAUSED** until written client/boss sign-off.
- [ ] **Do NOT trigger the account's global "Review and publish (N drafts)"** — those N drafts are not ours. All setup is via the API, which bypasses that queue; never duplicate with `source_ad_id` (it creates drafts).
- [ ] **Delete/replace via `ARCHIVED`** (status `REMOVED` is rejected).
- [ ] **Final schedule check vs. the event date** before anyone un-pauses.

---

### Boss-review crosswalk (SHMS "Business of Luxury" webinar, Aug 2026)
| Boss point | Audit item |
|---|---|
| Webinar naming = `EventType-Theme-Date` | A · Naming |
| Region tag `Global` (brand-protection budget) | A · Naming / Budget source |
| Ad-set geo naming aligned | B · Naming |
| Qualified-leads can't exclude web/LP | B · Audience structure |
| Advantage+ Audience turned off | B · Advantage+ Audience OFF |
| No FB pixel on the LP | D · Pixel on landing page |
| Event tracking not using the pixel | D · Registration/Lead event |
| Campus Sunset feed assets wrong format | C · Feed asset 1:1 / render-verified |
