// Deterministic narrative helpers. Every sentence is computed from the same aggregates the tables show.
import { type Dim, type Store } from './data';
import { aggregate, emptyTotals, metric, type Filter, type MetricId, type Totals } from './agg';
import { parseCampaign, type Benchmarks } from './rules';
import { label } from './format';

const pct0 = (v: number) => `${(v * 100).toFixed(0)}%`;
const signedPct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)}%`;

// ---------------------------------------------------------------- quantity vs quality (Good Lead / Lead)

export interface QQRow { key: string; leads: number; leadShare: number; gl: number; glShare: number; rate: number; vsAvg: number; quality: 'Low quality' | 'High quality' | 'In line' | 'Too few leads' }
export const QQ_MIN_LEADS = 20;

export function quantityQuality(s: Store, f: Filter, dim: Dim) {
  const m = aggregate(s, f, [dim]);
  let L = 0, G = 0;
  for (const t of m.values()) { L += t.leads; G += t.gl; }
  const avg = L ? G / L : 0;
  const rows: QQRow[] = [...m.entries()].filter(([, t]) => t.leads > 0).map(([key, t]) => {
    const rate = t.leads ? t.gl / t.leads : 0, vsAvg = avg ? rate / avg - 1 : 0;
    const quality: QQRow['quality'] = t.leads < QQ_MIN_LEADS ? 'Too few leads' : vsAvg <= -0.2 ? 'Low quality' : vsAvg >= 0.2 ? 'High quality' : 'In line';
    return { key, leads: t.leads, leadShare: t.leads / L, gl: t.gl, glShare: G ? t.gl / G : 0, rate, vsAvg, quality };
  }).sort((a, b) => b.leads - a.leads);
  const judged = rows.filter((r) => r.leads >= QQ_MIN_LEADS);
  const most = rows[0];
  const concern = judged.filter((r) => r.leadShare >= 0.1 && r.vsAvg <= -0.2).sort((a, b) => b.leadShare - a.leadShare)[0];
  const best = [...judged].sort((a, b) => b.rate - a.rate)[0];
  const parts: string[] = [];
  if (most) parts.push(`Quantity: ${label(most.key)} brings the most leads (${pct0(most.leadShare)}).`);
  if (concern) parts.push(`Quality concern: ${label(concern.key)} brings ${pct0(concern.leadShare)} of leads but only ${pct0(concern.glShare)} of Good Leads; GL/Lead ${pct0(concern.rate)} vs ${pct0(avg)} average (${signedPct(concern.vsAvg)}).`);
  if (best && best !== concern) parts.push(`Best quality: ${label(best.key)}, GL/Lead ${pct0(best.rate)} (${signedPct(best.vsAvg)} vs average) from ${pct0(best.leadShare)} of leads.`);
  if (!rows.length) parts.push('No leads in this view.');
  return { rows, avg, text: parts.join(' ') };
}

// ---------------------------------------------------------------- efficiency index

export function efficiency(s: Store, f: Filter, dim: Dim) {
  const m = aggregate(s, f, [dim]);
  let C = 0, L = 0, G = 0;
  for (const t of m.values()) { C += t.cost; L += t.leads; G += t.gl; }
  const rows = [...m.entries()].filter(([, t]) => t.cost > 0).map(([key, t]) => ({
    key, spendShare: t.cost / C, leadIdx: L ? (t.leads / L) / (t.cost / C) : NaN, glIdx: G ? (t.gl / G) / (t.cost / C) : NaN, t,
  })).sort((a, b) => b.spendShare - a.spendShare);
  const sig = rows.filter((r) => r.spendShare >= 0.02);
  const say = (k: 'leadIdx' | 'glIdx', name: string, share: (t: Totals) => number, tot: number) => {
    const ok = sig.filter((r) => Number.isFinite(r[k]));
    if (ok.length < 2) return '';
    const hi = ok.reduce((a, b) => (b[k] > a[k] ? b : a)), lo = ok.reduce((a, b) => (b[k] < a[k] ? b : a));
    return `${name}: ${label(hi.key)} brings ${pct0(share(hi.t) / tot)} of ${name.toLowerCase()} from ${pct0(hi.spendShare)} of spend (${hi[k].toFixed(1)}×); ${label(lo.key)} is lowest at ${lo[k].toFixed(1)}×.`;
  };
  const text = rows.length < 2 ? 'Only one value in view, so there is nothing to compare.'
    : [say('leadIdx', 'Leads', (t) => t.leads, L || 1), say('glIdx', 'Good Leads', (t) => t.gl, G || 1)].filter(Boolean).join(' ');
  return { rows, text };
}

// ---------------------------------------------------------------- best / weakest by country (at a glance)

export function bestWeakest(s: Store, f: Filter, dim: Dim, id: MetricId, minSpend = 100) {
  const m = aggregate(s, f, [dim]);
  const rows = [...m.entries()].filter(([, t]) => t.cost >= minSpend).map(([k, t]) => ({ k, v: metric(t, id) })).filter((r) => Number.isFinite(r.v));
  if (rows.length < 2) return null;
  const lowerBetter = ['cpl', 'cpgl', 'cpreg', 'cpapp', 'cpacc', 'cpc', 'cpm', 'cpScore'].includes(id);
  rows.sort((a, b) => (lowerBetter ? a.v - b.v : b.v - a.v));
  return { best: rows[0], weakest: rows.at(-1)!, n: rows.length };
}

export function topShares(s: Store, f: Filter, dim: Dim, id: 'cost' | 'leads' | 'gl') {
  const m = aggregate(s, f, [dim]);
  let T = 0; for (const t of m.values()) T += t[id];
  return [...m.entries()].map(([k, t]) => ({ k, share: T ? t[id] / T : 0 })).sort((a, b) => b.share - a.share).slice(0, 2);
}

// ---------------------------------------------------------------- trend notes

/** Peak and biggest step change in a weekly series, with the channel that drove the step. */
export function trendNote(s: Store, f: Filter, weeks: string[], id: MetricId, driverDim: Dim = 'channel'): string {
  const byW = aggregate(s, { ...f, weeks }, ['week']);
  const vals = weeks.map((w) => ({ w, v: metric(byW.get(w) ?? emptyTotals(), id) })).filter((x) => Number.isFinite(x.v));
  if (vals.length < 2) return '';
  const peak = vals.reduce((a, b) => (b.v > a.v ? b : a));
  let step = { i: 1, d: 0 };
  for (let i = 1; i < vals.length; i++) { const d = vals[i].v - vals[i - 1].v; if (Math.abs(d) > Math.abs(step.d)) step = { i, d }; }
  const a = vals[step.i - 1], b = vals[step.i];
  const byD = aggregate(s, { ...f, weeks: [a.w, b.w] }, ['week', driverDim]);
  let driver = '', best = 0;
  const keys = new Set([...byD.keys()].map((k) => k.split('\u0001')[1]));
  for (const k of keys) {
    const va = byD.get(`${a.w}\u0001${k}`), vb = byD.get(`${b.w}\u0001${k}`);
    const dv = (vb ? vb[(['cost', 'impr', 'clicks', 'leads', 'gl', 'reg', 'app', 'acc'].includes(id) ? id : 'cost') as 'cost'] : 0) - (va ? va[(['cost', 'impr', 'clicks', 'leads', 'gl', 'reg', 'app', 'acc'].includes(id) ? id : 'cost') as 'cost'] : 0);
    if (Math.abs(dv) > Math.abs(best)) { best = dv; driver = k; }
  }
  const fmtv = (v: number) => (['ctr', 'glRate', 'regRate', 'appRate', 'accRate', 'leadCvr'].includes(id) ? `${(v * 100).toFixed(1)}%` : v >= 100 ? v.toFixed(0) : v.toFixed(1));
  const ch = a.v ? (b.v - a.v) / Math.abs(a.v) : NaN;
  return `Peak in ${peak.w.slice(5)} (${fmtv(peak.v)}). Biggest step: ${b.w.slice(5)} ${step.d >= 0 ? 'rose' : 'fell'} ${Number.isFinite(ch) ? signedPct(ch) : ''} (${fmtv(a.v)} → ${fmtv(b.v)})${driver ? `, mostly ${label(driver)}` : ''}.`;
}

// ---------------------------------------------------------------- benchmark expectations

/**
 * Per row: expected leads / good leads / clicks for the row's spend at its School × market × channel benchmark
 * (Google → "Bench Mark", Meta → "Benchmark - FB"). Actuals are counted only on benchmarked campaigns so both sides match.
 */
export function benchExpect(s: Store, bench: Benchmarks) {
  const n = s.n;
  const out = { bCost: new Float64Array(n), bLeads: new Float64Array(n), bGl: new Float64Array(n), bClicks: new Float64Array(n), bImpr: new Float64Array(n), eLeads: new Float64Array(n), eGl: new Float64Array(n), eClicks: new Float64Array(n) };
  const cache = new Map<number, ReturnType<typeof benchFor>>();
  function benchFor(campIdx: number, chIdx: number) {
    const camp = s.dicts.campaign[campIdx], ch = s.dicts.channel[chIdx];
    if (!camp) return null;
    const p = parseCampaign(camp), src = ch === 'Google' ? bench.google : ch === 'Meta' ? bench.meta : null;
    return src?.[`${p.school}|${p.country}`] ?? null;
  }
  for (let i = 0; i < n; i++) {
    const key = s.dim.campaign[i] * 8 + s.dim.channel[i];
    let b = cache.get(key);
    if (b === undefined) { b = benchFor(s.dim.campaign[i], s.dim.channel[i]); cache.set(key, b); }
    if (!b) continue;
    const v = (k: 'cost' | 'leads' | 'gl' | 'clicks' | 'impr') => (Number.isNaN(s.m[k][i]) ? 0 : s.m[k][i]);
    const cost = v('cost');
    out.bCost[i] = cost; out.bLeads[i] = v('leads'); out.bGl[i] = v('gl'); out.bClicks[i] = v('clicks'); out.bImpr[i] = v('impr');
    if (b.cpl) out.eLeads[i] = cost / b.cpl;
    if (b.cpgl) out.eGl[i] = cost / b.cpgl;
    if (b.cpc) out.eClicks[i] = cost / b.cpc;
  }
  return out;
}
export type BenchArrays = ReturnType<typeof benchExpect>;
