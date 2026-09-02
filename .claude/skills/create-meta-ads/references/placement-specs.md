# Meta placement & asset-ratio reference

Source of truth for which aspect ratio serves which placement, so a single ad can carry a
1:1 and a 9:16 without cropping. Read this when building the `placement_videos` array
(Path A) or the `asset_customization_rules` (Path B) in `SKILL.md`.

## Aspect ratio → placement map

| Ratio | Pixels (recommended) | Min resolution | Placements to assign |
|-------|----------------------|----------------|----------------------|
| **1:1** (square) | 1080 × 1080 | 600 × 600 | FB Feed, IG Feed, Marketplace, Explore, profile feeds, video feeds, right column, Search |
| **9:16** (vertical) | 1080 × 1920 | 500 × 888 | FB Stories, IG Stories, FB Reels, IG Reels |
| 4:5 (portrait feed)* | 1080 × 1350 | 600 × 750 | FB/IG Feed — Meta's current *preferred* feed ratio; use instead of 1:1 if the user has it |
| 1.91:1 (landscape) | 1200 × 628 | 600 × 314 | Right column, Audience Network, Search, in-stream |

\* This skill is scoped to the user's 1:1 + 9:16 pair. 4:5 is listed only so you can suggest
it if the user asks why feeds "feel small" — 4:5 takes more vertical feed real estate than
1:1. The split logic is identical; just relabel the square bucket.

## The two buckets that matter

For a 1:1 + 9:16 ad, collapse every placement into two groups:

**Square bucket (1:1)** — anything that renders in a scrolling feed or a boxed slot:
- `facebook_positions`: `feed`, `marketplace`, `video_feeds`, `right_hand_column`,
  `instream_video`, `search`
- `instagram_positions`: `stream`, `explore`, `explore_home`, `profile_feed`, `ig_search`,
  `shop`

**Vertical bucket (9:16)** — anything full-screen:
- `facebook_positions`: `story`, `facebook_reels`
- `instagram_positions`: `story`, `reels`, `profile_reels`, `reels_overlay`

Assign the square bucket to the 1:1 asset and the vertical bucket to the 9:16 asset. Let the
**default / fallback** absorb any position not listed (Audience Network `classic`, Messenger
`story`, etc.) — point it at the 1:1, which crops most gracefully.

## Safe zones (9:16)

Full-screen verticals overlay UI (profile name, CTA, caption) on the bottom ~20% and some
chrome on the top ~14%. Keep logos, text, and the product's focal point inside the middle
~60% so nothing important sits under the Meta UI. If the user's 9:16 has text jammed at the
bottom, flag it before launch.

## Character / copy limits (shared across placements)

Shared copy in `asset_feed_spec` and in `ads_create_creative`:
- Primary text (`bodies` / `message`): ~125 chars before "…more" truncation on most feeds.
- Headline (`titles` / `headline`): ~40 chars.
- Description (`descriptions`): ~30 chars, shown on some placements only.

These are truncation points, not hard rejects — but write to them so the ad reads cleanly in
the tightest placement (Stories shows the least text).

## Delivery gotchas tied to placement

- **No `instagram_user_id` on the creative → zero Instagram delivery.** The 9:16 you made for
  IG Stories/Reels never serves. Always attach it.
- **Ad set placements narrowed to feed** → the vertical asset has nowhere to run. Keep
  Advantage+ Placements (leave `placement` unset) so both ratios deliver.
- **Overlapping rules** (same position in two `asset_customization_rules`) → creative
  rejected. Each position belongs to exactly one rule.
- **Uncovered placement** with no default rule / no fallback video → rejected or blank slot.
- **Reels vs Stories are separate positions.** `reels`/`facebook_reels` are distinct from
  `story`; list both in the vertical bucket or Reels falls through to the default (square).
