// Action rules, ported from the team's two existing routines (ACT campaigns by default; pass `activities` to widen):
//  - Google: "Campaign Daily Review" Apps Script (PPC) — benchmark + trend rules per campaign.
//  - Meta: "SEG Meta weekly report" — per market (school × country from campaign name), L7/P7 CPL and L14/P14 CPGL.
// Both run on rolling windows ending at the latest data date ("yesterday"), independent of the cycle/week filter.
import { countryOfAdSet, type Store } from './data';
import { activityOf, segmentOf } from './names';

export type Bench = { cpc: number | null; cpl: number | null; cpgl: number | null; glr: number | null };
export type Benchmarks = { google: Record<string, Bench>; meta: Record<string, Bench> };
export type Setup = Record<string, { enabled: boolean; dailyBudget: number; lastUpdated: string }>;

/** Reference date = yesterday in Hanoi, capped at the latest data date (never judge a partial day). */
export function refDate(lastDate: string, now = new Date()): string {
  const y = new Date(now.getTime() + 7 * 36e5 - 864e5).toISOString().slice(0, 10);
  return y < lastDate ? y : lastDate;
}

type Day = { cost: number; leads: number; gl: number; budget: number; impr: number; clicks: number; reg: number; app: number; acc: number };
const zero = (): Day => ({ cost: 0, leads: 0, gl: 0, budget: 0, impr: 0, clicks: 0, reg: 0, app: 0, acc: 0 });

export const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const range = (end: string, n: number) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

/** Campaign naming: Advertiser_Brand_Channel_ActivityType_Region_Country_... (UAE → AE). */
export function parseCampaign(c: string) {
  const p = c.split('_');
  const school = ['CAAS', 'SHMS', 'HIM', 'CRCS'].find((s) => c.includes(s)) ?? 'OTHER';
  let cc = (p[5] ?? 'UNKNOWN').trim().toUpperCase();
  if (cc === 'UAE') cc = 'AE';
  return { school, country: cc, type: p[3] ?? '' };
}

/** Ad-name variants of the same creative (_1, _3, – Copy) are merged before judging an ad. */
export const baseAd = (a: string) => a.replace(/(\s*[–-]\s*Copy(\s*\d+)?)+$/i, '').replace(/_\d+$/, '').trim();

/** Activity types to review (from the campaign name token); null = every activity. */
export type Activities = string[] | null;
const inScope = (activities: Activities) => (campaign: string) => !activities || activities.includes(activityOf(campaign, ''));
/** Benchmarks are ACT benchmarks: only ACT campaigns are judged against them. */
const isAct = (campaign: string) => activityOf(campaign, '') === 'ACT';

/** Daily series per key for rows of one channel whose campaign passes `keep`, over `days` ending at `end`. */
function series(s: Store, channel: string, keep: (campaign: string) => boolean, end: string, days: number, keyOf: (campaign: string, ad: string, adSet: string) => string | null, school?: string) {
  const want = new Set(range(end, days));
  const ch = s.dicts.channel.indexOf(channel);
  const sc = school ? s.dicts.school.indexOf(school) : -1;
  const out = new Map<string, Map<string, Day>>();
  for (let i = 0; i < s.n; i++) {
    if (s.dim.channel[i] !== ch) continue;
    if (school && s.dim.school[i] !== sc) continue;
    const d = s.dates[s.date[i]];
    if (!d || !want.has(d)) continue;
    const camp = s.dicts.campaign[s.dim.campaign[i]];
    if (!keep(camp)) continue;
    const key = keyOf(camp, s.dicts.ad[s.dim.ad[i]], s.dicts.ad_group[s.dim.ad_group[i]]);
    if (key === null) continue;
    let m = out.get(key); if (!m) { m = new Map(); out.set(key, m); }
    let x = m.get(d); if (!x) { x = zero(); m.set(d, x); }
    const v = (k: keyof Day) => { const n = s.m[k][i]; return Number.isNaN(n) ? 0 : n; };
    for (const k of Object.keys(x) as (keyof Day)[]) x[k] += v(k);
  }
  return out;
}

