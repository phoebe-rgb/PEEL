---
name: seg-meta-conversion-campaign
description: >-
  Build a Meta (Facebook/Instagram/Threads) conversion or awareness campaign end-to-end via the
  Meta Ads MCP — campaign, ad sets, audiences, images, creatives, and ads — with SEG's naming and
  targeting conventions baked in. Use whenever the user wants to create, duplicate, or finish a Meta
  ad campaign through the API: "build a Meta campaign", "duplicate this Open Day campaign", "set up
  Facebook/Instagram ads", "add the story 9:16 images", "make the ads placement-customized", "flip
  geo to worldwide", "why is Stories showing the 1:1 square". Encodes the hard-won API gotchas
  (worldwide-declaration INTERNAL error, ARCHIVED-not-REMOVED, url_tags immutability, the
  is_default placement rule, never source_ad_id, keep everything PAUSED) so a rebuild doesn't repeat
  past mistakes. Requires a connected Meta Ads MCP with ad-account write access.
---

# SEG Meta Conversion Campaign Builder

Create a full Meta campaign — campaign → ad sets → audiences → images → creatives → ads → previews —
through the **Meta Ads MCP** (an `ads_*` tool surface over the Graph Marketing API). The value is
**not repeating the expensive mistakes**: every step below carries a rule that was learned by a real
API rejection or a client-visible rendering bug on the SHMS Luxury-Webinar campaign. Follow them and
a build (or rebuild) lands clean and PAUSED, ready for human sign-off.

> **Prerequisite — the ads MCP must be connected.** This skill needs a Meta Ads MCP with write
> access to the target ad account (`ads_create_campaign`, `ads_create_ad_set`,
> `ads_creative_upload_image`, `ads_create_creative`, `ads_create_ad`, `ads_get_ad_preview`,
> `ads_update_entity`). If those tools are absent, STOP and tell the user to connect/authorize it —
> do not attempt a partial build. Meta's **developer-tools** docs MCP (`devtools_discovery`) is a
> different server and has **no** ad-write capability; use it only to look up API specs.

## The one rule that overrides everything

**Everything you create stays `status=PAUSED`. Never un-pause. Never click the account's global
"Review and publish" queue** — it may hold pre-existing drafts that are not yours. Launch is always a
human decision made after preview sign-off and a schedule check.

## Workflow

1. **Confirm the account context and connection.** Ad account id, Page id, (optional) Instagram
   account id / Threads id, pixel/custom-conversion for OFFSITE_CONVERSIONS, and that the ads MCP is
   live. Never guess IDs — read them back from the user or an `ads_*` read call.
2. **Name everything up front** with the SEG convention (see `references/naming-and-structure.md`).
   Campaign, ad sets, and ads all follow the sheet's segment order; worldwide Region code is `ALL`.
3. **Create the campaign** — objective (e.g. `OUTCOME_AWARENESS`, `OUTCOME_TRAFFIC`,
   `OUTCOME_SALES`), `AUCTION`, **ABO** (budgets on ad sets, `is_cbo=false`/no campaign budget),
   Advantage+ campaign **OFF**. `status=PAUSED`.
4. **Create the ad sets** — budget, optimization goal/billing event, schedule, audiences, placements,
   geo, age. Turn **Advantage audience OFF** (`advantage_audience=0`) and lookalike/custom
   targeting-relaxation OFF. For placement asset customization set **`is_dynamic_creative=false`**.
   See `references/meta-api-gotchas.md` for the geo and age traps.
5. **Upload images** → capture each `image_hash`. Provide **both** the 1:1 feed art and the 9:16
   story art per creative if the ad runs on Stories/Reels. Images must be public and Meta-fetchable.
6. **Build creatives** — `object_story_spec` (page_id, and instagram_user_id if IG), the copy, link,
   `call_to_action`, UTM `url_tags` at the **top level** of the creative, Advantage+ creative
   enhancements **OFF**. For per-placement images use **Placement Asset Customization**
   (`asset_feed_spec` + `asset_customization_rules` with a valid **`is_default`** rule) — the full
   recipe is in `references/placement-asset-customization.md`. This is where the "Stories shows the
   1:1 square" bug lives; get the default rule right.
7. **Create the ads** — one per creative, in the right ad set, `status=PAUSED`. Build with an
   **explicit `creative`**, never `source_ad_id` (that makes drafts that hit the Review-and-publish
   queue).
8. **Preview and verify — don't assume.** Call `ads_get_ad_preview` per format. Dynamic/asset-feed
   creatives return an iframe with **no rendered image**; to truly confirm the image, open the
   `preview_url` in ego-lite (the lightweight `preview_iframe.php` screenshots even when the full AM
   editor times out). Confirm **9:16 on Story/Reels and 1:1 on Feed** before telling the client it's
   right.
9. **Hand off.** Send previews, list every entity id you created, restate that all are PAUSED, and
   flag the pre-launch checklist: confirm Advantage+ creative OFF per ad in Ads Manager, check the
   schedule against the real event/launch date, then a human un-pauses.

## Editing / rebuilding existing ads

- **To change UTM (`url_tags`) or any immutable creative field → rebuild the creative.** `url_tags`
  is rejected by `ads_update_entity` on an existing ad and creatives are immutable. Build a fresh
  creative + ad, then **ARCHIVE** the old ad.
- **Delete = set `status=ARCHIVED`.** `REMOVED` is rejected by the API.
- **Duplicating to a second ad set → recreate with an explicit `creative`.** Do not use
  `source_ad_id`; it produces drafts that land in the Review-and-publish queue.
- **Name-only edits** (renaming a campaign/ad set/ad) go through `ads_update_entity` fine.

## Reference files

- `references/meta-api-gotchas.md` — every API rejection and rendering trap learned the hard way,
  with the working alternative. Read this before any create/update call.
- `references/naming-and-structure.md` — the SEG UTMs & Campaign Naming convention and the
  campaign→ad set→ad structure, with worked names.
- `references/placement-asset-customization.md` — the 9:16-Story-vs-1:1-Feed recipe and the
  **`is_default`** default-rule fix (the "square on the story end card" bug), copy-paste JSON.
- `examples/luxury_webinar_campaign.md` — a full worked build (the SHMS Luxury Webinar global
  campaign) you can pattern-match against.

Start from the references, not from memory — the Meta API's failure modes here are non-obvious and
each one already cost a rebuild.
