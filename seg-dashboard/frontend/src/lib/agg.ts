import { DIM_CHANNELS, MEAS, type Dim, type Meas, type Store, prevCycle, prevWeek, weekDays, cycleOf } from './data';

export type Totals = Record<Meas, number> & { avail: Record<Meas, boolean>; rows: number; x: Record<string, number> };

export interface Filter {
  cycle: string;
  weeks: string[] | null;               // null = whole cycle
  months?: string[] | null;             // YYYY-MM restriction
  dims: Partial<Record<Dim, string[]>>; // empty/undefined = all
  dates?: string[] | null;              // day-level restriction (daily rows only)
  range?: [string, string] | null;      // from–to dates; weekly history rows count when their Thursday is inside
}

export const emptyTotals = (): Totals => ({
  ...(Object.fromEntries(MEAS.map((k) => [k, 0])) as Record<Meas, number>),
  avail: Object.fromEntries(MEAS.map((k) => [k, false])) as Record<Meas, boolean>, rows: 0, x: {},
});

function addRow(t: Totals, s: Store, i: number) {
  for (const k of MEAS) {
    const v = s.m[k][i];
    if (!Number.isNaN(v)) { t[k] += v; t.avail[k] = true; }
  }
  t.rows++;
}

export type GroupKey = Dim | 'week' | 'date' | 'month';

/** Aggregate filtered rows by the given keys. Rates are computed later from these sums, never averaged. */
export function aggregate(s: Store, f: Filter, by: GroupKey[] = [], extra?: Record<string, Float64Array>): Map<string, Totals> {
  // cycle '*' = any cycle (rolling windows that cross 1 August use date filters instead)
  const cyc = f.cycle === '*' ? -2 : s.cycles.indexOf(f.cycle);
  const out = new Map<string, Totals>();
  if (cyc === -1) return out;
  const weekSet = f.weeks ? new Set(f.weeks.map((w) => s.weeks.indexOf(w))) : null;
  const dateSet = f.dates ? new Set(f.dates.map((d) => s.dates.indexOf(d))) : null;
  const monthSet = f.months ? new Set(f.months.map((m) => s.months.indexOf(m))) : null;
  let rangeDates: Set<number> | null = null, rangeWeeks: Set<number> | null = null;
  if (f.range) {
    const [a, b] = f.range;
    rangeDates = new Set(); rangeWeeks = new Set();
    s.dates.forEach((d, i) => { if (d && d >= a && d <= b) rangeDates!.add(i); });
    s.weeks.forEach((w, i) => { const th = weekDays(w)[3]; if (th >= a && th <= b) rangeWeeks!.add(i); });
  }
  const emptyDate = s.dates.indexOf('');
  const ex = extra ? Object.entries(extra) : [];
  const dimSets: [Int32Array, Set<number>][] = [];
  for (const d of Object.keys(f.dims) as Dim[]) {
    const vals = f.dims[d];
    if (vals && vals.length) dimSets.push([s.dim[d], new Set(vals.map((v) => s.dicts[d].indexOf(v)))]);
  }
  for (let i = 0; i < s.n; i++) {
    if (cyc !== -2 && s.cycle[i] !== cyc) continue;
    if (weekSet && !weekSet.has(s.week[i])) continue;
    if (dateSet && !dateSet.has(s.date[i])) continue;
    if (monthSet && !monthSet.has(s.month[i])) continue;
    if (rangeDates && !(s.date[i] === emptyDate ? rangeWeeks!.has(s.week[i]) : rangeDates.has(s.date[i]))) continue;
    let ok = true;
    for (const [col, set] of dimSets) if (!set.has(col[i])) { ok = false; break; }
    if (!ok) continue;
    let key = '';
    for (const g of by) {
      const v = g === 'week' ? s.weeks[s.week[i]]
        : g === 'date' ? s.dates[s.date[i]]
        : g === 'month' ? s.months[s.month[i]]
        : s.dicts[g][s.dim[g][i]];
      key += (key ? '\u0001' : '') + v;
    }
    let t = out.get(key);
    if (!t) { t = emptyTotals(); out.set(key, t); }
    addRow(t, s, i);
    for (const [k, arr] of ex) { const v = arr[i]; if (v) t.x[k] = (t.x[k] ?? 0) + v; }
  }
  return out;
}

export const total = (s: Store, f: Filter) => aggregate(s, f).get('') ?? emptyTotals();

// ---- metrics -------------------------------------------------------------

export type MetricId = Meas | 'ctr' | 'cpc' | 'cpm' | 'cpl' | 'cpgl' | 'cpreg' | 'cpapp' | 'cpacc'
  | 'glRate' | 'regRate' | 'appRate' | 'accRate' | 'leadAppRate' | 'leadCvr' | 'score' | 'cpScore';

export interface MetricDef { id: MetricId; label: string; kind: 'volume' | 'cost' | 'rate' | 'money'; better: 'up' | 'down' | 'neutral'; help: string }

