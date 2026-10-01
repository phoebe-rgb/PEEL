import { Fragment, useEffect, useMemo, useState } from 'react';
import { isoWeek, marketOf, weekDays } from './lib/data';
import { label } from './lib/format';
import { useCtx } from './components';
import { BarList, ColumnChart } from './charts';
import { reviewNegatives, type BaseNeg, type NegSuggestion } from './lib/negatives';

// Google Ads keyword + search-term report from the Sheet's <SCHOOL>_Keywords tabs (synced to KV `keywords`).
type KwLayer = { n: number; dims: Record<string, string[]>; cols: Record<string, number[]>; to: string };
export type Row = { day: string; school: string; campaign: string; market: string; adGroup: string; keyword: string; match: string; term: string; status: string; clicks: number; impr: number; cost: number; conv: number };
type Agg = { clicks: number; impr: number; cost: number; conv: number };
const zero = (): Agg => ({ clicks: 0, impr: 0, cost: 0, conv: 0 });
const add = (a: Agg, r: Agg) => { a.clicks += r.clicks; a.impr += r.impr; a.cost += r.cost; a.conv += r.conv; };

let cache: Promise<KwLayer | null> | null = null;
export function useKeywords(): { rows: Row[]; to: string } | null | undefined {
  const [v, setV] = useState<{ rows: Row[]; to: string } | null | undefined>(undefined);
  useEffect(() => {
    cache ??= fetch('/api/keywords').then((r) => (r.ok ? (r.json() as Promise<KwLayer | null>) : null)).catch(() => null)
      .then((live) => live ?? fetch('/data/keywords.json').then((r) => (r.ok ? (r.json() as Promise<KwLayer>) : null)).catch(() => null));
    cache.then((L) => {
      if (!L) return setV(null);
      const D = L.dims, C = L.cols;
      const rows: Row[] = [];
      for (let i = 0; i < L.n; i++) {
        const campaign = D.campaign[C.campaign[i]];
        rows.push({ day: D.day[C.day[i]], school: D.school[C.school[i]], campaign, market: marketOf(campaign), adGroup: D.ad_group[C.ad_group[i]], keyword: D.keyword[C.keyword[i]], match: D.match[C.match[i]], term: D.term[C.term[i]], status: D.status ? D.status[C.status[i]] ?? '' : '', clicks: C.clicks[i], impr: C.impr[i], cost: C.cost[i], conv: C.conv[i] });
      }
      setV({ rows, to: L.to });
    });
  }, []);
  return v;
}

const chf = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: v < 100 ? 2 : 0 }); // CHF, stated in the page intro
const n0 = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });
const cpa = (a: Agg) => (a.conv > 0 ? a.cost / a.conv : NaN);
const chg = (a: number, b: number, lowerBetter = false) => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  const d = (a - b) / Math.abs(b);
  return <b className={Math.abs(d) < 0.1 ? 'dim' : (d > 0) !== lowerBetter ? 'good' : 'bad'}>{d >= 0 ? '+' : '−'}{Math.abs(d * 100).toFixed(0)}%</b>;
};

function group(rows: Row[], key: (r: Row) => string) {
  const m = new Map<string, Agg>();
  for (const r of rows) { const k = key(r); let a = m.get(k); if (!a) { a = zero(); m.set(k, a); } add(a, r); }
  return m;
}