function sum(m: Map<string, Day> | undefined, dates: string[]) {
  const t = zero();
  for (const d of dates) { const x = m?.get(d); if (x) for (const k of Object.keys(t) as (keyof Day)[]) t[k] += x[k]; }
  return { ...t, cpreg: t.reg > 0 ? t.cost / t.reg : null, cpapp: t.app > 0 ? t.cost / t.app : null, cpacc: t.acc > 0 ? t.cost / t.acc : null, cpl: t.leads > 0 ? t.cost / t.leads : null, cpgl: t.gl > 0 ? t.cost / t.gl : null, glr: t.leads > 0 ? t.gl / t.leads : null, ctr: t.impr > 0 ? t.clicks / t.impr : null, cpm: t.impr > 0 ? (t.cost / t.impr) * 1000 : null };
}
const costDays = (m: Map<string, Day>, dates: string[]) => dates.filter((d) => (m.get(d)?.cost ?? 0) > 0).length;
const chg = (a: number | null, b: number | null) => (a === null || b === null || b <= 0 ? null : (a - b) / b);

// ================================================================ Google (PPC daily review)

export interface Alert { rule: string; title: string; detail: string; action: string }
export interface GoogleResult {
  campaign: string; school: string; country: string; bench: Bench | null; dailyBudget: number | null; shortWindow: number; setupNote: string;
  stats: ReturnType<typeof googleStats>; alerts: Alert[]; scale: Alert | null; severity: number; scaleScore: number;
  trend: { date: string; leads: number; gl: number }[];
}

function googleStats(m: Map<string, Day>, y: string, short: number) {
  const cur = sum(m, range(y, short)), prev = sum(m, range(addDays(y, -short), short));
  const w14 = sum(m, range(y, 14)), w30 = sum(m, range(y, 30));
  return {
    shortCost: cur.cost, shortLeads: cur.leads, shortCpl: cur.cpl, shortCpgl: cur.cpgl, prevCpl: prev.cpl, prevCpgl: prev.cpgl,
    cplChange: chg(cur.cpl, prev.cpl), cpglChange: chg(cur.cpgl, prev.cpgl),
    cost14: w14.cost, leads14: w14.leads, gl14: w14.gl, cpl14: w14.cpl, cpgl14: w14.cpgl, glr14: w14.glr,
    cost30: w30.cost, leads30: w30.leads, gl30: w30.gl, cpl30: w30.cpl, cpgl30: w30.cpgl, glr30: w30.glr,
    shortEveryDay: costDays(m, range(y, short)) === short, costDays14: costDays(m, range(y, 14)),
  };
}

const f1 = (n: number | null) => (n === null || !Number.isFinite(n) ? '—' : n.toFixed(1));
const pc = (n: number | null) => (n === null || !Number.isFinite(n) ? '—' : `${(n * 100).toFixed(1)}%`);

