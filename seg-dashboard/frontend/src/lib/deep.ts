// Deep insight for a drill-down row: what is going on (trend over three periods), why (which funnel lever moved,
// which audience / theme / ad / campaign drove it, what the specialist checks flag) and what to do next.
// Numbers are only used as evidence in brackets; the sentence carries the meaning.
import { aggregate, emptyTotals, metric, type Filter, type Totals } from './agg';
import type { Dim, Store } from './data';
import { classify, type Verdict } from './analysis';
import { label } from './format';
import { marketName } from './names';
import { campName } from './realloc';
import { baseAd, type GoogleResult, type MarketResult } from './rules';

export type Rag = 'red' | 'amber' | 'green' | 'grey';
export interface Deep { verdict: Verdict; rag: Rag; head: string; why: string[]; next: string[] }
export interface Sides { full: Totals; cur: Totals; prev?: Totals; prev2?: Totals }

const pc = (a: number, b: number) => (Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a - b) / Math.abs(b) : NaN);
const sg = (v: number) => (Number.isFinite(v) ? `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)}%` : 'new');
const chf = (v: number) => (Number.isFinite(v) ? `CHF ${v >= 100 ? v.toFixed(0) : v.toFixed(1)}` : '–');
const p1 = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '–');
const DRIVER_LABEL: Partial<Record<Dim, string>> = { subchannel: 'campaign type', audience: 'audience', theme: 'theme', campaign: 'campaign', ad: 'ad', program: 'program' };
export const DRIVERS: Dim[] = ['subchannel', 'audience', 'theme', 'campaign', 'ad'];
// brief (boss) = no ad-set / ad names: Meta by campaign and theme, Google by campaign type, keyword theme and campaign
const driversFor = (channel: string, brief: boolean): Dim[] => (channel === 'Meta' ? (brief ? ['campaign', 'theme'] : ['audience', 'theme', 'ad']) : channel === 'Google' ? ['subchannel', 'audience', 'campaign'] : ['campaign']);
const shortCamp = (c: string) => { const p = c.split('_'); return /^PL$/i.test(p[0] ?? '') && p.length > 6 ? p.slice(6).join('_') || c : c; };
const nameOf = (d: Dim, v: string) => (d === 'market' ? marketName(v) : d === 'campaign' ? campName(v) : label(v));

/** Good / watch / needs action for a row, judged against its parent's cost per good lead and its own trend. */
export function ragOf(full: Totals, cur: Totals, ref: Totals | undefined, parentCpgl: number): Rag {
  if (full.cost < 30 && full.leads < 3) return 'grey';
  const v = classify(cur, ref ?? emptyTotals()).verdict;
  const c = metric(full, 'cpgl');
  if ((full.gl === 0 && full.cost >= Math.max(100, Number.isFinite(parentCpgl) ? parentCpgl : 100)) || (full.gl >= 1 && Number.isFinite(parentCpgl) && c >= 1.4 * parentCpgl) || v === 'Worse') return 'red';
  if ((full.gl >= 3 && Number.isFinite(parentCpgl) && c <= 0.8 * parentCpgl) || v === 'Better') return 'green';
  return 'amber';
}

