# Netlify build-agent prompt — CAAS Indonesia landing page

**Brand:** Culinary Arts Academy Switzerland
**Source page to copy:** `lp.culinaryartsswitzerland.com/india`
**New route:** `/indonesia` → `https://lp.culinaryartsswitzerland.com/indonesia`
**Language:** English
**Hidden country value (form):** `Indonesia`
**Admissions-team label:** "Indonesia admissions team"

> Paste everything below into the Netlify **build agent** on the project **overview** page (build directly into the LIVE project — do **not** edit the existing India page). Route the form to the **same thank-you page** all other pages use.

---

Copy the existing **India** page (`/india`) and create a new page at **`/indonesia`**. Reuse the existing form integration, shared CSS, Netlify functions and Pardot Form Handler exactly as on `/india` — do not rebuild from scratch, only patch the following. This is a market-specific page, so **hard-code the country to Indonesia** (no country picker). Keep every existing form field and its Pardot mapping; the only field change is setting the hidden country value to `Indonesia` and defaulting the phone field to `+62 `.

## 1. Global text / metadata
- `<title>` → **Culinary Arts Academy Switzerland — Indonesia Admissions**
- Meta description → focus on launching an international culinary career from Switzerland, dedicated **Indonesia admissions team**, all-inclusive programs, paid internships, globally recognized degrees.
- Replace every "India" reference with "Indonesia" and "Indian families/students" with "Indonesian families/students".
- Any tracking/CTA class `cta-india` → `cta-indonesia`.

## 2. Hero
- Keep headline: *Turn Your Passion for Food into a Career for Life*.
- Sub-line (add/keep): *Launch an international culinary career from Switzerland — the world's #1 ranked culinary school, with paid internships and globally recognized degrees that open doors worldwide.*

## 3. Copy / house-rule fixes (apply site-wide on this page)
- "dual degrees" → **"2 degrees"**.
- "launchpad" → **"stepping stone"** (Why Switzerland heading + intro).
- No full stop at the end of headlines.
- Keep full brand name "Culinary Arts Academy Switzerland" (never an acronym).

## 4. Alumni section — weight toward Indonesia / Southeast Asia
Replace the alumni cards with (photos + info from `culinaryartsswitzerland.com/en/culinary-arts-academy-alumni/`):
1. **Theodore Darrel** — Owner & Chef, Tide & Table · Jakarta, Indonesia · Class of 2019
2. **Dary Hutomo Sarwono** — F&B Director, Joglo Group · Jakarta, Indonesia · Class of 2015
3. **Ian Ferdinand Chong** — Founder, Marymount Bakehouse · Singapore · Class of 2016
4. **Danna Vu** — Culinary World Cup 2018 Champion · Culinary Olympics 2020 Gold Medal
- Add to the intro: "...including chefs and restaurateurs leading kitchens across Jakarta and Southeast Asia."
- `[CONFIRM]` Source and upload the alumni photos from the alumni page.

## 5. Why Switzerland → "Trusted by Indonesian Families"
- Heading: *Trusted by Indonesian Families*.
- Bullet: "Degrees recognized for careers in **Indonesia, Singapore, the UAE and beyond**".

## 6. **Key change — "What's Covered" + fees, moved directly above the form**
This market has many junk leads, so **show the fees up front to qualify serious applicants.**
- Take the **"What's Covered / Everything is taken care of"** section. **Keep the eyebrow ("What's Covered"), headline ("Everything is taken care of") and subheadline.**
- **Remove the old "card detail"** (the bulleted list of inclusions / the collapsed fee accordions).
- **Add 3 program cards** (one per program) showing the fee **on the card face**, all expanded (no accordion):
  - **Bachelor of Arts — Culinary, or Pastry, Bakery & Chocolate Arts** — **CHF 175,300** (approx. Rp 3.6 billion) · 3 years / 7 terms · 2 paid internships
  - **MA in Culinary Business Management** — **CHF 49,000** (approx. Rp 1.0 billion) · 1 year / 2 terms · 1 paid internship
  - **Swiss Diplomas in Culinary or Pastry Arts** — **CHF 42,400** (approx. Rp 869 million) · 1 year / 2 terms · 1 paid internship
  - Each card: one-line "All-inclusive: tuition, accommodation & meals, kitchen tools & uniform, student services, arrival & insurance, career services and paid internship(s)" + a **Request More Info** CTA.
- Keep the ROI / paid-internship block (97% hired · CHF 2,350/mo) inside the section.
- **Move this whole section so it sits immediately above the admissions form** (order becomes: Programs → Alumni → Why Switzerland → Campuses → What's Covered/Fees → **Form** → FAQ).
- Footnote: *Indonesian rupiah figures are indicative only, converted at approx. 1 CHF = Rp 20,500. Fees are payable in CHF; the exchange rate at the time of payment will apply. A refundable CHF 2,000 security deposit applies. Pay in full 90 days before term start for a 2% early-bird discount.*
- `[CONFIRM]` IDR conversion rate (1 CHF ≈ Rp 20,500) — verify current rate before publishing.

## 7. Form — "Connect with our Indonesia Admissions Team"
- Heading → *Connect with our Indonesia Admissions Team*; sub → "...our Indonesia team will guide you...".
- Phone default value `+62 `.
- Hidden country value = `Indonesia`. Keep WhatsApp in the consent text (widely used in Indonesia).
- Success message → "Our Indonesia admissions team will be in touch shortly...".

## 8. FAQ — Indonesia
- "Why study in Switzerland, rather than Australia or elsewhere?" (Australia is the key competitor).
- "Is campus life safe and welcoming for Indonesian students?"
- Entry requirements → `[CONFIRM]`: senior secondary school (SMA / SMK or equivalent international diploma) + IELTS 5.5 or equivalent for Bachelor's.

---

### `[CONFIRM]` checklist before go-live
- [ ] Alumni photos sourced/uploaded for Theodore Darrel, Dary Hutomo Sarwono, Ian Ferdinand Chong.
- [ ] IDR exchange rate (1 CHF ≈ Rp 20,500) current & approved.
- [ ] Exact Indonesia entry requirements confirmed with admissions.
- [ ] Fee figures (CHF 175,300 / 49,000 / 42,400) still current for the target intake.
- [ ] Form routes to the shared thank-you page and Pardot with country = Indonesia.

**Guardrails:** build into the LIVE project (don't edit pages already live); all pages route to the same thank-you page; this market page hard-codes Indonesia (no country picker).
