// Budget reallocation suggestions: within a school (and market / channel), move budget from the least to the most
// efficient option on cost per good lead. Evidence window: last 28 days (L28) vs the 28 before (P28), ACT only.
import { aggregate, emptyTotals, metric, type Filter, type Totals } from './agg';
import type { Dim, Store } from './data';
import { refDate, addDays, baseAd, parseCampaign } from './rules';
import { label } from './format';
import { googleIntentOf, marketName, programOf, themeOf } from './names';

export interface ReallocSpec { dim: Dim; within: Dim[]; name: string }
export interface Option { key: string; t: Totals; p: Totals; cpgl: number; cpl: number; glr: number; share: number }
export interface Suggestion {
  id: string; spec: ReallocSpec; group: string[]; groupLabel: string; from: Option; to: Option;
  moveWeek: number; forecast: { lost: number; gained: number; net: number; cpglBefore: number; cpglAfter: number };
  confidence: 'High' | 'Medium' | 'Low'; recommendation: 'Recommended' | 'Test with half' ; why: string; insight: string; risk: string;
  dims: Partial<Record<Dim, string[]>>;
}

const DECAY = 1.15; // extra budget on the better option is assumed 15% less efficient (diminishing returns)
const range = (end: string, n: number) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
/** Campaigns are named by what they target: Google keyword theme, Meta program target (e.g. "Parents (all programmes)"). */
export const campName = (c: string) => (/_GA_|_PMax_|_YT_|_GDN_/i.test(c) ? googleIntentOf(c) : programOf(c)) || c;
export const optName = (d: Dim, v: string) => (d === 'market' ? marketName(v) : d === 'campaign' ? `${campName(v)} campaign` : label(v));
const nm = optName;
const f0 = (v: number) => (Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '–');
const pct = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '–');
const trend = (a: number, b: number) => (Number.isFinite(a) && Number.isFinite(b) && b > 0 ? (a - b) / b : NaN);