/** Three-period story on good leads (or leads when good leads are too few), plus the cost direction. */
function trendLine(x: Sides, p1Label: string): string {
  const useGl = Math.max(x.cur.gl, x.prev?.gl ?? 0, x.prev2?.gl ?? 0) >= 3;
  const k = useGl ? 'gl' : 'leads', noun = useGl ? 'Good leads' : 'Leads';
  const has = (t?: Totals) => !!t && (t.cost > 0 || t.leads > 0);
  const c = x.cur[k], b = has(x.prev) ? x.prev![k] : NaN, a = has(x.prev2) ? x.prev2![k] : NaN;
  const up = (m: number, n: number) => Number.isFinite(n) && m - n >= 2 && m > n * 1.1;
  const dn = (m: number, n: number) => Number.isFinite(n) && n - m >= 2 && m < n * 0.9;
  let t: string;
  if (!Number.isFinite(b)) t = `${noun}: no comparison period`;
  else if (dn(c, b) && dn(b, a)) t = `${noun} have fallen two periods in a row`;
  else if (up(c, b) && up(b, a)) t = `${noun} have grown two periods in a row`;
  else if (up(c, b) && dn(b, a)) t = `${noun} bounced back after a weak ${p1Label}${c >= a * 0.9 ? '' : ', but are still below two periods ago'}`;
  else if (dn(c, b) && up(b, a)) t = `${noun} gave back the gain of ${p1Label}`;
  else if (up(c, b)) t = `${noun} are up`;
  else if (dn(c, b)) t = `${noun} are down`;
  else t = `${noun} are flat`;
  const cost = pc(metric(x.cur, useGl ? 'cpgl' : 'cpl'), x.prev ? metric(x.prev, useGl ? 'cpgl' : 'cpl') : NaN);
  if (Number.isFinite(cost) && Math.abs(cost) >= 0.1) t += ` and each one costs ${cost > 0 ? 'more' : 'less'} (${useGl ? 'CPGL' : 'CPL'} ${sg(cost)})`;
  return `${t}.`;
}

interface Lever { k: string; v: number; bad: string; good: string; fix: string }
/** The funnel lever that moved most: reach cost, click appeal, click→lead, lead quality, follow-up. */
function levers(cur: Totals, prev: Totals, channel: string): Lever[] {
  const out: Lever[] = [];
  const add = (k: string, v: number, bad: string, good: string, fix: string) => { if (Number.isFinite(v) && Math.abs(v) >= 0.15) out.push({ k, v, bad, good, fix }); };
  const meta = channel === 'Meta';
  if (cur.impr >= 1000 && prev.impr >= 1000) {
    if (meta) add('cpm', -pc(metric(cur, 'cpm'), metric(prev, 'cpm')), `reaching people got more expensive (CPM ${sg(pc(metric(cur, 'cpm'), metric(prev, 'cpm')))}) — the audience is saturating or the auction is busier`, `reach got cheaper (CPM ${sg(pc(metric(cur, 'cpm'), metric(prev, 'cpm')))})`, 'Widen the audience or add fresh creatives; check frequency in Ads Manager.');
    else if (cur.clicks >= 30 && prev.clicks >= 30) add('cpc', -pc(metric(cur, 'cpc'), metric(prev, 'cpc')), `clicks cost more (CPC ${sg(pc(metric(cur, 'cpc'), metric(prev, 'cpc')))}) — more competition on these searches or a bid-strategy change`, `clicks got cheaper (CPC ${sg(pc(metric(cur, 'cpc'), metric(prev, 'cpc')))})`, 'Check search terms and add negatives; review the tCPA / bid strategy before adding budget.');
  }
  if (cur.clicks >= 30 && prev.clicks >= 30) {
    add('ctr', pc(metric(cur, 'ctr'), metric(prev, 'ctr')), meta ? `fewer people click (CTR ${sg(pc(metric(cur, 'ctr'), metric(prev, 'ctr')))}) — the creatives are wearing out` : `fewer searchers click (CTR ${sg(pc(metric(cur, 'ctr'), metric(prev, 'ctr')))}) — ads show on less relevant searches or lower positions`,
      `more people click (CTR ${sg(pc(metric(cur, 'ctr'), metric(prev, 'ctr')))}) — the current ${meta ? 'creatives' : 'ads'} land`, meta ? 'Rotate in new creatives for the weakest theme; pause ads whose CTR keeps falling.' : 'Tighten keywords / match types and refresh ad copy.');
    add('cvr', pc(metric(cur, 'leadCvr'), metric(prev, 'leadCvr')), `fewer clicks turn into leads (click→lead ${sg(pc(metric(cur, 'leadCvr'), metric(prev, 'leadCvr')))}) — landing page, form or tracking, or lower-intent traffic`,
      `more clicks turn into leads (click→lead ${sg(pc(metric(cur, 'leadCvr'), metric(prev, 'leadCvr')))})`, 'Test-submit the form, check the landing page and the UTM → Salesforce join.');
  }
  if (cur.leads >= 8 && prev.leads >= 8) add('gl', pc(metric(cur, 'glRate'), metric(prev, 'glRate')), `fewer leads qualify (GL rate ${p1(metric(prev, 'glRate'))} → ${p1(metric(cur, 'glRate'))}) — targeting is pulling in people who are not a fit`,
    `lead quality improved (GL rate ${p1(metric(prev, 'glRate'))} → ${p1(metric(cur, 'glRate'))})`, 'Tighten targeting (age, geo, interests) and add a qualifying question to the form.');
  if (cur.gl >= 5 && prev.gl >= 5) add('reg', pc(metric(cur, 'regRate'), metric(prev, 'regRate')), `good leads are not moving on to register (${p1(metric(prev, 'regRate'))} → ${p1(metric(cur, 'regRate'))}) — a follow-up issue, not media`,
    `more good leads register (${p1(metric(prev, 'regRate'))} → ${p1(metric(cur, 'regRate'))})`, 'Ask admissions to follow up this week\'s good leads.');
  return out;
}

