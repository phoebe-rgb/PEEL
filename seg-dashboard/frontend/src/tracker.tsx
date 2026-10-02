import { Fragment, useMemo, useState } from 'react';
import { aggregate, emptyTotals, metric, type Filter } from './lib/agg';
import { isoWeek, weekDays, weekRange, type Dim, type Store } from './lib/data';
import { label } from './lib/format';
import { classify } from './lib/analysis';
import { baseAd, googleReview, metaReview, refDate } from './lib/rules';
import { marketName } from './lib/names';
import { useShared, type Entry } from './lib/shared';
import { KINDS, KIND_HELP, SETUP_WORDS, pickWeek, platformOfChannel, storedBudget, storedKind, storedPlatform, withPriority, type Kind, type Platform, type Priority } from './lib/kinds';
import type { Comment } from './comments';
import { useCtx } from './components';
import { useRefData } from './actions';
import { budgetModel, paceByCountry, subName, usePlan } from './budget';
import { negativeReview, reviewWindow, useKeywords, useNegBaseline } from './keywords';
import type { BaseNeg } from './lib/negatives';
import { Block } from './perf';

interface Action { commentId?: string; id: string; platform: Platform; kind: Kind; budget?: boolean; priority: Priority; school: string; country: string; entity: string; text: string; dims: Partial<Record<Dim, string[]>>; source?: string }

const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const addD = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const todayHanoi = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);

function adVariants(s: Store, name: string) { return s.dicts.ad.filter((a) => a && baseAd(a) === name); }

/** Build this week's action list from the same rules the analysis uses. Only actions, no data. */
function buildActions(s: Store, bench: Parameters<typeof googleReview>[1], setup: Parameters<typeof googleReview>[2], plan: ReturnType<typeof usePlan>, kw: ReturnType<typeof useKeywords>, cycle: string, negBase: Record<string, BaseNeg[]> | null = null): Action[] {
  const out: Action[] = [];
  // `idNs` keeps the id an action had when budget and search terms were their own platforms, so done / dismissed state is not lost
  const push = (a: Omit<Action, 'id'>, key: string, idNs: string = a.platform) => out.push(withPriority({ ...a, id: hash(`${idNs}|${key}`) }));
  const g = googleReview(s, bench, setup);
  for (const r of g.critical) {
    for (const act of [...new Set(r.alerts.map((a) => a.action))]) push({ platform: 'Google Ads', kind: 'Performance', priority: 'High', school: r.school, country: marketName(r.country), entity: r.campaign, text: act, dims: { channel: ['Google'], campaign: [r.campaign] } }, `${r.campaign}|${act}`);
  }
  for (const r of g.scale) if (r.scale) push({ platform: 'Google Ads', kind: 'Scale', priority: 'Medium', school: r.school, country: marketName(r.country), entity: r.campaign, text: r.scale.action, dims: { channel: ['Google'], campaign: [r.campaign] } }, `${r.campaign}|scale`);
  const m = metaReview(s, bench);
  for (const e of m.markets) {
    if (e.flag === 'none' || e.segment === 'Social Boosting') continue;
    const dims = { channel: ['Meta'], school: [e.school], market: [e.country], activity: ['ACT'] };
    if (e.flag !== 'green' || /benchmark/.test(e.action)) {
      const first = e.action.split(/(?<=\.)\s+(?=Pause|Fund)/)[0];
      push({ platform: 'Meta', kind: 'Performance', priority: e.flag === 'red' ? 'High' : 'Medium', school: e.school, country: marketName(e.country), entity: `${e.segment}`, text: first, dims }, `${e.school}|${e.country}|${e.segment}|main`);
    }
    for (const a of e.ads) {
      if (a.flag === 'red') push({ platform: 'Meta', kind: 'Performance', priority: 'High', school: e.school, country: marketName(e.country), entity: a.ad, text: `Pause ${a.ad} (${a.verdict.replace(/^pause — /, '')}).`, dims: { channel: ['Meta'], ad: adVariants(s, a.ad) } }, `ad|${a.ad}|pause`);
      else if (a.flag === 'green' && /more budget/.test(a.verdict)) push({ platform: 'Meta', kind: 'Scale', priority: 'Low', school: e.school, country: marketName(e.country), entity: a.ad, text: `Give ${a.ad} more budget — cheap good leads.`, dims: { channel: ['Meta'], ad: adVariants(s, a.ad) } }, `ad|${a.ad}|fund`);
    }
  }
  if (plan) {
    const today = refDate(s.lastDate), bf: Filter = { cycle, weeks: null, dims: {} };
    const bm = budgetModel(s, bf, plan, today);
    for (const r of paceByCountry(s, bf, bm, today)) {
      const cut = r.target < r.r7 - 0.5;
      // no plan line / plan not launched = the budget is not set up right; under / over pace = pacing
      push({ platform: platformOfChannel(r.channel), budget: true, kind: r.st === 'No plan' || r.st === 'Not started' ? 'Setup' : 'Budget pacing', priority: r.st === 'No plan' || r.st === 'Over pace' || cut ? 'High' : 'Medium', school: r.school, country: r.market ? marketName(r.market) : '', entity: `${label(r.school)} · ${r.market ? `${marketName(r.market)} · ` : ''}${subName(r.sub)}${r.activity ? ` · ${r.activity}` : ''}`, text: r.action,
        dims: { school: [r.school], channel: [r.channel], ...(r.market ? { market: [r.market], subchannel: [r.sub] } : {}), ...(r.activity ? { activity: [r.activity] } : {}) } }, `${r.school}|${r.market}|${r.sub}|${r.activity}|${r.st}|${cut ? 'cut' : 'raise'}`, 'Budget');
    }
  }
  if (kw && negBase) {
    // the same review as the Search Keywords page: last 7 full days, six reason categories, baseline skipped
    const [from, to] = reviewWindow(kw.to, 7);
    const bySchool = new Map<string, { n: number; cost: number; cats: Map<string, number> }>();
    for (const c of negativeReview(kw.rows, negBase, from, to).suggestions) {
      const x = bySchool.get(c.school) ?? { n: 0, cost: 0, cats: new Map() };
      x.n++; x.cost += c.cost; x.cats.set(c.category, (x.cats.get(c.category) ?? 0) + 1); bySchool.set(c.school, x);
    }
    for (const [school, x] of bySchool) push({ platform: 'Google Ads', kind: 'Keywords', priority: x.cost >= 100 ? 'High' : 'Low', school, country: '', entity: `${school} negative keywords (${from} → ${to})`,
      text: `Review ${x.n} new negative keyword${x.n > 1 ? 's' : ''} (${[...x.cats].map(([k, n]) => `${k} ${n}`).join(', ')}; CHF ${x.cost.toFixed(0)} spent) on the Search Keywords page, apply, then add them to SEG_Negative_Keywords.`, dims: { channel: ['Google'], school: [school] } }, `neg|${school}|${to}`, 'Search keywords');
  }
  const order = { High: 0, Medium: 1, Low: 2 };
  return out.sort((a, b) => order[a.priority] - order[b.priority] || a.school.localeCompare(b.school));
}

