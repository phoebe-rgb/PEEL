import { useEffect, useMemo, useState } from 'react';
import { useCtx } from './components';
import { countryCodes, marketName } from './lib/names';
import { MiniCards, READ_ITEMS, WeekChart } from './weekly';
import { googleReview, metaReview, type Benchmarks, type Flag, type GoogleResult, type MarketResult, type Setup } from './lib/rules';

type Ref = { bench: Benchmarks; setup: Setup };
let refCache: Promise<Ref> | null = null;
/** Benchmarks + Google campaign setup: synced copy from KV, else the static snapshot shipped with the build. */
function getJson<T>(api: string, file: string): Promise<T> {
  return fetch(api).then((r) => (r.ok ? (r.json() as Promise<T | null>) : null)).catch(() => null)
    .then((live) => live ?? (fetch(file).then((r) => r.json()) as Promise<T>));
}
type FreqRow = { reach: number; impr: number; spend: number } | null;
type Freq = { asOf: string; window: [string, string]; prevWindow: [string, string]; campaigns: Record<string, { cur: FreqRow; prev: FreqRow }> };
let freqCache: Promise<Freq | null> | null = null;
/** Meta reach & frequency per campaign (Funnel has neither): synced copy in KV, else the snapshot shipped with the build. */
function useMetaFreq() {
  const [v, setV] = useState<Freq | null>(null);
  useEffect(() => { freqCache ??= getJson<Freq | null>('/api/metafreq', '/data/meta_freq.json').catch(() => null); freqCache.then(setV); }, []);
  return v;
}
const k0 = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
/** One line for the read: reach and frequency now vs the week before, and what it means. */
function freqNote(f: Freq, campaigns: string[], retargeting: boolean): string | null {
  const sum = (w: 'cur' | 'prev') => campaigns.reduce((a, c) => { const r = f.campaigns[c]?.[w]; return r ? { reach: a.reach + r.reach, impr: a.impr + r.impr } : a; }, { reach: 0, impr: 0 });
  const a = sum('cur'), b = sum('prev');
  if (!a.reach) return null;
  const fr = a.impr / a.reach, fp = b.reach ? b.impr / b.reach : NaN;
  const up = Number.isFinite(fp) && fr > fp * 1.2, reachDown = b.reach > 0 && a.reach < b.reach * 0.85;
  const limit = retargeting ? 5 : 3;
  const read = fr >= limit ? `high for ${retargeting ? 'retargeting' : 'prospecting'} — the same people see the ads too often: refresh creatives or widen the audience`
    : up && reachDown ? 'rising while reach falls — the audience is starting to saturate' : up ? 'rising — watch creative fatigue' : 'healthy';
  return `Reach & frequency (${f.window[0].slice(5)}–${f.window[1].slice(5)}, Meta): reach ${k0(a.reach)}${b.reach ? ` (prev ${k0(b.reach)})` : ''}, frequency ${fr.toFixed(2)}${Number.isFinite(fp) ? ` (prev ${fp.toFixed(2)})` : ''} — ${read}.`;
}

export function useRefData(): Ref | null {
  const [v, setV] = useState<Ref | null>(null);
  useEffect(() => {
    refCache ??= Promise.all([getJson<Benchmarks>('/api/bench', '/data/benchmarks.json'), getJson<Setup>('/api/setup', '/data/setup.json')])
      .then(([bench, setup]) => ({ bench, setup }));
    refCache.then(setV);
  }, []);
  return v;
}

const EMOJI: Record<Flag, string> = { red: '🔴', amber: '🟡', green: '🟢', none: '' };
const WORD: Record<Flag, string> = { red: 'Needs action', amber: 'Watch', green: 'Good', none: 'No spend' };
const chf = (n: number | null | undefined, d = 0) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : `CHF ${n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })}`);
const pct = (n: number | null) => (n === null || !Number.isFinite(n) ? '—' : `${(n * 100).toFixed(1)}%`);


// ---------------------------------------------------------------- Google