export interface KidSet { cur: Map<string, Totals>; prev: Map<string, Totals> }
export interface DeepCtx {
  s: Store; hierarchy: Dim[]; p1Label: string;
  kids: Map<Dim, Map<string, { key: string; cur: Totals; prev: Totals }[]>>; // row key → driver kids
  google: GoogleResult[]; meta: MarketResult[];
}

/** Driver breakdown under every leaf row: one aggregation per driver dimension (ads merged across name variants). */
export function buildKids(s: Store, cur: Filter, prev: Filter | null, hierarchy: Dim[]): DeepCtx['kids'] {
  const out: DeepCtx['kids'] = new Map();
  for (const d of DRIVERS) {
    const by = [...hierarchy, d];
    const c = aggregate(s, cur, by), p = prev ? aggregate(s, prev, by) : new Map<string, Totals>();
    const m = new Map<string, Map<string, { key: string; cur: Totals; prev: Totals }>>();
    const put = (k: string, t: Totals, side: 'cur' | 'prev') => {
      const parts = k.split('\u0001'), v = parts.pop()!;
      if (!v) return;
      const row = parts.join('\u0001'), key = d === 'ad' ? baseAd(v) : v;
      const g = m.get(row) ?? m.set(row, new Map()).get(row)!;
      const x = g.get(key) ?? g.set(key, { key, cur: emptyTotals(), prev: emptyTotals() }).get(key)!;
      const tgt = x[side];
      for (const f of ['cost', 'impr', 'clicks', 'leads', 'gl', 'reg', 'app', 'acc'] as const) { tgt[f] += t[f]; if (t.avail[f]) tgt.avail[f] = true; }
    };
    for (const [k, t] of c) put(k, t, 'cur');
    for (const [k, t] of p) put(k, t, 'prev');
    out.set(d, new Map([...m.entries()].map(([k, g]) => [k, [...g.values()]])));
  }
  return out;
}

