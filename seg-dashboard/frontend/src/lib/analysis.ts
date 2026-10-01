import { type Dim, type Store, isoWeek, weekDays } from './data';
import { aggregate, emptyTotals, metric, weekComplete, cycleWeeks, type Filter, type Totals } from './agg';

export type Verdict = 'Better' | 'Worse' | 'Mixed' | 'Stable' | 'Low volume';
export interface SegmentResult { key: string; cur: Totals; prev: Totals; verdict: Verdict; note: string }
export interface Window { label: string; curLabel: string; prevLabel: string; rows: SegmentResult[]; total: SegmentResult }

const THRESH = 0.1;       // ±10% on score or cost per score point
const MIN_SCORE = 10;     // below this on both sides the change is noise

const pct = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : a ? Infinity : 0);

/** Priority: funnel score volume and cost per score point (SEG weighted rule). CTR/CVR are supporting signals. */
export function classify(cur: Totals, prev: Totals): { verdict: Verdict; note: string } {
  const sc = metric(cur, 'score'), sp = metric(prev, 'score');
  if (sc < MIN_SCORE && sp < MIN_SCORE) return { verdict: 'Low volume', note: `Score ${sc.toFixed(0)} vs ${sp.toFixed(0)} — too small to judge` };
  const dv = pct(sc, sp);
  const ec = metric(cur, 'cpScore'), ep = metric(prev, 'cpScore');
  const de = Number.isFinite(ec) && Number.isFinite(ep) ? pct(ec, ep) : 0;
  const volUp = dv >= THRESH, volDown = dv <= -THRESH, effUp = de <= -THRESH, effDown = de >= THRESH;
  let verdict: Verdict = 'Stable';
  if ((volUp && !effDown) || (effUp && !volDown)) verdict = 'Better';
  if ((volDown && !effUp) || (effDown && !volUp)) verdict = verdict === 'Better' ? 'Mixed' : 'Worse';
  if ((volUp && effDown) || (volDown && effUp)) verdict = 'Mixed';
  return { verdict, note: suggest(cur, prev, verdict) };
}

function suggest(cur: Totals, prev: Totals, v: Verdict): string {
  const d = (id: Parameters<typeof metric>[1]) => pct(metric(cur, id), metric(prev, id));
  const f = (x: number) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)}%` : 'new');
  const ctr = d('ctr'), cvr = d('leadCvr'), gl = d('glRate'), cpm = d('cpm');
  if (ctr > THRESH && cvr < -THRESH) return `CTR ${f(ctr)} but Lead CVR ${f(cvr)}: check landing page and form journey.`;
  if (cvr > -THRESH && gl < -THRESH) return `Leads holding but Good Lead rate ${f(gl)}: check targeting/audience quality.`;
  if (cpm > THRESH && v !== 'Better') return `CPM ${f(cpm)}: check auction pressure, frequency or narrow audiences.`;
  if (v === 'Better') return `Funnel score ${f(d('score'))}, cost per point ${f(d('cpScore'))}: candidate for more budget.`;
  if (v === 'Worse') return `Funnel score ${f(d('score'))}, cost per point ${f(d('cpScore'))}: review creatives and bids.`;
  return `Score ${f(d('score'))}, cost per point ${f(d('cpScore'))}.`;
}

function build(s: Store, fc: Filter, fp: Filter, by: Dim, meta: Omit<Window, 'rows' | 'total'>): Window {
  const cur = aggregate(s, fc, [by]), prev = aggregate(s, fp, [by]);
  const keys = new Set([...cur.keys(), ...prev.keys()]);
  const rows = [...keys].map((key) => {
    const c = cur.get(key) ?? emptyTotals(), p = prev.get(key) ?? emptyTotals();
    return { key, cur: c, prev: p, ...classify(c, p) };
  }).sort((a, b) => metric(b.cur, 'score') + metric(b.prev, 'score') - metric(a.cur, 'score') - metric(a.prev, 'score'));
  const tc = aggregate(s, fc).get('') ?? emptyTotals(), tp = aggregate(s, fp).get('') ?? emptyTotals();
  return { ...meta, rows, total: { key: 'Total', cur: tc, prev: tp, ...classify(tc, tp) } };
}

/** Latest week vs the week before, matched on the same weekdays when the latest week is partial. */
export function latestWoW(s: Store, f: Filter, by: Dim): Window | null {
  const lw = isoWeek(s.lastDate);
  const days = weekDays(lw).filter((d) => d <= s.lastDate);
  const prevDays = weekDays(lw).map((d) => new Date(Date.parse(d + 'T00:00:00Z') - 7 * 86400000).toISOString().slice(0, 10)).slice(0, days.length);
  const pw = isoWeek(prevDays[0]);
  const hasDaily = (ds: string[]) => ds.every((d) => s.dates.includes(d));
  if (!hasDaily(days) || !hasDaily(prevDays)) return null;
  const partial = days.length < 7 ? ` (${days.length} days: ${days[0].slice(5)}–${days.at(-1)!.slice(5)} vs same weekdays)` : '';
  return build(s, { ...f, weeks: [lw], dates: days }, { ...f, weeks: [pw], dates: prevDays }, by,
    { label: `Latest WoW${partial}`, curLabel: lw, prevLabel: pw });
}

/** Last 4 complete weeks vs the 4 complete weeks before them, inside the selected cycle. */
export function fourWeek(s: Store, f: Filter, by: Dim): Window | null {
  const done = cycleWeeks(s, f.cycle).filter((w) => weekComplete(w, f.cycle, s.lastDate));
  if (done.length < 8) return null;
  const cur = done.slice(-4), prev = done.slice(-8, -4);
  return build(s, { ...f, weeks: cur }, { ...f, weeks: prev }, by,
    { label: '4-week trend', curLabel: `${cur[0]}–${cur[3]}`, prevLabel: `${prev[0]}–${prev[3]}` });
}