function GoogleCard({ r, i, kind }: { r: GoogleResult; i: number; kind: 'critical' | 'scale' }) {
  const bm = r.bench;
  const dims = { channel: ['Google'], campaign: [r.campaign] };
  return (
    <div className={`readcard ${kind === 'critical' ? 'red' : 'green'}`}>
      <div className="rc-head">
        <div><b>{kind === 'critical' ? '🔴' : '🟢'} {r.campaign}</b>
          <div className="dim">{r.school} · {marketName(r.country)} · budget {r.dailyBudget === null ? 'unknown' : `${chf(r.dailyBudget)}/day`} · {r.shortWindow}-day check{r.setupNote ? ` · ${r.setupNote}` : ''}{bm ? ` · benchmark CPL ${chf(bm.cpl, 0)}, CPGL ${chf(bm.cpgl, 0)}` : ''}</div></div>
      </div>
      <div className="rc-body">
        <div className="rc-left">
          <MiniCards dims={dims} items={READ_ITEMS} />
          {kind === 'critical' ? (
            <>
              <ul className="alerts">{r.alerts.map((a) => <li key={a.rule}><b>{a.title}.</b> {a.detail}</li>)}</ul>
              <div className="todo"><b>Actions</b><ol>{[...new Set(r.alerts.map((a) => a.action))].map((a) => <li key={a}>{a}</li>)}</ol></div>
            </>
          ) : r.scale && (<><p>{r.scale.detail}</p><div className="todo"><b>Action</b> 👉 {r.scale.action}</div></>)}
        </div>
        <div className="rc-right"><WeekChart dims={dims} /></div>
      </div>
    </div>
  );
}

/** School → country grouping (the dashboard-wide breakdown order). */
function Grouped({ rows, kind }: { rows: GoogleResult[]; kind: 'critical' | 'scale' }) {
  let i = 0;
  const schools = [...new Set(rows.map((r) => r.school))];
  return <>{schools.map((sc) => {
    const rs = rows.filter((r) => r.school === sc);
    const countries = [...new Set(rs.map((r) => r.country))];
    return <div key={sc}><h4>{sc}</h4>{countries.map((cc) => <div key={cc} className="grp"><div className="grp-head">{marketName(cc)}</div>
      {rs.filter((r) => r.country === cc).map((r) => <GoogleCard key={r.campaign} r={r} i={i++} kind={kind} />)}</div>)}</div>;
  })}</>;
}

export function GoogleActions({ compact = false }: { compact?: boolean }) {
  const { store, filter } = useCtx();
  const ref = useRefData();
  const school = filter.dims.school?.[0];
  const codes = useMemo(() => filter.dims.country?.length ? filter.dims.country.flatMap(countryCodes) : null, [filter.dims.country]);
  const g = useMemo(() => {
    if (!ref) return null;
    const x = googleReview(store, ref.bench, ref.setup, school);
    // the country filter keeps the campaigns aimed at that country (country code in the campaign name)
    return codes ? { ...x, critical: x.critical.filter((r) => codes.includes(r.country)), scale: x.scale.filter((r) => codes.includes(r.country)) } : x;
  }, [store, ref, school, codes]);
  if (!g) return <p className="note">Loading benchmarks…</p>;
  return (
    <>
      <h3>Google Ads — ACT campaign daily review (as of {g.asOf})</h3>
      <p className="note">
        {g.reviewed} active ACT campaigns reviewed · {g.critical.length} critical · {g.scale.length} scale opportunities · skipped {g.skippedRecent} changed in the last 3 days and {g.skippedPaused} paused (per the setup tabs).
        Rules from the PPC daily review: daily budget ≥ CHF 20 → 3-day lead check, otherwise 7-day; CPL / CpGL alert only above 150% of the
        School×Country benchmark ("Bench Mark" tab); trend alert when CPL or CpGL is +30% vs the previous same window; good-lead quality on 14 days.
        {g.noBenchmark.length > 0 && <> No benchmark for {g.noBenchmark.join(', ')} — only trend rules apply there.</>}
      </p>
      {g.critical.length === 0 && <p>✅ No critical signals.</p>}
      {compact ? g.critical.slice(0, 3).map((r, i) => <GoogleCard key={r.campaign} r={r} i={i} kind="critical" />) : <Grouped rows={g.critical} kind="critical" />}
      {g.scale.length > 0 && <h4 style={{ marginTop: 18 }}>Scale opportunities</h4>}
      {compact ? g.scale.slice(0, 2).map((r, i) => <GoogleCard key={r.campaign} r={r} i={i} kind="scale" />) : <Grouped rows={g.scale} kind="scale" />}
    </>
  );
}

