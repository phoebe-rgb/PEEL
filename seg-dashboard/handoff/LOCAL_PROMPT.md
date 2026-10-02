# Paste this to the local Claude Code session that owns the SEG dashboard project

You own the real SEG dashboard project (the folder with `src/`, `wrangler.toml`, the Alert Setup page,
and the credentials for `wrangler deploy`). A cloud session prepared the changes below against an older copy
of the source (1 Oct 2026). Bring them into the current local source, test them, and deploy **once**, only
when I say so. Everything here is about the Actions page and the Alert Setup page.

## 0. Get the files

```bash
git clone https://github.com/phoebe-rgb/PEEL.git peel-handoff   # or: git fetch in an existing clone
cd peel-handoff && git checkout claude/hopeful-archimedes-7djwwm
ls seg-dashboard/handoff     # this file, HANDOFF.md (full spec), actions-setup-high-and-type-filter.patch
```

Rules:
- **Do not deploy from `peel-handoff`.** Its `worker/`, `wrangler.toml` and `frontend/` are a stale snapshot of
  1 Oct; deploying them would overwrite the newer live Worker (more routes and secrets) and the Alert Setup page.
- Do not copy the Slack webhook or the Gemini key from the pasted Apps Script into the repo or the bundle.
  Both were exposed in a chat: keep them in Worker secrets and rotate them.
- Do not deploy until I say so. Report what you changed and the test results first.
- Spec and code snippets: `seg-dashboard/handoff/HANDOFF.md` §1b, §1c, §1d.

## 1. Actions page — apply one patch

From your project root (the folder with `src/`):

```bash
patch -p1 < <path>/peel-handoff/seg-dashboard/handoff/actions-setup-high-and-type-filter.patch
```

It touches `src/tracker.tsx`, `src/styles.css` and adds `src/lib/kinds.ts` + `src/lib/kinds.test.ts`. It applies
cleanly to the 1 Oct source on its own (checked), and reproduces the finished files in
`peel-handoff/seg-dashboard/frontend/src/`. If a hunk fails on `tracker.tsx` or `styles.css`, the local file has
changed: redo that part by hand, using the finished files as the reference. `kinds.ts` and `kinds.test.ts` are new
and can be copied as they are.

What I asked for, and what the patch does:
1. **Setup actions are always High.** Every action has a type (Setup, Performance, Scale, Budget pacing, Keywords,
   Feedback, Reallocation). `withPriority()` forces Setup → High; within a priority, Setup sorts first.
   Setup means: budget lines with **No plan** or **Not started**, and comments flagged "Needs action" that mention
   set-up / tracking / UTM / pixel / final URL / target location. A daily-budget change is Budget pacing, not Setup.
2. **Filter by type of problem.** A Type row with counts next to the platform tabs; it narrows together with the
   platform tab and applies to To do, Backlog, Done and Dismissed. The type is shown under the platform chip and
   saved with Done / Dismiss.
3. **No separate "Budget" or "Search keywords" platform.** Budget actions belong to their channel (Google Ads /
   Meta / LinkedIn; the LinkedIn tab only shows when it has actions); negative-keyword actions belong to Google Ads.
   The action id is still hashed from the old platform name (`idNs` in `push`), so Done / Dismiss saved before this
   change stays applied.
4. **Every budget action is in the main table, never in the backlog** (`pickWeek` in `lib/kinds.ts`): budget
   pacing, plan lines with no plan / not started, approved budget moves. The "top 8 per owner" cap only applies to
   the other actions.
5. **Alert Setup actions.** Any action the Alert Setup page creates must use `kind: 'Setup'` and
   `platform: platformOfChannel(channel)` (then it is High, shows under the Setup filter, and sits on the right
   platform tab). Check how that page creates actions today and wire it up.

## 2. Alert Setup page (only you have this source)

a. **Boosted posts are not "no destination link".** Today 29 active ads have no link and all 29 are boosted posts
   (`urlSource` = "boosted post (no link found)"); the link sits behind the post's Learn more button and the
   Marketing API does not return it. Search the source for `no destination link`; exempt
   `/^boosted post/i.test(ad.urlSource ?? '')`. Optional low-severity line: "N boosted posts — link cannot be read
   through the API". Example that triggered it: `PL_CAAS_FB_NURT_APAC_IN_ALL_ALL`, two `…BoostedPost…10Sep26` ads.

b. **Check live campaigns only.** Today the page checks everything configured on (PPC `state === 'ENABLED'`, Meta
   `status === 'ACTIVE'`), including campaigns that deliver nothing. Live = spend > 0 in the last 7 days of the `live`
   cube (match campaign names; `+` ↔ space for Meta). On 2 Oct this skips 9 of 126 PPC campaigns and 1 of 25 Meta
   campaigns (listed in HANDOFF.md §1d). Show "Checked N live · M skipped (no spend in 7 days)" under the page title
   so nothing disappears silently. Compute `spend7` in the page from the cube, or add it in the daily `setupcheck`
   producer.

c. **Ad engagement is not Advantage+ creative.** The Advantage+ rule (`adv|${advOn}`) flags any ad whose `advOn` is
   not `none…`. Ignore `inline_comment` ("relevant comments") before testing and before printing `found`:
   `const IGNORED_ADV = new Set(['inline_comment'])`. Today 10 active ads carry it, all with other enhancements too
   (`standard_enhancements`, `product_extensions`, …), so they stay flagged for those; only the text changes. If I say
   a different key is "ad engagement", add it to the set.

d. **Indonesia landing pages.** In the Landing page sheet I set Indonesia to **Live** for CAAS (row 9) and HIM
   (row 30); SHMS has no Indonesia row. After the next `setupcheck` refresh the page should check Indonesian CAAS /
   HIM campaigns against their Indonesia page (the rule uses a special page only when its status starts with "Live",
   otherwise Generic). Do **not** change any campaign's final URL. Confirm the refresh happened and tell me which
   **live** Indonesia campaigns do not match (live per 2b: CAAS 6, HIM 1, SHMS 5; HIM
   `…ID_EN_ALL_ALL_BusinessSchoolSwitzerland` has no spend in 30 days, so it is skipped).

## 3. Verify, then stop and report

- `npx tsc --noEmit` (strict), `npx vitest run`, `npm run build` all clean (the patch adds `lib/kinds.test.ts`;
  53 tests passed in the cloud copy).
- Open the built page. Actions: Type filter with counts; every Setup row is High; no Budget or Search keywords
  platform tab; budget rows are in "This week", none in the backlog; negative keywords sit on Google Ads. Alert Setup:
  no boosted-post link alert; the "Checked N live · M skipped" line; no `inline_comment` in any Advantage+ text.
- Report: what applied cleanly, what you redid by hand, test output, anything you did not do.
  **Wait for my OK before `wrangler deploy`.**
