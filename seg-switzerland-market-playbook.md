# SEG Switzerland (domestic market) — landing-page playbook

Reusable market playbook for the `seg-new-landing-page` skill, covering the **Switzerland**
market for any SEG brand (Culinary Arts Academy Switzerland ✓ done · SHMS · HIM Business School ·
César Ritz Colleges Switzerland). Drop this into the skill's `references/` folder as
`switzerland-market-playbook.md`, and mirror the summary into memory.

Source of truth for tone/rules: the boss's live `/switzerland` build prompt (domestic audience) +
the CAAS `/switzerland` page shipped from it.

---

## The one insight that drives everything

**The reader already lives in Switzerland. This is NOT a study-abroad page.** Every argument that
sells *crossing a border* is dead here and must be reframed as *why this school, at home*.

- Route: `/switzerland`. Source to copy-and-patch: **`india.html`** (NOT index/usa). Hard-code the
  country; only the index page uses a country picker.
- Competitive frame for a Swiss school-leaver = the **traditional Swiss apprenticeship**
  (CFC de cuisinier / Koch EFZ, and the equivalent for hospitality/business). Position the degree
  route as the faster, international, degree-bearing, business-focused alternative — plus "why here
  rather than abroad".

## Hard content rules (Switzerland)

1. **NO visa copy anywhere.** Strip it from hero, all-inclusive, form subhead, thank-you and FAQ.
2. **No study-abroad / relocation / "move to Switzerland" / "trusted by families abroad" / arrival
   framing.** Drop the **"Arrival in Switzerland, insurance & social assistance"** item from the
   all-inclusive list (keep accommodation, meals, tuition, kitchen tools, uniform, infrastructure,
   career services, paid internships).
3. **Don't sell Switzerland to a Swiss person.** Reframe the "Why study in Switzerland" section as
   **"Why train at <full brand name>"**. Keep only genuine industry/career bullets — Michelin-star
   density (120+ across the country), career outcomes, the N°1-for-career-goals and
   hospitality-school-ranking lines. **Drop destination-selling bullets**: "top 10 safest country",
   "most business-friendly country".
4. **No funding claims that aren't confirmed.** Do **NOT** state or imply any Swiss cantonal grant,
   stipend, student loan, federal funding, or tuition reduction / permit-based discount. The ONLY
   financial support to mention: **merit-based scholarships, awarded competitively** + flexible
   payment plans. (This is why the CAAS page shows no 30%/20%/15% permit reductions — unconfirmed
   for the school.)
5. **Currency = CHF, local.** Keep figures like `CHF 2,350` exactly — no USD/EUR conversion, no
   currency note.
6. **Campus-safety FAQ:** remove the "international students" framing → "structured student support…
   a vibrant community of 64+ nationalities".

## Form rules (non-negotiable — copy from india.html)

- Keep all functionality identical: the **Pardot Form Handler**, Netlify Forms post, all hidden
  UTM/tracking fields, dataLayer events, 2-step flow. **Never relabel or remap a field.**
- The ONLY functional change: hidden **`market` / `country` = Switzerland**, `source_page = /switzerland`.
- Fields may be **removed** but never **added, relabelled or remapped**.
- **KEEP "English level"** — Swiss students aren't native English speakers and programmes are in English.
- **KEEP "Are you a parent or student?"** — no data says it's student-led; keeping a field is the
  non-destructive default.
- Keep Age bracket, Current education level, How you plan to finance your studies (unchanged options/mapping).
- **Consent line: email and phone only. REMOVE WhatsApp** (not a standard Swiss admissions channel).
- Phone default dial code: `+41 `.

## Section-by-section patch map