export const METRICS: Record<MetricId, MetricDef> = {
  cost: { id: 'cost', label: 'Spend (CHF)', kind: 'money', better: 'neutral', help: 'Sum of Cost (CHF)' },
  impr: { id: 'impr', label: 'Impr.', kind: 'volume', better: 'up', help: 'Sum of Impressions' },
  clicks: { id: 'clicks', label: 'Clicks', kind: 'volume', better: 'up', help: 'Sum of Clicks' },
  sessions: { id: 'sessions', label: 'Sessions', kind: 'volume', better: 'up', help: 'GA4 sessions (live window only)' },
  leads: { id: 'leads', label: 'Leads', kind: 'volume', better: 'up', help: 'Leads created in CRM' },
  gl: { id: 'gl', label: 'Good Leads', kind: 'volume', better: 'up', help: 'Status High Potential, Online Application or Nurturing' },
  reg: { id: 'reg', label: 'Register', kind: 'volume', better: 'up', help: 'Register for Portal (CRM Converted Date)' },
  app: { id: 'app', label: 'Applied', kind: 'volume', better: 'up', help: 'Status applied or accepted' },
  acc: { id: 'acc', label: 'Accepted', kind: 'volume', better: 'up', help: 'Accept date known' },
  budget: { id: 'budget', label: 'Budget', kind: 'money', better: 'neutral', help: 'Funnel Budget measure' },
  ctr: { id: 'ctr', label: 'CTR', kind: 'rate', better: 'up', help: 'Clicks / Impressions' },
  cpc: { id: 'cpc', label: 'CPC', kind: 'cost', better: 'down', help: 'Spend / Clicks' },
  cpm: { id: 'cpm', label: 'CPM', kind: 'cost', better: 'down', help: 'Spend / Impressions × 1,000' },
  cpl: { id: 'cpl', label: 'CPL', kind: 'cost', better: 'down', help: 'Spend / Leads' },
  cpgl: { id: 'cpgl', label: 'Cost / GL', kind: 'cost', better: 'down', help: 'Spend / Good Leads' },
  cpreg: { id: 'cpreg', label: 'CPReg', kind: 'cost', better: 'down', help: 'Spend / Register' },
  cpapp: { id: 'cpapp', label: 'CPApp', kind: 'cost', better: 'down', help: 'Spend / Applied' },
  cpacc: { id: 'cpacc', label: 'CPAcc', kind: 'cost', better: 'down', help: 'Spend / Accepted' },
  glRate: { id: 'glRate', label: 'GL rate', kind: 'rate', better: 'up', help: 'Lead → Good Lead: Good Leads / Leads' },
  regRate: { id: 'regRate', label: 'GL → Reg', kind: 'rate', better: 'up', help: 'Good Lead → Register (stage before): Register / Good Leads' },
  appRate: { id: 'appRate', label: 'Reg → App', kind: 'rate', better: 'up', help: 'Register → Applied (stage before): Applied / Register' },
  accRate: { id: 'accRate', label: 'App → Acc', kind: 'rate', better: 'up', help: 'Applied → Accepted (stage before): Accepted / Applied' },
  leadAppRate: { id: 'leadAppRate', label: 'Lead → App', kind: 'rate', better: 'up', help: 'Lead → Applied (from lead): Applied / Leads' },
  leadCvr: { id: 'leadCvr', label: 'Lead CVR', kind: 'rate', better: 'up', help: 'Leads / Clicks' },
  score: { id: 'score', label: 'Funnel score', kind: 'volume', better: 'up', help: 'Lead×1 + Good Lead×3 + Applied×6 + Accepted×10 (SEG rule)' },
  cpScore: { id: 'cpScore', label: 'Cost / score pt', kind: 'cost', better: 'down', help: 'Spend / Funnel score' },
};

const div = (a: number, b: number, ok = true) => (ok && b > 0 ? a / b : NaN);

/** NaN means unavailable (missing measure or zero denominator) — never shown as 0. */
export function metric(t: Totals, id: MetricId): number {
  const A = t.avail;
  switch (id) {
    case 'ctr': return div(t.clicks, t.impr, A.clicks && A.impr);
    case 'cpc': return div(t.cost, t.clicks, A.cost && A.clicks);
    case 'cpm': return div(t.cost * 1000, t.impr, A.cost && A.impr);
    case 'cpl': return div(t.cost, t.leads, A.cost && A.leads);
    case 'cpgl': return div(t.cost, t.gl, A.cost && A.gl);
    case 'cpreg': return div(t.cost, t.reg, A.cost && A.reg);
    case 'cpapp': return div(t.cost, t.app, A.cost && A.app);
    case 'cpacc': return div(t.cost, t.acc, A.cost && A.acc);
    case 'glRate': return div(t.gl, t.leads, A.gl && A.leads);
    case 'regRate': return div(t.reg, t.gl, A.reg && A.gl);
    case 'appRate': return div(t.app, t.reg, A.app && A.reg);
    case 'accRate': return div(t.acc, t.app, A.acc && A.app);
    case 'leadAppRate': return div(t.app, t.leads, A.app && A.leads);
    case 'leadCvr': return div(t.leads, t.clicks, A.leads && A.clicks);
    case 'score': return t.leads + 3 * t.gl + 6 * t.app + 10 * t.acc;
    case 'cpScore': return div(t.cost, metric(t, 'score'), A.cost);
    default: return t.avail[id] ? t[id] : NaN;
  }
}