export function googleReview(s: Store, bench: Benchmarks, setup: Setup, school?: string, activities: Activities = ['ACT']) {
  const y = refDate(s.lastDate);
  const staleCut = addDays(y, -3);
  let skippedRecent = 0, skippedPaused = 0;
  const by = series(s, 'Google', inScope(activities), y, 30, (c) => c, school);
  const results: GoogleResult[] = [];
  for (const [campaign, m] of by) {
    if (!m.has(y)) continue; // active yesterday
    const { school: sc, country } = parseCampaign(campaign);
    const bm = isAct(campaign) ? bench.google[`${sc}|${country}`] ?? null : null;
    // Setup tabs (Google Ads export): skip paused campaigns and ones changed in the last 3 days (give changes time).
    const su = setup[campaign];
    if (su && !su.enabled) { skippedPaused++; continue; }
    if (su?.lastUpdated && su.lastUpdated.slice(0, 10) > staleCut) { skippedRecent++; continue; }
    const dailyBudget = su ? su.dailyBudget : null;
    const short = (dailyBudget ?? 0) >= 20 ? 3 : 7;
    const setupNote = su ? '' : 'no setup row — budget unknown, 7-day window';
    const st = googleStats(m, y, short);
    const alerts: Alert[] = [];
    const flags = { noLead: false, noGL: false, cplCrit: false, cpglCrit: false, cplUp: false, cpglUp: false };
    if (st.shortEveryDay && bm?.cpl && st.shortLeads === 0 && st.shortCost > bm.cpl * 1.5) {
      flags.noLead = true;
      alerts.push({ rule: `RULE_${short}D_NO_LEAD`, title: 'No leads — high spend', detail: `Spent ${f1(st.shortCost)} CHF in ${short}d with 0 leads (threshold ${f1(bm.cpl * 1.5)} CHF).`, action: 'Pause or reduce budget. Check landing page, keyword intent, and tracking immediately.' });
    }
    if (st.shortEveryDay && bm?.cpl && st.shortCpl !== null && st.shortCpl > bm.cpl * 1.5) {
      flags.cplCrit = true;
      alerts.push({ rule: `RULE_${short}D_CPL_HIGH`, title: `Last ${short}d CPL critical — ${f1(st.shortCpl)} CHF`, detail: `${f1(st.shortCpl)} CHF vs benchmark ${f1(bm.cpl)} CHF (${f1(st.shortCpl / bm.cpl)}×).`, action: 'Review targeting, search terms, negative keywords, bid strategy, and landing page conversion flow.' });
    }
    if (st.shortEveryDay && st.cplChange !== null && st.cplChange > 0.3) {
      flags.cplUp = true;
      alerts.push({ rule: `RULE_${short}D_CPL_INCREASE`, title: `CPL increased ${pc(st.cplChange)} vs previous ${short}d`, detail: `Current ${f1(st.shortCpl)} CHF vs previous ${f1(st.prevCpl)} CHF.`, action: 'Check recent changes: budget pacing, bid strategy, search terms, audience quality, creative fatigue, or landing page performance.' });
    }
    if (st.costDays14 >= 10 && bm?.cpgl && st.gl14 === 0 && st.cost14 > bm.cpgl * 1.5) {
      flags.noGL = true;
      alerts.push({ rule: 'RULE_14D_NO_GOOD_LEAD', title: 'No good leads — high spend', detail: `Spent ${f1(st.cost14)} CHF in 14d with 0 good leads (threshold ${f1(bm.cpgl * 1.5)} CHF).`, action: 'Audit lead quality, CRM qualification, and traffic source immediately.' });
    }
    if (st.costDays14 === 14 && bm?.cpgl && st.cpgl14 !== null && st.cpgl14 > bm.cpgl * 1.5) {
      flags.cpglCrit = true;
      alerts.push({ rule: 'RULE_14D_CPGL_HIGH', title: `14d cost per good lead critical — ${f1(st.cpgl14)} CHF`, detail: `${f1(st.cpgl14)} CHF vs benchmark ${f1(bm.cpgl)} CHF (${f1(st.cpgl14 / bm.cpgl)}×).`, action: 'Investigate traffic quality. Tighten targeting, search intent, campaign segmentation, or form qualification.' });
    }
    if (st.shortEveryDay && st.cpglChange !== null && st.cpglChange > 0.3) {
      flags.cpglUp = true;
      alerts.push({ rule: `RULE_${short}D_CPGL_INCREASE`, title: `Cost per good lead increased ${pc(st.cpglChange)} vs previous ${short}d`, detail: `Current ${short}d CpGL ${f1(st.shortCpgl)} CHF vs previous ${f1(st.prevCpgl)} CHF.`, action: 'Check lead quality source, CRM qualification, audience drift, and whether recent traffic is less qualified.' });
    }
    let scale: Alert | null = null;
    if (st.costDays14 === 14 && bm) {
      const ok14 = st.gl14 >= 2, cpglOk = st.cpgl14 !== null && !!bm.cpgl && st.cpgl14 <= bm.cpgl, glrOk = st.glr14 !== null && !!bm.glr && st.glr14 >= bm.glr;
      if (ok14 && cpglOk && glrOk) scale = { rule: 'RULE_SCALE_STRONG', title: 'Strong good lead signal', detail: `14d: ${st.gl14} good leads, CpGL ${f1(st.cpgl14)} vs benchmark ${f1(bm.cpgl)} CHF, GLR ${pc(st.glr14)} vs ${pc(bm.glr)}.`, action: 'Scale budget by 20–30% while monitoring CPL and good lead rate.' };
      else if (ok14 && cpglOk) scale = { rule: 'RULE_SCALE_CPGL', title: 'Efficient good lead cost', detail: `14d: ${st.gl14} good leads, CpGL ${f1(st.cpgl14)} CHF below benchmark ${f1(bm.cpgl)} CHF.`, action: 'Increase budget by 10–20% and monitor if good lead quality holds.' };
      else if (st.gl30 >= 3 && st.cpgl30 !== null && bm.cpgl && st.cpgl30 <= bm.cpgl) scale = { rule: 'RULE_SCALE_30D', title: 'Consistent good lead performance', detail: `30d: ${st.gl30} good leads, CpGL ${f1(st.cpgl30)} CHF below benchmark ${f1(bm.cpgl)} CHF.`, action: 'Consider scaling gradually by 10–15%.' };
    }
    let severity = 0;
    if (flags.noLead) severity += 100000 + st.shortCost * 100;
    if (flags.noGL) severity += 80000 + st.cost14 * 80;
    if (flags.cplCrit) severity += 60000 + (st.shortCpl ?? 0) * 20;
    if (flags.cpglCrit) severity += 50000 + (st.cpgl14 ?? 0) * 20;
    if (flags.cplUp) severity += 45000 + (st.cplChange ?? 0) * 10000;
    if (flags.cpglUp) severity += 43000 + (st.cpglChange ?? 0) * 10000;
    severity += st.shortCost * 5 + st.cost14 * 3;
    const scaleScore = st.gl30 * 10000 + st.gl14 * 8000 + (st.glr14 ?? 0) * 5000 - (st.cpgl30 ?? 0) * 10 - (st.cpl30 ?? 0) * 5 + st.cost30;
    results.push({
      campaign, school: sc, country, bench: bm, dailyBudget, shortWindow: short, setupNote, stats: st, alerts, scale, severity, scaleScore,
      trend: range(y, 30).map((d) => ({ date: d, leads: m.get(d)?.leads ?? 0, gl: m.get(d)?.gl ?? 0 })),
    });
  }
  const eligible = results.filter((r) => r.stats.shortEveryDay || r.stats.costDays14 >= 10);
  return {
    asOf: y, reviewed: results.length, skippedRecent, skippedPaused,
    critical: eligible.filter((r) => r.alerts.length).sort((a, b) => b.severity - a.severity).slice(0, 10),
    scale: eligible.filter((r) => r.scale).sort((a, b) => b.scaleScore - a.scaleScore).slice(0, 5),
    noBenchmark: [...new Set(results.filter((r) => !r.bench).map((r) => `${r.school}|${r.country}`))],
  };
}

