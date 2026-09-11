# CAAS Bachelor Programs — Landing Page

A self-contained static landing page for the **Culinary Arts Academy Switzerland**
Bachelor programs — **Bachelor of Arts in Culinary Arts** and **Bachelor of Arts in
Pastry, Bakery & Chocolate Arts** — modeled on the diploma landing page
(`learn.culinaryartsswitzerland.com/caas-course-diplomas/`) with header, footer and
admissions form styled after `lp.culinaryartsswitzerland.com`.

## Section order

1. Sticky header (logo + QS badge + Request More Info)
2. Hero — `STUDY CULINARY ARTS or PASTRY ARTS in SWITZERLAND'S #1 CULINARY SCHOOL`
3. Combined program overview (both pathways) + two pathway cards
4. Stat bar — Next Intake / Duration / Location / Credits (360 UK · 180 ECTS)
5. Request More Info CTA
6. Why students around the world choose these programs (6 reasons)
7. Two Vimeo videos (672755773 and 1201362976)
8. Program highlights
9. Two campuses — Le Bouveret & Brig
10. Alumni: from passion to career
11. Admissions form (two-step; program field = the 2 Bachelor programs only)
12. FAQ — refined for Bachelor / international students; single-open accordion
13. Footer — logo, #1 laurel badge, QS badge, Request More Info + copyright strip

## Brand type rules (from CAAS 2024 Guidelines, Google Fonts hierarchy)

- **Headline 1** — Old Standard TT, **FULL CAPS with prepositions, articles & pronouns
  in lowercase italics** (e.g. `PASSION for FOOD, CAREER for LIFE`). Implemented via
  `.display` + `<em>` wrapping the small words.
- **Subtitle / eyebrow** — Inter, FULL CAPS.
- **Body** — Inter regular.
- **Palette** — red `#e42313` / `#c01b0d`, cream `#faf6ef`, ink `#0e0e0e`, line `#e3e3e2`.

## Media

- Hero background and campus/alumni images are **labeled placeholders** — replace with
  final assets from `culinaryartsswitzerland.com`.
- The two program videos are live Vimeo embeds; confirm/relabel which clip is which.

## Deploy to Netlify

Root `netlify.toml` sets `publish = "caas-bachelor"`. The admissions form uses
`data-netlify="true"` (form name `admissions`) so submissions appear in the Netlify
dashboard — same handling as the generic brand page. Local preview: open
`caas-bachelor/index.html` or run `npx serve caas-bachelor`.
