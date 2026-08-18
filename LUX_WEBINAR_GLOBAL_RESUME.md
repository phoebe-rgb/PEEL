# SHMS Luxury Webinar — GLOBAL campaign — RESUME KIT

Goal: duplicate an SHMS Open Day campaign → **global**, **no Advantage+**, new Luxury-Webinar copy + assets.
Status as of 2026-08-18: campaign + 2 ad sets built via the Meta Ads MCP (server `00389a09…`), which then
disconnected. **Remaining = upload 3 feed images → 4 creatives → 4 ads in ad set 1.** Story (9:16) images added later by client, then duplicate to ad set 2.

> **RESUME 2026-08-18 (2nd session):** Meta Ads MCP `00389a09…` is STILL not connected (absent from the
> tool list, not just needing re-auth). Supermetrics `FA` has NO SEG account either → **no API write path this
> session.** User chose: **reconnect the Meta Ads MCP, then finish via API.** All assets verified present +
> public (3 feed lh3 URLs return HTTP 200 image/png; byte sizes match). **Story 9:16 originals are now present
> locally** in `../SHMS Luxury Webinar STORY/` (Clientbanner-All / Template-V1 / Template-V2) but are NOT yet on
> a public Drive folder — feed images only are public so far.
>
> **To reconnect:** in an interactive `claude` terminal run `/mcp` (or `claude mcp`) and reconnect/authorize the
> SEG Meta Ads MCP `00389a09…`. Then fire the sequence in "## READY-TO-FIRE" below. Nothing else is needed.
>
> **✅ DONE 2026-08-18 (MCP reconnected):** Steps A–D fired successfully. All in ad set `120250984139560323`, PAUSED.
> - image_hash: speaker `7165fa1a431e6ef8de7372266f962abb`, V1 `ceb88d505b13837a1259c6718ae6b57c`, V2 `bf74a189f2e3cfb0575787471928c1ce`
> - creatives: V1_Speaker `1597250915137919`, V1_Campus `1664095105237510`, V2_Speaker `1407872561250544`, V2_Campus `1061588776263856`
> - ads: V1_Speaker `120250986671350323`, V1_Campus `120250986672100323`, V2_Speaker `120250986672750323`, V2_Campus `120250986673260323`
> - **CAVEAT:** Meta DEPRECATED the `standard_enhancements` OPT_OUT field (creatives were created WITHOUT it). Advantage+ Creative enhancements must be confirmed OFF per-creative in the Ads Manager UI at review, or opted out via individual `creative_features_spec` features.
> - STILL TODO: geo flip IN→Worldwide + Universal Ads declaration; client approves feed ads; then push 3 story 9:16 images to a public Drive folder + duplicate the 4 ads into ad set 2 `120250984143570323`.
>
> **✅ NAMING DONE 2026-08-18** — applied the SEG "UTMs & Campaign Naming" convention (sheet `1scyvRTKRx7zdbPcfnEX_62uqNmLkBIuO5hcogJnOkPg`; worldwide Region code = `ALL`, confirmed by the Ad Set tab):
> - Campaign → `PL_SHMS_FB_CONV_ALL_ALL_ALL_ALL_LuxuryWebinar-26Aug26`
> - Ad set 1 → `ALL_ALL_ALL_ALL_WEB_Top25WebVisitors-180days`; Ad set 2 → `ALL_ALL_ALL_ALL_CL_QualifiedLeads_Sep22-Oct25`
> - Ads → `ALL_LuxuryWebinar-26Aug26_IMG_EN_{Speaker|CampusSunset}_{1|2}` (1=V1 sit-in copy, 2=V2 professionals copy)
>
> **⛔ WORLDWIDE FLIP BLOCKED (2026-08-18):** `ads_update_entity` setting `targeting.geo_locations.country_groups=["worldwide"]` + `regional_regulated_categories:["TAIWAN_UNIVERSAL"]` returns Meta **INTERNAL** (is_retryable) on every attempt (5×), while all name-only writes succeed. Worldwide-without-declaration gives a clean VALIDATION ("use TAIWAN_UNIVERSAL"), so worldwide geo IS processed — the INTERNAL appears ONLY once the declaration field is added → the `regional_regulated_categories` write is broken via this MCP path. **Fix = flip in Ads Manager UI:** open each ad set → Audience → Locations = Worldwide → accept the Universal Ads declaration checkbox(es) (Taiwan/Singapore) → keep all 5 included + 2 excluded custom audiences + advantage_audience OFF. Ad sets still on geo `IN` until this is done.
>
> **✅ RESOLVED — geo set to TOP-22 SHMS MARKETS (2026-08-18):** Instead of worldwide (blocked by the broken declaration write), client chose to target SHMS's best historical-origin countries (from `SEG Pilot ... Historical In-house students_Pivot table.csv`). Both ad sets now target 22 countries — **CN, VN, MM, SA, IN, TH, ID, HK, US, SE, CH, KH, KR, MY, AE, FR, CA, GB, DO, MO, NO, IT** (all with ≥10 historical accepted, excl. Taiwan+Singapore which trigger the declaration, and Russia which Meta doesn't deliver to). No country_groups, no regional_regulated_categories → API write succeeded, VERIFIED live. **age_min bumped 18→20** (forced: Thailand requires min age 20 when a custom audience is attached). All 5 included + 2 excluded audiences + advantage_audience=0 preserved. Both ad sets still PAUSED. NOTE: China (FB blocked in-country) and any low-delivery markets will simply under-serve; harmless.
>
> **✅ STORY 9:16 IMAGES ADDED via PLACEMENT CUSTOMIZATION (2026-08-18):** Browser/UI route abandoned — ego-lite screenshots timed out on the AM editor AND UI edits would entangle with the "Review and publish (54)" queue. Did it via API instead: pushed 3 story 9:16s to the public Drive folder, uploaded to account (hashes: story-speaker `65ac1bd0d188cd27edfae1d9ea12f6d6`, story-V1 `047b115203d69f23c1a84271b9e7940a`, story-V2 `0f3bdab27299f8d7394cadd0e96c44d3`), then REBUILT all 4 ads as **dynamic creatives** (`asset_feed_spec` with `asset_customization_rules`) passed as raw JSON through `ads_create_ad`'s `creative` field (the MCP has no per-placement-image param, but it forwards raw creative to the Graph API — this works). Rule: **FB story+facebook_reels & IG story+reels → 9:16 story image; everything else (feed/search/marketplace/instream/profile/Threads) → 1:1 feed image.** New ad ids (all PAUSED, ad set `120250984139560323`): Speaker_1 `120250990225460323`, CampusSunset_1 `120250990281160323`, Speaker_2 `120250990282100323`, CampusSunset_2 `120250990284970323`. Old 4 single-image ads (`1202509866713/721/727/732…`) set to ARCHIVED. `REMOVED` status is rejected by the API; use `ARCHIVED`. **CONFIRMED WORKING 2026-08-18** (client + preview-iframe screenshot): Ads Manager shows the ad's media split into groups — "Feeds, In-stream ads for reels" = 1:1, "Stories, Status, Reels, Search results" = 9:16 story, "Facebook Search results" = 1:1. So the 9:16 lands on Stories/Status/Reels (and IG Search) exactly as asked. LESSON: dynamic-creative ad previews return an iframe with NO rendered image via `ads_get_ad_preview`; to truly verify an image, open the preview_url in ego-lite (the lightweight preview_iframe.php DOES screenshot, even though the full AM editor times out) — don't claim an image is correct from canvas dimensions alone.
>
> **✅ UTM TRACKING + AD SET 2 DUPLICATION (2026-08-18):** Meta UTM template `utm_source=Facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}`. `url_tags` is NOT editable on an existing ad (`ads_update_entity` rejects it) and creatives are immutable → rebuilt all creatives with `url_tags` as a top-level creative field (sits beside object_story_spec + asset_feed_spec; `ads_create_ad` forwards it fine). Built 4 fresh ads in EACH ad set (explicit creative = published-PAUSED, NOT drafts — avoids the 54-queue; do NOT use source_ad_id which creates drafts). Archived the 4 prior no-UTM ads. **FINAL LIVE ADS (all PAUSED, UTM + 9:16-story/1:1-feed placement customization):** Ad set 1 `120250984139560323` (WEB Top25): Speaker_1 `120250991103330323`, CampusSunset_1 `120250991132460323`, Speaker_2 `120250991134900323`, CampusSunset_2 `120250991136990323`. Ad set 2 `120250984143570323` (CL QualifiedLeads): Speaker_1 `120250991140430323`, CampusSunset_1 `120250991142200323`, Speaker_2 `120250991145800323`, CampusSunset_2 `120250991157880323`. Both ad sets = 4 ads each. Remaining: client sign-off; confirm Advantage+ Creative OFF; check schedule vs Wed 26 Aug before un-pausing.