/** Entity metrics 7 days before vs up to 7 days after the resolved date. */
function impact(s: Store, dims: Partial<Record<Dim, string[]>>, resolvedAt: string) {
  const y = refDate(s.lastDate);
  const before = Array.from({ length: 7 }, (_, i) => addD(resolvedAt, -7 + i));
  const after = Array.from({ length: 7 }, (_, i) => addD(resolvedAt, 1 + i)).filter((d) => d <= y);
  const f = (dates: string[]): Filter => ({ cycle: '*', weeks: null, months: null, dims, dates });
  const b = aggregate(s, f(before)).get('') ?? emptyTotals(), a = aggregate(s, f(after)).get('') ?? emptyTotals();
  if (after.length < 3) return { verdict: 'Too early', text: `${after.length} day${after.length === 1 ? '' : 's'} of data since resolving.`, a, b };
  const scale = 7 / after.length; // compare daily rates
  const aS = { ...a, cost: a.cost * scale, leads: a.leads * scale, gl: a.gl * scale, app: a.app * scale, acc: a.acc * scale };
  const v = classify(aS, b).verdict;
  const cpl = (t: typeof a) => metric(t, 'cpl'), cpgl = (t: typeof a) => metric(t, 'cpgl');
  const d = (x: number, y2: number) => (Number.isFinite(x) && Number.isFinite(y2) && y2 ? `${x >= y2 ? '+' : '−'}${Math.abs(((x - y2) / y2) * 100).toFixed(0)}%` : '–');
  return { verdict: v, text: `Spend/day ${(b.cost / 7).toFixed(0)} → ${(a.cost / after.length).toFixed(0)}; leads/day ${(b.leads / 7).toFixed(1)} → ${(a.leads / after.length).toFixed(1)}; CPL ${d(cpl(a), cpl(b))}; CPGL ${d(cpgl(a), cpgl(b))} (${after.length} days after vs 7 before).`, a, b };
}

