# PEEL

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
