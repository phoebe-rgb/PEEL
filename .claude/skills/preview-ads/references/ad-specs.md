# Google Ads specifications reference

The source of truth for building accurate previews: character limits, pixel dimensions,
colors, and fonts. Values reflect Google Ads as of 2024–2025.

## Table of contents

- [Search ads — text limits](#search-ads--text-limits)
- [Responsive Search Ads (RSA)](#responsive-search-ads-rsa)
- [Search ad visual anatomy & colors](#search-ad-visual-anatomy--colors)
- [Desktop vs mobile rendering](#desktop-vs-mobile-rendering)
- [Ad extensions / assets](#ad-extensions--assets)
- [Display ads — sizes](#display-ads--sizes)
- [Display ad visual notes](#display-ad-visual-notes)

## Search ads — text limits

| Field | Max length | Count | Notes |
|-------|-----------:|------:|-------|
| Headline | 30 chars | up to 3 | Separated by " ‑ " (spaced hyphen/pipe) when shown inline. The 3rd may not always display. |
| Description | 90 chars | up to 2 | The 2nd may be truncated depending on space. |
| Display path | 15 chars | 2 segments | Optional. Shown as `domain.com/Path1/Path2`. Not the real URL path — vanity text. |
| Final URL | 2048 chars | 1 | The real destination. Only the **domain** is shown as the display URL. |

Character counting: Google counts each character including spaces. Wide characters
(most non-Latin scripts) may count as 2. Assume 1 per character for Latin copy.

**Truncation behavior:** Google does not error at display time for slightly long copy in
these previews; it truncates with an ellipsis (…). But the Ads editor *rejects* copy over
the limit at upload. So in a preview, flag the overage AND show the truncated form.

## Responsive Search Ads (RSA)

| Field | Max length | Count |
|-------|-----------:|------:|
| Headline | 30 chars | up to 15 (min 3 recommended) |
| Description | 90 chars | up to 4 (min 2 recommended) |

Google's system mixes and matches headlines/descriptions and serves different
combinations. **For a static preview, show the most common served layout: 3 headlines
joined by " ‑ " and 2 descriptions.** Optionally note that other combinations will serve.
Pinned headlines/descriptions (pinned to position 1/2/3) always show in that slot — if the
user specifies pins, honor them in the chosen combination.

## Search ad visual anatomy & colors

Modern format (post-2023, the "Sponsored" era). Top to bottom:

1. **"Sponsored" label** — bold, black `#202124`, ~14px. (This replaced the old green
   "Ad" pill. Use "Sponsored", not "Ad".)
2. **Brand row** — a favicon in a light circle, then **business name** (`#202124`, ~14px),
   then the **display URL** (`#4d5156`, ~14px). On the modern layout the label and this
   row can share space; keep the Sponsored label bold and distinct.
3. **Headline** — the blue clickable link. Color `#1a0dab` (visited `#681da8`), ~20px
   desktop / ~18px mobile, normal weight, clickable-blue. Multiple headlines joined with
   " ‑ ".
4. **Description** — body copy, `#4d5156`, ~14px, line-height ~1.4.
5. **Sitelinks / extensions** — blue links (`#1a0dab`), smaller.

Fonts: Google uses `arial, sans-serif` (Roboto/Google Sans in some surfaces). Arial is the
safe, universally-available choice and matches closely. Background is white `#ffffff`.

Container width: desktop search results column is ~600px. Keep the ad within ~600px.

## Desktop vs mobile rendering

| Aspect | Desktop | Mobile |
|--------|---------|--------|
| Content width | ~600px | ~360px (phone viewport) |
| Headline size | ~20px | ~18–20px, wraps sooner |
| Sitelinks | inline row, separated by spacing | stacked vertical list, each on its own line, often with a divider |
| Truncation | descriptions rarely cut | descriptions cut harder; 2nd description often hidden |
| Favicon | ~26px circle | ~26px circle |

Always render both unless the user asks for one. Frame each in a labeled device chrome so
it's obvious which is which.

## Ad extensions / assets

- **Sitelink** — link text 25 chars; optional 2 description lines 35 chars each.
- **Callout** — 25 chars, non-clickable snippets.
- **Structured snippet** — header + values.
- **Call extension** — phone number.

For previews, sitelinks are the most impactful to show. Others are optional.

## Display ads — sizes

Standard IAB / Google Display Network sizes (pixels, W×H):

| Name | Size | Orientation |
|------|------|-------------|
| Medium rectangle | 300×250 | box — most common, default |
| Leaderboard | 728×90 | horizontal |
| Wide skyscraper | 160×600 | vertical |
| Large rectangle | 336×280 | box |
| Mobile banner | 320×50 | horizontal, mobile |
| Large mobile banner | 320×100 | horizontal, mobile |
| Half page | 300×600 | vertical |
| Billboard | 970×250 | horizontal, large |

Default to the top three (300×250, 728×90, 160×600) unless the user names sizes. These
must render at **exact pixel dimensions** — a mockup that's the wrong size defeats the
purpose.

## Display ad visual notes

- A display ad = image/creative area + brand + optional headline + a **CTA button**.
- The layout adapts to the aspect ratio: box sizes stack (image on top, text/CTA below);
  the leaderboard is a horizontal strip (brand/CTA on one side, image on the other); the
  skyscraper stacks vertically with more room.
- CTA button: solid fill, contrasting color (a blue like `#1a73e8` on white, or brand
  color), rounded corners, clear label ("Shop now", "Learn more", "Sign up").
- If no image is supplied, use a neutral gray placeholder block labeled "Your image" so
  the composition still reads. Keep the brand name legible.
- Keep a thin border (`#dadce0`) around each banner so its exact bounds are visible.
