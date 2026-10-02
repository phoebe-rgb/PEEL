# Paste this to the local Claude Code session that owns the SEG dashboard project

You own the real SEG dashboard project (the folder with `src/`, `wrangler.toml`, the Alert Setup page,
and the credentials for `wrangler deploy`). A cloud session made fixes against an older copy of the
source (1 Oct 2026). Bring them into the current local source, test them, and deploy **once** when I say so.

## 0. Get the files

```bash
git clone https://github.com/phoebe-rgb/PEEL.git peel-handoff   # or: git fetch in an existing clone
cd peel-handoff && git checkout claude/hopeful-archimedes-7djwwm
ls seg-dashboard/handoff     # HANDOFF.md (full spec), 2 patches, App.tsx, this file
```

Rules for the whole task:
- **Do not deploy from `peel-handoff`.** Its `worker/`, `wrangler.toml` and `frontend/` are a stale snapshot;
  deploying them would overwrite the newer live Worker (more routes and secrets) and the Alert Setup page.
- Do not copy the Slack webhook or the Gemini key from the pasted Apps Script into the repo or the bundle.
  Both were exposed in a chat: keep them in Worker secrets and rotate them.
- Do not deploy until I say so. Report what you changed and the test results first.
- Read `seg-dashboard/handoff/HANDOFF.md` sections 1a–1d, 2, 5 and 6 before you start; this message is the summary.

## 1. Apply two patches to the local source (in this order)

From your project root (the folder with `src/`):

```bash
patch -p1 < <path>/peel-handoff/seg-dashboard/handoff/fix2-market-filter.patch                   # src/App.tsx
patch -p1 < <path>/peel-handoff/seg-dashboard/handoff/actions-setup-high-and-type-filter.patch   # Actions page
```

They apply cleanly to the 1 Oct source and were tested there (tsc strict, 53 tests, vite build, browser run).
If a hunk fails on `tracker.tsx` or `styles.css`, the local file has changed: redo that change by hand from the
description in HANDOFF.md §1a/§1b. The finished versions are in `peel-handoff/seg-dashboard/frontend/src/`
(`lib/kinds.ts`, `lib/kinds.test.ts`, `tracker.tsx`, `styles.css`, `App.tsx`) for comparison.

What they do:
1. **Market filter.** The top filter used the user's geo `country`; every table uses the campaign's target `market`.
   Filter dims become `['school','channel','market']`, `SAVE_KEY` → `seg-dash-view-v3`. Fixes the USA campaign
   showing 552 spend under India.
2. **Actions page.** Every action has a type (Setup, Performance, Scale, Budget pacing, Keywords, Feedback,
   Reallocation); Setup is always High and sorted first; a Type filter with counts sits next to the platform tabs.
   There is no separate "Budget" or "Search keywords" platform: budget actions belong to their channel
   (Google Ads / Meta / LinkedIn), negative keywords to Google Ads. Every budget action is in the main table,
   never in the backlog. Old Done / Dismiss state keeps working (ids are hashed from the old platform name).
3. Any action the Alert Setup page creates must use `kind: 'Setup'` and `platform: platformOfChannel(channel)`.

## 2. Alert Setup page changes (only you have this source)

Details and code snippets are in HANDOFF.md §1c and §1d.

a. **Boosted posts are not "no destination link".** Today 29 active ads have no link and all 29 are boosted posts
   (`urlSource` = "boosted post (no link found)"); the link sits behind the post's Learn more button, which the
   Marketing API does not return. Search the source for `no destination link`; exempt
   `/^boosted post/i.test(ad.urlSource ?? '')`. Optional low-severity line: "N boosted posts — link cannot be read
   through the API".

b. **Check live campaigns only.** Today the page checks everything configured on (PPC `state === 'ENABLED'`, Meta
   `status === 'ACTIVE'`). Live = spend > 0 in the last 7 days of the `live` cube (match campaign name, `+` ↔ space for
   Meta). On 2 Oct that skips 9 of 126 PPC campaigns and 1 of 25 Meta campaigns (listed in HANDOFF.md §1d).
   Show "Checked N live · M skipped (no spend in 7 days)" under the page title so nothing disappears silently.
   Either compute `spend7` in the page from the cube, or add it in the daily `setupcheck` producer.

c. **Ad engagement is not Advantage+ creative.** The Advantage+ rule (`adv|${advOn}`) flags any ad whose `advOn` is
   not `none…`. Ignore `inline_comment` ("relevant comments") before testing and before printing `found`:
   `const IGNORED_ADV = new Set(['inline_comment'])`. Today 10 active ads carry it, all with other enhancements
   too (`standard_enhancements`, `product_extensions`, …), so they stay flagged for those. If I tell you a different
   key is "ad engagement", add that key to the set.

d. After the `setupcheck` refresh, the Indonesia landing-page status I set to **Live** in the Landing page sheet
   (CAAS row 9, HIM row 30) should flow through; confirm that Indonesian CAAS/HIM campaigns are now checked against
   their Indonesia page, not Generic. Do **not** change any campaign's final URL; tell me which live Indonesia
   campaigns do not match.

## 3. Budget page

"CHF/day now" must come from the `Budget daily` columns of the `*_Setup` sheets (the budget actually set up),
compared with the target daily budget — not from KV `setup.dailyBudget`. If you already did this, say so.

## 4. Verify, then stop and report

- `npx tsc --noEmit` (strict), `npx vitest run`, `npm run build` all clean.
- Open the built page: the market filter lists market names (India, not IN); Actions → Type filter, Setup rows High,
  no Budget platform tab, budget rows in "This week"; Alert Setup → no boosted-post link alert, skipped-campaign line,
  no `inline_comment` in any Advantage+ `found` text.
- Report: what applied cleanly, what you redid by hand, test output, and anything you did not do. **Wait for my OK
  before `wrangler deploy`.**

## 5. Not part of this run (still open, tell me if you start on any)

- Rebuild the 2025 history (Aug 2024 – Aug 2026) leads by Country + paid channel so India YoY is right
  (HANDOFF.md §3 and §5.1–5.2). Needs the Funnel workspace; the cloud session has it.
- Reply to Piers in `#seg-reporting-dashboard`; his remaining requests are in §5.4.
