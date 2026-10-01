// Budget v Performance: the drill-down pivot (country → school → channel, each one can be switched off) with the
// monthly budget on the right, so performance and money can be judged on one row.
import { useEffect, useMemo, useState } from 'react';
import { aggregate, type Filter } from './lib/agg';
import type { Dim } from './lib/data';
import { countryCodes } from './lib/names';
import { comparePair } from './lib/pair';
import { refDate } from './lib/rules';
import { useCtx } from './components';
import { PivotTable } from './flatpivot';
import { DRILL_METRICS } from './drill';
import { METRICS, type MetricId } from './lib/agg';
import { usePlan } from './budget';

const OPTIONS: Dim[] = ['market', 'school', 'channel'];
const NAME: Record<string, string> = { market: 'Country', school: 'School', channel: 'Channel' };
const addM = (m: string, n: number) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 7);
const mName = (m: string) => new Date(`${m}-15T00:00:00Z`).toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const n0 = (v: number) => (Number.isFinite(v) && v ? Math.round(v).toLocaleString('en-US') : '–');
/** Budget country names (Funnel) → the campaign country codes the performance side uses. */
const codeOf = (name: string) => (!name || /^all$/i.test(name) ? 'ALL' : countryCodes(name)[0] ?? name);

function Chg({ a, b }: { a: number; b: number }) {
  if (!a && !b) return <td className="bp-chg dim">–</td>;
  if (!b) return <td className="bp-chg dim">new</td>;
  const d = a / b - 1;
  return <td className={`bp-chg ${Math.abs(d) < 0.1 ? 'dim' : d > 0 ? 'up' : 'down'}`}>{d >= 0 ? '+' : '−'}{Math.abs(d) >= 10 ? '>999' : Math.abs(d * 100).toFixed(0)}%</td>;
}

// Live Budget sheet (country × school × channel × activity × month, incl. future months), synced to KV `budgetlive`;
// the bundled snapshot is the fallback until the sync has run.
type LiveRow = { school: string; country: string; channel: string; activity: string; month: string; budget: number };
let liveCache: Promise<LiveRow[]> | null = null;
function useLiveBudget() {
  const [v, setV] = useState<LiveRow[] | null>(null);
  useEffect(() => {
    const get = (u: string) => fetch(u).then((r) => (r.ok ? (r.json() as Promise<{ rows?: LiveRow[] } | null>) : null)).catch(() => null);
    liveCache ??= get('/api/budgetlive').then((j) => j?.rows ?? get('/data/budget_live.json').then((k) => k?.rows ?? []));
    liveCache.then(setV);
  }, []);
  return v;
}

