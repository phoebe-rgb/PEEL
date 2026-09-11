# Build the HIM Business School Indonesia landing page

Create EXACTLY ONE new page at the route **/indonesia** for HIM Business School (Montreux, Switzerland).

## HARD GUARDRAILS — read first
* Create EXACTLY ONE new page, at `/indonesia`. Nothing else.
* Do NOT modify, delete, rename or reorder ANY existing page (india.html included), route, redirect, Netlify Function, form or form handler, environment variable, build/deploy setting, domain/DNS, or shared asset (CSS / JS / images / fonts).
* Copy-and-patch: `cp india.html indonesia.html` (the source is **india.html**, NOT index.html), then patch. Do not compose from scratch, do not extract or rebuild CSS, do not diff pages to work out the template.
* Patch, do not re-emit. Re-ordering existing blocks is a block move, not a rebuild.
* Do NOT build (shared, already exist): stylesheet/CSS; confirmation, privacy, SMS-terms pages; any Netlify Function; the Pardot Form Handler; any form validation.
* URL will be published at **lp.him-business-school.com/indonesia**.
* If completing this task appears to require changing anything other than the one new page, STOP and report — do not proceed, and do not publish.

## CRITICAL — THIS IS AN INDONESIAN STUDY-ABROAD AUDIENCE
The reader lives in Indonesia and is choosing where to study overseas. This IS a study-abroad page (unlike the Swiss-domestic build). That frames everything:
* **KEEP visa copy** — a student visa is required for Switzerland, but the Indonesia market treats it as a guided part of the admissions process, not a barrier. Frame it as reassurance ("we guide you through the visa process"), never as a warning.
* Decisions are **made jointly by student and parents**, and parents usually finance. Reassure on ROI, safety, graduate employability, reputation and support — for both audiences.
* **This market has a lot of junk leads. Show the fees on the page to qualify leads.** The Tuition Fees section is moved directly above the form and is expanded by default.
* Localise: Indonesia team (not India team), "Indonesian families", "Indonesian students", `+62` phone default, "e.g. Jakarta" city placeholder, IDR indicative pricing.

## FORM RULES (non-negotiable)
* Keep all form functionality identical to india.html, INCLUDING the Pardot Form Handler and all field mappings and picklist values. Do NOT relabel or remap any field.
* The ONLY functional change: the hidden country value becomes **Indonesia**, and the phone default becomes `+62`.
* Fields may be removed but NEVER added, relabelled or remapped.
* KEEP "English level" — Indonesian students are not native English speakers and the programmes are taught in English.
* KEEP "Are you a parent or student?" — this market is parent-and-student led.
* Keep Age bracket, Current education level, and How you plan to finance your studies with unchanged options and mapping.
* Consent line: **KEEP email, WhatsApp and phone.** WhatsApp is a primary admissions channel in Indonesia — do not remove it.

## SECTION-BY-SECTION
**Metadata.** Title: `HIM Business School — Indonesia Admissions | Be World Ready`. Meta description: Indonesia-facing — study business in Switzerland, BBA (Northwood, US) + new Master in Applied AI, 3 paid internships, Top 6 worldwide (QS), transparent Swiss fees, merit scholarships, dedicated Indonesia admissions team.

**Hero.** H1 stays ("Be World Ready. Study Business in Switzerland."). Add a supporting subheadline that names transparent fees and merit scholarships for ambitious Indonesian students. CTA and note reference the Indonesia team.

**Programs.** Card order and content unchanged (BBA + Master in Applied AI; BBA specialisations block).

**Tuition Fees (moved directly above the form to qualify leads).** Keep the two-card accordion (BBA + Master); make it single-open (opening one card closes the other), with the BBA card open by default. Headline/subhead take the all-inclusive "everything is taken care of" framing; the "What's Included" list becomes **"Everything is taken care of"**. Keep HIM's real fees — **BBA CHF 129,400** (Term 1 CHF 21,900, then CHF 21,500/term), Master "fees on request". Add IDR indicative figure (approx. **Rp 2.59 billion**, converted at ~1 CHF = Rp 20,000; payable in CHF via Flywire; rate at payment applies). Keep the "arrival in Switzerland" inclusion — it applies to this audience.

**Scholarships (section, directly above the form, below Tuition Fees).** Dark section (`section--blue offer offer--dark`) with heading "Scholarships & Payment Flexibility", covering merit scholarships up to 20% (limited & competitive), flexible per-term payment plans, 2% early-bird discount, and Indonesia-team support on education loans, payment plans and visa docs, plus a CTA. Localise the team reference to Indonesia.

**ROI / careers section.** Content unchanged (97% hired, 3 paid internships, CHF 2,350 average internship salary, alumni employers).

**Why HIM / Why Switzerland, Alumni, Campus, Partners, Video.** Content unchanged except localisation: "A springboard for global careers" (never "launchpad"), "Trusted by Indonesian families", degree "valued in Indonesia, Singapore, the UAE and beyond", Indonesia team CTA. **Alumni cards stay as-is — the HIM alumni page currently lists no Indonesian alum, so do not invent one.**

**Form section.** Heading/subhead/thank-you reference the "Indonesia admissions team" and mention programs, fees, scholarships and the visa process. Hidden country = Indonesia.

**FAQ.** Keep the visa FAQ (visa applies here). Rewrite entry requirements for Indonesian students: **completed senior secondary school (SMA / SMK) or equivalent**, English ~IELTS 5.5 (BBA); recognised Bachelor's (Master).

**Footer.** Unchanged.

## BRAND COPY RULES (apply throughout)
* Always the full name "HIM Business School" in visible copy.
* Never "launchpad" — use "springboard" / "stepping stone".
* Never call the school a "university".
* We are not selling a degree — we are selling the international career it makes possible. Lead with career outcomes and proof (rankings, internships, employability), then programme detail.

## VERIFY (4 steps max, then stop)
1. Start the dev server, read its log ONCE.
2. `curl /indonesia` — confirm 200 and the H1 matches.
3. Submit the form once end-to-end — confirm it reaches the Form Handler with hidden country = Indonesia.
4. Kill the dev server by PID.

Then report: the one file created, confirmation that no other file was created/modified/deleted, and the verify results.
