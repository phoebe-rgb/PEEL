# SHMS Luxury Webinar — GLOBAL campaign — SESSION WRAP-UP (2026-08-18)

Full running detail is in `LUX_WEBINAR_GLOBAL_RESUME.md`. This is the summary.

## What got built (all via the Meta Ads MCP, all PAUSED)
- **Campaign** `120250983803350323` — `PL_SHMS_FB_CONV_ALL_ALL_ALL_ALL_LuxuryWebinar-26Aug26` (OUTCOME_AWARENESS, ABO, no Advantage+). Ad account `1763026957318451`, SHMS Page `108901562465426`.
- **2 ad sets**, each with the 5 retargeting custom audiences + 2 exclusions, advantage_audience OFF, manual FB/IG/Threads placements, age 20–65:
  - Ad set 1 `120250984139560323` — `ALL_ALL_ALL_ALL_WEB_Top25WebVisitors-180days` (CHF3/day)
  - Ad set 2 `120250984143570323` — `ALL_ALL_ALL_ALL_CL_QualifiedLeads_Sep22-Oct25` (CHF2/day)
- **8 ads** (4 per ad set), 2 copy variants × Speaker/Campus image, all with:
  - Placement-customized **dynamic creatives** (`asset_feed_spec`): 1:1 feed image + 9:16 story image.
  - **UTM** `url_tags`: `utm_source=Facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}`
  - Link `lp.shms.com/luxury-webinar`, CTA `SIGN_UP`.
  - Live ad ids — Ad set 1: Speaker_1 `120250991103330323`, CampusSunset_1 `120250991132460323`, Speaker_2 `120250991134900323`, CampusSunset_2 `120250991136990323`. Ad set 2: Speaker_1 `120250991140430323`, CampusSunset_1 `120250991142200323`, Speaker_2 `120250991145800323`, CampusSunset_2 `120250991157880323`.
- **Geo**: targets the **top-22 SHMS historical-origin countries** (from the In-house-students pivot) — CN VN MM SA IN TH ID HK US SE CH KH KR MY AE FR CA GB DO MO NO IT — instead of literal worldwide (which is blocked by a Meta Universal Ads declaration bug via the API).
- **Naming**: applied the SEG "UTMs & Campaign Naming" sheet convention (worldwide Region = `ALL`).
- **Images**: 3 feed (1080×1080) + 3 story (1080×1920) pushed to a public Drive folder → lh3 CDN URLs → uploaded to the account.

## ⚠ OPEN ISSUES (do these before launch)
1. **Stories/Reels render the 1:1 square, not the 9:16 story image — DIAGNOSED + SOLVED 2026-08-18, see `LUX_WEBINAR_STORY_FIX.md`.** Root cause: the backup rule was attempted as an **empty `customization_spec: {}`**, which Meta rejects → no valid default → Story/Reels fell back to the 1:1 feed image ("square favicon on the story/reels end card"). Meta flags the default rule with **`is_default: true`** (not an empty spec). `LUX_WEBINAR_STORY_FIX.md` has the corrected `asset_feed_spec` (two rules: Story/Reels→9:16, `is_default`→1:1) ready to fire. STILL TODO (needs the ads MCP `00389a09…` connected): rebuild the 8 creatives/ads with it, archive the old 8, and **verify IG Story + IG Reels render via ego-lite screenshot** before claiming it fixed. Also confirm each ad set has `is_dynamic_creative=false`.
2. **Confirm Advantage+ Creative is OFF** per ad in Ads Manager (the API opt-out field `standard_enhancements` is deprecated; ads were built without it).
3. **Client sign-off** on the creatives (previews were sent).
4. **Check schedule vs. the webinar date Wed 26 Aug 2026** before anyone un-pauses. Everything is PAUSED now.

## Meta API gotchas learned (now codified in the skill)
- `url_tags` is immutable on an existing ad → must rebuild the creative to change UTM.
- Delete an ad = status `ARCHIVED` (`REMOVED` is rejected).
- Worldwide geo needs a Universal Ads (Taiwan/Singapore) declaration that returns INTERNAL via the MCP → target an explicit country list excluding TW/SG instead.
- Thailand + custom audience forces age_min ≥ 20.
- Dynamic-creative previews return an iframe with NO image → verify by screenshotting the `preview_url` in ego-lite.
- Never use `source_ad_id` to duplicate (creates drafts that hit the "Review and publish" queue); recreate with explicit `creative`. Never touch the global "Review and publish (54)".

## Deliverables from this session
- Skill: `~/.claude/skills/seg-meta-conversion-campaign/` (local) + committed to a branch of the PEEL repo (push pending — needs your GitHub auth).
- Memory updated: `seg-shms-luxury-webinar-campaign`, new `feedback-verify-dont-assume-render`.
- This wrap-up + `LUX_WEBINAR_GLOBAL_RESUME.md`.
