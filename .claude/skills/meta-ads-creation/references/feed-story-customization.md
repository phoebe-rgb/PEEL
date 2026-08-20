# Creative JSON for ads_create_ad

Pass these as the `creative` argument (JSON string) to `ads_create_ad`. The tool
accepts extra creative-level fields (`url_tags`, `asset_feed_spec`) alongside
`object_story_spec` even though its docstring only lists the "source" fields.

## A. Single image (one image on every placement)

```json
{
  "url_tags": "utm_source=Facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}",
  "object_story_spec": {
    "page_id": "<PAGE_ID>",
    "link_data": {
      "link": "https://learn.culinaryartsswitzerland.com/india/",
      "image_hash": "<FEED_HASH>",
      "message": "<primary text>",
      "name": "<headline>",
      "description": "<description>",
      "call_to_action": { "type": "LEARN_MORE", "value": { "link": "https://learn.culinaryartsswitzerland.com/india/" } }
    }
  }
}
```

Keep `link` clean; the UTM string goes in `url_tags` (the "URL parameters" field),
not appended to the link.

## B. Feed + Story per placement (placement asset customization)

Serves the square Feed image on feed placements and the vertical Story image on
Stories/Reels — in ONE ad. Ads Manager labels this **"Dynamic creative"**, but it
is a fixed per-placement mapping, **not** Advantage+ optimization.

```json
{
  "url_tags": "utm_source=Facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}",
  "object_story_spec": { "page_id": "<PAGE_ID>" },
  "asset_feed_spec": {
    "images": [
      { "hash": "<FEED_HASH>",  "adlabels": [{ "name": "feed_img" }] },
      { "hash": "<STORY_HASH>", "adlabels": [{ "name": "story_img" }] }
    ],
    "bodies":       [{ "text": "<primary text>" }],
    "titles":       [{ "text": "<headline>" }],
    "descriptions": [{ "text": "<description>" }],
    "link_urls":    [{ "website_url": "https://learn.culinaryartsswitzerland.com/india/" }],
    "call_to_action_types": ["LEARN_MORE"],
    "ad_formats": ["SINGLE_IMAGE"],
    "asset_customization_rules": [
      {
        "customization_spec": {
          "publisher_platforms": ["facebook", "instagram"],
          "facebook_positions": ["story", "facebook_reels"],
          "instagram_positions": ["story", "reels"]
        },
        "image_label": { "name": "story_img" },
        "priority": 1
      },
      {
        "customization_spec": {},
        "image_label": { "name": "feed_img" },
        "priority": 2
      }
    ]
  }
}
```

### Gotchas

- **A default rule is REQUIRED**: exactly one rule with an **empty** `customization_spec: {}` at the **lowest** priority (highest number). Omitting it returns
  `error_subcode 1885923: "Missing Default Asset Customization Rule"`. The Story rule takes the specific placements at priority 1; the empty default (Feed) catches everything else at priority 2.
- Feed image should be **1080x1080**, Story image **1080x1920**.
- No Instagram account was attachable on SEG (`ads_get_ig_accounts` not rolled out); IG placements fall back to the Page. If IG delivery matters, attach an IG user id via `instagram_user_id` when available.
- Video ads (per-placement): use the section **C** `asset_feed_spec` + `video_label` rules — **not** `placement_videos`. Upload each MP4 with `ads_creative_upload_video`, poll `ads_get_ad_videos` until `status.video_status == "ready"`, then create the ad. A single-video (one clip everywhere) ad can still use `object_story_spec.video_data`.
- **Canva MP4 export quality** (`export-design`, `format.quality`): `horizontal_1080p` for a **square** page → 1080×1080; `horizontal_4k` for a **vertical 9:16** page → ~1214×2160. `horizontal_1080p` caps the **longest** side at 1080, so a 1080×1920 page comes out **608×1080** (too small) — there is no `vertical_*` tier in the API.
- **Canva rate limits / timeouts**: keep to **≤2 concurrent** `export-design` calls (4+ → `"Too many requests"`); transient `connection timeout` also happens — just retry the failed one.
- Canva `export-design` returns short-lived signed S3 URLs (see the `response-expires` in the URL, a few hours). Upload promptly and **copy the URL verbatim** — a dropped `us-east-1` path segment, stray whitespace, or expiry → `ads_creative_upload_image` "Image Wasn't Downloaded" or `ads_creative_upload_video` error 389/1363057 "Unable to fetch video file from URL". Just re-export that page and re-upload. Uploading identical bytes de-duplicates to the same `hash`.

## C. Feed + Story per placement — VIDEO

