# Placement Asset Customization — 9:16 Story/Reels + 1:1 Feed

Serve a different image per placement from one ad: the **9:16** vertical art on Stories/Reels and the
**1:1** square on Feed. This is where the "Stories shows the 1:1 square on the end frame" bug lives.
Verified against Meta Marketing API v25.0 (*Placement Asset Customization*, *Asset Customization
Rules*).

## The rules that matter
1. Set **`optimization_type: "PLACEMENT"`** in `asset_feed_spec`.
2. Provide **at least two** `asset_customization_rules` — fewer and the ad won't create.
3. The **default/backup rule is flagged `is_default: true`** — NOT an empty `customization_spec: {}`
   (Meta rejects the empty spec; that was the original bug). Exactly one rule is `is_default`.
4. The **ad set must be `is_dynamic_creative=false`** (this is Placement Asset Customization, not
   Dynamic Creative).
5. Each image asset carries `adlabels: [{name: …}]`; each rule references one via `image_label`.

`customization_spec` fields: `publisher_platforms` = `facebook|instagram|messenger|audience_network|threads`;
`facebook_positions` = `feed, right_hand_column, marketplace, video_feeds, search, story,
facebook_reels, instream_video, notification`;
`instagram_positions` = `stream, story, reels, explore, explore_home, profile_feed, ig_search`;
`threads_positions` = `threads_stream` (requires IG `stream` in the same spec).

## Copy-paste `asset_feed_spec` (one creative)
```jsonc
{
  "optimization_type": "PLACEMENT",
  "ad_formats": ["SINGLE_IMAGE"],
  "images": [
    { "hash": "<FEED_1x1_HASH>",  "adlabels": [{ "name": "feed_1x1" }] },
    { "hash": "<STORY_9x16_HASH>", "adlabels": [{ "name": "story_9x16" }] }
  ],
  "bodies":       [{ "text": "<BODY / message>" }],
  "titles":       [{ "text": "<HEADLINE>" }],
  "descriptions": [{ "text": "<DESCRIPTION>" }],
  "link_urls":    [{ "website_url": "<LANDING_URL>" }],
  "call_to_action_types": ["SIGN_UP"],
  "asset_customization_rules": [
    {
      "customization_spec": {
        "publisher_platforms": ["facebook", "instagram"],
        "facebook_positions":  ["story", "facebook_reels"],
        "instagram_positions": ["story", "reels"]
      },
      "image_label": { "name": "story_9x16" }
    },
    {
      "is_default": true,
      "customization_spec": {
        "publisher_platforms": ["facebook", "instagram", "threads"],
        "facebook_positions":  ["feed", "marketplace", "video_feeds", "search"],
        "instagram_positions": ["stream", "explore", "profile_feed", "ig_search"],
        "threads_positions":   ["threads_stream"]
      },
      "image_label": { "name": "feed_1x1" }
    }
  ]
}
```
Keep these alongside it on the creative: `object_story_spec.page_id` (+ `instagram_user_id` for IG),
top-level `url_tags` (UTM), Advantage+ creative enhancements OFF. The MCP forwards raw `creative`
JSON to the Graph API, so pass the whole thing through `ads_create_creative`'s `creative` field.

## Verify (don't assume)
`ads_get_ad_preview` returns an iframe with no image for asset-feed creatives. Open the `preview_url`
in ego-lite and confirm **9:16 on IG/FB Story + Reels** and **1:1 on Feed** before sign-off. In Ads
Manager the media should split into groups: "Stories, Status, Reels, Search results" = 9:16;
"Feeds, In-stream ads for reels" = 1:1.

## What this does NOT change
The round **avatar + account name + CTA** on the Story/Reels end frame come from the ad identity (IG
account profile picture for IG, FB Page profile picture for FB) — automatic, not a creative field.
This rebuild only controls the big image slot.
