# CAAS Bachelor Programs — Landing Page

A self-contained static landing page for the **Culinary Arts Academy Switzerland**
Bachelor programs (all Bachelor pathways):

1. **Bachelor of Arts in Culinary Arts** (intakes: January / April / July / October)
2. **Bachelor of Arts in Pastry, Bakery & Chocolate Arts** (intakes: January / July)

Each program is presented in two sections — an **overview** (intro, stat tiles,
"at a glance", program video) and a **term-by-term journey** (three-year, multi-exit
structure with the Swiss Grand Diploma → Swiss Higher Diploma → dual Bachelor's degree,
plus "Graduate with" and entry requirements) — following the HIM Business School pattern.

## Design system

Mirrors `lp.culinaryartsswitzerland.com`:

- **Fonts:** Old Standard TT (serif display) + Inter (sans body/UI), via Google Fonts.
- **Colors:** red `#e42313` / `#c01b0d`, cream `#faf6ef`, ink `#0e0e0e`, coral accents.
- **Header/footer, hero, two-step admissions form** match the brand landing page.

## Content source

Copy, wording and figures are taken from the 2026 CAAS flyer and Bachelor program pages.

## Media

Hero, program videos and campus/alumni images are **clearly-labeled placeholders**
with correct aspect ratios. Replace them with final assets/embed URLs from
`culinaryartsswitzerland.com` before launch (search for `PLACEHOLDER` / `video-ph` /
`img-ph` in `index.html`).

## Deploy to Netlify

The repo root `netlify.toml` sets `publish = "caas-bachelor"`, so a Netlify deploy from
this branch serves the page at the site root. The admissions form uses
`data-netlify="true"` (form name: `admissions`) so submissions appear in the Netlify
dashboard with no extra backend — the same handling as the generic brand page.

Local preview: open `caas-bachelor/index.html` in a browser, or run
`npx serve caas-bachelor`.