// ---------------------------------------------------------------- Meta

type Win = MarketResult['l7'];
const COLS: { k: string; l: string; w: 'l7' | 'l14'; v: (x: Win) => number | null; money?: boolean; cost?: boolean }[] = [
  { k: 'cost', l: 'Spend L7', w: 'l7', v: (x) => x.cost, money: true }, { k: 'leads', l: 'Leads L7', w: 'l7', v: (x) => x.leads }, { k: 'cpl', l: 'CPL L7', w: 'l7', v: (x) => x.cpl, cost: true },
  { k: 'gl', l: 'GL L14', w: 'l14', v: (x) => x.gl }, { k: 'cpgl', l: 'CPGL L14', w: 'l14', v: (x) => x.cpgl, cost: true },
  { k: 'reg', l: 'Register L14', w: 'l14', v: (x) => x.reg }, { k: 'cpreg', l: 'CPReg L14', w: 'l14', v: (x) => x.cpreg, cost: true },
  { k: 'app', l: 'Applied L14', w: 'l14', v: (x) => x.app }, { k: 'cpapp', l: 'CPApp L14', w: 'l14', v: (x) => x.cpapp, cost: true },
  { k: 'acc', l: 'Accepted L14', w: 'l14', v: (x) => x.acc }, { k: 'cpacc', l: 'CPAcc L14', w: 'l14', v: (x) => x.cpacc, cost: true },
];
/** Ad set / ad table: last 7 days for spend and leads, last 14 for good leads and later stages; small line = vs P7 / P14. */
const ABBR: [RegExp, string][] = [[/QualifiedLeads?/gi, 'QL'], [/Look-?a-?like/gi, 'LAL'], [/WebVisitors?/gi, 'WebV'], [/AdvantagePlus/gi, 'Adv+'], [/Hospitality/gi, 'Hosp'], [/StudyAbroad/gi, 'StudyAbr'], [/Europe/gi, 'EU'], [/Interests?/gi, 'Int'], [/Parents?/gi, 'Par'], [/Culinary/gi, 'Cul'], [/Management|Mgmt/gi, 'Mgmt'], [/BestAds/gi, 'Best']];
/** Ad-set names in one card share their start (Region_Country_Level_…): keep only the part that differs, abbreviated. */
function trimNames(names: string[]): Map<string, string> {
  const toks = names.map((n) => n.split('_'));
  let common = 0;
  if (toks.length > 1) while (toks.every((t) => t.length > common + 1 && t[common] === toks[0][common])) common++;
  else common = Math.max(0, toks[0]?.length - 2);
  return new Map(names.map((n, i) => [n, ABBR.reduce((a, [r, x]) => a.replace(r, x), toks[i].slice(common).join('_')) || n]));
}

function WinTable({ first, rows, trim = false }: { first: string; rows: { name: string; l7: Win; p7: Win; l14: Win; p14: Win; verdict?: string }[]; trim?: boolean }) {
  const short = trim ? trimNames(rows.map((r) => r.name)) : null;
  const n = (v: number | null, c?: boolean) => (v === null || !Number.isFinite(v) ? '—' : c ? (v >= 100 ? v.toFixed(0) : v.toFixed(1)) : v.toFixed(0));
  const ch = (a: number | null, b: number | null, cost?: boolean, money?: boolean) => {
    if (a === null || b === null) return <span className="wt-d">—</span>;
    if (b === 0) return <span className={`wt-d ${a > 0 ? (cost ? 'down' : money ? '' : 'up') : ''}`}>{a > 0 ? 'new' : '0'}</span>;
    const d = (a - b) / b, cls = money || Math.abs(d) < 0.1 ? '' : (d > 0) !== !!cost ? 'up' : 'down';
    return <span className={`wt-d ${cls}`}>{d >= 0 ? '+' : '−'}{Math.abs(d * 100).toFixed(0)}%</span>;
  };
  return (
    <div className="tablewrap sp-scroll"><table className="t compact wt">
      <colgroup><col className="wt-name" />{COLS.map((c) => <col key={c.k} className="wt-num" />)}<col className="wt-verdict" /></colgroup>
      <thead><tr><th>{first}</th>{COLS.map((c) => <th key={c.k}>{c.l}</th>)}<th style={{ textAlign: 'left' }}>Verdict</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.name}><td title={r.name}>{short?.get(r.name) ?? r.name}</td>
          {COLS.map((c) => { const cur = c.v(r[c.w]), prev = c.v(r[c.w === 'l7' ? 'p7' : 'p14']); return <td key={c.k}><div>{n(cur, c.cost)}</div>{ch(cur, prev, c.cost, c.money)}</td>; })}
          <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>{r.verdict ?? ''}</td></tr>
      ))}</tbody>
    </table></div>
  );
}

