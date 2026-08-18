# Meta Ads API — gotchas (read before any create/update)

Every item here is a real API rejection or a client-visible rendering bug from the SHMS Luxury-Webinar
build, plus the working alternative. Verified against Meta Marketing API v25.0 docs.

## Table of contents
- [Keep everything PAUSED](#keep-everything-paused)
- [Geo: worldwide declaration is broken via API](#geo-worldwide)
- [Age floor traps](#age-floor)
- [Advantage+ must be off in three places](#advantage-off)
- [url_tags is immutable → rebuild](#url-tags)
- [Delete = ARCHIVED, not REMOVED](#archived)
- [Never duplicate with source_ad_id](#source-ad-id)
- [Stories/Reels shows the 1:1 square](#square)
- [Previews lie for asset-feed creatives](#previews)
- [The Review-and-publish queue is a trap](#review-queue)

<a name="keep-everything-paused"></a>
## Keep everything PAUSED
Create campaign, ad sets, and ads with `status=PAUSED`. Launch is a human decision after preview
sign-off + schedule check. Never touch the account's global **"Review and publish (N)"** button.

<a name="geo-worldwide"></a>
## Geo: worldwide declaration is broken via API
Setting `targeting.geo_locations.country_groups=["worldwide"]` **plus** the required
`regional_regulated_categories` declaration (e.g. `TAIWAN_UNIVERSAL`, `SINGAPORE_UNIVERSAL`) returns
Meta **INTERNAL** (is_retryable) on every attempt — while worldwide *without* the declaration returns
a clean VALIDATION error telling you to add it. So worldwide geo is processed, but the declaration
write itself is broken through the MCP path.
- **Fix A (preferred via API):** target an **explicit country list** that excludes the
  declaration-triggering countries (Taiwan, Singapore) and any Meta doesn't deliver to (Russia).
  SHMS used its top historical-origin markets. No `country_groups`, no
  `regional_regulated_categories` → the write succeeds.
- **Fix B (UI):** flip geo to Worldwide in Ads Manager and accept the Universal Ads declaration
  checkbox there.

<a name="age-floor"></a>
## Age floor traps
`age_min=18` can be force-bumped by Meta. **Thailand + an attached custom audience forces
`age_min ≥ 20`.** If you target TH with custom audiences, set `age_min=20` yourself or the write is
adjusted/blocked.

<a name="advantage-off"></a>
## Advantage+ must be off in three independent places
1. **Advantage+ campaign** (campaign budget optimization / auto-everything) — OFF at campaign create.
2. **Advantage audience** — `advantage_audience=0` on each ad set; also set custom/lookalike
   `targeting_relaxation` to 0.
3. **Advantage+ creative enhancements** — the API opt-out field `standard_enhancements` is
   **deprecated**; creatives now build without it. You must **confirm it OFF per creative in the Ads
   Manager UI at review**, or opt out individual features via `creative_features_spec`.

<a name="url-tags"></a>
## url_tags (UTM) is immutable → rebuild
`url_tags` is **rejected by `ads_update_entity`** on an existing ad, and creatives are immutable. To
add or change UTMs, rebuild the creative with `url_tags` as a **top-level creative field** (sits
beside `object_story_spec`/`asset_feed_spec`), make a new ad, and ARCHIVE the old one. SEG template:
`utm_source=Facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}`

<a name="archived"></a>
## Delete = ARCHIVED, not REMOVED
To retire an ad/creative, set `status=ARCHIVED`. `REMOVED` is rejected by the API.

<a name="source-ad-id"></a>
## Never duplicate with source_ad_id
`source_ad_id` creates **drafts** that pile into the account's "Review and publish" queue. To copy an
ad into another ad set, **recreate it with an explicit `creative`** (published-PAUSED, not a draft).

<a name="square"></a>
## Stories/Reels shows the 1:1 square (the "square on the end card")
Placement Asset Customization fell back to the 1:1 feed image on Story/Reels because the backup rule
was written as an **empty `customization_spec: {}`**, which Meta rejects. The default/backup rule is
flagged with **`is_default: true`**, not an empty spec. Full recipe:
`references/placement-asset-customization.md`. Also: the ad set must be `is_dynamic_creative=false`,
and each `asset_feed_spec` needs **at least two** customization rules.

NB the round **avatar + account name + CTA** on that end frame are pulled automatically from the ad
identity (IG account profile pic for IG placements, FB Page profile pic for FB) — they are **not** a
creative field and are not affected by this rebuild. Only the big image slot is.

<a name="previews"></a>
## Previews lie for asset-feed creatives
`ads_get_ad_preview` returns an **iframe with no rendered image** for dynamic/asset-feed creatives —
you cannot judge the image from it, and canvas dimensions alone prove nothing. To actually verify an
image, open the `preview_url` in **ego-lite** (the lightweight `preview_iframe.php` screenshots even
when the full Ads Manager editor times out). Verify each placement (IG Story, IG Reels, FB Story, FB
Reels, Feed) before claiming a render is correct.

<a name="review-queue"></a>
## The Review-and-publish queue is a trap
The account may show "Review and publish (N)" with N pre-existing drafts that are **not yours**.
Never click it. Avoid creating drafts in the first place (see `source_ad_id` above): always build
with explicit, published-PAUSED entities.
