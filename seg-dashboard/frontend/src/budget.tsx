import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar } from 'recharts';
import { aggregate, emptyTotals, metric, type Filter, type Totals } from './lib/agg';
import { cycleOf, isoWeek, weekDays, weekTick, type Dim, type Store } from './lib/data';
import { label } from './lib/format';
import { marketName } from './lib/names';
import { refDate } from './lib/rules';
import { useCtx } from './components';
import { Block } from './perf';
import { BarList } from './charts';
import { BudgetVsPerf } from './budgetperf';

// Plan = the Live Budget sheet per school × channel × month (public/data/budget_live.json / KV budgetlive); months it
// does not cover come from the older Funnel "Budget" pull (public/data/budget_plan.json).
export type PlanRow = { channel: string; school: string; month: string; budget: number };
let planCache: Promise<PlanRow[]> | null = null;
/** Months in the Live Budget sheet (KV `budgetlive`, else the bundled snapshot) replace the older Funnel plan file. */
export function usePlan() {
  const [p, setP] = useState<PlanRow[] | null>(null);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const get = (u: string): Promise<any> => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    planCache ??= Promise.all([get('/data/budget_plan.json'), get('/api/budgetlive').then((j) => j?.rows ? j : get('/data/budget_live.json'))]).then(([old, live]) => {
      const liveRows: { school: string; channel: string; month: string; budget: number }[] = live?.rows ?? [];
      const months = new Set(liveRows.map((r) => r.month));
      const m = new Map<string, PlanRow>();
      for (const r of liveRows) { const k = `${r.school}|${r.channel}|${r.month}`; const x = m.get(k) ?? { school: r.school, channel: r.channel, month: r.month, budget: 0 }; x.budget += r.budget; m.set(k, x); }
      return [...((old?.rows ?? []) as PlanRow[]).filter((r) => !months.has(r.month)), ...m.values()];
    });
    planCache.then(setP);
  }, []);
  return p;
}