function Market({ m, detail }: { m: MarketResult; detail: boolean }) {
  const freq = useMetaFreq();
  const fn = freq ? freqNote(freq, m.campaigns, m.segment === 'Retargeting') : null;
  const title = `${marketName(m.country)} — ${m.segment}`;
  if (m.flag === 'none') return <div className="market none"><b>{title}</b> <span className="dim">— no spend in the last 7 days.</span></div>;
  const dims = { channel: ['Meta'], campaign: m.campaigns, market: [m.country] };
  return (
    <div className={`readcard ${m.flag}`}>
      <div className="rc-head"><div><b>{EMOJI[m.flag]} {title}</b> <span className={`chip ${m.flag === 'red' ? 'Worse' : m.flag === 'amber' ? 'Mixed' : 'Better'}`}>{WORD[m.flag]}</span>
        <div className="dim">{m.campaigns.length} campaign{m.campaigns.length === 1 ? '' : 's'}{m.bench ? ` · benchmark CPL ${chf(m.bench.cpl, 1)}, CPGL ${chf(m.bench.cpgl, 0)}` : ''}</div></div></div>
      <div className="rc-body">
        <div className="rc-left">
          <MiniCards dims={dims} items={READ_ITEMS} />
          <div className="todo"><b>Read:</b> {m.story.split('. Delivery')[0].split(' L14:')[0]}. <b>Action:</b> {m.action || 'Hold.'}</div>
          {fn && <div className="freqnote">📡 {fn}</div>}
        </div>
        <div className="rc-right"><WeekChart dims={dims} /></div>
      </div>
      {detail && (
        <div className="specialist">
          <div className="sp-title">Ad sets and {m.ads.length} ads — last 7 / 14 days</div>
          {m.adSets.length > 0 && <WinTable trim first="Ad set (common start removed)" rows={m.adSets.map((a) => ({ name: a.adSet, l7: a.l7, p7: a.p7, l14: a.l14, p14: a.p14, verdict: `${EMOJI[a.flag]} ${a.verdict}` }))} />}
          <WinTable first="Ad (variants merged)" rows={m.ads.map((a) => ({ name: a.ad, l7: a.l7, p7: a.p7, l14: a.l14, p14: a.p14, verdict: `${EMOJI[a.flag]} ${a.verdict}` }))} />
          <p className="note">*Ad-set leads only where the lead's UTM carries the ad set; verdicts are made at ad level. Per-ad CPGL is directional on small counts.</p>
        </div>
      )}
    </div>
  );
}

