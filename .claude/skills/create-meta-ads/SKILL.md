---
name: create-meta-ads
description: >-
  Create a Meta (Facebook / Instagram) ad end to end — campaign, ad set, creative, and
  ad — using the Facebook Ads tools, with correct handling of MULTIPLE ASSET ASPECT
  RATIOS in one ad. Use this whenever the user wants to launch, build, set up, or publish
  a Meta / Facebook / Instagram ad, and ESPECIALLY when they have two (or more) sizes of
  the same creative — a 1:1 (square) for feeds and a 9:16 (vertical) for Stories/Reels —
  and want each placement to show the right size. Trigger on phrases like "create a
  Facebook ad", "launch a Meta campaign", "set up an Instagram ad", "I have a square and a
  vertical version", "1:1 and 9:16", "make Stories use the vertical", "placement
  customization", "why is my vertical getting cropped in feed". Explains placement asset
  customization: mapping a 1:1 asset to Feed placements and a 9:16 asset to Stories/Reels
  so nothing is cropped or letterboxed.
---

# Create Meta Ads (with per-placement asset ratios)

Build a Meta ad from scratch with the Facebook Ads tools and — the part most people get
wrong — make a single ad serve the **right aspect ratio to each placement**. A 1:1 square
looks correct in Feed but gets letterboxed in a full-screen Story; a 9:16 vertical fills a
Story but gets cropped to a sliver in Feed. The fix is **placement asset customization**:
attach both assets to one creative and tell Meta which placement uses which.

**The rule this skill exists to enforce:** never ship one aspect ratio to every placement.
When the user has (or should have) a 1:1 and a 9:16, map them:

| Asset | Aspect ratio | Recommended pixels | Placements it should serve |
|-------|-------------|--------------------|----------------------------|
| **Square** | **1:1** | 1080 × 1080 | Facebook Feed, Instagram Feed, Marketplace, Explore, profile feeds, in-stream/video feeds |
| **Vertical** | **9:16** | 1080 × 1920 | Facebook Stories, Instagram Stories, Facebook Reels, Instagram Reels |

If the user only has one ratio, say so plainly and offer to proceed single-ratio (Meta will
crop/pad the others) or wait for the second asset — don't silently ship a cropped ad.

## The full workflow

Everything below uses `mcp__Facebook_ads__*` tools. Generate one 20-character
`client_conversation_id` at the first call and reuse it on **every** Meta tool call in the
session. Campaigns, ad sets, and ads are all created **PAUSED** — nothing spends until the
user activates it. Always confirm budget, audience, and destination URL with the user
before creating spend-bearing entities.

