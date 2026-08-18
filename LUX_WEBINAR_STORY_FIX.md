# SHMS Luxury Webinar — STORY/REELS "SQUARE" FIX (root cause + ready-to-fire payload)

**Symptom (client-reported):** at the end of the Story/Reel the ad shows the **1:1 feed square**
("square favicon") instead of the full-screen **9:16 story image**, next to the SHMS page name +
**Sign up** CTA end card.

**This is OPEN ISSUE #1 in `LUX_WEBINAR_SESSION_WRAPUP.md`.** It is now diagnosed and solved.
The fix could not be *fired* in the web session that wrote this doc — the SEG Meta Ads MCP
(`00389a09…`, ad-account write access) is not connected there, and only Meta's **developer-tools**
docs MCP is. Fire the payload below from a session where the ads MCP is live.

---

## Root cause

The 8 ads are built as **Placement Asset Customization** creatives (`asset_feed_spec` +
`asset_customization_rules`, `optimization_type: "PLACEMENT"`). The prior session tried to express
the "everything-else" backup rule with an **empty `customization_spec: {}`** — Meta rejects that.
With no valid backup rule, the Story/Reels placements fall through to the 1:1 feed image → the
square the client saw.

**Meta identifies the default/backup rule with an explicit `is_default: true` boolean flag — not an
empty spec.** (Confirmed against Meta Marketing API docs: *Asset Customization Rules* /
*Placement Asset Customization* / *Multi-Language Ads*, v25.0, retrieved 2026-08-18 via the Meta
Developer Tools MCP.)

Two more requirements the rebuild must satisfy (same docs):
1. **At least two customization rules** per `asset_feed_spec` — fewer and the ad won't create.
2. The ad set must have **`is_dynamic_creative=false`** (this is Placement Asset Customization, not
   Dynamic Creative). Verify both ad sets before rebuilding.

`customization_spec` supported fields (Placement Asset Customization):
`publisher_platforms` = `facebook | instagram | messenger | audience_network | threads`;
`facebook_positions` = `feed, right_hand_column, marketplace, video_feeds, search, story,
facebook_reels, instream_video, notification`;
`instagram_positions` = `stream, story, reels, explore, explore_home, profile_feed, ig_search`;
`threads_positions` = `threads_stream` (requires IG `stream` also present).

---

## The fix — corrected `asset_feed_spec`

Each of the 8 creatives carries **two labelled images** — the 1:1 feed art and the 9:16 story art —
and **two rules**: a Story/Reels rule → 9:16, and a **default (`is_default: true`)** rule → 1:1 that
also backs up every placement not explicitly listed. The only change vs. the broken build is the
**`is_default: true` flag** replacing the empty-`{}` default attempt (plus enumerating placements
explicitly).

```jsonc
// asset_feed_spec for ONE creative (repeat per creative, swapping the two image hashes + copy)
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
  "link_urls":    [{ "website_url": "https://lp.shms.com/luxury-webinar" }],
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

Keep these creative-level fields that the prior build already got right (do **not** drop them):
- `url_tags` (UTM) at the **top level of the creative** (immutable on an existing ad → that's why we
  rebuild): `utm_source=Facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}`
- `object_story_spec.page_id = 108901562465426` (add `instagram_user_id` if the account requires an
  explicit IG identity for IG Story/Reels).
- Advantage+ creative enhancements OFF (confirm per-creative in Ads Manager at review — the API
  `standard_enhancements` opt-out field is deprecated).

### Image hashes (from `LUX_WEBINAR_GLOBAL_RESUME.md`)
| Creative | FEED 1:1 (`feed_1x1`) | STORY 9:16 (`story_9x16`) |
|---|---|---|
| Speaker      | `7165fa1a431e6ef8de7372266f962abb` | `65ac1bd0d188cd27edfae1d9ea12f6d6` |
| Campus V1    | `ceb88d505b13837a1259c6718ae6b57c` | `047b115203d69f23c1a84271b9e7940a` |
| Campus V2    | `bf74a189f2e3cfb0575787471928c1ce` | `0f3bdab27299f8d7394cadd0e96c44d3` |

(Speaker uses the speaker feed+story hashes for BOTH V1 and V2 copy; Campus uses V1 art for V1 copy,
V2 art for V2 copy. Copy V1/V2 headlines/descriptions/bodies are in the RESUME's `## Copy` section.)

---

## Fire sequence (once the ads MCP `00389a09…` is connected)

Guardrails from the RESUME/WRAPUP still apply: **everything stays PAUSED**; rebuild with an explicit
`creative` (never `source_ad_id` — it makes drafts that hit the account's "Review and publish (54)"
queue, which is NOT ours); delete = status **`ARCHIVED`** (`REMOVED` is rejected).

1. For each of the 8 ads, build a **new creative** with the corrected `asset_feed_spec` above
   (`ads_create_creative`, raw `creative` JSON — the MCP forwards it to the Graph API).
2. `ads_create_ad` in the SAME ad set as the ad it replaces, `status=PAUSED`, same ad name:
   - Ad set 1 `120250984139560323` (WEB Top25) — Speaker_1, CampusSunset_1, Speaker_2, CampusSunset_2
   - Ad set 2 `120250984143570323` (CL QualifiedLeads) — same four
3. Set the 8 prior ads (`120250991103330323 … 120250991157880323`) to **`ARCHIVED`**.
4. **Verify the render, don't assume it:** dynamic-creative previews return an iframe with no image
   via `ads_get_ad_preview`. Open each `preview_url` in ego-lite (the lightweight
   `preview_iframe.php` screenshots) and confirm **IG Story, IG Reels, FB Story, FB Reels** all show
   the **9:16** image and Feed shows the 1:1 — before telling the client it's fixed.

## Separate fix — the end-card round logo (the "SHMS logo" + name)

The 9:16 fix above is the **big full-screen image**. The small **round logo + account name** on the
Story/Reels end card is a *different* thing: it is the **advertiser identity's profile picture**, not
a creative field. Meta's docs are explicit — Stories branding ads (REACH / VIDEO_VIEWS) "only show an
advertiser's Instagram account name and profile picture" (*Data and CTA Requirements*). There is **no
`logo` field in `asset_feed_spec`** for stories/reels, so it cannot be set per-ad or via the rebuild.

### Where the end-card logo comes from
| Placement | The round logo + name is pulled from |
|---|---|
| **IG** Story / Reels (`shmsswitzerland`) | The **Instagram account's profile picture** |
| **FB** Story / Reels | The **SHMS Facebook Page (`108901562465426`) profile picture** |

### How to fix it (manual — profile-picture change, NOT an API action)
Neither step is doable via the Marketing API / ads MCP — a person with access must do them once, and
they then apply to every ad automatically:
1. **Instagram** — in the Instagram app on the `shmsswitzerland` account: *Edit profile → Change
   profile photo* → upload the SHMS crest (`SHMS ava facebook.jpg`). Covers all IG Story/Reels ads.
2. **Facebook** — on the SHMS Page (`108901562465426`): *Page → profile picture → Edit* → upload the
   same crest. Covers all FB Story/Reels ads.
3. If the IG identity is a **page-backed "shadow" account** (not a real IG login), its picture
   **auto-mirrors** the FB Page picture — so doing step 2 does step 1 for free.

### If you want the logo BIG and in-frame (not just the small round avatar)
The end-card avatar is always small and round. To show the SHMS logo large at the end of the story,
**bake it into the 9:16 story image** (a logo band top or bottom of the vertical artwork) and re-upload
that image. That is a design edit to the creative, then the rebuild above picks it up.