/** Leaf row (e.g. school × country × channel). */
export function deepLeaf(ctx: DeepCtx, rowKey: string, x: Sides, parentCpgl: number, brief = false): Deep {
  const parts = rowKey.split('\u0001');
  const val = (d: Dim) => parts[ctx.hierarchy.indexOf(d)] ?? '';
  const channel = val('channel') || (val('subchannel').startsWith('Google') ? 'Google' : val('subchannel'));
  const DL: Partial<Record<Dim, string>> = { ...DRIVER_LABEL, audience: channel === 'Google' ? 'keyword theme' : 'audience' };
  const prev = x.prev ?? emptyTotals();
  const { verdict } = classify(x.cur, prev);
  const rag = ragOf(x.full, x.cur, x.prev, parentCpgl);
  const why: string[] = [], next: string[] = [];
  if (verdict === 'Low volume' && x.full.cost < 50) return { verdict, rag, head: 'Too little spend to read.', why, next: ['No action — read again when it has spend.'] };
  const head = trendLine(x, ctx.p1Label);
  // 1. funnel lever
  const lv = levers(x.cur, prev, channel);
  const worst = lv.filter((l) => l.v < 0).sort((a, b) => a.v - b.v)[0], best = lv.filter((l) => l.v > 0).sort((a, b) => b.v - a.v)[0];
  if (worst && verdict !== 'Better') why.push(`Main reason: ${worst.bad}.`);
  else if (best && verdict === 'Better') why.push(`Main reason: ${best.good}.`);
  if (worst && verdict === 'Better' && worst.k === 'gl') why.push(`Watch: ${worst.bad}.`);
  // 2. drivers inside the row
  const rowCpgl = metric(x.full, 'cpgl');
  const up = x.cur.gl >= prev.gl;
  type Hit = { d: Dim; k: string; dg: number; t: Totals };
  let mover = null as Hit | null, waste = null as Hit | null, star = null as Hit | null;
  for (const d of driversFor(channel, brief)) {
    const ks = ctx.kids.get(d)?.get(rowKey) ?? [];
    if (ks.length < 2) continue;
    for (const k of ks) {
      const dg = k.cur.gl - k.prev.gl;
      if (dg !== 0 && (up ? dg > 0 : dg < 0) && (!mover || Math.abs(dg) > Math.abs(mover.dg) || (Math.abs(dg) === Math.abs(mover.dg) && d === 'ad'))) mover = { d, k: k.key, dg, t: k.cur };
      if (k.cur.gl === 0 && k.cur.cost >= Math.max(80, Number.isFinite(rowCpgl) ? rowCpgl : 80) && (!waste || k.cur.cost > waste.t.cost)) waste = { d, k: k.key, dg, t: k.cur };
      if (k.cur.gl >= 3 && Number.isFinite(rowCpgl) && metric(k.cur, 'cpgl') <= 0.7 * rowCpgl && (!star || metric(k.cur, 'cpgl') < metric(star.t, 'cpgl'))) star = { d, k: k.key, dg, t: k.cur };
    }
  }
  if (mover && Math.abs(mover.dg) >= 2) why.push(`${up ? 'The gain' : 'The drop'} sits in ${DL[mover.d]} "${nameOf(mover.d, mover.k)}" (${mover.dg > 0 ? '+' : '−'}${Math.abs(mover.dg)} GL).`);
  if (waste) why.push(`${DL[waste.d]![0].toUpperCase()}${DL[waste.d]!.slice(1)} "${nameOf(waste.d, waste.k)}" spent ${chf(waste.t.cost)} without a good lead.`);
  if (star && star.k !== mover?.k) why.push(`"${nameOf(star.d, star.k)}" is the efficient part (CPGL ${chf(metric(star.t, 'cpgl'))} vs ${chf(rowCpgl)}).`);
  // 3. specialist checks (rolling windows) for this school × country
  const sc = val('school'), mk = val('market');
  if (channel === 'Google' || channel === '') {
    const gs = [...new Map(ctx.google.filter((r) => (!sc || r.school === sc) && (!mk || r.country === mk)).map((r) => [r.campaign, r])).values()];
    for (const r of gs.filter((g) => g.alerts.length).slice(0, 2)) {
      why.push(`PPC check on the ${campName(r.campaign)} campaign: ${r.alerts[0].title.split(' — ')[0].toLowerCase()} (${r.alerts[0].detail.replace(/\.$/, '')}).`);
      next.push(`${shortCamp(r.campaign)}: ${r.alerts[0].action}`);
    }
    for (const r of gs.filter((g) => g.scale && !g.alerts.length).slice(0, 1)) next.push(`${shortCamp(r.campaign)}: ${r.scale!.action}`);
  }
  if (channel === 'Meta') {
    for (const m of ctx.meta.filter((e) => e.school === sc && (!mk || e.country === mk) && e.flag !== 'none' && e.segment !== 'Social Boosting').slice(0, 2)) {
      if (m.flag !== 'green') why.push(brief ? `The ${m.segment} campaign is flagged ${m.flag === 'red' ? 'needs action' : 'watch'} in the weekly read${m.cplChange !== null ? ` (CPL ${sg(m.cplChange)} week on week)` : ''}${/expensive/.test(m.action) ? ' — reach is getting expensive' : /fatigue/.test(m.action) ? ' — creative fatigue' : /landing|form/.test(m.action) ? ' — clicks convert less' : /qualif/.test(m.action) ? ' — leads are not qualifying' : ''}.` : `Weekly read, ${m.segment}: ${m.story.split('. Delivery')[0].split(' L14:')[0].replace(/\.$/, '')}.`);
      const pause = m.ads.filter((a) => a.flag === 'red').slice(0, 2).map((a) => a.ad), fund = m.ads.filter((a) => a.flag === 'green').slice(0, 2).map((a) => a.ad);
      if (pause.length) next.push(`${m.segment}: pause ${pause.join(', ')} (spend without good leads).`);
      if (fund.length && m.flag !== 'red') next.push(`${m.segment}: keep ${fund.join(', ')} on — they bring good leads.`);
      if (!pause.length && m.flag !== 'green' && m.action) next.push(`${m.segment}: ${m.action.split(/(?<=\.)\s+(?=Pause|Fund)/)[0]}`);
    }
  }
  // 4. fixes from the diagnosis
  if (worst && verdict !== 'Better') next.push(worst.fix);
  if (waste) next.push(`Cut or pause ${DL[waste.d]} "${nameOf(waste.d, waste.k)}" and move that money to ${star ? `"${nameOf(star.d, star.k)}"` : 'the parts that bring good leads'}.`);
  else if (star && rag !== 'red') next.push(`Give "${nameOf(star.d, star.k)}" more of the budget (+10–20%).`);
  if (!next.length) next.push(verdict === 'Better' ? 'Keep running; if it holds next period, add 10–20% budget.' : verdict === 'Worse' ? 'Review creatives, audiences and search terms before adding budget.' : 'No change needed.');
  if (brief) return { verdict, rag, head, why: [...new Set(why)].slice(0, 4), next: [] };
  return { verdict, rag, head, why: [...new Set(why)].slice(0, 4), next: [...new Set(next)].slice(0, 3) };
}