1. **Find the account, page, and IG account.**
   - `ads_get_ad_accounts` → the `ad_account_id` (numeric, no `act_` prefix).
   - `ads_get_ad_account_pages` → the Facebook `page_id`.
   - `ads_get_ig_accounts` → the `instagram_user_id` (needed for Instagram delivery; omit and
     the ad won't run on Instagram surfaces).

2. **Create the campaign** — `ads_create_campaign`.
   - Pick an ODAX `objective`: `OUTCOME_TRAFFIC`, `OUTCOME_SALES`, `OUTCOME_ENGAGEMENT`,
     `OUTCOME_LEADS`, `OUTCOME_AWARENESS`, `OUTCOME_APP_PROMOTION`. Legacy objectives are
     rejected.
   - Prefer **CBO**: set `campaign_daily_budget` or `campaign_lifetime_budget` (in cents)
     here unless the user explicitly wants per-ad-set budgets (ABO).
   - `buying_type` = `AUCTION`; `special_ad_categories` = `[]` unless it's housing / credit /
     employment / social issues.

3. **Create the ad set** — `ads_create_ad_set`.
   - **Do not restrict placements.** Leave `placement` unset so the ad set runs on
     Advantage+ Placements (all surfaces). That is exactly why you need both asset ratios —
     the ad will appear in both Feed and Stories/Reels. If you hard-limit placements to feed
     only, the 9:16 asset never gets used.
   - Use only optimization goals valid for the campaign objective (the create-campaign
     response lists `valid_optimization_goals`).
   - Budget: if the campaign is CBO, do **not** pass `daily_budget`/`lifetime_budget` here.
   - Targeting: `{"geo_locations":{"countries":["US"]}}` broad is fine. Never invent
     interest IDs.

4. **Upload BOTH assets** and keep both handles.
   - Images: `ads_creative_upload_image` (from a public URL) or
     `ads_creative_upload_local_image` → each returns an **image hash**. Upload the 1:1 and
     the 9:16 separately; you'll have two hashes.
   - Videos: `ads_creative_upload_video` → each returns a **video id**. Upload the 1:1 and
     the 9:16 separately; you'll have two video ids (plus a thumbnail image for each).

5. **Create the creative with per-placement assets** — this is the core step. Pick the path
   that matches the media type (see the two sections below).

6. **Create the ad** — `ads_create_ad` with the `ad_set_id` and the creative
   (`{"creative_id":"<id>"}` if you created the creative separately). Created PAUSED.

7. **Verify before handoff** — `ads_get_ad_preview` for a **feed** format AND a
   **story/reels** format. Confirm the square shows in feed and the vertical shows in
   Stories/Reels with no cropping or bars. This preview check is the proof the customization
   worked — always do it when two ratios are in play.

## Path A — VIDEO: use `placement_videos` (tool-native, preferred)

`ads_create_creative` has first-class support for per-placement video. Pass a
`placement_videos` array (2–10 entries). **Exactly one entry is the fallback** and contains
only `video_id` (no placement fields). Every other entry names its platforms and positions.

Split the 1:1 to feeds and the 9:16 to Stories/Reels:

```jsonc
ads_create_creative(
  ad_account_id, page_id, instagram_user_id,   // instagram_user_id required for IG delivery
  name: "Spring Sale — placement optimized",
  message: "...", headline: "...", link_url: "https://example.com",
  call_to_action_type: "SHOP_NOW",
  placement_videos: [
    // 1:1 square → Feed placements
    {
      video_id: "<SQUARE_1x1_VIDEO_ID>",
      publisher_platforms: ["facebook", "instagram"],
      facebook_positions:  ["feed", "video_feeds", "marketplace"],
      instagram_positions: ["stream", "explore", "profile_feed"]
    },
    // 9:16 vertical → Stories + Reels
    {
      video_id: "<VERTICAL_9x16_VIDEO_ID>",
      publisher_platforms: ["facebook", "instagram"],
      facebook_positions:  ["story", "facebook_reels"],
      instagram_positions: ["story", "reels", "profile_reels"]
    },
    // fallback — used for any placement not matched above (video_id ONLY, no positions)
    { video_id: "<SQUARE_1x1_VIDEO_ID>" }
  ]
)
```

The fallback catches placements you didn't enumerate (right column, Audience Network, etc.).
Use the square as the fallback — it degrades more gracefully than a vertical.

## Path B — IMAGE: use `asset_feed_spec` with `asset_customization_rules`

The image formats in `ads_create_creative` (single-image, carousel) don't take a
per-placement image array, so for two image ratios build an **`asset_feed_spec`** creative
and pass it as the raw `creative` JSON to `ads_create_ad` (or the underlying creative call).
`asset_customization_rules` map each placement group to an image via a shared **label**.

```jsonc
creative = {
  "name": "Spring Sale — placement optimized",
  "object_story_spec": {
    "page_id": "<PAGE_ID>",
    "instagram_user_id": "<IG_USER_ID>"        // required for Instagram delivery
  },
  "asset_feed_spec": {
    "ad_formats": ["SINGLE_IMAGE"],
    "images": [
      { "hash": "<SQUARE_1x1_HASH>",   "adlabels": [{ "name": "square_1x1"   }] },
      { "hash": "<VERTICAL_9x16_HASH>", "adlabels": [{ "name": "vertical_9x16" }] }
    ],
    "bodies":                [{ "text": "Your body copy" }],
    "titles":                [{ "text": "Your headline" }],
    "descriptions":          [{ "text": "Optional description" }],
    "link_urls":             [{ "website_url": "https://example.com" }],
    "call_to_action_types":  ["SHOP_NOW"],
    "asset_customization_rules": [
      {
        // 1:1 square → Feed placements  (mark ONE rule as the default)
        "customization_spec": {
          "publisher_platforms": ["facebook", "instagram"],
          "facebook_positions":  ["feed", "marketplace", "video_feeds"],
          "instagram_positions": ["stream", "explore", "profile_feed"]
        },
        "image_label": { "name": "square_1x1" },
        "is_default": true
      },
      {
        // 9:16 vertical → Stories + Reels
        "customization_spec": {
          "publisher_platforms": ["facebook", "instagram"],
          "facebook_positions":  ["story", "facebook_reels"],
          "instagram_positions": ["story", "reels", "profile_reels"]
        },
        "image_label": { "name": "vertical_9x16" }
      }
    ]
  }
}
```

Rules to respect or Meta rejects the creative:
- **Every placement the ad set can deliver to must be covered** by some rule. Mark one rule
  `"is_default": true` — it catches anything not explicitly listed, so nothing is left
  unmapped.
- Each `image_label.name` must exactly match an `adlabels[].name` on an image in `images`.
- Don't list the same placement in two rules — placements can't overlap across rules.

## Placement position values (reference)

`facebook_positions`: `feed`, `story`, `facebook_reels`, `marketplace`, `video_feeds`,
`instream_video`, `right_hand_column`, `search`.
`instagram_positions`: `stream`, `story`, `reels`, `explore`, `explore_home`,
`profile_feed`, `profile_reels`, `ig_search`, `reels_overlay`, `shop`.

For the standard **1:1 vs 9:16** split, only two buckets matter — feed-like (square) and
full-screen (vertical). The rest can ride the default rule. Full sizing table and the
common pitfalls are in `references/placement-specs.md`.

## Common mistakes this skill prevents

- **One ratio everywhere.** Shipping only a 1:1 → verticals are letterboxed; only a 9:16 →
  feeds are cropped. Always split when both exist.
- **Forgetting the fallback / default.** No fallback video (Path A) or no `is_default` rule
  (Path B) → the creative is rejected or some placements go blank.
- **Missing `instagram_user_id`.** Without it the ad silently won't run on Instagram, so the
  Stories/Reels asset never serves.
- **Locking placements to feed only** in the ad set, then wondering why the 9:16 is never
  used. Leave placements broad (Advantage+) so both assets have somewhere to serve.
- **Label mismatch.** `image_label` not matching an image's `adlabels` name → rejected.
- **Skipping the preview.** Always `ads_get_ad_preview` for both a feed and a story format to
  confirm the mapping before telling the user it's done.
