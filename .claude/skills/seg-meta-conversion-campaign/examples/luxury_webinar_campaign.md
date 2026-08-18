# Worked example — SHMS Luxury Webinar (global) campaign

A complete build to pattern-match against. Account: SEG (CHF), ad account `1763026957318451`, SHMS
Page `108901562465426`. Objective `OUTCOME_AWARENESS`, AUCTION, ABO, Advantage+ OFF. Everything
PAUSED. (IDs are illustrative of the real build; use the current account's IDs when you run it.)

## 1. Campaign
`PL_SHMS_FB_CONV_ALL_ALL_ALL_ALL_LuxuryWebinar-26Aug26` — `OUTCOME_AWARENESS`, `AUCTION`, ABO
(no campaign budget), Advantage+ campaign OFF, `status=PAUSED`.

## 2. Ad sets (2), both PAUSED
Both: REACH/IMPRESSIONS billing, manual FB+IG+Threads placements, `advantage_audience=0`,
targeting_relaxation lookalike/custom=0, **`is_dynamic_creative=false`**, age 18–65.
- **Ad set 1** — daily CHF3.
- **Ad set 2** — daily CHF2.
- **Audiences (both): reuse the duplicated source campaign's audiences unchanged** — the exact same
  included custom audiences and the same exclusions the source Open Day campaign already had. Do NOT
  add new audiences (no "top 25%" segment, no new lookalikes).
- **Geo:** worldwide — **leave the location empty** (no `geo_locations` at all). Do not use the
  `country_groups=["worldwide"]` + Universal-Ads declaration route; that returns INTERNAL via the API.

## 3. Images (public → image_hash)
Per creative, a 1:1 feed (1080×1080) and a 9:16 story (1080×1920), uploaded via public URLs with
`ads_creative_upload_image` → capture `image_hash` for each.

## 4. Creatives + ads (4 per ad set = 8)
Two copy variants (V1 "sit in on a Master's", V2 "what makes iconic brands win") × two images
(Speaker, Campus). Each creative:
- `object_story_spec.page_id = 108901562465426`
- link `https://lp.shms.com/luxury-webinar`, `call_to_action` type `SIGN_UP`
- top-level `url_tags` (SEG UTM template)
- Advantage+ creative enhancements OFF (confirm in UI at review)
- **Placement Asset Customization** `asset_feed_spec` with the two labelled images and the two rules
  (Story/Reels→9:16, `is_default`→1:1) — see `references/placement-asset-customization.md`.
- Ad built with explicit `creative` (never `source_ad_id`), `status=PAUSED`, name
  `ALL_LuxuryWebinar-26Aug26_IMG_EN_{Speaker|CampusSunset}_{1|2}`.

Ad set 2 = the same 4 ads recreated with explicit creatives (not duplicated via `source_ad_id`).

## 5. Verify + hand off
`ads_get_ad_preview` per ad, then open each `preview_url` in ego-lite and confirm 9:16 on
Story/Reels and 1:1 on Feed. Send previews to the client. All 8 ads PAUSED.

## Pre-launch checklist (human)
- [ ] Advantage+ creative confirmed OFF per ad in Ads Manager (API opt-out field deprecated)
- [ ] Client sign-off on creatives
- [ ] Schedule checked against the webinar date (Wed 26 Aug) before un-pausing
- [ ] Do not click the account's global "Review and publish (54)" — those drafts are not ours