// One tab per channel; LinkedIn only appears when it has actions. Budget and search-term actions sit in their channel.
const PLATFORMS: Platform[] = ['Google Ads', 'Meta', 'LinkedIn'];

// Owners (Slack): Google Ads → John Martin, Meta → Phoebe.
export const OWNERS = { google: { name: 'John', slack: 'U0BGSG23SBZ' }, meta: { name: 'Phoebe', slack: 'U09EUG9LFA7' } };
const ownerOf = (a: Action) => (a.platform === 'Google Ads' ? OWNERS.google : OWNERS.meta);
/** Deadline = Wednesday of the week the action is raised (Hanoi calendar week). */
const wednesday = (d: string) => addD(weekDays(isoWeek(d))[0], 2);
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const f0 = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '–');
const pctCh = (a: number, b: number) => (Number.isFinite(a) && Number.isFinite(b) && b ? `${a >= b ? '+' : '−'}${Math.abs(((a - b) / b) * 100).toFixed(0)}%` : 'n/a');

/** Last complete ISO week vs the one before, for one channel (ACT only). */
function weekSummary(s: Store, channel: string) {
  const lw = isoWeek(addD(weekDays(isoWeek(refDate(s.lastDate)))[0], weekDays(isoWeek(refDate(s.lastDate)))[6] <= s.lastDate ? 0 : -7));
  const pw = isoWeek(addD(weekDays(lw)[0], -7));
  const g = (w: string) => aggregate(s, { cycle: '*', weeks: [w], months: null, dims: { channel: [channel], activity: ['ACT'] } }).get('') ?? emptyTotals();
  const a = g(lw), b = g(pw);
  const line = (l: string, id: Parameters<typeof metric>[1], money = false) => `${l} ${money ? 'CHF ' : ''}${f0(metric(a, id))} (${pctCh(metric(a, id), metric(b, id))})`;
  return { lw, pw, text: [line('Spend', 'cost', true), line('Leads', 'leads'), line('CPL', 'cpl', true), line('Good leads', 'gl'), line('CPGL', 'cpgl', true), line('Applied', 'app'), line('Accepted', 'acc')].join(' · ') };
}

