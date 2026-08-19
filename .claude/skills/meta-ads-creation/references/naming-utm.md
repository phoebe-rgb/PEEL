# Naming & UTM conventions

Source: SEG "UTM & Naming" sheet
(https://docs.google.com/spreadsheets/d/1scyvRTKRx7zdbPcfnEX_62uqNmLkBIuO5hcogJnOkPg).
If the user provides a different naming/UTM doc, prefer theirs and update this file.

## Ad name — Social

`Region_Theme_Format_Lang_AssetName_CopyVersion`

- **Region**: `APAC`, `Americas`, `Euro`, `MiddleEast`, `Scandi`, `CentralAsia`, `Africa`, `Caribbean`.
- **Theme**: short token — `rank` (Overall Ranking), `career` (Career Prospects), `safety` (Safety & Security), `global` (Global Exposure), `heritage` (Swiss Heritage & Innovation).
- **Format**: `IMG`, `VID`, `MSG`.
- **Lang**: `EN`, `SE`, `IT`, `FR`, `DE`, …
- **AssetName**: the creative's short name — take it from the Canva **page title** (titles read as `AssetName-Theme`), e.g. `Class-Chef-Student`, `FoodwHands`, `CampusApicius`, `CampusDeepColor`, `CauxCampusPanoramicView`, `GroupOfStudentInClass`, `LeysinGrandHall`. Avoid underscores inside AssetName (underscore is the field separator); hyphens are fine.
- **CopyVersion**: integer, usually the asset index within the theme (`1`..`n`).

Example: `APAC_rank_IMG_EN_Class-Chef-Student_1`

## Campaign name — Social (for reference)

`PL_<School>_FB_<Funnel>_<Region>_<Country>_<Degree>_<Audience/Detail>`
e.g. `PL_CAAS_FB_ACT_APAC_IN_ALL_ALL_Parents`. Funnel: `ACT` (acquisition/leads), `CONV` (conversion/awareness), `NURT` (nurture), `RET` (retargeting).

## UTM / URL parameters (Meta)

Put this string in the ad's **URL parameters** field (`url_tags` on the creative), and keep the destination link clean:

```
utm_source=Facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}
```

`{{campaign.name}}`, `{{adset.name}}`, `{{ad.name}}` are Meta's URL macros — Meta substitutes them at delivery. Do **not** hard-code names.

## Destination URLs (India examples)

- CAAS: `https://learn.culinaryartsswitzerland.com/india/`
- SHMS: `https://learn.shms.com/india/`

General pattern from the URL-link tab: `https://learn.<brand>.com/<program>/<country>/<lang>[/<note>]` (brands: `shms.com`, `culinaryartsswitzerland.com`, `cesarritzcolleges.edu`, `him-business-school.com`).

## Conversion actions (Meta events)

`Lead` = Form-Fill (pixel) · `Register` = CRM · `SubmitApplication` = Applied (CRM) · `Accepted` (CRM).

## Ad account

SEG = `1763026957318451` (business "SEG", currency CHF). Pages: CAAS = `223546014396686`, SHMS = `108901562465426`.