Same shape as B, but a `videos` array + `video_label` rules and `ad_formats: ["SINGLE_VIDEO"]`.
Upload each MP4 first (`ads_creative_upload_video` → poll `ads_get_ad_videos` until
`status.video_status == "ready"`), then pass the inline creative below to `ads_create_ad`.

**Use `asset_feed_spec`, NOT the `placement_videos` shortcut of `ads_create_creative`.**
The shortcut hard-requires an explicit `instagram_user_id` and fails with
`"Instagram Account Is Missing"` (error_subcode 1772103) when no IG account is
attachable (SEG: `ads_get_ig_accounts` is gated). The inline `asset_feed_spec` path
below auto-inherits the **Page's** Instagram identity — the same way the image ads
deliver on IG — so it just works, no `instagram_user_id` needed.

```json
{
  "name": "APAC_rank_VID_EN_Food_1",
  "object_story_spec": { "page_id": "<PAGE_ID>" },
  "asset_feed_spec": {
    "ad_formats": ["SINGLE_VIDEO"],
    "videos": [
      { "video_id": "<SQUARE_VIDEO_ID>",   "adlabels": [{ "name": "sq" }] },
      { "video_id": "<VERTICAL_VIDEO_ID>", "adlabels": [{ "name": "vt" }] }
    ],
    "bodies":       [{ "text": "<primary text>" }],
    "titles":       [{ "text": "<headline>" }],
    "descriptions": [{ "text": "<description>" }],
    "link_urls":    [{ "website_url": "https://learn.culinaryartsswitzerland.com/india/?utm_source=Facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}" }],
    "call_to_action_types": ["LEARN_MORE"],
    "asset_customization_rules": [
      {
        "customization_spec": {
          "publisher_platforms": ["facebook", "instagram", "messenger"],
          "facebook_positions": ["story", "facebook_reels", "facebook_reels_overlay"],
          "instagram_positions": ["story", "reels", "profile_reels"],
          "messenger_positions": ["story"]
        },
        "video_label": { "name": "vt" }
      },
      { "customization_spec": {}, "video_label": { "name": "sq" } }
    ]
  }
}
```

- No thumbnail needed — Meta auto-generates one per video from its first frame.
- **`url_tags` is NOT accepted inside `asset_feed_spec`** (`"Unexpected key url_tags on param asset_feed_spec"`). Put `url_tags` at the creative top level (sibling of `object_story_spec`, as in A/B), **or** append the UTM string to `link_urls[].website_url` (shown above) — both track identically.
- Empty-default-rule requirement is identical to B: square = empty-spec default, vertical = story/reels rule.

## Turning ads on but keeping the campaign off

New ads are created PAUSED. If asked to "turn the ads on but keep the campaign off", activate each ad with `ads_activate_entity` (`entity_type:"ad"`) and leave the campaign paused. The ad reads ACTIVE at the ad level but its effective status is `CAMPAIGN_PAUSED`, so it does not deliver or spend until the campaign itself is activated.

## Canva deck mapping (SEG Parent Bachelor, India — reference)

Decks are grouped by **theme**, each theme a block of pages sharing the same
background set with the theme headline baked in. Read page titles via
`read-design` (open_transaction) — titles are `AssetName-Theme`; pages with a
`type:"video"` element are the video assets.

- **CAAS Feed** (`DAHQwEdpGxM`, 1080x1080): 6 pages/theme (4 img + 2 vid), Food video first then Campus → video pages `5,6 / 11,12 / 17,18 / 23,24`.
- **CAAS Story** (`DAHQwCn4q5o`, 1080x1920): layout is **volatile** (the owner re-edits it — seen as both 28 pages/7-per-theme with a 3rd "Class" vertical, and 24 pages/6-per-theme symmetric with Feed). **Do not assume page numbers** — read titles/video elements each run.

> **Pair Feed↔Story by concept (page title), never by position.** A Story deck may
> carry an extra vertical-only asset or be restructured, so positional pairing
> mismatches. Match `<Asset>-<Theme>` titles: e.g. CAAS Feed `Food-…`/`Campus-…`
> ↔ the Story pages with the same asset name. Ignore Story-only extras.
> Also: a Feed video and its Story counterpart can be **different clips of the same
> concept** (the owner updated one deck's clip only) — that's expected, still pair by title.
- **SHMS Feed** (`DAHQwHPYv1Q`, 1080x1080) and **SHMS Story** (`DAHQwKuHTqA`, 1080x1920): 5 pages/theme (3 img + 2 vid), themes Ranking, Heritage, Career, Safety → image pages `5*t + 1..3` (Feed and Story share page numbers).

Image asset names by position — CAAS: `Class-Chef-Student, FoodwHands, CampusApicius, CampusDeepColor`; SHMS: `CauxCampusPanoramicView, GroupOfStudentInClass, LeysinGrandHall`.