/** Group row (school, country): what the children say together. */
export function deepGroup(ctx: DeepCtx, x: Sides, kids: { key: string; name: string; sides: Sides; deep?: Deep }[]): Omit<Deep, 'rag'> {
  const prev = x.prev ?? emptyTotals();
  const { verdict } = classify(x.cur, prev);
  const head = trendLine(x, ctx.p1Label);
  const why: string[] = [], next: string[] = [];
  const up = x.cur.gl >= prev.gl;
  const moves = kids.map((k) => ({ ...k, dg: k.sides.cur.gl - (k.sides.prev?.gl ?? 0) })).filter((k) => k.dg !== 0 && (up ? k.dg > 0 : k.dg < 0)).sort((a, b) => Math.abs(b.dg) - Math.abs(a.dg));
  if (moves[0]) why.push(`${up ? 'Gain' : 'Drop'} driven by ${moves[0].name} (${moves[0].dg > 0 ? '+' : '−'}${Math.abs(moves[0].dg)} GL)${moves[1] ? ` and ${moves[1].name} (${moves[1].dg > 0 ? '+' : '−'}${Math.abs(moves[1].dg)})` : ''}.`);
  const reds = kids.filter((k) => k.deep?.rag === 'red'), greens = kids.filter((k) => k.deep?.rag === 'green');
  if (reds.length) why.push(`Needs action: ${reds.slice(0, 3).map((k) => k.name).join(', ')}${reds.length > 3 ? ` (+${reds.length - 3})` : ''}.`);
  if (greens.length) why.push(`Working: ${greens.slice(0, 3).map((k) => k.name).join(', ')}.`);
  for (const r of reds.slice(0, 2)) if (r.deep?.next[0]) next.push(`${r.name}: ${r.deep.next[0]}`);
  if (!next.length && greens[0]?.deep?.next[0]) next.push(`${greens[0].name}: ${greens[0].deep.next[0]}`);
  if (!next.length) next.push('No change needed.');
  return { verdict, head, why, next };
}