// ================================================================ Meta (weekly report)
// Format follows the team's "SEG Meta Weekly Report": one entry per school × market × campaign segment,
// a short brief for leadership, and an expandable specialist section (ad sets, ads with L7 + L14, verdicts).

export type Flag = 'red' | 'amber' | 'green' | 'none';
type Win = ReturnType<typeof sum>;
export interface AdRow { ad: string; l7: Win; l14: Win; p7: Win; p14: Win; flag: Flag; verdict: string }
export interface AdSetRow { adSet: string; l7: Win; l14: Win; p7: Win; p14: Win; share: number; flag: Flag; verdict: string }
export interface MarketResult {
  school: string; country: string; segment: string; flag: Flag; bench: Bench | null;
  l7: Win; p7: Win; l14: Win; p14: Win;
  cplChange: number | null; cpglChange: number | null; brief: string; story: string; action: string;
  ads: AdRow[]; adSets: AdSetRow[]; campaigns: string[];
}

export function metaWindows(y: string) {
  return { L7: [addDays(y, -6), y], P7: [addDays(y, -13), addDays(y, -7)], L14: [addDays(y, -13), y], P14: [addDays(y, -27), addDays(y, -14)] };
}

const sgn = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)}%`);

export function metaReview(s: Store, bench: Benchmarks, school?: string, activities: Activities = ['ACT']) {
  const y = refDate(s.lastDate);
  // region-wide campaigns (country ALL) take the country from the ad set name (Region_COUNTRY_…)
  // non-ACT campaigns get their activity in front of the segment ("NURT · Parents") so they never merge with ACT
  const seg = (c: string) => { const g = segmentOf(c), a = activityOf(c, ''); return a === 'ACT' || g === 'Retargeting' || g === 'Social Boosting' ? g : `${a} · ${g}`; };
  const key = (c: string, adSet = '') => { const p = parseCampaign(c); const cc = p.country === 'ALL' ? countryOfAdSet(adSet) || 'ALL' : p.country; return `${p.school}|${cc}|${seg(c)}`; };
  const keep = inScope(activities);
  const campsBy = new Map<string, Set<string>>();
  const keyC = (c: string, _a: string, as: string) => { const k = key(c, as); (campsBy.get(k) ?? campsBy.set(k, new Set()).get(k)!).add(c); return k; };
  const markets = series(s, 'Meta', keep, y, 28, keyC, school);
  const ads = series(s, 'Meta', keep, y, 28, (c, a, as) => (a ? `${key(c, as)}\u0001${baseAd(a)}` : null), school);
  const setMap = new Map<string, Map<string, Map<string, Day>>>();
  { // ad set split: campaign → ad set (from the ad_group dimension)
    const ch = s.dicts.channel.indexOf('Meta'), want = new Set(range(y, 28));
    for (let i = 0; i < s.n; i++) {
      if (s.dim.channel[i] !== ch) continue;
      const d = s.dates[s.date[i]]; if (!d || !want.has(d)) continue;
      const camp = s.dicts.campaign[s.dim.campaign[i]]; if (!keep(camp)) continue;
      if (school && s.dicts.school[s.dim.school[i]] !== school) continue;
      const as = s.dicts.ad_group[s.dim.ad_group[i]] || '(no ad set)';
      const k = key(camp, as);
      const m1 = setMap.get(k) ?? setMap.set(k, new Map()).get(k)!;
      const m2 = m1.get(as) ?? m1.set(as, new Map()).get(as)!;
      const x = m2.get(d) ?? m2.set(d, zero()).get(d)!;
      for (const f of Object.keys(x) as (keyof Day)[]) { const n = s.m[f][i]; if (!Number.isNaN(n)) x[f] += n; }
    }
  }
  const L7 = range(y, 7), P7 = range(addDays(y, -7), 7), L14 = range(y, 14), P14 = range(addDays(y, -14), 14);
  const out: MarketResult[] = [];
  for (const [k, m] of markets) {
    const [sc, cc, segment] = k.split('|');
    const l7 = sum(m, L7), p7 = sum(m, P7), l14 = sum(m, L14), p14 = sum(m, P14);
    const bm = [...(campsBy.get(k) ?? [])].some(isAct) ? bench.meta[`${sc}|${cc}`] ?? null : null;
    const cplChange = chg(l7.cpl, p7.cpl), cpglChange = chg(l14.cpgl, p14.cpgl);
    const pooled = segment === 'Retargeting' || segment === 'Social Boosting';
    let flag: Flag = 'green', story = '', action = '';
    const thin = l7.leads <= 2 || p7.leads <= 2;
    if (l7.cost === 0) { flag = 'none'; story = 'No spend in the last 7 days.'; }
    else if (segment === 'Social Boosting') { flag = 'green'; story = `CHF ${l7.cost.toFixed(0)} in L7, CTR ${pc(l7.ctr)}. Awareness play — not measured on leads.`; action = 'No action; runs as planned.'; }
    else if (l7.leads === 0 && l7.cost < Math.max(50, bm?.cpl ?? 0)) {
      flag = 'amber';
      story = `CHF ${l7.cost.toFixed(0)} in L7 with no CRM leads (P7: ${p7.leads} leads on CHF ${p7.cost.toFixed(0)}). CTR ${pc(l7.ctr)}, CPM ${f1(l7.cpm)}.`;
      action = pooled ? 'Running at a small pooled budget; check frequency in Meta, no change needed.' : 'Spend is too small to judge; keep running and read again next week.';
    } else if (l7.leads === 0) {
      flag = 'red';
      story = `CHF ${l7.cost.toFixed(0)} spent in L7 with no CRM leads (P7: ${p7.leads} leads). ${l7.clicks.toFixed(0)} clicks at ${pc(l7.ctr)} CTR${l7.clicks >= 30 ? ' — the ad gets clicks, but nothing converts after the click' : ''}.`;
      action = l7.clicks >= 30 ? 'Test-submit the landing-page form and confirm the UTM → Salesforce join before judging the ad.' : 'Check audience size and creative; the ad is not earning clicks.';
    } else if (cplChange !== null && cplChange > 0.2) {
      flag = thin ? 'amber' : 'red';
      const cpmUp = chg(l7.cpm, p7.cpm), ctrCh = chg(l7.ctr, p7.ctr);
      story = `CPL CHF ${f1(l7.cpl)} vs ${f1(p7.cpl)} (${sgn(cplChange)}): ${l7.leads} leads vs ${p7.leads} on spend ${f1(l7.cost)} vs ${f1(p7.cost)}${thin ? ' — thin volume, 1–2 leads swing this' : ''}. Delivery: CPM ${f1(l7.cpm)} (${sgn(cpmUp)}), CTR ${pc(l7.ctr)} (${sgn(ctrCh)}).`;
      action = thin ? 'Watch another week before acting.' : (cpmUp ?? 0) > 0.2 ? 'Reach is getting expensive: widen the audience or refresh creative before adding spend.' : (ctrCh ?? 0) < -0.15 ? 'Creative fatigue: pause the weakest ads and fund the ones that qualify.' : 'Clicks convert less: check the landing page and form; fund ads with good-lead proof.';
    } else {
      story = `CPL CHF ${f1(l7.cpl)} on ${l7.leads} leads (P7 ${f1(p7.cpl)} on ${p7.leads}). CPM ${f1(l7.cpm)}, CTR ${pc(l7.ctr)}.`;
      action = 'Hold budget.';
    }
    if (flag !== 'none' && segment !== 'Social Boosting') {
      story += ` L14: ${l14.gl} GL, CPGL CHF ${f1(l14.cpgl)} (${sgn(cpglChange)} vs P14), GL rate ${pc(l14.glr)} vs ${pc(p14.glr)}${l14.reg ? `, ${l14.reg} reg` : ''}.`;
      if (cpglChange !== null && cpglChange > 0.2) {
        if (flag === 'green') flag = 'amber';
        story += ' Good leads lag, so the quality read is a watch signal.';
        if (action === 'Hold budget.') action = 'Check the lead-status mix ("Contacted" is still in progress; a "No Reply" build-up is a CRM follow-up issue).';
      } else if (l14.gl === 0 && l14.leads >= 10) {
        if (flag === 'green') flag = 'amber';
        if (action === 'Hold budget.') action = 'Leads are not qualifying: tighten targeting or the form.';
      } else if ((l14.glr ?? 0) > (p14.glr ?? 0) && cplChange !== null && cplChange > 0.2 && flag === 'red' && !thin) {
        story += ' The 14-day good-lead rate went up, so this is a volume dip, not a quality drop.';
        flag = 'amber';
      } else if (flag === 'green' && bm?.cpgl && l14.cpgl !== null && l14.cpgl <= bm.cpgl && l14.gl >= 2) {
        action = `CPGL CHF ${f1(l14.cpgl)} is under benchmark ${f1(bm.cpgl)}: protect budget; candidate for +10–20%.`;
      }
    }
    if (pooled) story += ' Leads cannot be country-attributed.';
    // ads (variants merged), L7 and L14, with a verdict
    const entryCpgl = l14.cpgl ?? bm?.cpgl ?? null;
    const adRows: AdRow[] = [];
    for (const [ak, am] of ads) {
      if (!ak.startsWith(k + '\u0001')) continue;
      const a7 = sum(am, L7), a14 = sum(am, L14);
      if (a14.cost <= 0 && a14.leads <= 0) continue;
      let f: Flag = 'amber', verdict = 'watch';
      const share = l14.cost ? a14.cost / l14.cost : 0;
      if (a14.gl >= 1 && entryCpgl !== null && (a14.cpgl ?? Infinity) <= entryCpgl) { f = 'green'; verdict = share < 0.1 ? 'cheap GL — give it more budget' : 'keep, it qualifies'; }
      else if (a14.gl === 0 && entryCpgl !== null && a14.cost >= Math.max(30, entryCpgl)) { f = 'red'; verdict = `pause — CHF ${a14.cost.toFixed(0)} with 0 GL`; }
      else if (a14.leads >= 15 && (a14.glr ?? 0) < ((l14.glr ?? 0) / 2)) { f = 'red'; verdict = `pause — non-qualifying volume (GL rate ${pc(a14.glr)})`; }
      else if (a14.cost < 10) { f = 'none'; verdict = 'too small to read'; }
      adRows.push({ ad: ak.split('\u0001')[1], l7: a7, l14: a14, p7: sum(am, P7), p14: sum(am, P14), flag: f, verdict });
    }
    adRows.sort((a, b) => b.l14.cost - a.l14.cost);
    const sets: AdSetRow[] = [...(setMap.get(k) ?? new Map()).entries()].map(([as, dm]) => ({ adSet: as, l7: sum(dm, L7), l14: sum(dm, L14), p7: sum(dm, P7), p14: sum(dm, P14), share: 0, flag: 'amber' as Flag, verdict: 'watch' }))
      .filter((r) => r.l14.cost > 0 || r.l14.leads > 0).sort((a, b) => b.l14.cost - a.l14.cost);
    const setCost = sets.reduce((a, r) => a + r.l14.cost, 0); sets.forEach((r) => { r.share = setCost ? r.l14.cost / setCost : 0; });
    // ad-set verdict: same rule as ads, judged against the entry's 14-day cost per good lead
    for (const r of sets) {
      const a = r.l14;
      if (a.gl >= 1 && entryCpgl !== null && (a.cpgl ?? Infinity) <= entryCpgl) { r.flag = 'green'; r.verdict = r.share < 0.3 ? 'cheap GL — give it more budget' : 'keep, it qualifies'; }
      else if (a.gl === 0 && entryCpgl !== null && a.cost >= Math.max(50, entryCpgl)) { r.flag = 'red'; r.verdict = `cut — CHF ${a.cost.toFixed(0)} with 0 GL`; }
      else if (a.gl >= 1 && entryCpgl !== null && (a.cpgl ?? 0) >= 1.5 * entryCpgl) { r.flag = 'red'; r.verdict = `cut — CPGL ${(a.cpgl ?? 0).toFixed(0)} vs ${entryCpgl.toFixed(0)}`; }
      else if (a.leads >= 15 && (a.glr ?? 0) < ((l14.glr ?? 0) / 2)) { r.flag = 'red'; r.verdict = `tighten — non-qualifying volume (GL rate ${pc(a.glr)})`; }
      else if (a.cost < 10) { r.flag = 'none'; r.verdict = 'too small to read'; }
    }
    const pauses = adRows.filter((a) => a.flag === 'red').slice(0, 2).map((a) => a.ad), scale = adRows.filter((a) => a.flag === 'green').slice(0, 2).map((a) => a.ad);
    if (flag !== 'none' && (pauses.length || scale.length) && !pooled) action += `${pauses.length ? ` Pause ${pauses.join(', ')}.` : ''}${scale.length ? ` Fund ${scale.join(', ')}.` : ''}`;
    const brief = flag === 'none' ? 'No spend this week.' : segment === 'Social Boosting' ? story
      : l7.leads === 0 ? `CHF ${l7.cost.toFixed(0)} spent, 0 leads this week (P7 ${p7.leads}); ${l14.gl} good leads in 14 days. ${action.split('.')[0]}.`
      : `CPL CHF ${f1(l7.cpl)} (${sgn(cplChange)}) on ${l7.leads} leads; ${l14.gl} good leads in 14 days at CHF ${f1(l14.cpgl)} (${sgn(cpglChange)}). ${action.split('.')[0]}.`;
    out.push({ school: sc, country: cc, segment, flag, bench: bm, l7, p7, l14, p14, cplChange, cpglChange, brief, story, action: action.trim(), ads: adRows, adSets: sets, campaigns: [...(campsBy.get(k) ?? [])] });
  }
  const order: Record<Flag, number> = { red: 0, amber: 1, green: 2, none: 3 };
  out.sort((a, b) => order[a.flag] - order[b.flag] || b.l7.cost - a.l7.cost);
  const other = (tag: string) => { const m = series(s, 'Meta', (c) => c.includes(tag), y, 14, () => 'x', school).get('x'); return sum(m, L14); };
  const allM = new Map<string, Day>(); for (const m of markets.values()) for (const [d, x] of m) { const t = allM.get(d) ?? allM.set(d, zero()).get(d)!; (Object.keys(x) as (keyof Day)[]).forEach((f) => { t[f] += x[f]; }); }
  const tot = { l7: sum(allM, L7), p7: sum(allM, P7), l14: sum(allM, L14), p14: sum(allM, P14) };
  return { asOf: y, windows: metaWindows(y), markets: out, conv: other('_FB_CONV_'), nurt: other('_FB_NURT_'), tot };
}