| Section | Patch |
|---|---|
| **Metadata** | Title `\<Brand\> \| Switzerland Admissions`. Meta desc: Swiss-resident-facing, no visa/relocation. |
| **Hero** | H1 stays. Rewrite the supporting line for a student already in Switzerland choosing where to train. |
| **Programs** | Keep card order + content. Lead-in = internationally recognised Swiss qualification, taught in English, paid internships, without leaving the country. |
| **All-inclusive** | Team ref → "Swiss admissions team"; drop the arrival item. |
| **Why Us / Masterclasses / Campuses / Alumni** | Content unchanged (unless client asks for a local alumni swap — see CAAS example). |
| **Why Switzerland** | Reframe to "Why train at \<Brand\>"; keep industry/career bullets, drop safety + business-friendly. |
| **ROI / career** | Lead with outcomes; CHF 2,350 as-is; merit-based competitive scholarships only; no funding-eligibility claims. |
| **Form** | Heading/subhead/thank-you → "Swiss admissions team"; remove visa; hidden country = Switzerland. |
| **FAQ** | Delete visa FAQ → accommodation+meals only. Rewrite "why Switzerland vs elsewhere" → "why train here rather than abroad or an apprenticeship". Entry requirements → "Requirements vary by programme and by the qualification you are coming from. Our admissions team will confirm… contact our team for exact requirements." Remove "international students" framing. |
| **Footer** | Unchanged. |

## Brand copy rules (apply throughout — from the skill's house rules)

- Always the **full brand name** in visible copy, never the acronym (**SHMS** is the exception).
- Always **"2 degrees"**, never "dual degrees".
- Never **"launchpad"** → use **"stepping stone"**.
- Never call the school a **"university"** (César Ritz Colleges is the exception).
- **HIM = "HIM Business School"**, positioned as a **business school**, not hospitality.
- **No full stop at the end of headlines.**

## Template facts (the real shared CAAS/SEG template)

- Fonts: **Old Standard TT** (uppercase headings; italic-lowercase `.art` spans for words like
  *for / in / of / to*) + **Inter** (body).
- Palette: red `#e42313`, red-dark `#c01b0d`, black `#0e0e0e`, cream `#faf6ef`, muted `#5c5c5c`.
- Structure: video hero → ranking band w/ laurel badge → programs → all-inclusive → why-us (bg
  image) → masterclasses → alumni (dark) → why-Switzerland (dark) → ROI (cream) → campuses → form
  (bg image, 2-step Pardot) → FAQ (accordion) → ranking footer, plus a sticky CTA bar + dataLayer/GTM.
- **Alternate section backgrounds** so no two adjacent sections share a colour (`.section`,
  `.section--cream`, `.section--dark`). Watch this when inserting a new section.
- For a **local preview mockup**, point all `/assets/...` at `https://lp.culinaryartsswitzerland.com/assets/...`
  so images/video render. For the **live deploy**, keep them relative and copy-and-patch from
  india.html — do not rebuild CSS from scratch.

## CAAS Switzerland — what we actually shipped (worked example)

- Hero line: *"World-class culinary training. Build a culinary career that travels the world."*
- **Alumni swap**: replaced Varun Menghani (Dubai) with **Halina Mikhadziuk** — Chef de Partie,
  Hotel Astoria, Lucerne (Swiss-based proof). Image from the CAAS CMS.
- Added an optional **Direct Entry** section (credit transfer for CFC/EFZ / prior study) — useful
  for the apprenticeship-holder audience; also as a "transfer credits" FAQ.
- ROI alumni employers kept as Nobu / Ritz Paris.
- Deliverable: `caas-switzerland.html` on branch `claude/intelligent-fermat-revyog`.

## Next: SHMS & HIM Switzerland

- **SHMS** (Swiss Hotel Management School): acronym allowed; hospitality positioning; same domestic
  rules; competitor frame = hospitality apprenticeship + going abroad.
- **HIM**: always **"HIM Business School"**, **business school not hospitality**, never "university".
  Domestic rules identical. Program set + proof points come from HIM's own india.html source.
- For each: `cp india.html switzerland.html`, apply this playbook, hard-code country = Switzerland,
  keep the Pardot form intact.
