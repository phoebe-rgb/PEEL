---
name: meta-ads-creation
description: Create or duplicate Meta (Facebook/Instagram) ads on existing campaigns using the Facebook Ads MCP tools, pulling copy from a Google Sheet and creative assets from Canva. Use when the user wants to "create a new ad", "duplicate an ad", "add ads to a campaign", refresh copy/creative on Meta/Facebook/Instagram ads, or batch-build ads per asset with per-placement (Feed + Story/Reels) images. Covers Swiss Education Group (SEG: SHMS, CAAS, HIM, CRCS) naming and UTM conventions, but the workflow is reusable for any advertiser.
---

# Meta Ads Creation

Build Meta ads from three inputs — an **existing campaign/adset** (to inherit setup), **copy** (from a Google Sheet), and **creative assets** (from Canva) — and assemble them with the Facebook Ads MCP tools.

## Golden rules

- **Creatives are immutable.** You cannot edit an existing creative's copy, image, link, or CTA. To "duplicate and change copy/asset", build a **new** creative and a **new** ad. `ads_creative_update` / `ads_update_entity` only rename, relabel, or change status.
- **New ads are created PAUSED.** They stay paused until the user activates them. Never activate without explicit instruction. To "turn the ads on but keep the campaign off", activate each **ad** with `ads_activate_entity` (`entity_type:"ad"`) and leave the campaign paused — the ad's effective status becomes `CAMPAIGN_PAUSED` and it won't deliver until the campaign itself is activated. All three levels (campaign, ad set, ad) must be ACTIVE to actually deliver.
- **"Keep setup as is."** Placements, audience, budget, optimization live on the **ad set**, not the ad — so putting the new ad in the same ad set preserves them. On the creative, preserve: destination URL, URL parameters, CTA, page, and "no Advantage+".
- **"No Advantage+"** = do not set `advantage_plus_creative` and do not opt into `advantage_plus_creative_features`. Placement asset customization (Feed vs Story image) is **not** Advantage+ — it is a fixed per-placement mapping (see references/feed-story-customization.md).
- **Confirm before scale.** Build ONE ad, preview it (`ads_get_ad_preview`, both Feed and Story formats), get sign-off, then batch. Ads are live-account, hard-to-reverse objects.

## Workflow

1. **Find the account + campaign.** `ads_get_ad_accounts` → pick the account (SEG = `1763026957318451`, CHF). `ads_get_ad_entities` at `level:"campaign"` filtered by name to get the campaign id, then `level:"ad"` filtered by `campaign.id` to see existing ads and which ad set is live (the one whose ads are `CAMPAIGN_PAUSED`, not `ADSET_PAUSED`).
2. **Get the copy.** Read the copy sheet. Google Sheets export as CSV/XLSX is public if link-shared: `curl -sSL "https://docs.google.com/spreadsheets/d/<ID>/export?format=xlsx" -o copy.xlsx` then parse with openpyxl. Match the requested **audience** (e.g. "Bachelor (Parents)") and **theme** row.
3. **Get the assets from Canva.** Resolve `canva.link/<id>` short links with `resolve-shortlink`, then `read-design` (with `open_transaction:true`) to get per-page **titles** (which encode `AssetName-Theme`) and to detect `type:"video"` vs image elements. `export-design` (PNG for images, MP4 for video) returns a temporary public download URL.
4. **Upload media.** `ads_creative_upload_image` (from the Canva export URL) → image `hash`. For video: `ads_creative_upload_video` → `video_id`, then poll `ads_get_ad_videos` until `ready`.
5. **Build the ad.** `ads_create_ad` with an inline `creative` JSON:
   - Single image, one image everywhere → `object_story_spec.link_data` (see references/feed-story-customization.md).
   - Different image per placement (Feed square + Story/Reels vertical) → `asset_feed_spec` with `asset_customization_rules` (see references/feed-story-customization.md).
   - **Video per placement** (Feed square + Story/Reels vertical) → `asset_feed_spec` with a `videos` array + `video_label` rules and `ad_formats:["SINGLE_VIDEO"]` (section C). Do **not** use `ads_create_creative`'s `placement_videos` shortcut — it hard-requires `instagram_user_id` and fails "Instagram Account Is Missing"; the `asset_feed_spec` path inherits the Page's IG identity automatically.
   - Put the UTM string in `url_tags` (the "URL parameters" field) and keep `link` clean — **except** in a video `asset_feed_spec`, where `url_tags` is rejected, so append the UTM to `link_urls[].website_url` there.
6. **Preview + verify.** `ads_get_ad_preview` for `MOBILE_FEED_STANDARD` and `INSTAGRAM_STORY`. Return the `preview_url` to the user.
7. **Batch** the rest once approved, reusing the same structure. Name every ad per the convention below.

See `references/naming-utm.md` for the naming + UTM conventions and `references/feed-story-customization.md` for the exact creative JSON (including the required empty default customization rule).
