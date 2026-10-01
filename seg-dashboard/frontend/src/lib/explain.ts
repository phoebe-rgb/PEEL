// "What happened → why → what next" for any row (school, country, channel, campaign, audience…), from the current vs comparison totals.
import { aggregate, emptyTotals, metric, type Filter, type Totals } from './agg';
import type { Dim, Store } from './data';
import { classify, type Verdict } from './analysis';
import { label } from './format';
import { marketName } from './names';
const nameOf = (k: string) => (/^[A-Z0-9]{2,6}$/.test(k) ? marketName(k) : label(k));

const pc = (a: number, b: number) => (Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a - b) / Math.abs(b) : NaN);
export const sgn = (v: number) => (Number.isFinite(v) ? `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)}%` : 'new');
const chf = (v: number) => (Number.isFinite(v) ? `CHF ${v >= 100 ? v.toFixed(0) : v.toFixed(1)}` : '–');

export interface Kid { key: string; cur: Totals; ref?: Totals }
export interface Explained { verdict: Verdict; what: string; why: string; next: string }

export function explain(cur: Totals, ref: Totals | undefined, kids: Kid[], kidLabel = '', allowShift = true): Explained {
  const prev = ref ?? emptyTotals();
  const { verdict } = classify(cur, prev);
  const what = `Good Leads ${prev.gl.toFixed(0)} → ${cur.gl.toFixed(0)} (${sgn(pc(cur.gl, prev.gl))}), CPGL ${chf(metric(cur, 'cpgl'))} (${sgn(pc(metric(cur, 'cpgl'), metric(prev, 'cpgl')))}); Leads ${sgn(pc(cur.leads, prev.leads))} at CPL ${chf(metric(cur, 'cpl'))}; spend ${sgn(pc(cur.cost, prev.cost))}.`;
  const why: string[] = [];
  if (cur.clicks > 0 && prev.clicks > 0 && Math.abs(pc(metric(cur, 'cpl'), metric(prev, 'cpl'))) >= 0.1) {
    const parts = [
      { k: 'cpm', v: pc(metric(cur, 'cpm'), metric(prev, 'cpm')), t: 'CPM' },
      { k: 'ctr', v: -pc(metric(cur, 'ctr'), metric(prev, 'ctr')), t: 'CTR' },
      { k: 'cvr', v: -pc(metric(cur, 'leadCvr'), metric(prev, 'leadCvr')), t: 'click→lead' },
    ].filter((x) => Number.isFinite(x.v)).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    if (parts[0]) {
      const real = parts[0].k === 'cpm' ? parts[0].v : -parts[0].v;
      why.push(`CPL ${pc(metric(cur, 'cpl'), metric(prev, 'cpl')) > 0 ? 'rose' : 'fell'} mostly via ${parts[0].t} ${sgn(real)}.`);
    }
  }
  const moves = kids.map((k) => ({ k: k.key.split('\u0001').at(-1)!, dg: k.cur.gl - (k.ref?.gl ?? 0), t: k.cur })).filter((x) => x.dg !== 0);
  const up = cur.gl >= prev.gl;
  const driver = moves.sort((a, b) => (up ? b.dg - a.dg : a.dg - b.dg))[0];
  if (driver) why.push(`Most of the ${up ? 'gain' : 'drop'} came from ${kidLabel ? `${kidLabel} ` : ''}${nameOf(driver.k)} (${driver.dg > 0 ? '+' : ''}${driver.dg.toFixed(0)} GL).`);
  // next
  const avg = metric(cur, 'cpgl');
  const good = kids.filter((k) => k.cur.gl >= 3 && Number.isFinite(avg) && metric(k.cur, 'cpgl') <= 0.75 * avg).sort((a, b) => metric(a.cur, 'cpgl') - metric(b.cur, 'cpgl'))[0];
  const bad = kids.filter((k) => k.cur.cost >= 50 && (k.cur.gl === 0 ? k.cur.cost >= (Number.isFinite(avg) ? avg : 100) : metric(k.cur, 'cpgl') >= 1.5 * avg)).sort((a, b) => b.cur.cost - a.cur.cost)[0];
  let next = '';
  if (metric(cur, 'score') < 10 && metric(prev, 'score') < 10) next = 'Too little volume to act on — read again next period.';
  else if (allowShift && bad && good && bad.key !== good.key) next = `Shift budget from ${nameOf(bad.key.split('\u0001').at(-1)!)} (CPGL ${chf(metric(bad.cur, 'cpgl'))}) to ${nameOf(good.key.split('\u0001').at(-1)!)} (CPGL ${chf(metric(good.cur, 'cpgl'))}).`;
  else if (verdict === 'Worse') next = cur.gl === 0 && cur.leads > 5 ? 'Leads are not qualifying: tighten targeting / form.' : 'Review creatives, audiences and search terms before adding budget.';
  else if (verdict === 'Better') next = good ? `Hold; scale ${nameOf(good.key.split('\u0001').at(-1)!)} carefully (+10–20%).` : 'Hold budget; it is working.';
  else if (verdict === 'Mixed') next = 'Volume and efficiency moved apart — check which lever changed before acting.';
  else next = 'Stable — no change needed.';
  return { verdict, what, why: why.join(' '), next };
}

export interface Realloc { group: string; from: string; to: string; move: number; fromCpgl: number; toCpgl: number; extraGl: number }

/** Within each group (e.g. school), suggest moving budget from the least to the most efficient option (Good-Lead cost). */
export function reallocations(s: Store, f: Filter, group: Dim | null, option: Dim, minGl = 3, share = 0.2): Realloc[] {
  const by = group ? [group, option] : [option];
  const m = aggregate(s, f, by);
  const groups = new Map<string, { key: string; t: Totals }[]>();
  for (const [k, t] of m) {
    const parts = k.split('\u0001'), g = group ? parts[0] : 'All', o = parts.at(-1)!;
    if (!o || t.cost <= 0) continue;
    (groups.get(g) ?? groups.set(g, []).get(g)!).push({ key: o, t });
  }
  const out: Realloc[] = [];
  for (const [g, opts] of groups) {
    const scored = opts.filter((o) => o.t.gl >= minGl).map((o) => ({ ...o, c: metric(o.t, 'cpgl') })).sort((a, b) => a.c - b.c);
    const zero = opts.filter((o) => o.t.gl === 0 && o.t.cost >= 200).sort((a, b) => b.t.cost - a.t.cost)[0];
    const best = scored[0];
    const worst = zero ? { ...zero, c: Infinity } : scored.at(-1);
    if (!best || !worst || best.key === worst.key) continue;
    if (Number.isFinite(worst.c) && worst.c < best.c * 1.4) continue; // not different enough
    const move = worst.t.cost * share;
    const extraGl = move / best.c - (Number.isFinite(worst.c) ? move / worst.c : 0);
    out.push({ group: g, from: worst.key, to: best.key, move, fromCpgl: worst.c, toCpgl: best.c, extraGl });
  }
  return out.sort((a, b) => b.extraGl - a.extraGl);
}