export function BudgetVsPerf({ activity, boost }: { activity: string; boost: boolean }) {
  const { store, filter, view } = useCtx();
  const plan = usePlan();
  const live = useLiveBudget();
  const [sel, setSel] = useState<Dim[]>(OPTIONS);
  // fewer metric columns by default so the budget stays in view; tick more to see the full funnel
  const [mets, setMets] = useState<MetricId[]>(['cost', 'leads', 'cpl', 'gl', 'cpgl', 'app', 'cpapp', 'acc', 'cpacc']);
  const metrics = DRILL_METRICS.filter((m) => mets.includes(m));
  const dims = OPTIONS.filter((d) => sel.includes(d));
  const scope = useMemo(() => ({
    ...filter.dims,
    activity: activity === 'All' ? [] : [activity],
    ...(boost ? {} : { boost: ['Paid ads'] }),
  }), [filter.dims, activity, boost]);
  const pair = useMemo(() => comparePair(store, { ...filter, dims: scope }, view.view, view.compare ?? 'prev'), [store, filter, scope, view.view, view.compare]);
  const today = refDate(store.lastDate), cur = today.slice(0, 7), next = addM(cur, 1);
  const months = { cur, prev: addM(cur, -1), ly: addM(cur, -12), next, nextLy: addM(next, -12) };

  const budget = useMemo(() => {
    // budget measure: posted per country × school × channel × activity on the 1st of each month
    // a month in the Live Budget sheet is read from it; older months (last year) from the Funnel budget measure
    const codes = filter.dims.country?.length ? new Set(filter.dims.country.map(codeOf)) : null;
    const ok = (r: LiveRow) => (!scope.school?.length || scope.school.includes(r.school)) && (!scope.channel?.length || scope.channel.includes(r.channel))
      && (!scope.activity?.length || scope.activity.includes(r.activity)) && (!codes || codes.has(codeOf(r.country)));
    const fromLive = (m: string) => {
      const out = new Map<string, { budget: number }>();
      for (const r of live ?? []) if (r.month === m && ok(r)) { const k = `${r.country}\u0001${r.school}\u0001${r.channel}`; out.set(k, { budget: (out.get(k)?.budget ?? 0) + r.budget }); }
      return out;
    };
    const liveMonths = new Set((live ?? []).map((r) => r.month));
    const get = (m: string) => (liveMonths.has(m) ? fromLive(m) : aggregate(store, { cycle: '*', weeks: null, months: [m], dims: { ...scope, boost: [] } } as Filter, ['country', 'school', 'channel']));
    const raw = Object.fromEntries(Object.entries(months).map(([k, m]) => [k, get(m)])) as unknown as Record<keyof typeof months, Map<string, { budget: number }>>;
    // without the sheet, next month only appears in Funnel on its 1st: until then, estimate it from the forward plan
    // (school × channel) split like the current month
    const nextPosted = liveMonths.has(next) || [...raw.next.values()].some((t) => t.budget > 0);
    const curAll = aggregate(store, { cycle: '*', weeks: null, months: [cur], dims: { school: scope.school ?? [], channel: scope.channel ?? [] } } as Filter, ['school', 'channel']);
    const ratio = new Map<string, number>();
    for (const r of plan ?? []) if (r.month === next) ratio.set(`${r.school}\u0001${r.channel}`, (ratio.get(`${r.school}\u0001${r.channel}`) ?? 0) + r.budget);
    for (const [k, v] of ratio) { const base = curAll.get(k)?.budget ?? 0; ratio.set(k, base ? v / base : NaN); }
    const keyOf = (k: string) => {
      const [country, school, channel] = k.split('\u0001');
      const v: Record<string, string> = { market: codeOf(country), school, channel };
      return dims.map((d) => v[d]).join('\u0001');
    };
    const out = new Map<string, Record<keyof typeof months, number>>();
    const zero = () => ({ cur: 0, prev: 0, ly: 0, next: 0, nextLy: 0 });
    for (const [part, m] of Object.entries(raw) as [keyof typeof months, Map<string, { budget: number }>][]) {
      if (part === 'next' && !nextPosted) continue;
      for (const [k, t] of m) { if (!t.budget) continue; const kk = keyOf(k); const o = out.get(kk) ?? zero(); o[part] += t.budget; out.set(kk, o); }
    }
    if (!nextPosted) for (const [k, t] of raw.cur) {
      const [, school, channel] = k.split('\u0001'), r = ratio.get(`${school}\u0001${channel}`);
      if (!t.budget || !Number.isFinite(r)) continue;
      const kk = keyOf(k); const o = out.get(kk) ?? zero(); o.next += t.budget * (r as number); out.set(kk, o);
    }
    const total = zero();
    for (const o of out.values()) for (const p of Object.keys(total) as (keyof typeof total)[]) total[p] += o[p];
    return { out, total, nextPosted };
  }, [store, scope, plan, live, filter.dims.country, dims.join(), cur]);

  const head = (
    <>
      <th className="bp-first bp-h">{mName(months.cur)} budget</th><th className="bp-h">MoM</th><th className="bp-h">YoY</th><th className="bp-h">% of total</th>
      <th className="bp-first bp-h">{mName(months.next)} budget{budget.nextPosted ? '' : ' (est.)'}</th><th className="bp-h">MoM</th><th className="bp-h">YoY</th><th className="bp-h">% of total</th>
    </>
  );
  const cells = (key: string) => {
    const b = key ? budget.out.get(key) : budget.total, T = budget.total;
    if (!b) return <><td className="bp-first dim">–</td><td /><td /><td /><td className="bp-first dim">–</td><td /><td /><td /></>;
    return (
      <>
        <td className="bp-first"><b>{n0(b.cur)}</b></td><Chg a={b.cur} b={b.prev} /><Chg a={b.cur} b={b.ly} /><td className="bp-pct">{T.cur ? `${((b.cur / T.cur) * 100).toFixed(1)}%` : '–'}</td>
        <td className="bp-first"><b>{budget.nextPosted ? '' : '≈'}{n0(b.next)}</b></td><Chg a={b.next} b={b.cur} /><Chg a={b.next} b={b.nextLy} /><td className="bp-pct">{T.next ? `${((b.next / T.next) * 100).toFixed(1)}%` : '–'}</td>
      </>
    );
  };

  return (
    <>
      <div className="dimpick"><span className="pg-name">Columns</span>{OPTIONS.map((d) => (
        <label key={d} className={`pick ${sel.includes(d) ? 'on' : ''}`}><input type="checkbox" checked={sel.includes(d)} onChange={() => setSel((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))} />{NAME[d]}</label>
      ))}<span className="dim">Performance: {pair.curLabel || 'selected period'} vs {pair.prevLabel || '—'} · Budget: {mName(months.cur)} and {mName(months.next)} (CHF)</span></div>
      <div className="dimpick"><span className="pg-name">Metrics</span>{DRILL_METRICS.map((m) => (
        <label key={m} className={`pick ${mets.includes(m) ? 'on' : ''}`} title={METRICS[m].help}><input type="checkbox" checked={mets.includes(m)} onChange={() => setMets((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))} />{METRICS[m].label}</label>
      ))}</div>
      {!dims.length ? <p className="dim">Tick at least one column.</p> : <PivotTable pair={pair} dims={dims} metrics={metrics} pills={false} right={{ head, cells }} />}
      <p className="note">
        Left: the drill-down for the period in the filter bar ({activity === 'All' ? 'all activities' : activity}{boost ? '' : ', without Meta social boosting'}), value and change vs the comparison period.
        Right: the Funnel budget per country × school × channel{activity === 'All' ? '' : ` for ${activity}`}. MoM = vs the month before; YoY = vs the same month last year; % of total = share of the month's budget in this table.
        {budget.nextPosted ? ' Budgets come from the Live Budget tab of "SEG 2026 Paid Media Budget Breakdown" (last year from Funnel).' : ` ${mName(months.next)} is not in the budget sheet yet, so it is estimated (≈): the forward plan per school × channel, split by country as in ${mName(months.cur)}.`}
        {' '}Budget for "All markets" campaigns is posted without a country and shows on the All markets row. The budget excludes Meta social boosting (it has its own tab in the budget sheet).
      </p>
    </>
  );
}