## Account / IDs
- Ad account: **1763026957318451** (SEG, CHF)
- SHMS Page id: **108901562465426**
- Campaign: **120250983803350323** — `PL_SHMS_FB_CONV_Global_ALL_ALL_LuxuryWebinar-26Aug26` (OUTCOME_AWARENESS, AUCTION, ABO, no CBO) — PAUSED
- Ad set 1: **120250984139560323** — `Global_KEY_ALL_ALL_WEB_Top25WebVisitors-180days` — REACH / IMPRESSIONS, daily 300 (CHF3) — PAUSED  ← **put the 4 ads here**
- Ad set 2: **120250984143570323** — `Global_KEY_ALL_ALL_CL_QualifiedLeads_Sep22-Oct25` — REACH / IMPRESSIONS, daily 200 (CHF2) — PAUSED
- Source cloned: `PL_SHMS_FB_CONV_APAC_IN_ALL_ALL_OpenDay-OnCampus-18May26` (120244015704330323)

### Ad set targeting (both) — already set, no Advantage+
age 18–65; FB+IG+Threads manual placements; advantage_audience=0; targeting_relaxation lookalike/custom=0.
Included custom audiences: 120233184258270323, 120233184260170323, 120233627513980323, 120239661780240323, 120239661792880323.
Excluded: 120235660199770323, 120244289232340323.
**GEO = India placeholder (`IN`) — must change to WORLDWIDE + Universal Ads declaration.** Worldwide via API needs
`geo_locations.country_groups=["worldwide"]` AND the regional regulated-category declaration
(TAIWAN_UNIVERSAL, SINGAPORE_UNIVERSAL, +others). The MCP `ads_create_ad_set` couldn't set that field →
do the geo/declaration flip in Ads Manager UI, or via ads_update_entity if it accepts `regional_regulated_categories`.

