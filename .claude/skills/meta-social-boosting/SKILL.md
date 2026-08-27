---
name: meta-social-boosting
description: >-
  Create Meta (Facebook/Instagram) social-boosting and nurturing ads at scale by
  duplicating existing boosted-post ads onto new Instagram posts. Use whenever the user
  wants to "boost" Instagram Reels/posts into an existing Meta campaign, add new ads to a
  Nurturing/Social Boosting ad set, swap the post on an ad while keeping everything else,
  or replicate an ad across a campaign's ad sets. Trigger on phrases like "create nurturing
  ads on Meta", "boost these reels", "add new social boosting ads", "duplicate the ad and
  change the post", "promote existing Instagram post", "swap the post ID keep tracking", or
  when the user supplies Instagram reel links/shortcodes and a campaign to add them to.
  Handles the whole flow via the Meta Marketing (Graph) API: resolving reel shortcodes to
  Instagram media IDs, building existing-post creatives (source_instagram_media_id), keeping
  UTM tracking and conversion tracking_specs, no Advantage+, PAUSED-first, then activate.
---

# Meta Social Boosting / Nurturing Ads

Boost existing **Instagram** posts (usually Reels) into an existing Meta campaign — the
"nurturing" / "social boosting" pattern used to re-engage warm audiences (website visitors +
engagers). The core operation: **duplicate an existing ad, swap in a new post, keep the ad
set / tracking / CTA / naming the same, no Advantage+, create PAUSED, then activate.** One
post typically becomes one ad in *every* ad set of the brand's campaign.

## Golden rules

- **Create PAUSED, verify, then activate.** Never create ads live. Activating spends real
  money — do it only on explicit user instruction, after previews are checked.
- **No Advantage+.** Set `degrees_of_freedom_spec` with `advantage_plus_creative: OPT_OUT`
  (and the other enhancement features OPT_OUT). Do **not** include `standard_enhancements`
  on create — that field is deprecated and the API rejects it.
- **Keep tracking identical.** Copy `url_tags` and `tracking_specs` from an existing template
  ad in the same campaign — don't invent them.
- **Match the existing ad name convention exactly** (read real ad names first, don't only
  trust a naming doc).
- **Never guess a post ID.** A wrong ID boosts the wrong post with real spend.

## Inputs you need

1. **Which ad account + campaign(s)** (brand). Nurturing campaigns are usually named like
   `PL_<BRAND>_FB_NURT_..._SocialBoosting`, objective `OUTCOME_ENGAGEMENT`.
2. **The new posts** — Instagram permalinks/shortcodes (e.g.
   `https://www.instagram.com/reels/DbsCMzMklLD/` → shortcode `DbsCMzMklLD`). If they come
   from a sheet, the "new" ones are often flagged by a status like **Suggested**.
3. **The ad-name convention** (region_theme_format_lang_asset_version, or read it off
   existing ads: e.g. `ALL_BoostedPost_VID_EN_<Category>_<AssetName>`).

## Access: the #1 blocker (read this first)

Boosting an **existing Instagram post** needs to read that post's Instagram media. Two traps:

- **The MCP Instagram tools (`ads_get_ig_accounts` / `ads_get_ig_media`) are often gated**
  ("This tool is new and is being gradually rolled out… check back later"). When gated, use
  the **Graph API directly** with a user token.
- **Identity matters more than scopes.** A *Conversions API system user* token can create ads
  but usually **can't see the brand Pages/Instagram accounts** (assets not assigned to it), so
  it can't resolve reel IDs. A **User access token from the person who manages the accounts**
  (Graph API Explorer → User Token → `ads_management`, `instagram_basic`, `pages_show_list`,
  `pages_read_engagement`) carries the same access as their Ads Manager UI and works.
  - Diagnose with `GET /me` (identity) and `GET /me/accounts` (which Pages the token can see).
  - A token can only reach assets its user actually owns — regenerating a token never adds
    access that was never assigned.
- **Security:** treat any pasted token as exposed; tell the user to revoke it afterward. Store
  it in a session-local file (umask 077), never echo it, never commit it.

## Workflow (Graph API — `https://graph.facebook.com/v21.0`)

### 1. Map the structure
- `GET /act_<ID>/campaigns?fields=id,name,objective` → find the `*_NURT_*_SocialBoosting`
  campaign per brand.
