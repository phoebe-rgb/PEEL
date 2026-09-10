---
name: meta-nurturing-ads
description: >-
  Create Meta (Facebook/Instagram) nurturing-campaign ads that promote existing
  published Instagram reels as existing-post video ads across a school/region's
  NURT ad sets. Use when asked to roll out reels into "_NURT_" campaigns, boost
  existing IG posts (source_instagram_media_id), map reel permalinks/shortcodes
  to media ids, reuse one creative per reel across ad sets, attach pixel +
  offline-dataset tracking and UTM url_tags, activate the new ads, and pause the
  old ads. Covers the gotchas that make this fail (page-locked ad sets, school
  vs group IG ownership, shortcode≠media-id, the "link required" trap).
---

# Meta nurturing-campaign ad creation (existing-post reel ads)

Promote existing published IG reels as **existing-post** video ads into a school's
non-SocialBoosting `_NURT_` campaigns, one creative per reel reused across ad sets,
then pause the previously-running ads. This is an **awareness/nurturing** flow, not
a boosted-post-forbids-link flow — the working creative IS the existing IG post.

## 0. Guardrails (this is live money on a real account)
- Confirm scope up front: which schools, which **regions** (each region = one campaign),
  activate-immediately vs paused, and whether to pause old ads. These change blast radius.
- Never guess a media id, never hand-decode a shortcode (see §3), never pause a
  campaign/ad-set id (only ad ids). Keep a **before-list** of old ads for rollback.
- Prefer the account's own app credentials. A user-pasted Graph token is read-first;
  if used for writes, say so and tell the user to rotate it afterward.

## 1. Scope the campaigns and ad sets
- In-scope campaign = name contains `_NURT_` AND NOT `SocialBoosting`, for the target
  school + region (e.g. `PL_CAAS_FB_NURT_APAC_IN_ALL_ALL` = CAAS India).
- Verify each campaign live (`ads_get_ad_entities` level=campaign, object_ids=[...],
  fields id,name,objective,effective_status) — don't trust a spec sheet.
- Pull every ad set under each in-scope campaign. The **region prefix** for ad naming
  comes from the ad set's own name (`APAC`, `MiddleEast`, `Scandi`, `Americas`, `ALL`),
  not the reel content. Oddly-named sets ("Store Testimonial ads") take the prefix
  their existing ads already use.

## 2. Find the reels — they usually live on the SCHOOL IG account, not the group
The MCP `ads_get_ig_media` only returns media for the IG account **linked to the ad
account** (often just the group account), so school reels won't appear there. Resolve
via Graph with a token that manages the pages:
```
GET /me/accounts?fields=id,access_token                      # page tokens (in memory only)
GET /{page_id}?fields=instagram_business_account{id,username} # needs the PAGE token
GET /{ig_id}/media?fields=id,shortcode,permalink&limit=100    # page until shortcodes found
```
Map each reel **shortcode** (from its permalink) → numeric **media id** (`id`). Record
the owning **IG account id** (school) and its **page id** per brand.

## 3. Do NOT decode shortcodes
Base64-decoding a shortcode yields the media *pk*, which is NOT the Graph API media id
(validated: `DaiaGX8CCGt` → `3936…757`, but real id `18082742075649934`). Only
`ads_get_ig_media` / the `/media` edge give the usable id.

## 4. The working creative shape (existing IG post + custom link/tracking)
The account's existing reel ads are `object_type: VIDEO` with `effective_instagram_media_id`
set, `actor_id` = the **page**, `instagram_user_id` = the **school IG**. Reproduce with:
```
POST /act_<AD_ACCOUNT>/adcreatives
  name                       = <RegionPrefix>_BoostedPost_VID_EN_<AssetName>   # actually set instagram_user_id below
  instagram_user_id          = <school IG account id that OWNS the reel>
  source_instagram_media_id  = <numeric media id from §2>
  url_tags                   = utm_source=Facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}
```
**Critical:** do NOT add `object_story_spec`/`page_id`, `link_data`, or a top-level
`call_to_action`/`link` to a `source_instagram_media_id` creative — that triggers
`"The link field is required"` or `"ambiguous promoted object"`. The bare
`instagram_user_id` + `source_instagram_media_id` (+ `url_tags`) is what Meta accepts,
and it delivers on FB + IG. Reuse **one creative per reel** across all its ad sets.

## 5. Create the ads
```
POST /act_<AD_ACCOUNT>/ads
  name          = <RegionPrefix>_BoostedPost_VID_EN_<AssetName>
  adset_id      = <target ad set>
  creative      = {"creative_id": <reel's creative>}
  status        = ACTIVE          # or PAUSED if the user wants review first
  tracking_specs = [
    {"action.type":["offsite_conversion"],"fb_pixel":["<PIXEL/DATASET id>"]},
    {"action.type":["offline_conversion"],"dataset":["<PIXEL/DATASET id>"]}
  ]
```
New ACTIVE ads show `effective_status: IN_PROCESS` while Meta reviews — that is normal,
not an error. Ads in a PAUSED campaign/ad set won't deliver until those are activated too.

## 6. Known failure: page-locked ad sets ("Pages don't match", subcode 1885029)
An ad set with `promoted_object.page_id = <some other page>` (e.g. the group page) will
reject a creative whose media is owned by a different page. Check
`ads_get_ad_entities`/Graph `fields=promoted_object` on the ad set. If it's locked to a
page you can't match with the reel's owner, **skip that ad set** and tell the user —
you cannot promote a school-owned reel through a group-page-locked set.

## 7. Pause the old ads (auditable, reversible)
- Capture the before-list first: `GET /act_/ads?filtering=[{campaign.id IN [<ids>]}]`
  fields id,name,effective_status — save it.
- Pause each **ad** id (`POST /{ad_id} {"status":"PAUSED"}`). Guard the loop so it never
  touches campaign ids, ad-set ids, or the newly created ad ids.

## 8. QC checklist
- [ ] Only `_NURT_`, non-SocialBoosting campaigns for the right school got that school's reels.
- [ ] Each shortcode resolved to a real media id (no decode/guess).
- [ ] One creative per reel, reused across ad sets; `instagram_user_id` = owning school IG.
- [ ] `url_tags` on every creative; `tracking_specs` (offsite pixel + offline dataset) on every ad.
- [ ] Ad names use the ad set's region prefix; new-ad count matches expectation.
- [ ] Page-locked ad sets identified and reported, not silently dropped.
- [ ] Before-list captured; old-ads pause count matches; new ads not paused.
