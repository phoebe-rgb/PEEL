---
name: meta-ads-creation
description: "Create or duplicate Meta (Facebook/Instagram) ads on existing campaigns using the Facebook Ads MCP tools, pulling copy from a Google Sheet and creative assets from Canva. Use when the user wants to \"create a new ad\", \"duplicate an ad\", \"add ads to a campaign\", refresh copy/creative on Meta/Facebook/Instagram ads, or batch-build ads per asset with per-placement (Feed + Story/Reels) images. Covers Swiss Education Group (SEG: SHMS, CAAS, HIM, CRCS) naming and UTM conventions, but the workflow is reusable for any advertiser."
---

# Meta Ads Creation

Build Meta ads from three inputs — an **existing campaign/adset** (to inherit setup), **copy** (from a Google Sheet), and **creative assets** (from Canva) — and assemble them with the Facebook Ads MCP tools.

## Golden rules

- **Creatives are immutable.** You cannot edit an existing creative's copy, image, link, or CTA. To "duplicate and change copy/asset", build a **new** creative and a **new** ad. `ads_creative_update` / `ads_update_entity` only rename, relabel, or change status.
- **New ads are created PAUSED.** They stay paused until the user activates them. Never activate without explicit instruction. To "turn the ads on but keep the campaign off", activate each **ad** with `ads_activate_entity` (`entity_type:"ad"`) and leave the campaign paused — the ad's effective status becomes `CAMPAIGN_PAUSED` and it won't deliver until the campaign itself is activated. All three levels (campaign, ad set, ad) must be ACTIVE to actually deliver.
- **"Keep setup as is."** Placements, audience, budget, optimization live on the **ad set**, not the ad — so putting the new ad in the same ad set preserves them. On the creative, preserve: destination URL, URL parameters, CTA, page, and "no Advantage+".
- **"No Advantage+"** = do not set `advantage_plus_creative` and do not opt into `advantage_plus_creative_features`. Placement asset customization (Feed vs Story image) is **not** Advantage+ — it is a fixed per-placement mapping (see references/feed-story-customization.md).
- **No Meta auto-content, ever.** Every creative MUST carry the opt-out block in `references/ai-optouts.md`. It covers `creative_sourcing_spec` website_media / website_summary / catalog OPT_OUT, `media_sourcing_spec: []`, the **full 82-key** `creative_features_spec` OPT_OUT list (`references/creative-features-optout.json`), `biz_ai.capabilities.prompts` OPT_OUT and `contextual_multi_ads` OPT_OUT. With only a partial list, publish fails with 2446880 "WhatsApp number required". If it is missing, Ads Manager attaches **"Related media"** (dozens of other account images) and AI "selling points". Never leave these on. Duplicating in Ads Manager re-enables them (`DUPLICATION_UPGRADE`), so QC duplicated campaigns for this too. **Never click the trash icon on Related media in the Ads Manager UI.** It writes more than 30 per-item opt-outs, and publish then fails with error 105. Rebuild the ad via the API instead.
- **Never copy a creative via an old `creative_id`.** Older creatives keep headline and description in `call_to_action.value.link_title/link_description`, and publishing fails with error #1815589. Always rebuild inline: `asset_feed_spec` titles/descriptions, the same media hashes / video_ids, plus the opt-out block.
- **Don't touch ad-set or campaign status** unless asked. A paused ad set (e.g. LAL / WEB) is usually intentional.
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
   - Put the UTM string in `url_tags` at the creative **top level** (sibling of `object_story_spec` and `asset_feed_spec`; this works for video too) and keep `link` clean. Never put `url_tags` *inside* `asset_feed_spec`.
6. **QC the draft** (checklist in `references/ai-optouts.md`). Read the draft back and check every ACTIVE ad: all opt-outs present, `validation_status` VALIDATED, no `active_errors`, no deprecated CTA fields, no duplicate names. Ask the user to spot-check that one ad shows no **Related media**.
7. **Preview + verify.** `ads_get_ad_preview` for `MOBILE_FEED_STANDARD` and `INSTAGRAM_STORY`. Return the `preview_url` to the user.
8. **Batch** the rest once approved, reusing the same structure. Name every ad per the convention below.

See `references/ai-optouts.md` for the mandatory opt-out block and QC checklist, `references/naming-utm.md` for the naming + UTM conventions and `references/feed-story-customization.md` for the exact creative JSON (including the required empty default customization rule).
