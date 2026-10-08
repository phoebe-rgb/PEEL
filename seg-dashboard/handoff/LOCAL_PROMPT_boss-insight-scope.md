# Paste this to the local Claude Code session that owns the SEG dashboard project

You own the real SEG dashboard project (the folder with `src/`, `wrangler.toml` and the credentials for
`wrangler deploy`). A cloud session prepared one change against the older copy of the source in this repo
(1 Oct snapshot). Bring it into the current local source, test it, and **do not deploy until I say so**.

## What I want

On **Performance → Boss**, the **Drill-down insights** table (School → Country → Channel — insights) must follow
the **ACT / Paid / All** filter at the top of the page, like the data table above it. Today the insight text only
looks at ACT campaigns, whatever the filter says.

## Why it is ACT-only today

The numbers in the table already follow the filter (they use `pair`). The written insight does not: it comes from
`googleReview()` and `metaReview()` in `src/lib/rules.ts`, which only keep campaigns whose name contains `_ACT_`
(Google) or `_FB_ACT_` (Meta). `BossPivot` and `Drill` in `src/drill.tsx` call them with no scope.

## Get the files

```bash
git clone https://github.com/phoebe-rgb/PEEL.git peel-handoff   # or git fetch in an existing clone
cd peel-handoff && git checkout claude/boss-drill-insight-scope
```

Do not deploy from `peel-handoff`: its `worker/`, `frontend/` and `wrangler.toml` are a stale 1 Oct snapshot.

## Apply

From your project root (the folder with `src/`):

```bash
git apply <path>/peel-handoff/seg-dashboard/handoff/boss-insight-follows-activity-filter.patch
# or: patch -p1 < …same file
```

The finished files are in `peel-handoff/seg-dashboard/frontend/src/` (`drill.tsx`, `lib/rules.ts`,
`lib/scope.test.ts`) if a hunk fails because the local file changed. In that case, redo the change by hand.

### What the patch does

1. `lib/rules.ts`
   - `googleReview(s, bench, setup, school?, activities = ['ACT'])` and
     `metaReview(s, bench, school?, activities = ['ACT'])` take an **activity list** (from the campaign-name token
     via `activityOf`). `null` = every activity. The default stays `['ACT']`, so the Actions page, Slack notify and
     the channel "Actions" blocks keep working as before.
   - Benchmarks are ACT benchmarks, so a **non-ACT campaign is never judged against them** (`bench = null` for it).
     Only the trend rules apply to it (CPL / CPGL up vs the previous window).
   - Meta: a non-ACT campaign gets its activity in front of the segment (`NURT · All programmes`), so it never merges
     with an ACT entry for the same school and country. Retargeting and Social Boosting keep their names.
2. `drill.tsx`, in **both** `BossPivot` and `Drill`:
   `activities = pair.cur.dims.activity?.length ? pair.cur.dims.activity : null`, then pass it to both reviews.
   The `useMemo` depends on it.
3. New `lib/scope.test.ts`: ACT by default, all activities with `null`, one activity when listed, and Meta NURT
   stays a separate entry.

### Wire it to your top filter. Check this first

The 1 Oct snapshot has no ACT / Paid / All filter: `toFilter()` in `lib/period.ts` forces `activity: ['ACT']`. Your
local source has the filter. Check how it reaches the `Filter`:

- If ACT / Paid / All already sets `pair.cur.dims.activity` (e.g. ACT → `['ACT']`, All → nothing), the patch works
  as it is.
- If it is stored somewhere else (its own state, a `scope` field, a channel or source filter), compute
  `activities` from that same value in `BossPivot` / `Drill` instead: ACT → `['ACT']`, All → `null`, and Paid →
  the activity list your filter means by "Paid" (or `null` if Paid differs from All by channel/source, not by activity,
  because the reviews only read the Google and Meta channels anyway).

Also update any text on the Boss page that still says "ACT campaigns" under the insights so it names the
selected filter.

## Test, then report

```bash
npx vitest run          # all tests pass, including scope.test.ts
npm run build           # vite build clean
```

In the browser, open Performance → Boss, switch ACT → Paid → All, and check that the insights change. With All,
BRAND / CONV / NURT campaigns can now appear in the "why" lines, e.g. India YouTube BRAND. Tell me what you changed
and the results. **Don't deploy until I say so.**