- `GET /act_<ID>/adsets?...` (filter by campaign) → the ad sets to replicate across
  (tiers/regions; retargeting audiences like "Web90-And-Engagers180").
- List a campaign's ads and note the **naming pattern** and how one post maps to ad sets
  (usually the same post = one ad per ad set).

### 2. Read a template creative (per brand) — the thing you replicate
`GET /<creative_id>?fields=name,call_to_action,url_tags,degrees_of_freedom_spec,instagram_user_id,source_instagram_media_id,call_to_action_type`
Capture: the **CTA type + landing link**, the **`url_tags`** (e.g.
`utm_source=Facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}`),
the **`instagram_user_id`** (brand IG account), and the enhancement opt-outs.

### 3. Resolve each reel shortcode → Instagram **media V2 ID**
The decoded shortcode (a ~19-digit "pk") is **NOT** accepted — the API wants the "Instagram
media V2 ID" (`17.../18...`). Get it from the IG account's media list:
```
GET /<page_id>?fields=instagram_business_account          # -> IG business account id
GET /<ig_business_account_id>/media?fields=id,shortcode&limit=50   # page through, match shortcode
```
Build a `shortcode -> media_id` map. (This is exactly what the gated `ads_get_ig_media` does.)

### 4. Create the creative (existing Instagram post)
`POST /act_<ID>/adcreatives`:
```
name                       = <ad name>
instagram_user_id          = <brand IG account id>
source_instagram_media_id  = <resolved V2 media id>
url_tags                   = <copied from template>
call_to_action             = {"type":"LEARN_MORE","value":{"link":"<brand landing url>"}}
degrees_of_freedom_spec    = {"creative_features_spec":{"advantage_plus_creative":{"enroll_status":"OPT_OUT"},
                              "enhance_cta":{"enroll_status":"OPT_OUT"},"multi_photo_to_video":{"enroll_status":"OPT_OUT"},
                              "text_optimizations":{"enroll_status":"OPT_OUT"},"video_auto_crop":{"enroll_status":"OPT_OUT"},
                              "video_filtering":{"enroll_status":"OPT_OUT"},"video_uncrop":{"enroll_status":"OPT_OUT"}}}
```
Reuse one creative across a brand's ad sets — `{{adset.name}}` in `url_tags` resolves per ad.

### 5. Create the ad — PAUSED — in each ad set
`POST /act_<ID>/ads` with `name`, `adset_id`, `creative={"creative_id":"<cid>"}`, `status=PAUSED`.

### 6. Apply conversion tracking (`tracking_specs`)
`POST /<ad_id>` with `tracking_specs` (JSON). Website pixel + offline dataset:
```
[{"action.type":["offsite_conversion"],"fb_pixel":["<pixel_id>"]},
 {"action.type":["offline_conversion"],"dataset":["<dataset_id>"]}]
```
Meta auto-adds the engagement rows (post_engagement/link_click/…). Copy IDs from the account's
selected dataset or an existing ad.

### 7. Preview, then activate
- Preview one ad per post: `GET /<ad_id>/previews?ad_format=INSTAGRAM_REELS` → extract the
  `iframe src` (a `business.facebook.com/ads/api/preview_iframe.php?...` link; short-lived).
- After the user confirms: `POST /<ad_id>` with `status=ACTIVE` for each ad.

## Gotchas checklist
- `standard_enhancements` on create → **rejected** (deprecated). Omit it.
- Decoded shortcode as `source_instagram_media_id` → **rejected** ("must be a valid Instagram
  media V2 ID"). Resolve via the IG account's `/media` edge instead.
- `/{campaign}/ads` default filter can hide brand-new PAUSED ads (shows 0) — verify by reading
  ad IDs directly, not the campaign edge count.
- Nested-field curl like `creative{source_instagram_media_id}` gets mangled by the shell —
  fetch the creative id, then read the creative separately (or drive it from Python).
- Watch for messy source rows (a title that's actually a URL, duplicates) — flag and skip.

## Batch tips
- Drive the batch from a small Python script (urllib) rather than long shell one-liners — it
  avoids quoting/escaping bugs and lets you collect a clean `created_ads.json` record.
- Larger batches (30+ create/update calls) can exceed a foreground timeout — run them in the
  background and read the summary when done.