export function MetaActions({ compact = false }: { compact?: boolean }) {
  const { store, filter } = useCtx();
  const ref = useRefData();
  const school = filter.dims.school?.[0];
  const codes = useMemo(() => filter.dims.country?.length ? filter.dims.country.flatMap(countryCodes) : null, [filter.dims.country]);
  const r = useMemo(() => (ref ? metaReview(store, ref.bench, school) : null), [store, ref, school]);
  if (!r) return <p className="note">Loading benchmarks…</p>;
  const w = r.windows, act = r.markets.filter((m) => m.flag !== 'none' && m.segment !== 'Social Boosting' && (!codes || codes.includes(m.country)));
  const reds = act.filter((m) => m.flag === 'red'), ambers = act.filter((m) => m.flag === 'amber'), greens = act.filter((m) => m.flag === 'green');
  const t = r.tot, d = (a: number | null, b: number | null) => (a !== null && b !== null && b ? `${a >= b ? '+' : '−'}${Math.abs(((a - b) / b) * 100).toFixed(0)}%` : '—');
  const glUp = act.filter((m) => (m.l14.glr ?? 0) > (m.p14.glr ?? 0) && m.l14.leads >= 20).length;
  const best = [...greens].filter((m) => m.l14.gl >= 2 && m.l14.cpgl !== null).sort((a, b) => (a.l14.cpgl ?? 0) - (b.l14.cpgl ?? 0))[0];
  const name = (m: MarketResult) => `${m.school} ${marketName(m.country)} ${m.segment}`;
  const steps = [...reds.map((m) => `${name(m)}: ${m.action}`), ...greens.filter((m) => /benchmark|Fund/.test(m.action)).map((m) => `${name(m)}: ${m.action}`), ...ambers.slice(0, 3).map((m) => `${name(m)} (watch): ${m.action}`)];
  const schools = ['CAAS', 'HIM', 'SHMS', 'CRCS'];
  return (
    <>
      <h3>Meta — ACT weekly report</h3>
      <p className="note">CPL: L7 {w.L7[0]}…{w.L7[1]} vs P7 {w.P7[0]}…{w.P7[1]}. Quality/CPGL: L14 {w.L14[0]}…{w.L14[1]} vs P14 {w.P14[0]}…{w.P14[1]}. ACT only; leads and GL from Funnel (Salesforce).
        🔴 CPL &gt;20% worse (🟡 when 1–2 leads make it noise) or spend with no leads · 🟡 CPGL worse or not qualifying · 🟢 holding.</p>
      <div className="panel">
        <b>The week in one line:</b> ACT spent CHF {t.l7.cost.toFixed(0)} ({d(t.l7.cost, t.p7.cost)}) for {t.l7.leads} leads ({d(t.l7.leads, t.p7.leads)}); blended CPL CHF {t.l7.cpl?.toFixed(2) ?? '—'} vs {t.p7.cpl?.toFixed(2) ?? '—'}. {t.l14.gl} good leads in 14 days at CPGL CHF {t.l14.cpgl?.toFixed(0) ?? '—'} ({d(t.l14.cpgl, t.p14.cpgl)}). {reds.length} need action, {ambers.length} to watch, {greens.length} holding.
      </div>
      {!compact && schools.map((sc) => {
        const ms = r.markets.filter((m) => m.school === sc && (!codes || codes.includes(m.country)));
        if (!ms.length) return null;
        return <div key={sc}><h4>{sc}</h4>{ms.map((m) => <Market key={m.country + m.segment} m={m} detail />)}</div>;
      })}
      {compact && [...reds, ...ambers].slice(0, 4).map((m) => <Market key={m.school + m.country + m.segment} m={{ ...m, segment: `${m.school} · ${m.segment}` }} detail={false} />)}
      {!compact && (
        <>
          <h4>Our read</h4>
          <p>Blended CPL moved {d(t.l7.cpl, t.p7.cpl)} week on week, while 14-day good-lead cost moved {d(t.l14.cpgl, t.p14.cpgl)} and the good-lead rate went {(t.l14.glr ?? 0) >= (t.p14.glr ?? 0) ? 'up' : 'down'} ({pct(t.l14.glr)} vs {pct(t.p14.glr)}); {glUp} of {act.length} entries improved their GL rate.
            {reds.length ? ` The problems are ${reds.slice(0, 3).map(name).join(', ')}.` : ' Nothing needs urgent action.'}{best ? ` The upside is ${name(best)} (CPGL CHF ${best.l14.cpgl?.toFixed(0)}).` : ''}</p>
          <h4>Next steps</h4>
          {steps.length ? <ol>{steps.map((x) => <li key={x}>{x}</li>)}</ol> : <p>No action needed this week.</p>}
          <p className="note">Funnel splits the same creative across ad-name variants (_1/_3/– Copy); they are merged. GL and registrations lag by several days, so L7 GL undercounts and quality verdicts use L14. Retargeting and social-boosting leads cannot be country-attributed.</p>
        </>
      )}
    </>
  );
}

export function ActionsSummary() {
  return (
    <div className="actions-summary">
      <h3>Analysis & actions — ACT campaigns <a href="#/actions" style={{ fontSize: 13, fontWeight: 400 }}>full review →</a></h3>
      <div className="grid2">
        <div><GoogleActions compact /></div>
        <div><MetaActions compact /></div>
      </div>
    </div>
  );
}