function Nested({ rows, by, title }: { rows: Row[]; by: (r: Row) => string; title: string }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const top = [...group(rows, by).entries()].sort((a, b) => b[1].cost - a[1].cost);
  return (
    <div className="tablewrap"><table className="t hier">
      <thead><tr><th>{title} › search term</th><th>Spend</th><th>Clicks</th><th>CPC</th><th>Conv.</th><th>Cost / conv.</th></tr></thead>
      <tbody>{top.map(([k, a]) => {
        const kids = open.has(k) ? [...group(rows.filter((r) => by(r) === k && r.clicks > 0), (r) => r.term).entries()].sort((x, y) => y[1].cost - x[1].cost).slice(0, 40) : [];
        return (
          <Fragment key={k}>
            <tr><td><button className="twisty" onClick={() => setOpen((o) => { const s = new Set(o); if (s.has(k)) s.delete(k); else s.add(k); return s; })}>{open.has(k) ? '▾' : '›'}</button>{label(k)}</td>
              <td>{chf(a.cost)}</td><td>{n0(a.clicks)}</td><td>{a.clicks ? (a.cost / a.clicks).toFixed(2) : '–'}</td><td>{n0(a.conv)}</td><td>{Number.isFinite(cpa(a)) ? chf(cpa(a)) : '–'}</td></tr>
            {kids.map(([t, b]) => <tr key={k + t} className="lvl1"><td style={{ paddingLeft: 30 }}>{t}</td><td>{chf(b.cost)}</td><td>{n0(b.clicks)}</td><td>{b.clicks ? (b.cost / b.clicks).toFixed(2) : '–'}</td><td>{n0(b.conv)}</td><td>{Number.isFinite(cpa(b)) ? chf(cpa(b)) : '–'}</td></tr>)}
          </Fragment>
        );
      })}</tbody>
    </table></div>
  );
}