const dim = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
const addD = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const f0 = (v: number) => (Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '–');
const pct = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(0)}%` : '–');
type Status = 'On pace' | 'Under pace' | 'Over pace' | 'Not started' | 'No plan' | 'Future';
const statusOf = (spent: number, expected: number): Status => (expected <= 0 ? (spent > 0 ? 'No plan' : 'Future') : spent === 0 ? 'Not started' : spent / expected < 0.9 ? 'Under pace' : spent / expected > 1.1 ? 'Over pace' : 'On pace');
const chip = (s: Status) => <span className={`chip ${s === 'On pace' ? 'Better' : s === 'Over pace' ? 'Worse' : s === 'Future' ? 'Stable' : 'Mixed'}`}>{s}</span>;

function PaceBar({ spent, plan, expected }: { spent: number; plan: number; expected: number }) {
  if (!plan) return <span className="dim">no plan</span>;
  const used = spent / plan, tick = expected / plan, st = statusOf(spent, expected);
  return (
    <span className="pacebar" title={`${pct(used)} of plan used; expected by now ${pct(tick)}`}>
      <span className={`pb-fill ${st === 'Over pace' ? 'over' : st === 'On pace' ? 'ok' : 'under'}`} style={{ width: `${Math.min(100, used * 100)}%` }} />
      <span className="pb-tick" style={{ left: `${Math.min(100, tick * 100)}%` }} />
      <span className="pb-txt">{pct(used)}</span>
    </span>
  );
}

export type BudgetModel = NonNullable<ReturnType<typeof budgetModel>>;
/** Pacing model shared by the Budget page and the Actions list. */
/** Days of month m that fall inside [a, b] (inclusive), as a share of the month. */
const monthShare = (m: string, a: string, b: string) => {
  const s = a > `${m}-01` ? a : `${m}-01`, e0 = `${m}-${String(dim(m)).padStart(2, '0')}`, e = b < e0 ? b : e0;
  return e < s ? 0 : (Math.round((Date.parse(e) - Date.parse(s)) / 864e5) + 1) / dim(m);
};

/** `rng` = the selected dates: the plan is prorated by day to that window and spend is counted inside it. */
export function budgetModel(store: Store, filter: Filter, plan: PlanRow[], today: string, rng: [string, string] | null = null) {
  const cycle = filter.cycle, schoolF = filter.dims.school?.[0], chanF = filter.dims.channel?.[0];
    const inScope = (r: PlanRow) => (!schoolF || r.school === schoolF) && (!chanF || r.channel === chanF);
    const rows = plan.filter((r) => inScope(r) && (rng ? monthShare(r.month, rng[0], rng[1]) > 0 : cycleOf(`${r.month}-01`) === cycle));
    const months = [...new Set([...rows.map((r) => r.month)])].sort();
    const cur = today.slice(0, 7);
    const start = rng?.[0] ?? '0000-00-00', end = rng?.[1] ?? '9999-12-31';
    const planFrac = (m: string) => (rng ? monthShare(m, start, end) : 1);
    const expFrac = (m: string) => monthShare(m, start, end < today ? end : today);
    const f = { ...filter, weeks: null, months: null, dates: null, range: rng, ...(rng ? { cycle: '*' } : {}) };
    const spendBy = aggregate(store, f, ['school', 'channel', 'month']);
    const rate7 = aggregate(store, { ...f, cycle: '*', dates: Array.from({ length: 7 }, (_, i) => addD(today, -i)) }, ['school', 'channel']);
    const rate28 = aggregate(store, { ...f, cycle: '*', dates: Array.from({ length: 28 }, (_, i) => addD(today, -i)) }, ['school', 'channel']);
    const lines = new Map<string, { school: string; channel: string; plan: number; expected: number; spent: number; byMonth: Map<string, { plan: number; spent: number; expected: number }>; r7: number; r28: number; t: Totals; nextPlan: number }>();
    const next = new Date(Date.UTC(Number(cur.slice(0, 4)), Number(cur.slice(5, 7)), 1)).toISOString().slice(0, 7);
    for (const r of rows) {
      const k = `${r.school}\u0001${r.channel}`;
      const L = lines.get(k) ?? { school: r.school, channel: r.channel, plan: 0, expected: 0, spent: 0, byMonth: new Map(), r7: 0, r28: 0, t: emptyTotals(), nextPlan: 0 };
      L.plan += r.budget * planFrac(r.month); L.expected += r.budget * expFrac(r.month);
      const bm = L.byMonth.get(r.month) ?? { plan: 0, spent: 0, expected: 0 }; bm.plan += r.budget * planFrac(r.month); bm.expected += r.budget * expFrac(r.month); L.byMonth.set(r.month, bm);
      if (r.month === next) L.nextPlan += r.budget;
      lines.set(k, L);
    }
    if (rng) for (const r of plan) if (r.month === next && inScope(r) && monthShare(r.month, start, end) === 0) {
      const k = `${r.school}\u0001${r.channel}`;
      const L = lines.get(k); if (L) L.nextPlan += r.budget;
    }
    // spend (also lines with spend but no plan)
    const res = aggregate(store, f, ['school', 'channel']);
    for (const [k, t] of res) {
      const [school, channel] = k.split('\u0001');
      if (!school || (schoolF && school !== schoolF)) continue;
      const L = lines.get(k) ?? { school, channel, plan: 0, expected: 0, spent: 0, byMonth: new Map(), r7: 0, r28: 0, t: emptyTotals(), nextPlan: 0 };
      L.spent = t.cost; L.t = t; L.r7 = (rate7.get(k)?.cost ?? 0) / 7; L.r28 = (rate28.get(k)?.cost ?? 0) / 28;
      for (const m of months) { const bm = L.byMonth.get(m) ?? { plan: 0, spent: 0, expected: 0 }; bm.spent = spendBy.get(`${k}\u0001${m}`)?.cost ?? 0; L.byMonth.set(m, bm); }
      if (L.plan > 0 || t.cost > 0) lines.set(k, L);
    }
    const all = [...lines.values()].filter((l) => l.plan > 0 || l.spent > 0).sort((a, b) => b.plan - a.plan);
    const horizon = rng ? end : months.length ? `${months.at(-1)}-${String(dim(months.at(-1)!)).padStart(2, '0')}` : today;
    const daysLeft = Math.max(1, (Date.parse(horizon) - Date.parse(today < start ? start : today)) / 864e5);
    const T = all.reduce((a, l) => ({ plan: a.plan + l.plan, expected: a.expected + l.expected, spent: a.spent + l.spent, r7: a.r7 + l.r7, r28: a.r28 + l.r28, nextPlan: a.nextPlan + l.nextPlan, gl: a.gl + l.t.gl }), { plan: 0, expected: 0, spent: 0, r7: 0, r28: 0, nextPlan: 0, gl: 0 });
    const avgCpgl = T.gl ? T.spent / T.gl : NaN;
    const acctPace = T.expected ? T.spent / T.expected : NaN;
    const withAct = all.map((l) => {
      const st = statusOf(l.spent, l.expected), cpgl = metric(l.t, 'cpgl'), remaining = Math.max(0, l.plan - l.spent), need = remaining / daysLeft;
      const reached = l.r7 > 0 ? addD(today, Math.ceil(remaining / l.r7)) : '';
      let action = 'Keep.';
      if (st === 'No plan') action = 'Spending without a plan line — add it to the budget sheet or stop.';
      else if (st === 'Not started') action = `Not started: launch or confirm it is scheduled later (needs CHF ${f0(need)}/day to use the plan).`;
      else if (st === 'Under pace') action = Number.isFinite(cpgl) && cpgl <= avgCpgl ? `Efficient and under pace: raise to ≈CHF ${f0(need)}/day (now ${f0(l.r7)}).` : `Under pace with weaker good-lead cost: fix before adding; consider moving its budget to an efficient line.`;
      else if (st === 'Over pace') action = acctPace > 1.1 ? `Account is over pace: cut to ≈CHF ${f0(need)}/day.` : Number.isFinite(cpgl) && cpgl <= avgCpgl ? 'Over its line but efficient while the account is under pace — keep, fund from under-used lines.' : `Over pace and weaker: bring down to ≈CHF ${f0(need)}/day.`;
      return { ...l, st, cpgl, remaining, need, reached, action };
    });
    const monthRows = months.map((m) => { const r = { m, plan: 0, expected: 0, spent: 0 }; for (const l of all) { const b = l.byMonth.get(m); if (b) { r.plan += b.plan; r.expected += b.expected; r.spent += b.spent; } } return r; });
    // burn-up by ISO week, from the first week with spend to the last month that has a budget: spend stops at the
    // latest data, the plan line runs on, and a projection at the 28-day rate shows where spend ends up
    const wk = aggregate(store, f, ['week']);
    const first = rng ? isoWeek(start) : [...wk.keys()].sort()[0];
    const weeks: string[] = [];
    if (first) for (let d = weekDays(first)[0]; d <= horizon; d = addD(d, 7)) weeks.push(isoWeek(d));
    const expAt = (e: string) => rows.reduce((a, r) => a + r.budget * monthShare(r.month, start, e), 0);
    let cs = 0;
    const r28 = all.reduce((a, l) => a + l.r28, 0);
    const burn = weeks.map((w) => {
      const sun = weekDays(w)[6], past = weekDays(w)[0] <= today;
      if (past) cs += wk.get(w)?.cost ?? 0;
      const end = sun < horizon ? sun : horizon;
      const proj = sun < today ? null : Math.round(cs + r28 * Math.max(0, (Date.parse(end) - Date.parse(today)) / 864e5));
      return { w: weekTick(w), spent: past ? Math.round(cs) : null, expected: Math.round(expAt(end)), week: past ? wk.get(w)?.cost ?? 0 : null, proj };
    });
    return { all: withAct, T, months, monthRows, daysLeft, horizon, acctPace, avgCpgl, next, cur, burn };
}

/** Adwords = Google Search; PMax / YouTube / Display keep their names. */
export const subName = (x: string) => (x === 'Google Search' ? 'Adwords (Search)' : x === 'Google' ? 'Google (whole line)' : x === 'Meta' ? 'Meta' : x === 'Google PMax' ? 'PMax' : x.replace(/^Google /, ''));

export interface PaceRow { school: string; channel: string; market: string; sub: string; activity: string; st: Status; linePace: number; r7: number; target: number; cpgl: number; gl: number; cost28: number; lineCpgl: number; why: string; action: string }

/**
 * What to do, per school · country · channel type · activity, only for lines that are under or over pace. The plan is set per
 * school × channel, so the line's daily gap (needed/day − current/day) is split over its countries by efficiency:
 * extra money goes to countries with the best 28-day cost per good lead; cuts come from the worst first.
 */
export function paceByCountry(store: Store, filter: Filter, model: BudgetModel, today: string): PaceRow[] {
  const f = { ...filter, weeks: null, months: null, dates: null, range: null };
  const d7 = aggregate(store, { ...f, cycle: '*', dates: Array.from({ length: 7 }, (_, i) => addD(today, -i)) }, ['school', 'channel', 'market', 'subchannel', 'activity']);
  const d28 = aggregate(store, { ...f, cycle: '*', dates: Array.from({ length: 28 }, (_, i) => addD(today, -i)) }, ['school', 'channel', 'market', 'subchannel', 'activity']);
  const out: PaceRow[] = [];
  for (const l of model.all) {
    if (l.st !== 'Under pace' && l.st !== 'Over pace' && l.st !== 'Not started' && l.st !== 'No plan') continue;
    const linePace = l.expected ? l.spent / l.expected : NaN;
    // Already spending at the daily rate the plan needs from here (±10%): on track, nothing to change.
    if ((l.st === 'Under pace' || l.st === 'Over pace') && l.need > 0 && Math.abs(l.r7 / l.need - 1) <= 0.1) continue;
    const base = { school: l.school, channel: l.channel, st: l.st, linePace };
    const lineCpgl = metric(l.t, 'cpgl');
    if (l.st === 'Not started') { out.push({ ...base, market: '', sub: l.channel, activity: '', r7: 0, target: l.need, cpgl: NaN, gl: 0, cost28: 0, lineCpgl, why: `The ${l.channel} plan for ${label(l.school)} has CHF ${f0(l.plan)} this cycle and nothing has been spent.`, action: `Launch it or confirm it starts later — the plan needs ≈CHF ${f0(l.need)}/day.` }); continue; }
    const cs = [...d28.keys()].filter((k) => k.startsWith(`${l.school}\u0001${l.channel}\u0001`)).map((k) => {
      const t = d28.get(k)!, [, , market, sub, activity] = k.split('\u0001');
      return { market, sub, activity, r7: (d7.get(k)?.cost ?? 0) / 7, t, cpgl: metric(t, 'cpgl') };
    }).filter((c) => c.market && (c.r7 > 0 || c.t.cost > 0));
    const gap = l.st === 'No plan' ? -l.r7 : l.need - l.r7; // CHF/day to add (+) or remove (−)
    const mk = (c: typeof cs[number], target: number, why: string, action: string) => out.push({ ...base, market: c.market, sub: c.sub, activity: c.activity, r7: c.r7, target, cpgl: c.cpgl, gl: c.t.gl, cost28: c.t.cost, lineCpgl, why, action });
    const nm = (c: typeof cs[number]) => `${label(l.school)} ${marketName(c.market)} ${subName(c.sub)}${c.activity ? ` ${c.activity}` : ''}`;
    if (gap > 0) {
      // under pace: raise the efficient countries (≤ line CPGL, or ≤ account average), up to +60% each
      const ok = cs.filter((c) => c.t.gl >= 2 && Number.isFinite(c.cpgl) && (c.cpgl <= lineCpgl * 1.05 || c.cpgl <= model.avgCpgl)).sort((a, b) => a.cpgl - b.cpgl);
      let left = gap;
      const w = ok.reduce((a, c) => a + Math.max(c.r7, 5), 0);
      for (const c of ok) {
        if (left <= 0.5) break;
        const add = Math.min(left, Math.max(5, (gap * Math.max(c.r7, 5)) / w), Math.max(10, c.r7 * 0.6));
        left -= add;
        mk(c, c.r7 + add, `Line ${pct(linePace)} of pace (−CHF ${f0(l.expected - l.spent)}). ${marketName(c.market)}${c.activity ? ` ${c.activity}` : ''} is one of the most efficient parts of the line: CPGL CHF ${f0(c.cpgl)} vs CHF ${f0(lineCpgl)} for the line (${c.t.gl} GL in 28 days).`,
          `Raise ${nm(c)} from CHF ${f0(c.r7)} to CHF ${f0(c.r7 + add)}/day (+${f0(add)}).`);
      }
      for (const c of cs.filter((c) => !ok.includes(c) && c.activity !== 'BRAND' && c.t.cost >= 100 && (c.t.gl === 0 || c.cpgl >= 1.4 * lineCpgl))) {
        mk(c, c.r7, `Under-pace line, but ${marketName(c.market)} ${c.t.gl ? `costs CHF ${f0(c.cpgl)} per good lead (line CHF ${f0(lineCpgl)})` : `spent CHF ${f0(c.t.cost)} in 28 days without a good lead`}.`, `Do not add budget to ${nm(c)} — fix targeting / creatives first.`);
      }
      if (left > 5) out.push({ ...base, market: '', sub: l.channel, activity: '', r7: l.r7, target: l.r7 + (gap - left), cpgl: lineCpgl, gl: l.t.gl, cost28: 0, lineCpgl, why: `CHF ${f0(left)}/day of the gap has no efficient country to go to.`, action: ok.length ? `Leave CHF ${f0(left)}/day unspent (or open a new country / audience test) rather than forcing it into weak countries.` : `No country in this line earns its good leads cheaply — hold the extra CHF ${f0(gap)}/day until creatives / targeting are fixed.` });
    } else if (gap < 0) {
      // over pace (or spending without a plan): cut the least efficient countries first, up to 50% each
      let left = -gap;
      // BRAND is awareness (not judged on good leads), so it is cut last
      const worstKey = (c: typeof cs[number]) => (c.activity === 'BRAND' ? -1 : c.t.gl ? c.cpgl : Infinity);
      const byWorst = [...cs].filter((c) => c.r7 > 0).sort((a, b) => worstKey(b) - worstKey(a));
      for (const c of byWorst) {
        if (left <= 0.5) break;
        const cut = Math.min(left, l.st === 'No plan' ? c.r7 : c.r7 * 0.5);
        left -= cut;
        mk(c, c.r7 - cut, l.st === 'No plan' ? `${label(l.school)} ${l.channel} spends without a plan line.` : `Line ${pct(linePace)} of pace (+CHF ${f0(l.spent - l.expected)}). ${marketName(c.market)} ${c.t.gl ? `is the least efficient: CPGL CHF ${f0(c.cpgl)} vs CHF ${f0(lineCpgl)} for the line` : `spent CHF ${f0(c.t.cost)} in 28 days without a good lead`}.`,
          `Cut ${nm(c)} from CHF ${f0(c.r7)} to CHF ${f0(c.r7 - cut)}/day (−${f0(cut)}).`);
      }
    }
  }
  return out;
}

/** School → Country → Channel type → Activity: spend and results; plan share is estimated from the line's spend split. */
const LEVELS = ['school', 'market', 'subchannel', 'activity'] as const;
const LEVEL_NAME = ['School', 'Country', 'Channel', 'Activity'];
function CountryBreakdown({ lines, filter, today, activity, pace }: { lines: BudgetModel['all']; filter: Filter; today: string; activity: string; pace: PaceRow[] }) {
  const { store } = useCtx();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const data = useMemo(() => {
    const f = { ...filter, weeks: null, months: null, dates: null, range: null };
    const by = [...LEVELS, 'channel'] as Dim[];
    const cyc = aggregate(store, f, by);
    const d7 = aggregate(store, { ...f, cycle: '*', dates: Array.from({ length: 7 }, (_, i) => addD(today, -i)) }, by);
    const mtd = aggregate(store, { ...f, months: [today.slice(0, 7)] }, by);
    const lineSpend = new Map<string, number>();
    for (const [k, t] of cyc) { const p = k.split('\u0001'), lk = `${p[0]}\u0001${p[4]}`; lineSpend.set(lk, (lineSpend.get(lk) ?? 0) + t.cost); }
    const plan = new Map(lines.map((l) => [`${l.school}\u0001${l.channel}`, l]));
    return [...cyc.entries()].filter(([k, t]) => k.split('\u0001')[0] && t.cost > 0).map(([k, t]) => {
      const p = k.split('\u0001'), lk = `${p[0]}\u0001${p[4]}`;
      const L = plan.get(lk), share = t.cost / (lineSpend.get(lk) || 1);
      return { p, t, share, estPlan: L ? L.plan * share : NaN, estExp: L ? L.expected * share : NaN, r7: (d7.get(k)?.cost ?? 0) / 7, target: NaN, mtd: mtd.get(k)?.cost ?? 0 };
    }).filter((r) => activity === 'All' || r.p[3] === activity);
  }, [store, filter, lines, today, activity]);
  // target/day = the What-to-do target for that school · country · channel · activity, otherwise keep today's rate
  const targets = useMemo(() => new Map(pace.filter((r) => r.market).map((r) => [`${r.school}|${r.market}|${r.sub}|${r.activity}`, r.target])), [pace]);
  for (const r of data) r.target = targets.get(`${r.p[0]}|${r.p[1]}|${r.p[2]}|${r.p[3]}`) ?? r.r7;
  type R = typeof data[number];
  const sum = (rs: R[]) => rs.reduce((a, r) => ({ cost: a.cost + r.t.cost, leads: a.leads + r.t.leads, gl: a.gl + r.t.gl, app: a.app + r.t.app, acc: a.acc + r.t.acc, r7: a.r7 + r.r7, target: a.target + r.target, mtd: a.mtd + r.mtd, estPlan: a.estPlan + (r.estPlan || 0), estExp: a.estExp + (r.estExp || 0) }), { cost: 0, leads: 0, gl: 0, app: 0, acc: 0, r7: 0, target: 0, mtd: 0, estPlan: 0, estExp: 0 });
  const tog = (k: string) => setOpen((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const cells = (x: ReturnType<typeof sum>) => (<>
    <td>{f0(x.cost)}</td><td>{x.estPlan ? f0(x.estPlan) : '–'}</td><td>{x.estExp ? <PaceBar spent={x.cost} plan={x.estPlan} expected={x.estExp} /> : '–'}</td>
    <td>{f0(x.mtd)}</td><td>{f0(x.r7)}</td><td><b>{f0(x.target)}</b>{Math.abs(x.target - x.r7) >= 0.5 && <div className={x.target > x.r7 ? 'good' : 'bad'} style={{ fontSize: 11 }}>{x.target > x.r7 ? '+' : '−'}{f0(Math.abs(x.target - x.r7))}</div>}</td><td>{f0(x.leads)}</td><td>{f0(x.gl)}</td><td>{x.gl ? f0(x.cost / x.gl) : '–'}</td><td>{f0(x.app)}</td><td>{x.app ? f0(x.cost / x.app) : '–'}</td><td>{f0(x.acc)}</td><td>{x.acc ? f0(x.cost / x.acc) : '–'}</td></>);
  const nameAt = (d: number, v: string) => (d === 1 ? marketName(v) : d === 2 ? subName(v) : label(v));
  const render = (rs: R[], d: number, prefix: string): ReactNode[] => {
    const vals = [...new Set(rs.map((r) => r.p[d]))].sort((a, b) => sum(rs.filter((r) => r.p[d] === b)).cost - sum(rs.filter((r) => r.p[d] === a)).cost);
    return vals.map((v) => {
      const sub = rs.filter((r) => r.p[d] === v), key = `${prefix}|${v}`, leaf = d === LEVELS.length - 1, isOpen = open.has(key);
      return (
        <Fragment key={key}>
          <tr className={leaf ? 'pv-leaf' : `pv-group pv-g${Math.min(d, 2)}`} onClick={leaf ? undefined : () => tog(key)}>
            <td className="pv-name" style={{ paddingLeft: 8 + d * 18 }}>{!leaf && <span className="pv-caret">{isOpen ? '▾' : '▸'}</span>}<span className="pv-dim">{LEVEL_NAME[d]}</span>{nameAt(d, v)}</td>{cells(sum(sub))}
          </tr>
          {!leaf && isOpen && render(sub, d + 1, key)}
        </Fragment>
      );
    });
  };
  return (
    <div className="tablewrap"><table className="t hier pvlike">
      <thead><tr><th>School › country › channel › activity</th><th>Spent (cycle)</th><th>Est. plan</th><th>Used · pace tick (est.)</th><th>Spent {today.slice(0, 7)}</th><th>CHF/day now (7d)</th><th>Target/day</th><th>Leads</th><th>Good Leads</th><th>CPGL</th><th>Applied</th><th>CPApp</th><th>Accepted</th><th>CPAcc</th></tr></thead>
      <tbody>{render(data, 0, '')}</tbody>
    </table></div>
  );
}

export function BudgetPage() {
  const { store, filter: ctxFilter, view } = useCtx();
  const filter = useMemo(() => ({ ...ctxFilter, cycle: view.cycle, range: null }), [ctxFilter, view.cycle]);
  const plan = usePlan();
  const today = refDate(store.lastDate);
  const cycle = filter.cycle;
  const planOK = !(filter.dims.country?.length || filter.dims.level?.length);
  // The plan is not split by activity, so pacing compares it with ALL paid spend (not only ACT).
  const [boost, setBoost] = useState(false); // the Live Budget sheet excludes social boosting (own budget tab), so spend leaves it out by default
  const allAct = useMemo(() => ({ ...filter, dims: { ...filter.dims, activity: [], ...(boost ? {} : { boost: ['Paid ads'] }) } }), [filter, boost]);
  // the date filter (range or month) narrows the plan, the expected spend and the actual spend to those days
  const rng = useMemo<[string, string] | null>(() => {
    if (ctxFilter.range) return ctxFilter.range;
    if (view.view === 'month' && ctxFilter.months?.length === 1) { const m = ctxFilter.months[0]; return [`${m}-01`, `${m}-${String(dim(m)).padStart(2, '0')}`]; }
    return null;
  }, [ctxFilter.range, ctxFilter.months, view.view]);
  const model = useMemo(() => (plan ? budgetModel(store, allAct, plan, today, rng) : null), [plan, store, allAct, today, rng]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [wtdCh, setWtdCh] = useState('All');
  const [act, setAct] = useState('All');
  if (!plan || !model) return <p className="note">Loading budget plan…</p>;
  const { all, T, monthRows, daysLeft, horizon, acctPace, next, cur, burn } = model;
  const pace = paceByCountry(store, allAct, model, today);
  const paceAct = pace.filter((r) => Math.abs(r.target - r.r7) >= 0.5 || r.st === 'Not started' || r.st === 'No plan').filter((r) => act === 'All' || !r.activity || r.activity === act);
  const subs = [...new Set(paceAct.map((r) => r.sub))].sort();
  const paceShown = paceAct.filter((r) => wtdCh === 'All' || r.sub === wtdCh);
  const under = all.filter((l) => l.st === 'Under pace' || l.st === 'Not started').sort((a, b) => (b.expected - b.spent) - (a.expected - a.spent)).slice(0, 3);
  const over = all.filter((l) => l.st === 'Over pace').sort((a, b) => (b.spent - b.expected) - (a.spent - a.expected)).slice(0, 2);
  const notStarted = all.filter((l) => l.st === 'Not started').reduce((a, l) => a + l.expected, 0);
  const proj = T.spent + T.r28 * daysLeft;
  const nm = (l: { school: string; channel: string }) => `${label(l.school)} · ${l.channel}`;
  const schools = [...new Set(all.map((l) => l.school))];
  return (
    <>
      <div className="pagehead"><div><h2 className="page">Budget & Pacing</h2>
        <p className="lede">{rng ? <>Dates {rng[0]} → {rng[1]} (plan prorated by day) · </> : <>Cycle {cycle} · </>}plan = Live Budget sheet per school × channel × month (known to {model.months.at(-1)}) · even daily pace inside each month · data through {today}. All activities are included (ACT, BRAND, CONV, NURT); pacing uses all paid spend because the plan is not split by activity.</p></div>
        <div className="actfilter"><span className="pg-name">Activity</span><div className="seg">{['All', 'ACT', 'BRAND', 'CONV', 'NURT'].map((a) => <button key={a} className={act === a ? 'on' : ''} onClick={() => setAct(a)}>{a === 'All' ? 'All activities' : a}</button>)}</div>
          <span className="pg-name">Meta social boosting</span><div className="seg"><button className={boost ? 'on' : ''} onClick={() => setBoost(true)}>Included</button><button className={!boost ? 'on' : ''} onClick={() => setBoost(false)}>Excluded</button></div></div>
      </div>
      <p className="note">{boost ? 'Meta social boosting is included in spend, but the Live Budget sheet has no boosting line (it has its own budget tab), so lines with boosting look over pace.' : 'Meta social boosting (SocialBoosting campaigns and boosted-post ads) is left out of spend, like the Live Budget sheet, which budgets boosting on its own tab.'}</p>
      {act !== 'All' && <p className="note">Activity {act}: applies to "What to do", Budget v Performance and the country breakdown. Plan pacing (scorecards, read, charts, by month / area) always uses all activities, because the Funnel plan is not split by activity.</p>}
      {!planOK && <p className="warnbox">The plan exists only per school × channel. Country / activity / level filters are ignored on this page.</p>}
      <Block tone="cards" n="Scorecard" title="Cycle pacing">
        <div className="kpis-grid">
          {[['Plan (known months)', `CHF ${f0(T.plan)}`, `to ${horizon}`], ['Expected by now', `CHF ${f0(T.expected)}`, 'even daily pace'], ['Spent', `CHF ${f0(T.spent)}`, `${pct(T.plan ? T.spent / T.plan : NaN)} of plan`],
            ['Pace', pct(acctPace), acctPace < 0.9 ? 'under pace' : acctPace > 1.1 ? 'over pace' : 'on pace'], ['Projected at 28-day rate', `CHF ${f0(proj)}`, `${pct(T.plan ? proj / T.plan : NaN)} of plan by ${horizon}`], ['Needed per day', `CHF ${f0(Math.max(0, T.plan - T.spent) / daysLeft)}`, `now CHF ${f0(T.r7)}/day (7d)`]]
            .map(([a, b, c], i) => <div key={a} className={`kpi ${i === 3 ? (acctPace < 0.9 || acctPace > 1.1 ? 'kpi-down' : 'kpi-up') : ''}`}><div className="kpi-label">{a}</div><div className="kpi-value">{b}</div><div className="kpi-delta"><span className="kpi-prev">{c}</span></div></div>)}
        </div>
      </Block>
      <Block tone="analysis" n="Read" title={acctPace < 0.9 ? 'Spend is under pace' : acctPace > 1.1 ? 'Spend is over pace' : 'Spend is on pace'}>
        <p>CHF {f0(T.spent)} spent vs CHF {f0(T.expected)} expected by now ({pct(acctPace)} of pace).{notStarted > 0 && ` CHF ${f0(notStarted)} of the gap is in plan lines not started yet (they may be scheduled later).`}
          {under.length > 0 && ` Most under: ${under.map((l) => `${nm(l)} (−CHF ${f0(l.expected - l.spent)})`).join(', ')}.`}
          {over.length > 0 && ` Over pace: ${over.map((l) => `${nm(l)} (+CHF ${f0(l.spent - l.expected)})`).join(', ')}.`}
          {` At the last 28 days' rate (CHF ${f0(T.r28)}/day) spend reaches CHF ${f0(proj)} by ${horizon}, ${pct(T.plan ? proj / T.plan : NaN)} of the plan. Using the full plan needs CHF ${f0(Math.max(0, T.plan - T.spent) / daysLeft)}/day for the remaining ${Math.round(daysLeft)} days.`}</p>
        <p className="note">Cutting a running line is only suggested when the whole account is over pace; while it is under pace, the advice is to move budget to lines that are efficient and running out.</p>
      </Block>
      <Block tone="tables" n="Budget v Performance" title="Budget v Performance — country → school → channel" sub="Performance (left, the period in the filter bar) next to this month's and next month's budget (right) on the same row. Untick Country, School or Channel to see a higher level.">
        <BudgetVsPerf activity={act} boost={boost} />
      </Block>
      <Block tone="charts" n="Charts" title="Burn-up and pace by line">
        <div className="two">
          <div className="panel">
            <div className="chart-title">Cumulative spend vs expected plan, to the end of the budget <span className="dim">· weekly spend as columns (CHF)</span></div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={burn} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="w" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={50} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v, n) => [f0(Number(v)), n === 'spent' ? 'Cumulative spend (CHF)' : n === 'expected' ? 'Expected (plan)' : n === 'proj' ? 'Projected at 28-day rate' : 'Week spend']} />
                <Bar dataKey="week" fill="var(--c1)" fillOpacity={0.25} radius={[4, 4, 0, 0]} maxBarSize={16} isAnimationActive={false} />
                <Line dataKey="expected" stroke="var(--muted)" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="spent" stroke="var(--c1)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                <Line dataKey="proj" stroke="var(--c1)" strokeDasharray="2 4" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="legend"><span><i className="sw" style={{ background: 'var(--c1)' }} />Cumulative spend</span><span><i className="sw" style={{ background: 'var(--c1)', opacity: 0.5 }} />Projected at the 28-day rate (dotted)</span><span><i className="sw" style={{ background: 'var(--muted)' }} />Expected at even pace, to {horizon}</span></div>
          </div>
          <BarList title="Pace by line (spend ÷ expected by now)" rows={all.filter((l) => l.expected > 0).map((l) => ({ key: nm(l), v: (l.spent / l.expected) * 100, sub: l.st, flag: (l.st === 'On pace' ? 'good' : 'bad') as 'good' | 'bad' }))} fmtV={(v) => `${v.toFixed(0)}%`} max={12} />
        </div>
      </Block>
      <Block tone="tables" n="What to do" title="What to do — under- and over-pace lines, by country" sub={`Only lines that are under or over pace, not started, or spending without a plan — a line already spending at the daily rate its plan needs (±10%) is on track and left out. Status per row: target/day = now → On pace; target above now → Under pace; below → Over pace. The plan is per school × channel, so the line's daily gap is split over its countries by 28-day cost per good lead: extra money to the most efficient countries, cuts from the least efficient first. CHF/day now = last 7 days.`}>
        <div className="seg wrap">{['All', ...subs].map((c) => <button key={c} className={wtdCh === c ? 'on' : ''} onClick={() => setWtdCh(c)}>{c === 'All' ? 'All channels' : subName(c)} <span className="count">{c === 'All' ? paceAct.length : paceAct.filter((r) => r.sub === c).length}</span></button>)}</div>
        {paceShown.length === 0 ? <p className="good">Every line is on pace — nothing to change.</p> : (
          <div className="tablewrap"><table className="t wtd">
            <thead><tr><th>School</th><th>Country</th><th>Channel</th><th>Activity</th><th>Status</th><th>CHF/day now</th><th>→ Target/day</th><th>Change</th><th>GL · CPGL (28d)</th><th style={{ textAlign: 'left' }}>What to do</th><th style={{ textAlign: 'left' }}>Why</th></tr></thead>
            <tbody>{paceShown.map((r, i) => { const d = r.target - r.r7; return (
              <tr key={i} data-cmt={`${label(r.school)} › ${r.market ? marketName(r.market) : 'whole line'} › ${subName(r.sub)}${r.activity ? ` › ${r.activity}` : ''}`}><td><b>{label(r.school)}</b></td><td>{r.market ? marketName(r.market) : <span className="dim">whole line</span>}</td><td>{subName(r.sub)}</td><td>{r.activity || <span className="dim">all</span>}</td><td>{chip(r.st === 'Not started' || r.st === 'No plan' ? r.st : Math.abs(d) < 0.5 ? 'On pace' : d > 0 ? 'Under pace' : 'Over pace')}{Number.isFinite(r.linePace) && <div className="dim">line {pct(r.linePace)} of pace to date</div>}</td>
                <td>{f0(r.r7)}</td><td><b>{f0(r.target)}</b></td><td className={d > 0.5 ? 'good' : d < -0.5 ? 'bad' : 'dim'}>{Math.abs(d) < 0.5 ? 'hold' : `${d > 0 ? '+' : '−'}${f0(Math.abs(d))}`}</td>
                <td>{r.market ? `${f0(r.gl)} · ${Number.isFinite(r.cpgl) ? f0(r.cpgl) : '–'}` : '–'}</td><td className="act-text"><b>{r.action}</b></td><td className="act-text dim">{r.why}</td></tr>); })}</tbody>
          </table></div>
        )}
      </Block>
      <Block tone="tables" n="Next month" title={`Next month · ${next}`} sub="Daily budget needed to spend next month's plan, vs the current 7-day rate.">
        <div className="tablewrap"><table className="t">
          <thead><tr><th>Line</th><th>Plan {next}</th><th>Needed/day</th><th>CHF/day now</th><th>Change</th></tr></thead>
          <tbody>{all.filter((l) => l.nextPlan > 0 || l.r7 > 0).map((l) => { const need = l.nextPlan / dim(next); const d = l.r7 ? need / l.r7 - 1 : NaN; return (
            <tr key={nm(l)}><td>{nm(l)}</td><td>{f0(l.nextPlan)}</td><td>{f0(need)}</td><td>{f0(l.r7)}</td><td className={Math.abs(d) > 0.2 ? 'bad' : 'dim'}>{Number.isFinite(d) ? `${d >= 0 ? '+' : ''}${(d * 100).toFixed(0)}%` : l.nextPlan ? 'start' : 'stop'}</td></tr>); })}
            <tr className="total"><td>Total</td><td>{f0(T.nextPlan)}</td><td>{f0(T.nextPlan / dim(next))}</td><td>{f0(T.r7)}</td><td /></tr></tbody>
        </table></div>
      </Block>
      <Block tone="tables" n="By month" title="By month" sub="Every month of the cycle with a plan. The current month is judged to date.">
        <div className="tablewrap"><table className="t">
          <thead><tr><th>Month</th><th>Plan (full month)</th><th>Expected to date</th><th>Spent</th><th>Gap</th><th>Used · pace tick</th><th>Status</th></tr></thead>
          <tbody>{monthRows.map((r) => (
            <tr key={r.m}><td>{r.m}{r.m === cur && <span className="dim"> · to {today.slice(8)}</span>}</td><td>{f0(r.plan)}</td><td>{f0(r.expected)}</td><td>{f0(r.spent)}</td><td>{r.expected ? f0(r.spent - r.expected) : '–'}</td>
              <td><PaceBar spent={r.spent} plan={r.plan} expected={r.expected} /></td><td>{chip(r.m > cur ? 'Future' : statusOf(r.spent, r.expected))}</td></tr>
          ))}</tbody>
        </table></div>
      </Block>
      <Block tone="tables" n="By country" title="School → Country → Channel" sub="Spend and results by school, country (campaign market) and channel. Target/day = the What-to-do target for that row (today's rate where nothing changes). The plan exists per school × channel only, so each country's plan is estimated from its share of that line's spend so far (est.). Click a band to open it.">
        <CountryBreakdown lines={all} filter={allAct} today={today} activity={act} pace={pace} />
      </Block>
      <Block tone="tables" n="By area" title="Pacing by area" sub="School → channel (the level the plan is set at), cycle to date. Open a school.">
        <div className="tablewrap"><table className="t hier">
          <thead><tr><th>School › channel</th><th>Cycle plan</th><th>Expected</th><th>Spent</th><th>Gap</th><th>Of which not started</th><th>Used · pace tick</th><th>Status</th></tr></thead>
          <tbody>{schools.map((sc) => {
            const ls = all.filter((l) => l.school === sc);
            const s = ls.reduce((a, l) => ({ plan: a.plan + l.plan, exp: a.exp + l.expected, spent: a.spent + l.spent, ns: a.ns + (l.st === 'Not started' ? l.expected : 0) }), { plan: 0, exp: 0, spent: 0, ns: 0 });
            const isOpen = open.has(sc);
            return (
              <Fragment key={sc}>
                <tr><td><button className="twisty" onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(sc)) n.delete(sc); else n.add(sc); return n; })}>{isOpen ? '▾' : '›'}</button><b>{label(sc)}</b></td>
                  <td>{f0(s.plan)}</td><td>{f0(s.exp)}</td><td>{f0(s.spent)}</td><td>{f0(s.spent - s.exp)}</td><td>{s.ns ? f0(s.ns) : '–'}</td><td><PaceBar spent={s.spent} plan={s.plan} expected={s.exp} /></td><td>{chip(statusOf(s.spent, s.exp))}</td></tr>
                {isOpen && ls.map((l) => (
                  <tr key={nm(l)} className="lvl1"><td style={{ paddingLeft: 34 }}>{l.channel}</td><td>{f0(l.plan)}</td><td>{f0(l.expected)}</td><td>{f0(l.spent)}</td><td>{f0(l.spent - l.expected)}</td><td>{l.st === 'Not started' ? f0(l.expected) : '–'}</td><td><PaceBar spent={l.spent} plan={l.plan} expected={l.expected} /></td><td>{chip(l.st)}</td></tr>
                ))}
              </Fragment>
            );
          })}</tbody>
        </table></div>
      </Block>
    </>
  );
}