// ---- comparable periods --------------------------------------------------

/** A week is complete inside a cycle when all 7 days are in that cycle and on/before the last data date. */
export function weekComplete(week: string, cycle: string, lastDate: string): boolean {
  const days = weekDays(week);
  return days.every((d) => cycleOf(d) === cycle) && days[6] <= lastDate;
}

export function cycleWeeks(s: Store, cycle: string): string[] {
  const c = s.cycles.indexOf(cycle);
  const set = new Set<number>();
  for (let i = 0; i < s.n; i++) if (s.cycle[i] === c) set.add(s.week[i]);
  return [...set].map((i) => s.weeks[i]).sort();
}

/** Share of spend+leads in a cycle that carries a value for the dimension (history gaps). */
export function coverage(s: Store, cycle: string, d: Dim): number {
  const c = s.cycles.indexOf(cycle);
  const chans = DIM_CHANNELS[d]?.map((x) => s.dicts.channel.indexOf(x));
  let tot = 0, has = 0;
  const empty = s.dicts[d].indexOf('');
  for (let i = 0; i < s.n; i++) {
    if (s.cycle[i] !== c) continue;
    if (chans && !chans.includes(s.dim.channel[i])) continue;
    const w = (s.m.cost[i] || 0) + 10 * (s.m.leads[i] || 0);
    tot += w; if (s.dim[d][i] !== empty) has += w;
  }
  return tot ? has / tot : 0;
}

export interface Comparison {
  totals: Totals;             // full selected current data (always shown)
  comparisonTotals: Totals;   // current, matched complete weeks only
  prevTotals: Totals;         // previous cycle, same ISO weeks
  matchedWeeks: string[];
  unavailable: string | null; // reason when no fair comparison exists
}

export function compare(s: Store, f: Filter, supportedDims?: Set<Dim>): Comparison {
  const totals = total(s, f);
  const weeks = f.weeks ?? cycleWeeks(s, f.cycle);
  const pc = prevCycle(f.cycle);
  const res = (reason: string | null, matched: string[] = [], cmp = emptyTotals(), prev = emptyTotals()): Comparison =>
    ({ totals, comparisonTotals: cmp, prevTotals: prev, matchedWeeks: matched, unavailable: reason });
  if (!s.cycles.includes(pc)) return res(`No ${pc} data`);
  if (supportedDims) {
    const bad = (Object.keys(f.dims) as Dim[]).filter((d) => f.dims[d]?.length && !supportedDims.has(d));
    if (bad.length) return res(`${pc} history has no ${bad.join(', ')} breakdown`);
  }
  const prevWeeks = cycleWeeks(s, pc);
  const inMonth = (w: string, ms: string[] | null | undefined) => !ms || weekDays(w).every((d) => ms.includes(d.slice(0, 7)));
  const prevMonths = f.months?.map((m) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`) ?? null;
  const matched = weeks.filter((w) => {
    const p = prevWeek(w);
    return p && weekComplete(w, f.cycle, s.lastDate) && weekComplete(p, pc, s.lastDate) && prevWeeks.includes(p)
      && inMonth(w, f.months) && inMonth(p, prevMonths);
  });
  if (!matched.length) return res('No complete matching weeks');
  const cmp = total(s, { ...f, weeks: matched });
  const prev = total(s, prevCycleFilter(f, matched));
  return res(null, matched, cmp, prev);
}

/** The same ISO weeks (and calendar months) one cycle earlier. */
export function prevCycleFilter(f: Filter, matchedWeeks: string[]): Filter {
  return { ...f, cycle: prevCycle(f.cycle), months: f.months?.map((m) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`) ?? null, weeks: matchedWeeks.map((w) => prevWeek(w)!), dates: null };
}

export type Delta = { kind: 'pct' | 'pp' | 'new' | 'none'; value: number; good: boolean | null };

export function delta(cur: Totals, prev: Totals, id: MetricId): Delta {
  const a = metric(cur, id), b = metric(prev, id), def = METRICS[id];
  if (Number.isNaN(a) || Number.isNaN(b)) return { kind: 'none', value: NaN, good: null };
  const judge = (up: boolean) => (def.better === 'neutral' ? null : def.better === 'up' ? up : !up);
  if (def.kind === 'rate') {
    const v = (a - b) * 100;
    return { kind: 'pp', value: v, good: Math.abs(v) < 0.05 ? null : judge(v > 0) };
  }
  if (b === 0) return a === 0 ? { kind: 'none', value: 0, good: null } : { kind: 'new', value: NaN, good: judge(true) };
  const v = ((a - b) / Math.abs(b)) * 100;
  return { kind: 'pct', value: v, good: Math.abs(v) < 0.5 ? null : judge(v > 0) };
}