export function P06Keywords() {
  const { filter } = useCtx();
  const data = useKeywords();
  const weeks = useMemo(() => (data ? [...new Set(data.rows.map((r) => isoWeek(r.day)))].sort() : []), [data]);
  const [week, setWeek] = useState(''); // an ISO week, or 'd<N>' = the last N days
  const [market, setMarket] = useState('');
  const [adGroup, setAdGroup] = useState('');
  const [showAll, setShowAll] = useState(false);
  if (data === undefined) return <p className="note">Loading keyword report…</p>;
  if (data === null || !data.rows.length) return <p className="note">No keyword report available.</p>;
  const w = week || 'd28';
  const school = filter.dims.school?.[0];
  const shiftD = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const nDays = w.startsWith('d') ? Number(w.slice(1)) : 0;
  const days = nDays ? Array.from({ length: nDays }, (_, i) => shiftD(data.to, i - nDays + 1)) : weekDays(w).filter((d) => d <= data.to);
  const span = nDays || 7;
  const prevDays = (nDays ? days : weekDays(w)).map((d) => shiftD(d, -span)).slice(0, days.length);
  const periodName = nDays ? `Last ${nDays} days` : w;
  const base = data.rows.filter((r) => (!school || r.school === school) && (!market || r.market === market) && (!adGroup || r.adGroup === adGroup));
  const cur = base.filter((r) => days.includes(r.day)), prev = base.filter((r) => prevDays.includes(r.day));
  const T = zero(), P = zero(); cur.forEach((r) => add(T, r)); prev.forEach((r) => add(P, r));
  const avgCpa = cpa(T), wasteAt = Math.max(20, Number.isFinite(avgCpa) ? avgCpa : 20);
  const kw = [...group(cur, (r) => `${r.keyword}\u0001${r.adGroup}\u0001${r.match}`).entries()].sort((a, b) => b[1].cost - a[1].cost);
  const terms = [...group(cur.filter((r) => r.clicks > 0), (r) => `${r.term}\u0001${r.keyword}`).entries()].sort((a, b) => b[1].cost - a[1].cost);
  const winners = kw.filter(([, a]) => a.conv >= 2 && cpa(a) <= avgCpa).slice(0, 5);
  const waste = kw.filter(([, a]) => a.conv === 0 && a.cost >= wasteAt).slice(0, 8);
  const negatives = terms.filter(([, a]) => a.conv === 0 && a.cost >= wasteAt / 2).slice(0, 10);
  const newKw = terms.filter(([k, a]) => { const [t, kwd] = k.split('\u0001'); return a.conv >= 1 && t.toLowerCase() !== kwd.toLowerCase().replace(/[+"[\]]/g, ''); }).slice(0, 10);
  const wasteCost = kw.filter(([, a]) => a.conv === 0).reduce((s, [, a]) => s + a.cost, 0);
  const markets = [...new Set(data.rows.map((r) => r.market))].filter(Boolean).sort();
  const weekly = weeks.map((x) => { const a = zero(); base.filter((r) => isoWeek(r.day) === x).forEach((r) => add(a, r)); return { w: x, a, partial: weekDays(x)[6] > data.to }; });
  const groups = [...new Set(data.rows.filter((r) => !market || r.market === market).map((r) => r.adGroup))].filter(Boolean).sort();
  const stale = (Date.now() - Date.parse(data.to + 'T00:00:00Z')) / 864e5 > 3;
  const cards: [string, number, number, (v: number) => string, boolean][] = [
    ['Spend', T.cost, P.cost, chf, false], ['Clicks', T.clicks, P.clicks, n0, false], ['CTR', T.impr ? T.clicks / T.impr : NaN, P.impr ? P.clicks / P.impr : NaN, (v) => `${(v * 100).toFixed(2)}%`, false],
    ['CPC', T.clicks ? T.cost / T.clicks : NaN, P.clicks ? P.cost / P.clicks : NaN, (v) => v.toFixed(2), true], ['Conversions', T.conv, P.conv, n0, false],
    ['Cost / conv.', cpa(T), cpa(P), chf, true], ['Conv. rate', T.clicks ? T.conv / T.clicks : NaN, P.clicks ? P.conv / P.clicks : NaN, (v) => `${(v * 100).toFixed(2)}%`, false],
  ];
  return (
    <>
      <h2 className="page"><span className="pnum">06</span>Search Keywords Performance</h2>
      <p className="lede">{periodName} ({days[0]?.slice(5)}–{days.at(-1)?.slice(5)}) vs the {nDays ? `${nDays} days` : 'week'} before · Google Ads search keywords and search terms · spend in CHF · data through {data.to}.
        Conversions are Google Ads conversions attributed to the click, so they differ from CRM Leads on other pages.</p>
      {stale && <p className="warnbox">⚠️ The keyword report stops at {data.to}. The Sheet's *_Keywords tabs have not been refreshed since, so this page is historical until they update again.</p>}
      <div className="filters inline-filters">
        <label>Period<select value={w} onChange={(e) => setWeek(e.target.value)}>
          <optgroup label="Rolling">{[7, 14, 28, 56, 90].map((n) => <option key={n} value={`d${n}`}>Last {n} days</option>)}</optgroup>
          <optgroup label="Week">{[...weeks].reverse().map((x) => <option key={x} value={x}>{x} ({weekDays(x)[0].slice(5)}–{weekDays(x)[6].slice(5)})</option>)}</optgroup></select></label>
        <label>Market<select value={market} onChange={(e) => { setMarket(e.target.value); setAdGroup(''); }}><option value="">All</option>{markets.map((m) => <option key={m}>{m}</option>)}</select></label>
        <label>Ad group<select value={adGroup} onChange={(e) => setAdGroup(e.target.value)}><option value="">All</option>{groups.map((g) => <option key={g}>{g}</option>)}</select></label>
      </div>
      <h3>Search funnel</h3>
      <div className="cards">{cards.map(([n, a, b, f, lb]) => (
        <div className="card" key={n}><div className="lbl">{n}</div><div className="val">{Number.isFinite(a) ? f(a) : '–'}</div><div className="dl">prev {Number.isFinite(b) ? f(b) : '–'} {chg(a, b, lb)}</div></div>
      ))}</div>
      <section className="sect"><h3><span className="sect-n">Charts</span>Week by week and what works best</h3>
        <div className="grid3">
          <ColumnChart title={<>Spend by week <span className="dim">· conversions under each column</span></>} data={weekly.map((x) => ({ x: x.w.slice(5), v: x.a.cost, top: x.a.cost.toFixed(0), sub: x.a.conv.toFixed(0), partial: x.partial }))} />
          <ColumnChart title={<>Conversions by week <span className="dim">· cost/conv</span></>} color="var(--c2)" data={weekly.map((x) => ({ x: x.w.slice(5), v: x.a.conv, sub: x.a.conv ? (x.a.cost / x.a.conv).toFixed(0) : '–', partial: x.partial }))} />
          <BarList title={<>Top keywords by conversions ({periodName})</>} rows={kw.map(([k, a]) => ({ key: k.split('\u0001')[0], v: a.conv, sub: Number.isFinite(cpa(a)) ? `CHF ${cpa(a).toFixed(0)}/conv` : '', flag: (cpa(a) <= avgCpa ? 'good' : cpa(a) >= 1.5 * avgCpa ? 'bad' : undefined) as 'good' | 'bad' | undefined }))} fmtV={(v) => v.toFixed(1)} color="var(--c2)" />
        </div>
      </section>
      <h3>What to do</h3>
      <p className="note">Winners: at least 2 conversions at or below the average cost/conv ({Number.isFinite(avgCpa) ? chf(avgCpa) : '–'}). Waste: at least {chf(wasteAt)} with no conversions. {chf(wasteCost)} ({T.cost ? ((wasteCost / T.cost) * 100).toFixed(1) : 0}%) of spend in view went to keywords with no conversions.</p>
      <div className="grid2">
        <div className="panel"><div className="chart-title">🟢 Winners</div>{winners.length ? <ul>{winners.map(([k, a]) => <li key={k}><b>{k.split('\u0001')[0]}</b> <span className="dim">({k.split('\u0001')[1]})</span> — {n0(a.conv)} conv. at {chf(cpa(a))}</li>)}</ul> : <p className="dim">None in this period.</p>}<div className="todo"><b>Do:</b> keep them; if limited by budget or rank, raise bid or budget a little.</div></div>
        <div className="panel"><div className="chart-title">🔴 Waste</div>{waste.length ? <ul>{waste.map(([k, a]) => <li key={k}><b>{k.split('\u0001')[0]}</b> <span className="dim">({k.split('\u0001')[1]})</span> — {chf(a.cost)}, {n0(a.clicks)} clicks, 0 conv.</li>)}</ul> : <p className="dim">No keyword spent {chf(wasteAt)} without results.</p>}<div className="todo"><b>Do:</b> lower bids or pause, and check the landing page match.</div></div>
        <div className="panel"><div className="chart-title">Negative candidates</div>{negatives.length ? <ul>{negatives.map(([k, a]) => <li key={k}>“{k.split('\u0001')[0]}” <span className="dim">via {k.split('\u0001')[1]}</span> — {chf(a.cost)}, 0 conv.</li>)}</ul> : <p className="dim">None.</p>}<div className="todo"><b>Do:</b> review these searches; add the ones that don't fit as negatives.</div></div>
        <div className="panel"><div className="chart-title">New keyword candidates</div>{newKw.length ? <ul>{newKw.map(([k, a]) => <li key={k}>“{k.split('\u0001')[0]}” — {n0(a.conv)} conv., {chf(a.cost)}</li>)}</ul> : <p className="dim">None.</p>}<div className="todo"><b>Do:</b> add converting searches as their own phrase keywords.</div></div>
      </div>
      <section className="block tone-analysis"><header className="block-head"><div><span className="block-tag">Negatives</span><h3>Negative keywords — ready to paste</h3></div></header><div className="block-body">
        <NegativeExport rows={data.rows.filter((r) => (!school || r.school === school) && (!market || r.market === market) && (!adGroup || r.adGroup === adGroup))} to={data.to} />
      </div></section>
      <h3>By market</h3>
      <p className="note">Market = country code in the campaign name. Open a market to see its search terms (searches with at least one click).</p>
      <Nested rows={cur} by={(r) => r.market || '(no market)'} title="Market" />
      <h3>By ad group</h3>
      <Nested rows={cur} by={(r) => r.adGroup} title="Ad group" />
      <h3>Keywords</h3>
      <div className="tablewrap"><table className="t">
        <thead><tr><th>Keyword · ad group · match</th><th>Spend</th><th>Clicks</th><th>CPC</th><th>Conv.</th><th>Cost / conv.</th><th>Flag</th></tr></thead>
        <tbody>{(showAll ? kw : kw.slice(0, 25)).map(([k, a]) => { const [kwd, ag, mt] = k.split('\u0001'); const c = cpa(a);
          const flag = a.conv === 0 && a.cost >= wasteAt ? '🔴 Waste' : a.conv >= 1 && c <= avgCpa ? '🟢 Winner' : Number.isFinite(c) && c >= 1.5 * avgCpa ? '🟡 Expensive' : '';
          return <tr key={k}><td>{kwd} <span className="dim">· {ag} · {mt.toLowerCase()}</span></td><td>{chf(a.cost)}</td><td>{n0(a.clicks)}</td><td>{a.clicks ? (a.cost / a.clicks).toFixed(2) : '–'}</td><td>{n0(a.conv)}</td><td>{Number.isFinite(c) ? chf(c) : '–'}</td><td>{flag}</td></tr>; })}</tbody>
      </table></div>
      {kw.length > 25 && <button className="linkbtn" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show top 25' : `Show all ${kw.length}`}</button>}
      <h3>Search terms</h3>
      <div className="tablewrap"><table className="t">
        <thead><tr><th>Search term</th><th>Keyword</th><th>Spend</th><th>Clicks</th><th>Conv.</th><th>Cost / conv.</th></tr></thead>
        <tbody>{terms.slice(0, 50).map(([k, a]) => <tr key={k}><td>{k.split('\u0001')[0]}</td><td className="dim">{k.split('\u0001')[1]}</td><td>{chf(a.cost)}</td><td>{n0(a.clicks)}</td><td>{n0(a.conv)}</td><td>{Number.isFinite(cpa(a)) ? chf(cpa(a)) : '–'}</td></tr>)}</tbody>
      </table></div>
      <p className="note">Showing the top 50 of {terms.length} search terms by spend.</p>
    </>
  );
}

// ---------------------------------------------------------------- negative keywords (copy to Google Ads)

let baseCache: Promise<Record<string, BaseNeg[]>> | null = null;
/** SEG_Negative_Keywords (KV `negbase`, else the bundled snapshot): terms already negated per school. */
export function useNegBaseline() {
  const [v, setV] = useState<Record<string, BaseNeg[]> | null>(null);
  useEffect(() => {
    const get = (u: string) => fetch(u).then((r) => (r.ok ? (r.json() as Promise<{ schools?: Record<string, BaseNeg[]> } | null>) : null)).catch(() => null);
    baseCache ??= get('/api/negbase').then((j) => j?.schools ?? get('/data/neg_baseline.json').then((k) => k?.schools ?? {}));
    baseCache.then(setV);
  }, []);
  return v;
}

const addDay = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
/** The review window: the last N full days ending with the latest day in the sheet. */
export function reviewWindow(to: string, days = 7): [string, string] { return [addDay(to, 1 - days), to]; }
export function negativeReview(rows: Row[], baseline: Record<string, BaseNeg[]>, from: string, to: string) {
  return reviewNegatives(rows.filter((r) => r.day >= from && r.day <= to), baseline);
}

export function NegativeExport({ rows, to }: { rows: Row[]; to: string }) {
  const baseline = useNegBaseline();
  const [days, setDays] = useState(7);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState('');
  const [from, end] = reviewWindow(to, days);
  const res = useMemo(() => (baseline ? negativeReview(rows, baseline, from, end) : null), [rows, baseline, from, end]);
  if (!res) return <p className="note">Loading the negative-keyword baseline…</p>;
  const id = (c: NegSuggestion) => `${c.school}\u0001${c.formatted}`;
  const chosen = res.suggestions.filter((c) => !off.has(id(c)));
  const bySchool = new Map<string, NegSuggestion[]>(); for (const c of chosen) (bySchool.get(c.school) ?? bySchool.set(c.school, []).get(c.school)!).push(c);
  const text = [...bySchool.entries()].map(([sc, cs]) => `# ${sc}\n${cs.map((c) => c.formatted).join('\n')}`).join('\n\n');
  const csvEsc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const review = ['School,Category,Negative keyword (formatted),Match type,Impr.,Clicks,Cost (CHF),Suggested reason,Status', ...chosen.map((c) => [c.school, c.category, c.formatted, c.match, String(c.impr), String(c.clicks), c.cost.toFixed(2), `${c.reason} — e.g. ${c.terms.slice(0, 2).join('; ')}`, ''].map(csvEsc).join(','))].join('\n');
  const editor = ['Campaign,Ad group,Keyword,Criterion Type', ...chosen.flatMap((c) => c.campaigns.map((cp) => [cp, '', c.negative, `Negative ${c.match.toLowerCase()}`].map(csvEsc).join(',')))].join('\n');
  const copy = async (what: string, v: string) => { try { await navigator.clipboard.writeText(v); setCopied(what); setTimeout(() => setCopied(''), 2000); } catch { setCopied('Copy blocked — select the text and copy manually'); } };
  const download = (name: string, v: string) => { const b = new Blob([v], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
  return (
    <div className="negx">
      <div className="negx-ctrl">
        <label>Window<select value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 14, 28].map((d) => <option key={d} value={d}>last {d} days</option>)}</select></label>
        <span className="dim">{from} → {end} · {res.reviewed} unique search terms reviewed · {chosen.length} new candidates · skipped {res.skippedBaseline} already on SEG_Negative_Keywords and {res.skippedExcluded} rows already Excluded</span>
      </div>
      <div className="two">
        <div className="tablewrap" style={{ maxHeight: 460, overflowY: 'auto' }}><table className="t compact">
          <thead><tr><th style={{ width: 28 }}><input type="checkbox" checked={off.size === 0} onChange={(e) => setOff(e.target.checked ? new Set() : new Set(res.suggestions.map(id)))} /></th><th style={{ textAlign: 'left' }}>School · category</th><th style={{ textAlign: 'left' }}>Negative</th><th>Impr.</th><th>Clicks</th><th>Cost</th><th style={{ textAlign: 'left' }}>Why · search terms</th></tr></thead>
          <tbody>{res.suggestions.map((c) => (
            <tr key={id(c)} className={off.has(id(c)) ? 'dimrow' : ''}><td><input type="checkbox" checked={!off.has(id(c))} onChange={() => setOff((o) => { const n = new Set(o); if (n.has(id(c))) n.delete(id(c)); else n.add(id(c)); return n; })} /></td>
              <td style={{ textAlign: 'left' }}><b>{c.school}</b><div className="dim" style={{ fontSize: 11 }}>{c.category}</div></td>
              <td style={{ textAlign: 'left' }}><code>{c.formatted}</code><div className="dim" style={{ fontSize: 11 }}>{c.match}</div></td>
              <td>{c.impr}</td><td>{c.clicks}</td><td>{c.cost.toFixed(0)}</td>
              <td style={{ textAlign: 'left', fontSize: 12 }}>{c.reason}<div className="dim" style={{ fontSize: 11 }}>{c.terms.slice(0, 3).join(' · ')}{c.terms.length > 3 ? ` +${c.terms.length - 3}` : ''}</div></td></tr>
          ))}</tbody>
        </table>{!res.suggestions.length && <p className="good" style={{ padding: 10 }}>Clean: no new negatives in this window.</p>}</div>
        <div>
          <div className="copybox"><div className="copyhead"><b>Paste into Google Ads</b> <span className="dim">(per school: shared negative list or campaign → Negative keywords)</span><button onClick={() => copy('List copied', text)}>Copy list</button></div>
            <pre>{text || '— nothing selected —'}</pre></div>
          <div className="copybox"><div className="copyhead"><b>Review sheet / baseline rows</b> <span className="dim">(once confirmed + applied, paste into the school tab of SEG_Negative_Keywords)</span><button onClick={() => copy('Review CSV copied', review)}>Copy</button><button onClick={() => download(`SEG-neg-keyword-review-${from}-to-${end}.csv`, review)}>Download .csv</button></div>
            <pre>{review}</pre></div>
          <div className="copybox"><div className="copyhead"><b>Google Ads Editor CSV</b> <span className="dim">(one row per campaign where the search appeared)</span><button onClick={() => copy('Editor CSV copied', editor)}>Copy</button></div>
            <pre>{editor}</pre></div>
          {copied && <p className="good">{copied}</p>}
        </div>
      </div>
      <p className="note">Same method as the twice-weekly SEG negative-keyword review: last 7 full days, rows with at least 1 impression, Excluded terms and anything already on SEG_Negative_Keywords skipped. Only terms in one of six reasons are suggested — Competitor, Wrong geography, Free / low-fee intent, Fee shopper, Too broad / low intent, Off-product. Never suggested: any school name of SEG, including misspellings (César/Caesar Ritz, SHMS, HIM, CAAS, Culinary Arts Academy…), and searches for a real SEG programme unless they name a competitor, another country or fees. Ambiguous terms are not flagged. Candidates for human review — nothing is applied automatically.</p>
    </div>
  );
}
