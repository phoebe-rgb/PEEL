# Mandatory AI / auto-media opt-outs (every creative, every time)

PEEL / SEG rule: **no Meta auto-generated content of any kind.** That means no
"Related media", no website summary / selling points, no auto-crop or other AI
video edits. Meta switches these **on by default** when a field is left out, and
also when an ad is **duplicated** in Ads Manager (`action_metadata.type:
"DUPLICATION_UPGRADE"`). So never rely on defaults. Every creative must carry the
block below, explicitly.

## The block (merge into every inline `creative` JSON)

```json
{
  "degrees_of_freedom_spec": {
    "creative_features_spec": { "...": "ALL 82 keys from creative-features-optout.json, each {\"enroll_status\":\"OPT_OUT\"}" }
  },
  "biz_ai": { "capabilities": { "prompts": { "enroll_status": "OPT_OUT" } } },
  "contextual_multi_ads": { "enroll_status": "OPT_OUT" },
  "creative_sourcing_spec": {
    "website_media_spec":   { "enroll_status": "OPT_OUT" },
    "website_summary_spec": { "enroll_status": "OPT_OUT" },
    "catalog":              { "enroll_status": "OPT_OUT" }
  },
  "media_sourcing_spec": []
}
```

`creative_features_spec` must be the **full list** in
[`creative-features-optout.json`](creative-features-optout.json). It holds 82
features, copied from a creative that Ads Manager published successfully with
everything off. Load it and paste it in. **Three video keys are not enough**:

- With only 3 keys, Meta leaves biz_ai / "Chat with business" style features on.
- Once the ad set is live, publish then fails with **error 2446880 "WhatsApp
  number required"**.
- `biz_ai.capabilities.prompts` OPT_OUT is also required for the same reason.

What each line kills:

| Field | Ads Manager label | What it does if left on |
|---|---|---|
| `media_sourcing_spec: []` + `website_media_spec` OPT_OUT | **Related media** ("54 media being used in this ad") | Meta pulls other images and videos from the account or website into the ad |
| `website_summary_spec` OPT_OUT | Website summary / selling points | Meta writes unapproved claims scraped from the LP (e.g. "the only culinary school ranked in QS 2026") |
| `video_auto_crop` / `video_uncrop` / `video_filtering` | Advantage+ creative → video enhancements | Meta crops, extends or filters the video |
| `contextual_multi_ads` OPT_OUT | Multi-advertiser ads | The ad is shown in a carousel next to other advertisers |
| `catalog` OPT_OUT | Catalog / product extensions | Product cards get attached |

Do **not** send `standard_enhancements` (the API rejects it even as OPT_OUT) or
`cv_transformation`.

## NEVER click the trash icon on "Related media" in Ads Manager

If Related media shows up, the creative is missing the opt-out block. Fix it
via the API (create a new ad with the block, delete the old one).

Do **not** remove the media one by one in the UI:

- Each click writes a per-item list into
  `media_sourcing_spec.related_media.images[] = {opt_in_status: "opt_out", ...}`.
  There are usually 33–49 items.
- Meta allows at most 30, so publish fails with **error 105:
  "media_sourcing_spec['related_media']['images'] must have at most 30
  elements"**.
- The ad is then unpublishable and must be recreated.

The only correct value is `"media_sourcing_spec": []`.

## Cleaning up broken drafts

- `ads_update_entity {"status":"DELETED"}` on a never-published (`action:"add"`)
  draft ad drops it from publish. The validator may still show a stale error,
  or 1487839 "must specify ACTIVE or PAUSED", until it re-runs.
- If Ads Manager still lists those rows as errors at "Review and publish", the
  user should select them and **Discard**.
- Never let a PAUSED, errored draft sit in the campaign. It blocks "Publish all".

## Never reuse an old `creative_id` to "copy" a creative

A `{"creative_id": "<old>"}` creative passes `ads_create_ad`. But older creatives
store the headline and description inside the CTA (`call_to_action.value.link_title`
/ `link_description`). Ads Manager then blocks publishing with **error #1815589:
"Link title and description of creative's Call to Action are deprecated"**, and
shows "Please specify the media to run with this ad".

The fix is to rebuild the creative inline instead:
- `asset_feed_spec` with `titles` / `descriptions`, the same `images` (hash) or
  `videos` (video_id + thumbnail_url), the same labels and rules.
- The UTM `url_tags` at creative top level.
- The opt-out block above.

To get the media, read the source ad's draft or creative (`ads_get_ad_entities`
with `object_state=draft`) and copy `asset_feed_spec.images[].hash` /
`videos[].video_id`.

Keep `object_story_spec` = `{page_id, instagram_user_id, threads_user_id}` when
the source had them, because the ad sets deliver on Threads.

## QC after building (do this before reporting done)

1. Read the draft back (`ads_get_ad_entities`, `object_state=draft`, campaign id)
   and check, for every ACTIVE ad:
   - `creative_sourcing_spec.website_media_spec.enroll_status == OPT_OUT`
   - `creative_sourcing_spec.website_summary_spec.enroll_status == OPT_OUT`
   - `media_sourcing_spec == []`
   - every `degrees_of_freedom_spec.creative_features_spec.*.enroll_status == OPT_OUT`, with all 82 keys present
   - `biz_ai.capabilities.prompts.enroll_status == OPT_OUT`
   - no draft ad in the campaign, ACTIVE **or PAUSED**, has `active_errors`. Any errored draft blocks publish
   - no `call_to_action.value.link_title` / `link_description`
   - `validation_status == VALIDATED` and `active_errors` empty
   - no duplicate ad names within an ad set
2. The draft API does **not** expose the "Related media" list itself; it is
   computed in Ads Manager. Ask the user to spot-check one ad's **Related media**
   panel. It must be absent, or show 0.
3. When QC-ing a campaign someone **duplicated in Ads Manager**, look for
   `DUPLICATION_UPGRADE` opt-ins. They mean the creative must be rebuilt with
   this block, because it cannot be edited in place.

## Scope guard

Only touch ads and creatives. **Do not change ad-set or campaign status** (e.g.
paused LAL / WEB ad sets) unless the user asks. A paused ad set is usually
intentional.
