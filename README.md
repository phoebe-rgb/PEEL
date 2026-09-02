# PEEL

## `create-meta-ads` skill

A Claude skill for creating **Meta (Facebook / Instagram) ads** end to end — campaign, ad
set, creative, and ad — via the Facebook Ads tools, with correct handling of **two asset
aspect ratios in a single ad**: a **1:1** square for Feed placements and a **9:16** vertical
for Stories and Reels.

It lives in [`.claude/skills/create-meta-ads/`](.claude/skills/create-meta-ads/) and triggers
whenever someone wants to launch a Meta ad, especially when they have a square and a vertical
version and want each placement to show the right size instead of a cropped or letterboxed one.

**What it teaches (placement asset customization)**

- **Video** — the tool-native `placement_videos` path: 1:1 → Feed, 9:16 → Stories/Reels,
  plus a fallback.
- **Image** — an `asset_feed_spec` with `asset_customization_rules` mapping each placement
  group to the right image by label, with one default rule.
- A full placement → aspect-ratio map, the exact `facebook_positions` / `instagram_positions`
  buckets, and the common rejections (missing fallback, label mismatch, no `instagram_user_id`,
  feed-only placements).

See the skill's [`SKILL.md`](.claude/skills/create-meta-ads/SKILL.md) for the workflow and
[`references/placement-specs.md`](.claude/skills/create-meta-ads/references/placement-specs.md)
for the sizing tables.

## `preview-ads` skill

A Claude skill for generating realistic **Google Ads preview mockups** — how a text
or banner ad will actually look on Google Search or the Display Network before it
goes live. It's the same job as tools like Vaizle's Google Ads Mockup Generator.

It lives in [`.claude/skills/preview-ads/`](.claude/skills/preview-ads/) and triggers
whenever someone wants to preview, mock up, or visualize a Google ad.

**Supported formats**

- **Search ads** — the modern "Sponsored" layout: favicon, business name, display URL,
  blue headline, description, and sitelinks.
- **Responsive Search Ads (RSA)** — renders the most common served combination
  (3 headlines + 2 descriptions) from a larger asset pool.
- **Display ads** — exact-pixel IAB banners (300×250, 728×90, 160×600, and more) with
  image, brand, and CTA button.

**What it produces**: a self-contained HTML preview (desktop + mobile) that mirrors
Google's real ad chrome, plus optional high-res PNG export for client decks. It also
checks copy against Google's hard character limits (30 for headlines, 90 for
descriptions) and flags anything that will be truncated.

See the skill's [`SKILL.md`](.claude/skills/preview-ads/SKILL.md) for the full workflow
and [`examples/`](.claude/skills/preview-ads/examples/) for rendered samples.