export function reallocSuggestions(s: Store, baseDims: Filter['dims'], specs: ReallocSpec[], max = 12): Suggestion[] {
  const y = refDate(s.lastDate);
  const L = range(y, 28), P = range(addDays(y, -28), 28);
  const f = (dates: string[]): Filter => ({ cycle: '*', weeks: null, months: null, dims: baseDims, dates });
  const out: Suggestion[] = [];
  for (const spec of specs) {
    const by = [...spec.within, spec.dim];
    const cur = aggregate(s, f(L), by), prev = aggregate(s, f(P), by);
    const groups = new Map<string, Option[]>();
    for (const [k, t] of cur) {
      const parts = k.split('\u0001');
      if (parts.some((x) => !x)) continue;
      const g = parts.slice(0, -1).join('\u0001'), o = parts.at(-1)!;
      if (t.cost < 100) continue;
      const p = prev.get(k) ?? emptyTotals();
      (groups.get(g) ?? groups.set(g, []).get(g)!).push({ key: o, t, p, cpgl: metric(t, 'cpgl'), cpl: metric(t, 'cpl'), glr: metric(t, 'glRate'), share: 0 });
    }
    for (const [g, opts] of groups) {
      if (opts.length < 2) continue;
      const tot = opts.reduce((a, o) => { a.cost += o.t.cost; a.gl += o.t.gl; return a; }, { cost: 0, gl: 0 });
      opts.forEach((o) => { o.share = o.t.cost / tot.cost; });
      const avg = tot.gl ? tot.cost / tot.gl : NaN;
      const best = opts.filter((o) => o.t.gl >= 3).sort((a, b) => a.cpgl - b.cpgl)[0];
      if (!best) continue;
      const worst = opts.filter((o) => o.key !== best.key && ((o.t.gl >= 1 && o.cpgl >= 1.4 * best.cpgl) || (o.t.gl === 0 && o.t.cost >= Math.max(150, Number.isFinite(avg) ? avg : 150))))
        .sort((a, b) => (b.t.gl === 0 ? Infinity : b.cpgl) - (a.t.gl === 0 ? Infinity : a.cpgl))[0];
      if (!worst) continue;
      const moveWeek = (worst.t.cost / 4) * 0.25;
      const move4 = moveWeek * 4;
      const lost = worst.t.gl ? move4 / worst.cpgl : 0, gained = move4 / (best.cpgl * DECAY), net = gained - lost;
      const cpglAfter = tot.cost / (tot.gl + net);
      const bestTrend = trend(best.cpgl, metric(best.p, 'cpgl')), worstTrend = trend(worst.cpgl, metric(worst.p, 'cpgl'));
      const confidence: Suggestion['confidence'] = best.t.gl >= 5 && (worst.t.gl >= 3 || worst.t.gl === 0) && !(bestTrend > 0.2) ? 'High' : best.t.gl >= 3 ? 'Medium' : 'Low';
      if (net < 0.3) continue;
      const demandCapped = /brand/i.test(best.key);
      const recommendation: Suggestion['recommendation'] = !demandCapped && confidence !== 'Low' && net >= 1 ? 'Recommended' : 'Test with half';
      const gParts = g.split('\u0001'), groupLabel = gParts.map((v, i) => nm(spec.within[i], v)).join(' · ');
      const ratio = worst.t.gl ? worst.cpgl / best.cpgl : Infinity;
      const why = worst.t.gl === 0
        ? `In ${groupLabel}, ${nm(spec.dim, worst.key)} spent CHF ${f0(worst.t.cost)} in the last 4 weeks without a single good lead (${f0(worst.t.leads)} leads), while ${nm(spec.dim, best.key)} delivered ${f0(best.t.gl)} good leads at CHF ${f0(best.cpgl)} each.`
        : `In ${groupLabel}, ${nm(spec.dim, worst.key)} costs CHF ${f0(worst.cpgl)} per good lead (${f0(worst.t.gl)} GL from CHF ${f0(worst.t.cost)}) vs CHF ${f0(best.cpgl)} for ${nm(spec.dim, best.key)} (${f0(best.t.gl)} GL from CHF ${f0(best.t.cost)}) — ${ratio.toFixed(1)}× more expensive over the last 4 weeks.`;
      const insight = [
        Number.isFinite(worst.cpl) && Number.isFinite(best.cpl) && worst.cpl <= best.cpl * 1.1 && worst.glr < best.glr * 0.7
          ? `It is a quality problem, not a cost problem: ${nm(spec.dim, worst.key)} buys leads at CHF ${f0(worst.cpl)} (similar or cheaper) but only ${pct(worst.glr)} qualify vs ${pct(best.glr)}.`
          : `It is a cost problem: ${nm(spec.dim, worst.key)} pays CHF ${f0(worst.cpl)} per lead vs CHF ${f0(best.cpl)}${Number.isFinite(worst.glr) ? `, with a GL rate of ${pct(worst.glr)} vs ${pct(best.glr)}` : ''}.`,
        `${nm(spec.dim, best.key)} has ${(best.share * 100).toFixed(0)}% of this spend${best.share < 0.35 ? ', so there is room to scale' : ', so extra budget may saturate it — scale in steps'}.`,
        Number.isFinite(bestTrend) ? `Its cost per good lead ${bestTrend <= 0 ? 'improved' : 'rose'} ${Math.abs(bestTrend * 100).toFixed(0)}% vs the previous 4 weeks.` : '',
        Number.isFinite(worstTrend) && worstTrend > 0.2 ? `${nm(spec.dim, worst.key)} is also getting worse (${(worstTrend * 100).toFixed(0)}% costlier than the previous 4 weeks).` : '',
      ].filter(Boolean).join(' ');
      const risk = demandCapped ? 'Brand search is limited by how many people search the brand: extra budget only helps if the brand campaign is losing impression share to budget. Check "Search lost IS (budget)" in Google Ads first; otherwise move the money to the next-best option.' : confidence === 'Low' ? 'Few good leads behind this read — test with half the amount for 2 weeks.' : `Assumes the extra budget on ${nm(spec.dim, best.key)} performs 15% worse than today (diminishing returns); good leads lag, so judge after 2–3 weeks.`;
      const dims: Suggestion['dims'] = { ...baseDims };
      spec.within.forEach((d, i) => { dims[d] = [gParts[i]]; });
      out.push({ id: `realloc|${spec.dim}|${g}|${worst.key}|${best.key}`, spec, group: gParts, groupLabel, from: worst, to: best, moveWeek,
        forecast: { lost, gained, net, cpglBefore: avg, cpglAfter }, confidence: demandCapped ? 'Low' : confidence, recommendation, why, insight, risk, dims });
    }
  }
  // one suggestion per group (e.g. one per school · country · channel) — keep the biggest gain
  const seen = new Set<string>();
  return out.sort((a, b) => b.forecast.net - a.forecast.net).filter((x) => { const k = `${x.spec.dim}|${x.group.join('|')}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, max);
}

// Budget moves between campaigns of the same school × country × channel (each campaign = one program target or
// keyword theme). Target audiences (Meta ad sets) only move inside one campaign. Ads / themes are switched off / on.
const LINE: Dim[] = ['school', 'market', 'channel'];
const CAMPAIGN: ReallocSpec = { dim: 'campaign', within: LINE, name: 'Campaign → campaign' };
export const BOSS_SPECS: ReallocSpec[] = [CAMPAIGN];
export const GOOGLE_SPECS: ReallocSpec[] = [CAMPAIGN];
export const META_SPECS: ReallocSpec[] = [CAMPAIGN, { dim: 'audience', within: [...LINE, 'campaign'], name: 'Target audience (ad set) inside one campaign' }];

// ---------------------------------------------------------------- inside a campaign: ads and themes off / on

export interface AdStat { ad: string; theme: string; cost: number; leads: number; gl: number; app: number; acc: number; cpgl: number; cpl: number }
export interface OnOff {
  id: string; school: string; market: string; campaign: string; camp: AdStat;
  off: AdStat[]; on: AdStat[]; themesOff: string[]; themesOn: string[];
  forecast: { freed: number; lost: number; gained: number; net: number };
  confidence: 'High' | 'Medium' | 'Low'; why: string; insight: string; risk: string; dims: Partial<Record<Dim, string[]>>;
}

const stat = (ad: string, theme: string, t: { cost: number; leads: number; gl: number; app: number; acc: number }): AdStat => ({ ad, theme, ...t, cpgl: t.gl ? t.cost / t.gl : NaN, cpl: t.leads ? t.cost / t.leads : NaN });

/** Meta campaigns: which ads (and whole themes) to switch off and which to keep on, last 28 days, ad-name variants merged. */
export function onOffSuggestions(s: Store, baseDims: Filter['dims'], max = 10): OnOff[] {
  const y = refDate(s.lastDate);
  const f: Filter = { cycle: '*', weeks: null, months: null, dims: { ...baseDims, channel: ['Meta'] }, dates: range(y, 28) };
  const by = aggregate(s, f, ['campaign', 'ad']);
  const camps = new Map<string, Map<string, { cost: number; leads: number; gl: number; app: number; acc: number }>>();
  for (const [k, t] of by) {
    const [c, a] = k.split('\u0001');
    if (!c || !a) continue;
    const m = camps.get(c) ?? camps.set(c, new Map()).get(c)!;
    const b = baseAd(a), x = m.get(b) ?? m.set(b, { cost: 0, leads: 0, gl: 0, app: 0, acc: 0 }).get(b)!;
    x.cost += t.cost; x.leads += t.leads; x.gl += t.gl; x.app += t.app; x.acc += t.acc;
  }
  const out: OnOff[] = [];
  for (const [campaign, ads] of camps) {
    const list = [...ads.entries()].map(([a, t]) => stat(a, themeOf(a), t));
    const tot = list.reduce((a, x) => ({ cost: a.cost + x.cost, leads: a.leads + x.leads, gl: a.gl + x.gl, app: a.app + x.app, acc: a.acc + x.acc }), { cost: 0, leads: 0, gl: 0, app: 0, acc: 0 });
    if (tot.cost < 200 || list.length < 2) continue;
    const camp = stat(campaign, '', tot);
    const ref = Number.isFinite(camp.cpgl) ? camp.cpgl : NaN;
    const off = list.filter((a) => (a.gl === 0 && a.cost >= Math.max(60, Number.isFinite(ref) ? ref : 100)) || (a.gl >= 1 && Number.isFinite(ref) && a.cpgl >= 1.6 * ref && a.cost >= 100)).sort((a, b) => b.cost - a.cost);
    const on = list.filter((a) => a.gl >= 2 && Number.isFinite(ref) && a.cpgl <= ref).sort((a, b) => a.cpgl - b.cpgl);
    if (!off.length || !on.length) continue;
    const themes = new Map<string, { cost: number; leads: number; gl: number }>();
    for (const a of list) { const t = themes.get(a.theme) ?? themes.set(a.theme, { cost: 0, leads: 0, gl: 0 }).get(a.theme)!; t.cost += a.cost; t.leads += a.leads; t.gl += a.gl; }
    const offSet = new Set(off.map((a) => a.ad));
    const themesOff = [...themes.keys()].filter((th) => list.filter((a) => a.theme === th).every((a) => offSet.has(a.ad)));
    const themesOn = [...themes.entries()].filter(([, t]) => t.gl >= 3 && Number.isFinite(ref) && t.cost / t.gl <= 0.8 * ref).map(([th]) => th);
    const freed = off.reduce((a, x) => a + x.cost, 0), lost = off.reduce((a, x) => a + x.gl, 0);
    const onT = on.reduce((a, x) => ({ cost: a.cost + x.cost, gl: a.gl + x.gl }), { cost: 0, gl: 0 });
    const onCpgl = onT.cost / onT.gl, gained = freed / (onCpgl * DECAY), net = gained - lost;
    if (net < 0.3) continue;
    const { school, country } = parseCampaign(campaign);
    const confidence: OnOff['confidence'] = onT.gl >= 6 && freed >= 200 ? 'High' : onT.gl >= 3 ? 'Medium' : 'Low';
    const why = `${off.length} ad${off.length > 1 ? 's' : ''} took CHF ${f0(freed)} (${Math.round((freed / tot.cost) * 100)}% of the campaign) in the last 4 weeks for ${lost} good lead${lost === 1 ? '' : 's'}, while ${on.length} ad${on.length > 1 ? 's' : ''} brought ${onT.gl} good leads at CHF ${f0(onCpgl)} each (campaign average CHF ${f0(camp.cpgl)}).`;
    const qual = off.filter((a) => a.leads >= 5 && a.gl === 0);
    const insight = [
      themesOff.length ? `Whole theme${themesOff.length > 1 ? 's' : ''} not working here: ${themesOff.join(', ')} — switch the theme off, not only single ads.` : '',
      themesOn.length ? `Theme${themesOn.length > 1 ? 's' : ''} that qualify best: ${themesOn.join(', ')} — new creatives should follow ${themesOn.length > 1 ? 'these' : 'this'}.` : '',
      qual.length ? `${qual.map((a) => a.ad).slice(0, 2).join(', ')} bring leads (${qual.reduce((a, x) => a + x.leads, 0)}) but none qualify — cheap clicks from the wrong people.` : '',
      'Meta moves the ad-set budget to the remaining ads by itself once the weak ones are off; the campaign budget does not change.',
    ].filter(Boolean).join(' ');
    const risk = confidence === 'Low' ? 'Few good leads behind the winners — switch off only the zero-good-lead ads first and read again in 2 weeks.' : 'Keep at least 3–4 ads live per ad set so delivery does not concentrate on one creative; good leads lag, so judge after 2 weeks.';
    out.push({ id: `onoff|${campaign}|${off.map((a) => a.ad).join(',')}`, school, market: country, campaign, camp, off, on, themesOff, themesOn,
      forecast: { freed, lost, gained, net }, confidence, why, insight, risk, dims: { ...baseDims, channel: ['Meta'], campaign: [campaign] } });
  }
  return out.sort((a, b) => b.forecast.net - a.forecast.net).slice(0, max);
}