## Images (public, Meta-fetchable) — FEED 1:1 only for now
Drive folder `SHMS_LuxWebinar_Meta_FEED_upload` (id 13lCzS4MfKvpWBteqcAvX-SCQeJE0dFeh), all shared anyone/reader.
- Clientbanner-All (speaker/hero): https://lh3.googleusercontent.com/d/1bsTYFYD2IZ9gZZoj7cLTy9lcV7h_32K3=w1080
- Template-V1 ("Step inside an SHMS Master's"): https://lh3.googleusercontent.com/d/167X59DEiQUhov8mMxQOi0MdnN3ALsMIb=w1080
- Template-V2 ("Decoding the DNA of iconic brands"): https://lh3.googleusercontent.com/d/1RTcYGvL66eb6rcJLENcFWMZWbvxa97nM=w1080

Local originals: `~/Documents/Claude/Projects/SEG (25)/SHMS Luxury Webinar FEED/` →
`Clientbanner-All.png`, `Template-V1.png`, `Template-V1 (2).png` (the "(2)" IS the V2 feed art).
Story 9:16 versions live in `../SHMS Luxury Webinar STORY/` (Clientbanner-All, Template-V1, Template-V2) — client adds these later.

## Copy (sheet 1r0IVv7Ws912MWAxV_PkrTFq2tlWXlNxV8qnQtBUafeo, tab "Copy")
Common to all ads: link **https://lp.shms.com/luxury-webinar**, CTA **SIGN_UP**, Page SHMS 108901562465426.
Turn OFF Advantage+ creative enhancements (standard_enhancements opted out).

**V1 body (message):**
Want to sit in on a Master's class before you apply?

Join a free live webinar with Dr. Olesya Tomyuk, SHMS Program Manager and luxury-brand researcher, on what makes the world's most iconic brands win, the thinking at the heart of our Master's in Luxury Brand Management.

One hour to see what a Swiss Master's at SHMS is really like.

📅 Wednesday 26 August
🕒 2:00 PM (CET)
💻 Live on Zoom

Save your seat, free for registered guests.
- V1 headline (name): `Free webinar · 26 Aug, Zoom`
- V1 description: `Sit In on an SHMS Master's - Live`

**V2 body (message):**
What makes a luxury brand truly iconic, and how do you build that edge into your own work?

In a free live webinar, Dr. Olesya Tomyuk (PhD, SHMS) unpacks the strategy, mindset and excellence behind the world's most iconic luxury brands, drawn from her research into how luxury consumers really behave.

One hour, live, with one of the world's top hospitality schools.

