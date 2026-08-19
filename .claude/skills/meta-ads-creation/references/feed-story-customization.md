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
- Video ads: upload each MP4 with `ads_creative_upload_video`, poll `ads_get_ad_videos` until `status.video_status == "ready"`, then use `video_data` (single) or `placement_videos` (per-placement) instead of images.

## Canva deck mapping (SEG Parent Bachelor, India — reference)

Decks are grouped by **theme**, each theme a block of pages sharing the same
background set with the theme headline baked in. Read page titles via
`read-design` (open_transaction) — titles are `AssetName-Theme`; pages with a
`type:"video"` element are the video assets.

- **CAAS Feed** (`DAHQwEdpGxM`, 1080x1080): 6 pages/theme (4 img + 2 vid). Themes in order Ranking, Career, Safety, Global → feed image pages `6*t + 1..4`.
- **CAAS Story** (`DAHQwCn4q5o`, 1080x1920): 7 pages/theme (4 img + 3 vid) → story image pages `7*t + 1..4`.
- **SHMS Feed** (`DAHQwHPYv1Q`, 1080x1080) and **SHMS Story** (`DAHQwKuHTqA`, 1080x1920): 5 pages/theme (3 img + 2 vid), themes Ranking, Heritage, Career, Safety → image pages `5*t + 1..3` (Feed and Story share page numbers).

Image asset names by position — CAAS: `Class-Chef-Student, FoodwHands, CampusApicius, CampusDeepColor`; SHMS: `CauxCampusPanoramicView, GroupOfStudentInClass, LeysinGrandHall`.