export function ActionsPage() {
  const { store, filter, view } = useCtx();
  const ref = useRefData();
  const plan = usePlan();
  const kw = useKeywords();
  const negBase = useNegBaseline();
  const shared = useShared('/api/actions');
  const [tab, setTab] = useState<Platform | 'All'>('All');
  const [kindTab, setKindTab] = useState<Kind | 'All'>('All');
  const [edit, setEdit] = useState<{ id: string; mode: 'done' | 'dismiss' } | null>(null);
  const [f1, setF1] = useState(''), [f2, setF2] = useState('');
  const today = todayHanoi();
  const week = isoWeek(today); // calendar week (resolving stamps the calendar week too)
  const monday = weekDays(week)[0];
  const lastWeek = isoWeek(addD(monday, -7));
  const deadline = wednesday(today);
  const actions = useMemo(() => (ref ? buildActions(store, ref.bench, ref.setup, plan, kw ?? null, view.cycle, negBase) : []), [store, ref, plan, kw, view.cycle, negBase]);
  const st = shared.data;
  // Comments flagged "Needs action" in the 💬 Comments panel become actions.
  const cm = useShared('/api/comments');
  const feedback: Action[] = Object.entries(cm.data as Record<string, Comment>).filter(([, c]) => c.needsAction && !c.resolved && !c.deleted && (c.text ?? '').trim()).map(([id, c]) => ({
    id: hash(`comment|${id}`), commentId: id, source: `Comment · ${c.name}`, kind: (SETUP_WORDS.test(String(c.text)) ? 'Setup' : 'Feedback') as Kind, platform: (/meta/i.test(`${c.anchor} ${c.text}`) ? 'Meta' : /google|adwords|pmax|search/i.test(`${c.anchor} ${c.text}`) ? 'Google Ads' : /linkedin/i.test(`${c.anchor} ${c.text}`) ? 'LinkedIn' : 'Tracking') as Platform,
    priority: 'High' as const, school: ['CAAS', 'SHMS', 'HIM', 'CRCS'].find((x) => `${c.anchor} ${c.text}`.includes(x)) ?? 'All', country: '', entity: `${c.page} › ${c.anchor ?? ''}`, text: String(c.text), dims: {},
  }));
  const known = new Map([...actions, ...feedback].map((a) => [a.id, a]));
  // done / dismissed actions that no longer fire still show (from storage)
  const stored: Action[] = Object.entries(st).filter(([id, e]) => !known.has(id) && (e.resolved || e.dismissed || (e.source === 'realloc' && e.approved))).map(([id, e]) => ({ id, platform: storedPlatform(e), kind: storedKind(e), budget: storedBudget(e), priority: (e.priority as Action['priority']) ?? 'Medium', school: String(e.school ?? ''), country: e.country ? marketName(String(e.country)) : '', entity: String(e.entity ?? ''), text: String(e.actionText ?? ''), dims: (e.dims as Action['dims']) ?? {}, source: e.source === 'realloc' ? `Approved reallocation${e.note ? ` · "${String(e.note)}"` : ''}` : String(e.source ?? '') }));
  const all = [...actions.map((a) => ({ ...a, source: a.source ?? 'Rule' })), ...feedback, ...stored].map(withPriority).filter((a) => (!filter.dims.school?.length || filter.dims.school.includes(a.school) || a.school === 'All'));
  const isDone = (a: Action) => !!st[a.id]?.resolved, isDis = (a: Action) => !!st[a.id]?.dismissed;
  const isOpen = (a: Action) => !isDone(a) && !isDis(a);
  // platform and type filters narrow each other, so the counts on one row follow the choice on the other
  const kindOk = (a: Action) => kindTab === 'All' || a.kind === kindTab, platOk = (a: Action) => tab === 'All' || a.platform === tab;
  const shown = all.filter((a) => platOk(a) && kindOk(a));
  const platformTabs = PLATFORMS.filter((p) => p !== 'LinkedIn' || all.some((a) => a.platform === p));
  // money at stake = the entity's spend in the last 14 days; every budget action is in this week's table, each owner also gets the top 8 others, the rest wait in the backlog
  const stakeOf = useMemo(() => {
    const y = refDate(store.lastDate), dates = Array.from({ length: 14 }, (_, i) => addD(y, -i));
    const cache = new Map<string, number>();
    return (a: Action) => {
      const k = JSON.stringify(a.dims);
      if (!cache.has(k)) cache.set(k, Object.keys(a.dims).length ? (aggregate(store, { cycle: '*', weeks: null, months: null, dims: a.dims, dates }).get('')?.cost ?? 0) : 0);
      return cache.get(k)!;
    };
  }, [store]);
  const PR = { High: 0, Medium: 1, Low: 2 };
  // priority first; among equals set-up problems go first, then the most money at stake
  const byUrgency = (a: Action, b: Action) => PR[a.priority] - PR[b.priority] || Number(b.kind === 'Setup') - Number(a.kind === 'Setup') || stakeOf(b) - stakeOf(a);
  const allOpen = all.filter(isOpen).sort(byUrgency);
  const TOP = 8;
  const weekSet = pickWeek(allOpen, (a) => ownerOf(a).name, TOP); // budget actions are never in the backlog
  const [showBacklog, setShowBacklog] = useState(false);
  const open = shown.filter((a) => isOpen(a) && weekSet.has(a.id)).sort(byUrgency);
  const backlog = shown.filter((a) => isOpen(a) && !weekSet.has(a.id)).sort(byUrgency);
  const done = shown.filter(isDone), dismissed = shown.filter((a) => isDis(a) && !isDone(a));
  // approved budget moves: 2 weeks after approval, compare the forecast with what happened to the two options
  const forecastCheck = (a: Action) => {
    const e = st[a.id]; if (!e || e.source !== 'realloc' || !e.forecastNet || !e.approvedAt) return null;
    const from = String(e.approvedAt), y = refDate(store.lastDate), days = Math.round((Date.parse(y) - Date.parse(from)) / 864e5);
    if (days < 14) return { verdict: 'Too early', text: `Checked 14 days after approval (${days}/14 days so far). Forecast: +${Number(e.forecastNet).toFixed(1)} good leads in 4 weeks.` };
    const win = (start: string, n: number) => Array.from({ length: n }, (_, i) => addD(start, i));
    const g = (ds: string[]) => aggregate(store, { cycle: '*', weeks: null, months: null, dims: a.dims, dates: ds }).get('')?.gl ?? 0;
    const before = g(win(addD(from, -14), 14)), after = g(win(addD(from, 1), 14)), actual = after - before, expected = Number(e.forecastNet) / 2;
    const verdict = actual >= expected * 0.5 ? 'Better' : actual < 0 ? 'Worse' : 'Mixed';
    return { verdict, text: `Forecast for 2 weeks: +${expected.toFixed(1)} GL · actual: ${actual >= 0 ? '+' : ''}${actual} GL (${before} → ${after}). ${verdict === 'Better' ? 'Forecast held.' : verdict === 'Worse' ? 'Went the wrong way — review the rule.' : 'Weaker than forecast.'}` };
  };
  const meta = (a: Action) => ({ platform: a.platform, kind: a.kind, budget: !!a.budget, priority: a.priority, school: a.school, country: a.country, entity: a.entity, actionText: a.text, dims: a.dims });
  const save = (a: Action) => {
    if (!edit || !f1.trim() || (edit.mode === 'done' && !f2.trim())) return;
    if (edit.mode === 'done') {
      if (a.commentId) void cm.save(a.commentId, { data: { resolved: true } });
      void shared.save(a.id, { data: { ...meta(a), resolved: true, dismissed: false, note: f1.trim(), why: f2.trim(), resolvedAt: today, resolvedWeek: week } });
    } else void shared.save(a.id, { data: { ...meta(a), dismissed: true, resolved: false, reason: f1.trim(), dismissedAt: today, dismissedWeek: week } });
    setEdit(null); setF1(''); setF2('');
  };
  const reopen = (a: Action) => { if (a.commentId) void cm.save(a.commentId, { data: { resolved: false } }); void shared.save(a.id, { data: { resolved: false, dismissed: false, resolvedAt: null, dismissedAt: null } }); };
  const startEdit = (a: Action, mode: 'done' | 'dismiss') => { setEdit({ id: a.id, mode }); setF1(''); setF2(''); };
  const since = (a: Action, d: string) => impact(store, a.dims, d);
  const lastWeekDone = all.filter((a) => isDone(a) && st[a.id]?.resolvedWeek === lastWeek).map((a) => ({ a, e: st[a.id] as Entry, im: since(a, String(st[a.id]?.resolvedAt)) }));
  const better = lastWeekDone.filter((x) => x.im.verdict === 'Better').length, worse = lastWeekDone.filter((x) => x.im.verdict === 'Worse').length;
  // Thursday review: this week's done / dismissed, and open actions whose results kept getting worse since Monday
  const doneWk = all.filter((a) => isDone(a) && st[a.id]?.resolvedWeek === week), disWk = all.filter((a) => isDis(a) && st[a.id]?.dismissedWeek === week);
  const stale = all.filter((a) => !isDone(a) && !isDis(a) && weekSet.has(a.id)).map((a) => ({ a, im: since(a, addD(monday, -1)) })).filter((x) => x.im.verdict === 'Worse');

  const openRow = (a: Action) => (
    <Fragment key={a.id}>
      <tr data-cmt={`${a.platform} · ${a.entity.slice(0, 40)}: ${a.text.slice(0, 50)}`}>
        <td><span className={`prio p-${a.priority}`}>{a.priority}</span></td>
        <td><span className={`plat plat-${a.platform.replace(/\s/g, '')}`}>{a.platform}</span><div className="kindrow"><span className={`kind k-${a.kind.replace(/\s/g, '')}`} title={KIND_HELP[a.kind]}>{a.kind}</span></div></td>
        <td>{label(a.school)}{a.country && <div className="dim">{a.country}</div>}</td>
        <td className="act-text"><b>{a.text}</b><div className="dim ent">{a.entity}</div><div className={`src ${a.source?.startsWith('Comment') ? 'boss' : a.source?.startsWith('Approved') ? 'appr' : ''}`}>{a.source}</div></td>
        <td>{ownerOf(a).name}</td><td>{stakeOf(a) ? `CHF ${f0(stakeOf(a))}` : '–'}</td><td className={today > deadline ? 'bad' : ''}>{fmtDay(deadline)}</td>
        <td><div className="actbtns"><button className="btn-done" onClick={() => startEdit(a, 'done')}>✓ Done</button><button className="btn-dis" onClick={() => startEdit(a, 'dismiss')}>✕ Dismiss</button></div></td>
      </tr>
      {edit?.id === a.id && (
        <tr className="editrow"><td colSpan={8}>
          <div className="editform">
            <b>{edit.mode === 'done' ? 'Mark done — what did you change, and why?' : 'Dismiss — why is this not needed?'}</b>
            <textarea className="bossnote" autoFocus placeholder={edit.mode === 'done' ? 'What changed (e.g. paused 2 ads, budget 40 → 25/day)…' : 'Reason (e.g. campaign ends Friday, already fixed in the CRM)…'} value={f1} onChange={(e) => setF1(e.target.value)} />
            {edit.mode === 'done' && <textarea className="bossnote" placeholder="Why (e.g. CPL 3× benchmark with no good leads in 14 days)…" value={f2} onChange={(e) => setF2(e.target.value)} />}
            <div><button className="cmt-btn" disabled={!f1.trim() || (edit.mode === 'done' && !f2.trim())} onClick={() => save(a)}>Save</button> <button className="linkbtn" onClick={() => setEdit(null)}>Cancel</button></div>
          </div>
        </td></tr>
      )}
    </Fragment>
  );
  const resultCell = (a: Action, from: string) => { const im = since(a, from); return <td style={{ textAlign: 'left', whiteSpace: 'normal', minWidth: 260 }}><span className={`chip ${im.verdict.split(' ')[0]}`}>{im.verdict}</span><div className="dim">{im.text}</div></td>; };

  // ---------------- Slack messages (read by the scheduled routines; also copyable)
  const origin = typeof location !== 'undefined' ? location.origin : '';
  const ownerMsg = (plat: 'google' | 'meta') => {
    const o = OWNERS[plat], ch = plat === 'google' ? 'Google' : 'Meta', sum = weekSummary(store, ch);
    const mine = allOpen.filter((a) => ownerOf(a) === o && weekSet.has(a.id)); // same list as this week's table
    const lines: string[] = [];
    if (ref && plat === 'google') {
      for (const r of googleReview(store, ref.bench, ref.setup).critical.slice(0, 6)) lines.push(`• *${r.campaign}* (${r.school} ${marketName(r.country)})\n   _What:_ ${r.alerts[0].title}. _Why:_ ${r.alerts[0].detail} _Next:_ ${r.alerts[0].action}`);
    }
    if (ref && plat === 'meta') {
      for (const m of metaReview(store, ref.bench).markets.filter((x) => x.flag === 'red' || x.flag === 'amber').slice(0, 6)) lines.push(`• *${m.school} ${marketName(m.country)} — ${m.segment}* ${m.flag === 'red' ? '🔴' : '🟡'}\n   _What:_ ${m.brief.split('. ')[0]}. _Why:_ ${m.story.split(' L14:')[0]} _Next:_ ${m.action || 'Hold.'}`);
    }
    const input = mine.filter((a) => a.source?.startsWith('Comment') || /tracking|CRM|UTM|form/i.test(a.text)).slice(0, 5).map((a) => `• ${a.text} — ${a.entity}`);
    return [
      `*SEG ${ch === 'Google' ? 'Google Ads' : 'Meta'} — action list, week of ${weekRange(week)}* · owner <@${o.slack}> · deadline *${fmtDay(deadline)}*`,
      `*Last week (${weekRange(sum.lw)} vs ${weekRange(sum.pw)}, ACT campaigns; data through ${store.lastDate}):* ${sum.text}`,
      `*Campaigns to look at:*\n${lines.join('\n') || '• Nothing critical this week.'}`,
      `*Your ${mine.length} actions this week* (${allOpen.filter((a) => ownerOf(a) === o).length - mine.length} more in the backlog) → ${origin}/#/actions (tick ✓ Done with what changed + why, or ✕ Dismiss with a reason, by ${fmtDay(deadline)})`,
      input.length ? `*Input needed from you:*\n${input.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');
  };
  const thursday = [
    `*SEG actions — Thursday review, week of ${weekRange(week)}*`,
    `✅ Done: ${doneWk.length} · ✕ Dismissed: ${disWk.length} · ⏳ Still open this week: ${allOpen.filter((a) => weekSet.has(a.id)).length} (backlog ${allOpen.length - weekSet.size})`,
    doneWk.length ? `*Done — data before vs after the change:*\n${doneWk.slice(0, 8).map((a) => { const im = since(a, String(st[a.id]?.resolvedAt)); return `• ${a.text} (${a.entity}) — changed: ${String(st[a.id]?.note ?? '')}\n   → *${im.verdict}*: ${im.text}`; }).join('\n')}` : '',
    disWk.length ? `*Dismissed — reason and data since:*\n${disWk.slice(0, 8).map((a) => { const im = since(a, String(st[a.id]?.dismissedAt)); return `• ${a.text} — reason: ${String(st[a.id]?.reason ?? '')}\n   → *${im.verdict}*: ${im.text}`; }).join('\n')}` : '',
    stale.length ? `*⚠️ No action yet and results got worse since Monday:*\n${stale.slice(0, 10).map(({ a, im }) => `• <@${ownerOf(a).slack}> ${a.text} (${a.entity}) — ${im.text}`).join('\n')}` : '*No untouched action is getting worse.* 👍',
    `${origin}/#/actions`,
  ].filter(Boolean).join('\n\n');
  const g = weekSummary(store, 'Google'), mt = weekSummary(store, 'Meta');
  const monday2 = [
    `*SEG weekly performance review — week of ${weekRange(week)}* 👋 team`,
    `Please open the dashboard, review last week and leave comments anywhere with 💬 *Comments* (bottom right): point to a table / row, tag people with @Name, tick *Needs action* when something must change. When you are done, press *Send my comments to Slack*.`,
    `*Google Ads (${weekRange(g.lw)}):* ${g.text}\n*Meta (${weekRange(mt.lw)}):* ${mt.text}`,
    `${origin}/#/performance`,
  ].join('\n\n');
  const MSGS: [string, string, string][] = [['tue-google', 'Tuesday · Google Ads (→ John)', ownerMsg('google')], ['tue-meta', 'Tuesday · Meta (→ Phoebe)', ownerMsg('meta')], ['thu-review', 'Thursday · review', thursday], ['mon-team', 'Monday · team review call', monday2]];
  const [msgTab, setMsgTab] = useState('tue-google');

  const HEAD = <thead><tr><th>Priority</th><th>Platform · type</th><th>School · country</th><th style={{ textAlign: 'left' }}>Action</th><th>Owner</th><th>Spend 14d</th><th>Deadline</th><th>Done / dismiss</th></tr></thead>;
  return (
    <>
      <div className="pagehead"><div><h2 className="page">Actions</h2><p className="lede">This week's actions ({weekRange(week)}) per platform. Owners: Google Ads → John, Meta → Phoebe; deadline <b>{fmtDay(deadline)}</b>. <b>✓ Done</b> needs what changed and why; <b>✕ Dismiss</b> needs a reason. Next week each change is checked against its results. <a href="#/must-read">Rules</a></p></div></div>
      {shared.error && <p className="warnbox">{shared.error}</p>}
      <Block tone="tables" n="To do" title={`This week · ${open.length} actions`} sub={`Every budget action, plus the top ${TOP} other actions per owner. Sorted by priority (set-up problems first), then the spend behind each one (last 14 days). The rest waits in the backlog below. The platform and type filters apply to every list on this page.`} right={
        <div className="seg">{(['All', ...platformTabs] as const).map((p) => <button key={p} className={tab === p ? 'on' : ''} onClick={() => setTab(p)}>{p} <span className="count">{all.filter((a) => (p === 'All' || a.platform === p) && kindOk(a) && isOpen(a)).length}</span></button>)}</div>}>
        <div className="kindbar"><span className="dim">Type</span>
          <div className="seg">{(['All', ...KINDS] as const).map((k) => <button key={k} className={kindTab === k ? 'on' : ''} title={k === 'All' ? 'Every type of problem' : KIND_HELP[k]} onClick={() => setKindTab(k)}>{k} <span className="count">{all.filter((a) => (k === 'All' || a.kind === k) && platOk(a) && isOpen(a)).length}</span></button>)}</div>
        </div>
        {!ref ? <p className="note">Loading…</p> : open.length === 0 ? (tab !== 'All' || kindTab !== 'All') && allOpen.length ? <p className="dim">No actions this week with this filter ({allOpen.length} open in total).</p> : <p className="good">Nothing open. 🎉</p> : (
          <div className="tablewrap"><table className="t actions-t">{HEAD}<tbody>{open.map(openRow)}</tbody></table></div>
        )}
      </Block>
      <Block tone="tables" n="Backlog" title={`Backlog · ${backlog.length}`} sub="Lower priority or less money at stake. They move up when this week's list is done or dismissed." right={<button className="linkbtn" onClick={() => setShowBacklog(!showBacklog)}>{showBacklog ? 'Hide' : 'Show'}</button>}>
        {showBacklog && (backlog.length ? <div className="tablewrap"><table className="t actions-t">{HEAD}<tbody>{backlog.map(openRow)}</tbody></table></div> : <p className="dim">Empty.</p>)}
      </Block>
      <Block tone="tables" n="Done" title={`Done · ${done.length}`} sub="What changed, why, and what happened after: the entity's results 7 days before vs the days since (daily rate). Good leads lag, so read quality after 1–2 weeks.">
        {done.length ? <div className="tablewrap"><table className="t actions-t">
          <thead><tr><th style={{ textAlign: 'left' }}>Action</th><th style={{ textAlign: 'left' }}>What changed</th><th style={{ textAlign: 'left' }}>Why</th><th>Done</th><th style={{ textAlign: 'left' }}>Effect after the change</th><th style={{ textAlign: 'left' }}>Budget move: forecast vs actual</th><th /></tr></thead>
          <tbody>{done.map((a) => { const e = st[a.id]; return (
            <tr key={a.id} data-cmt={`Done · ${a.entity.slice(0, 40)}: ${a.text.slice(0, 50)}`}><td className="act-text"><b>{a.text}</b><div className="dim ent">{a.platform} · {a.kind} · {a.entity}</div></td><td className="act-text">{String(e?.note ?? '') || <span className="dim">—</span>}</td><td className="act-text">{String(e?.why ?? '') || <span className="dim">—</span>}</td>
              <td>{String(e?.resolvedAt ?? '')}<div className="dim">by {String(e?.by ?? '')}</div></td>{resultCell(a, String(e?.resolvedAt))}
              <td style={{ textAlign: 'left', whiteSpace: 'normal', minWidth: 220 }}>{(() => { const fc = forecastCheck(a); return fc ? <><span className={`chip ${fc.verdict.split(' ')[0]}`}>{fc.verdict === 'Better' ? 'Held' : fc.verdict === 'Worse' ? 'Wrong' : fc.verdict === 'Mixed' ? 'Weaker' : fc.verdict}</span><div className="dim">{fc.text}</div></> : <span className="dim">—</span>; })()}</td>
              <td><button className="linkbtn" onClick={() => reopen(a)}>Reopen</button></td></tr>); })}</tbody>
        </table></div> : <p className="dim">Nothing done yet.</p>}
      </Block>
      <Block tone="tables" n="Dismissed" title={`Dismissed · ${dismissed.length}`} sub="Actions the owner decided not to take, with the reason — and how the entity has done since.">
        {dismissed.length ? <div className="tablewrap"><table className="t actions-t">
          <thead><tr><th style={{ textAlign: 'left' }}>Action</th><th style={{ textAlign: 'left' }}>Reason</th><th>Dismissed</th><th style={{ textAlign: 'left' }}>Results since</th><th /></tr></thead>
          <tbody>{dismissed.map((a) => { const e = st[a.id]; return (
            <tr key={a.id} data-cmt={`Dismissed · ${a.entity.slice(0, 40)}: ${a.text.slice(0, 50)}`}><td className="act-text"><b>{a.text}</b><div className="dim ent">{a.platform} · {a.kind} · {a.entity}</div></td><td className="act-text">{String(e?.reason ?? '')}</td>
              <td>{String(e?.dismissedAt ?? '')}<div className="dim">by {String(e?.by ?? '')}</div></td>{resultCell(a, String(e?.dismissedAt))}<td><button className="linkbtn" onClick={() => reopen(a)}>Reopen</button></td></tr>); })}</tbody>
        </table></div> : <p className="dim">Nothing dismissed.</p>}
      </Block>
      <Block tone="analysis" n="Review" title={`Thursday review · ${weekRange(week)}`} sub="Reviewed in the data: for every action done or dismissed this week, the entity's results 7 days before vs the days since; for open actions nobody touched, whether the numbers got worse since Monday. The summary is posted to Slack on Thursday.">
        <p><b>{doneWk.length}</b> done · <b>{disWk.length}</b> dismissed · <b>{stale.length}</b> untouched and getting worse.</p>
        {stale.length > 0 && <ul>{stale.slice(0, 12).map(({ a, im }) => <li key={a.id}><b>{ownerOf(a).name}:</b> {a.text} <span className="dim">({a.entity})</span> — {im.text}</li>)}</ul>}
      </Block>
      <Block tone="analysis" n="Last week" title={`What changed last week (${weekRange(lastWeek)}) and did it work?`}>
        {lastWeekDone.length === 0 ? <p className="dim">No actions were done last week.</p> : (
          <p><b>{lastWeekDone.length} done</b>: {better} improved, {worse} got worse, {lastWeekDone.length - better - worse} stable or too early.{better > 0 && ` Worked: ${lastWeekDone.filter((x) => x.im.verdict === 'Better').slice(0, 3).map((x) => x.a.entity).join('; ')}.`}</p>
        )}
      </Block>
      <Block tone="cards" n="Slack" title="Slack messages" sub="Posted by the weekly routines: Monday team review call (#seg-paid-media), Tuesday action lists for John (Google) and Phoebe (Meta), Thursday review. Copy one to send it by hand.">
        <div className="seg wrap">{MSGS.map(([k, l]) => <button key={k} className={msgTab === k ? 'on' : ''} onClick={() => setMsgTab(k)}>{l}</button>)}</div>
        {MSGS.map(([k, , t]) => <pre key={k} data-digest={k} className="digest" hidden={msgTab !== k}>{t}</pre>)}
        <button className="btn-o" onClick={() => void navigator.clipboard?.writeText(MSGS.find(([k]) => k === msgTab)![2])}>Copy message</button>
      </Block>
    </>
  );
}