📅 Wednesday 26 August
🕒 2:00 PM (CET)
💻 Live on Zoom

Reserve your spot, free for registered guests.
- V2 headline (name): `Free live webinar · 26 Aug`
- V2 description: `What Makes Iconic Brands Win`

## The 4 ads (all in ad set 1 = 120250984139560323, status PAUSED)
| Ad name | Image (feed 1:1) | Copy |
|---|---|---|
| SHMS_LuxWebinar_Global_V1_Speaker | Clientbanner-All | V1 |
| SHMS_LuxWebinar_Global_V1_Campus | Template-V1 | V1 |
| SHMS_LuxWebinar_Global_V2_Speaker | Clientbanner-All | V2 |
| SHMS_LuxWebinar_Global_V2_Campus | Template-V2 | V2 |

## READY-TO-FIRE sequence (paste once MCP `00389a09…` is live)
All in ad account **1763026957318451**, Page **108901562465426**, ad set **120250984139560323**, status **PAUSED**.
Common creative fields: `link=https://lp.shms.com/luxury-webinar`, `call_to_action{type:SIGN_UP}`, Advantage+ creative enhancements OFF (standard_enhancements opted out).

**Step A — upload 3 feed images → capture image_hash (h_speaker, h_v1, h_v2):**
- `ads_creative_upload_image(account_id=1763026957318451, image_url="https://lh3.googleusercontent.com/d/1bsTYFYD2IZ9gZZoj7cLTy9lcV7h_32K3=w1080")` → **h_speaker**  (Clientbanner-All)
- `ads_creative_upload_image(account_id=1763026957318451, image_url="https://lh3.googleusercontent.com/d/167X59DEiQUhov8mMxQOi0MdnN3ALsMIb=w1080")` → **h_v1**  (Template-V1)
- `ads_creative_upload_image(account_id=1763026957318451, image_url="https://lh3.googleusercontent.com/d/1RTcYGvL66eb6rcJLENcFWMZWbvxa97nM=w1080")` → **h_v2**  (Template-V2)

**Step B — 4 creatives** (`ads_create_creative`, object_story_spec.page_id=108901562465426, link_data{ image_hash, link, message=BODY, name=HEADLINE, description=DESC, call_to_action{type:SIGN_UP} }, degrees_of_freedom_spec → creative_features_spec standard_enhancements OPT_OUT):

| Creative | image_hash | message | name (headline) | description |
|---|---|---|---|---|
| cr_V1_Speaker | h_speaker | V1 body | `Free webinar · 26 Aug, Zoom` | `Sit In on an SHMS Master's - Live` |
| cr_V1_Campus  | h_v1      | V1 body | `Free webinar · 26 Aug, Zoom` | `Sit In on an SHMS Master's - Live` |
| cr_V2_Speaker | h_speaker | V2 body | `Free live webinar · 26 Aug`  | `What Makes Iconic Brands Win` |
| cr_V2_Campus  | h_v2      | V2 body | `Free live webinar · 26 Aug`  | `What Makes Iconic Brands Win` |

**Step C — 4 ads** (`ads_create_ad`, adset_id=120250984139560323, status=PAUSED), one per creative above:
`SHMS_LuxWebinar_Global_V1_Speaker`, `…_V1_Campus`, `…_V2_Speaker`, `…_V2_Campus`.

**Step D — `ads_get_ad_preview` for each** → send previews to client.

(V1/V2 body text verbatim in the "## Copy" section above.)

## Remaining steps (via MCP `00389a09…` once reconnected)
1. `ads_creative_upload_image` ×3 with the 3 lh3 URLs → capture each `image_hash`.
2. `ads_create_creative` ×4 — object_story_spec: page_id 108901562465426, link_data{ image_hash, link, message=body, name=headline, description, call_to_action{type:SIGN_UP} }. Advantage+ creative OFF.
3. `ads_create_ad` ×4 in ad set 120250984139560323, status PAUSED.
4. `ads_get_ad_preview` for each → send previews to client.
5. Flip both ad sets GEO → Worldwide + Universal Ads declaration (UI or ads_update_entity).
6. After client adds 9:16 story images to the 4 ads + approves → duplicate the 4 ads into ad set 2 (120250984143570323).
7. Confirm schedule vs webinar date **Wed 26 Aug 2026** before anyone un-pauses.

NOTE: keep everything PAUSED. Do not click the account's global "Review and publish (54)" — 54 pre-existing drafts are NOT ours.
