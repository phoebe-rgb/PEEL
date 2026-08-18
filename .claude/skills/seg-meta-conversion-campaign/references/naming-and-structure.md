# SEG naming convention + campaign structure

## Campaign structure (conversion/awareness, ABO)
```
Campaign (objective, AUCTION, ABO — budgets live on ad sets, Advantage+ OFF, PAUSED)
├── Ad set 1 (own daily/lifetime budget, optimization goal, audience, placements, geo, age)
│   ├── Ad (creative A)
│   ├── Ad (creative B)
│   └── …
└── Ad set 2 (own budget, different audience/schedule)
    └── … (usually the same ads duplicated in)
```
- **ABO, not CBO:** budget on each ad set, no campaign budget optimization.
- **Advantage+ OFF** at all three levels (campaign, audience, creative — see gotchas).
- Ad sets carry the audiences: included custom audiences, excluded custom audiences,
  `advantage_audience=0`, manual FB/IG/Threads placements, explicit age range.

## SEG UTMs & Campaign Naming convention
Names follow the SEG "UTMs & Campaign Naming" sheet — a fixed segment order joined by `_`. Worldwide
Region code is **`ALL`**. General shape:

**Campaign:** `{Pillar}_{Brand}_{Channel}_{Objective}_{Region}_{…}_{Descriptor}-{Date}`
**Ad set:** `{Region}_{…}_{AudienceType}_{AudienceDescriptor}`
**Ad:** `{Region}_{Descriptor}-{Date}_{Format}_{Lang}_{Variant}`

### Worked example — SHMS Luxury Webinar (global)
- Campaign → `PL_SHMS_FB_CONV_ALL_ALL_ALL_ALL_LuxuryWebinar-26Aug26`
- Ad set 1 → `ALL_ALL_ALL_ALL_WEB_Top25WebVisitors-180days`
- Ad set 2 → `ALL_ALL_ALL_ALL_CL_QualifiedLeads_Sep22-Oct25`
- Ads → `ALL_LuxuryWebinar-26Aug26_IMG_EN_{Speaker|CampusSunset}_{1|2}`
  (variant `1` = copy V1, `2` = copy V2; `Speaker`/`CampusSunset` = the image)

### UTM template (creative `url_tags`, top-level field)
```
utm_source=Facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}
```
Meta expands the `{{…}}` macros at delivery. Because `url_tags` is immutable on an existing ad,
finalize the naming BEFORE building creatives — a name change later means rebuilding the creative.

## Pre-build checklist
- [ ] Ad account id, Page id, IG account id (if IG), Threads id (if Threads) confirmed
- [ ] Pixel + custom_event_type confirmed (for OFFSITE_CONVERSIONS optimization)
- [ ] Included + excluded custom audience ids listed
- [ ] Geo decided (explicit country list vs. UI worldwide — see gotchas)
- [ ] Names generated for campaign + every ad set + every ad
- [ ] Feed 1:1 and story 9:16 images public + Meta-fetchable
- [ ] Copy (body/headline/description), link, CTA type confirmed
