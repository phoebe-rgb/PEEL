# Indonesia market playbook — CAAS landing pages

Reusable notes for building **Indonesia** landing pages (Culinary Arts Academy Switzerland and other SEG brands). Drop this into the `seg-new-landing-page` skill as `references/markets/indonesia.md`, and keep the short "house rules" block below in memory.

## Market steer (from the Indonesia market-insights playbook)
- **Audience:** outbound international students; **students + parents decide together** (parents fund & co-decide → address both).
- **Tone:** aspirational — sell the *international career*, not the degree.
- **Barriers:** (1) cost/ROI, (2) unfamiliarity with Switzerland. Reassure with paid internships, graduate outcomes, safety, rankings.
- **Junk-lead market → qualify on the page:** show tuition fees up front (this is why the Indonesia page displays prices, unlike most market pages).
- **Visa IS required** — keep all visa copy.
- **Channels:** WhatsApp is primary — keep it in the consent line.
- **Competitors:** Australia, Singapore, Malaysia, UK, Europe → frame Switzerland's wedge on value + paid experience, never on price.
- **CAAS lead programme:** Swiss Diploma programmes first (career-changer friendly, practical, 1 year), then Bachelors, then Master.

## House rules (short version for memory)
> **Indonesia CAAS page:** show fees (junk-lead market); feature **LPDP** scholarship prominently (2-col section under Tuition & Fees) — but **[CONFIRM] LPDP eligibility/scope with admissions** (LPDP mainly funds postgraduate). Diploma-first program order. Keep WhatsApp + visa copy. Phone = generic placeholder (no +62 default). Real Indonesian alumni only. Australia is the key competitor. Brand rules: full name always, "2 degrees" not "dual degrees", "stepping stone" not "launchpad", never "university".

## Reusable adaptations checklist (India/USA live page → Indonesia)
1. Title / meta → Indonesia; form hidden `market`/`country` = Indonesia, `source_page` = `/indonesia`; form heading + thank-you → "Indonesia admissions team". Keep all fields, Pardot mapping, visa copy, WhatsApp consent.
2. Programs → **reorder diploma-first** + diploma-led lead-in paragraph.
3. Show **priced Tuition Fees** ("What's Covered / Everything is taken care of" heading) above the form: Bachelor CHF 175,300 · MA CHF 49,000 · Diplomas CHF 42,400, with indicative Rp `[CONFIRM rate ~1 CHF = Rp 20,500]`.
4. **LPDP scholarship** = standalone 2-column section directly under Tuition & Fees (see snippet).
5. Alumni → real Indonesian alumni (never invent):
   - Theodore Darrel — Owner & Chef, Tide & Table, Jakarta (2019) — `https://cms.culinaryartsswitzerland.com/sites/default/files/styles/287x335/public/2025-12/Theodore%20Darrel.png`
   - Dary Hutomo Sarwono — F&B Director, Joglo Group, Jakarta (2015) — `.../Dary%20Sarwono.png`
   - (SEA) Ian Ferdinand Chong — Marymount Bakehouse, Singapore (2016) — `.../Ian%20Ferdinand%20Chong.png`
6. "Trusted by Indonesian Families" block in Why Switzerland (dedicated team, LPDP guidance, regional recognition).
7. Campus: use the USA big Brig image `/assets/brig-campus-building.jpg`.
8. Copy: "international student" → "Indonesian student"; FAQ entry requirement → SMA/SMK (or a cautious "requirements vary, contact us") `[CONFIRM]`.

## LPDP 2-column section (reusable snippet)
Assets to add in the Netlify project: `/assets/IndonesianStudent.png` (left image) and `/assets/lpdp-logo.png` (logo). CSS uses the shared tokens already on these pages.

```css
.lpdp{display:grid;grid-template-columns:1fr;background:var(--black);color:#fff;border-left:4px solid var(--red);border-radius:8px;overflow:hidden;box-shadow:0 10px 26px rgba(17,17,17,.08)}
.lpdp__media{min-height:240px;background:#1c1c1c}
.lpdp__media img{width:100%;height:100%;object-fit:cover;display:block}
.lpdp__content{padding:30px 32px}
.lpdp__row{display:flex;align-items:center;gap:14px;margin-bottom:16px}
.lpdp__logo{height:46px;width:auto;background:#fff;border-radius:8px;padding:6px}
.lpdp__tag{display:inline-block;font-family:var(--sans);font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:var(--red);padding:5px 12px;border-radius:2px}
.lpdp h3{color:#fff;font-size:clamp(22px,4vw,30px);margin:0 0 10px}
.lpdp p{font-size:14.5px;color:#d8d8d8;margin:0 0 20px}
.lpdp .btn{margin:0}
@media(min-width:768px){.lpdp{grid-template-columns:1fr 1fr}.lpdp__content{padding:36px 40px}}
```
```html
<section class="section" id="lpdp">
  <div class="wrap">
    <p class="eyebrow">Scholarships &amp; Funding</p>
    <h2 class="section-title">LPDP &amp; scholarships for Indonesian students</h2>
    <div class="lpdp">
      <div class="lpdp__media"><img src="/assets/IndonesianStudent.png" alt="Indonesian student at Culinary Arts Academy Switzerland"></div>
      <div class="lpdp__content">
        <div class="lpdp__row">
          <img class="lpdp__logo" src="/assets/lpdp-logo.png" alt="LPDP (Lembaga Pengelola Dana Pendidikan)">
          <span class="lpdp__tag">LPDP Scholarship</span>
        </div>
        <h3>Planning to fund your studies with LPDP?</h3>
        <p>Many Indonesian students finance study abroad through <strong>LPDP (Lembaga Pengelola Dana Pendidikan)</strong>. Eligible applicants may use LPDP funding toward tuition and living costs, and our Indonesia admissions team can guide you through choosing an eligible program and preparing a strong application, alongside our own merit-based scholarships.</p>
        <a href="#admissions-form" class="btn btn--primary cta-lead" data-cta="lpdp">Ask about LPDP &amp; scholarships</a>
      </div>
    </div>
  </div>
</section>
```

## Netlify workflow notes
- Pages are files at project root named `<market>.html` (route `/indonesia` → `indonesia.html`), **not** `index.html`.
- Prefer **patch an existing page** over "create new" once it's live. Keep boss's credit guardrails: copy-and-patch, read once, ≤4-step verify, touch only the one file.
- New assets to upload for Indonesia: `IndonesianStudent.png`, `lpdp-logo.png` (+ reuse existing shared assets).

## Always [CONFIRM] before publishing
- LPDP eligibility & which programmes it covers (mainly postgraduate).
- IDR conversion rate (~1 CHF = Rp 20,500) and that CHF fees are current for the intake.
- Exact Indonesia entry requirements (SMA/SMK vs. cautious generic).
- Cleared to display the LPDP mark (implies affiliation).
