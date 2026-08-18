---
name: preview-ads
description: >-
  Generate realistic Google Ads preview mockups — how an ad will actually look on
  Google Search or the Display Network before it goes live. Use this whenever the
  user wants to preview, mock up, visualize, or design a Google ad: Search ads,
  Responsive Search Ads (RSA), or Display banner ads. Trigger on phrases like "preview
  my Google ad", "what will this ad look like", "make a Google Ads mockup", "RSA
  preview", "display ad mockup", "show me this ad on desktop and mobile", or when the
  user pastes ad copy (headlines, descriptions, a final URL) and wants to see it
  rendered. Produces a self-contained HTML preview that mirrors Google's real ad
  chrome (the "Sponsored" label, favicon, headline, description, sitelinks) and can be
  exported to PNG for client decks and campaign docs.
---

# Google Ads Preview Generator

Turn raw ad copy into a preview that looks like the real thing on Google — the same
job as tools like Vaizle's Google Ads Mockup Generator. The value is *fidelity*: a
marketer should be able to glance at the output and trust it matches what searchers or
browsers will see, catch a headline that gets truncated, and drop a PNG into a client
deck. Getting the character limits and the visual chrome right is the whole point.

## What this skill produces

A **single self-contained HTML file** (inline CSS, no external assets) that renders one
or more ad previews. It opens in any browser and can be exported to PNG. Everything the
preview needs — fonts, colors, the "Sponsored" chrome, favicon — is baked in so the file
travels well and renders identically everywhere.

Three ad formats are supported. Pick based on what the user is building:

| Format | When to use | Preview shows |
|--------|-------------|---------------|
| **Search ad** | A single fixed text ad | The exact headlines/descriptions given |
| **Responsive Search Ad (RSA)** | The user has many headlines/descriptions and wants to see how Google might assemble them | The most common live layout: 3 headlines + 2 descriptions |
| **Display ad** | Image/banner ads on the Display Network | A banner at standard IAB sizes with image, brand, CTA |

## Workflow

1. **Collect the inputs.** You need the ad copy. Ask for whatever is missing, but don't
   over-interrogate — fill obvious gaps with sensible placeholders and tell the user what
   you assumed. See "Inputs by format" below.
2. **Check the copy against Google's limits.** This is where you add real value. Flag any
   headline over 30 characters or description over 90 — Google will reject or truncate it.
   Report the overages plainly (e.g. "Headline 2 is 34/30 chars — Google will truncate to
   '…'") rather than silently cutting text. See `references/ad-specs.md` for every limit.
3. **Build the HTML** by copying the matching template from `assets/` and filling in the
   copy. Render both **desktop and mobile** views unless the user only wants one — the
   difference matters (mobile truncates harder and stacks sitelinks differently).
4. **Export to PNG** if the user wants an image (they usually do, for decks). Use
   `scripts/render_png.py`. If PNG export isn't available in the environment, hand over
   the HTML and say it can be screenshotted from a browser.
5. **Deliver** the HTML (and PNGs), and summarize any copy problems you found.

## Inputs by format

**Search ad / RSA**
- Final URL (e.g. `https://www.acme.com/running-shoes`) — the domain becomes the display URL
- Display path — two optional path segments shown after the domain (`/running/shoes`), 15 chars each
- Headlines — Search: up to 3. RSA: up to 15 (you'll show the top 3). 30 chars each.
- Descriptions — Search: up to 2. RSA: up to 4 (you'll show the top 2). 90 chars each.
- Sitelinks (optional) — short link texts (25 chars) shown under the ad
- Business/brand name (optional, shown in the modern "Sponsored" row)

**Display ad**
- Image — a creative. If none is supplied, use a neutral placeholder block.
- Brand name, headline, and a call-to-action button label (e.g. "Shop now")
- Size(s) — default to the three IAB standards: 300×250 (medium rectangle),
  728×90 (leaderboard), 160×600 (wide skyscraper). See specs file for more.

When copy is missing, prefer realistic sample content over lorem ipsum so the preview
reads like a real ad, and note that it's placeholder.

## Fidelity notes — get these right

These are the details that make a preview look real instead of "close enough". Full
color/spec tables are in `references/ad-specs.md`; the essentials:

- **Search ads now lead with a bold "Sponsored" label** (Google replaced the old green
  "Ad" pill in 2023), sitting above a row with a **favicon circle, business name, and
  display URL**. The headline is the blue link (`#1a0dab`, visited `#681da8`); the
  description is dark gray (`#4d5156`). Font is Arial/Roboto-style sans-serif.
- **Character limits are hard.** 30 for headlines, 90 for descriptions, 15 per display
  path segment, 25 for sitelink text. Don't render copy that exceeds them without showing
  the truncation the way Google actually would.
- **Mobile is narrower** (~360px content width) and truncates more aggressively; sitelinks
  render as a vertical stacked list rather than an inline row.
- **Display ads** are exact pixel boxes — a 300×250 must be exactly 300×250. Keep the CTA
  a solid contained button and the brand visible.

## Reference files

- `references/ad-specs.md` — every character limit, pixel dimension, and exact color/font
  value, per format and per device. Read this before building; it's the source of truth
  for fidelity. Has a table of contents.
- `assets/search_ad_template.html` — fillable Search / RSA preview (desktop + mobile).
- `assets/display_ad_template.html` — fillable Display banner preview at standard sizes.
- `scripts/render_png.py` — converts a preview HTML file to PNG(s) using Playwright.
- `examples/` — a worked Search ad and Display ad you can look at to calibrate.

Start from the template rather than writing markup from scratch — the chrome (Sponsored
label, favicon, spacing, colors) is fiddly and already correct in the template.
