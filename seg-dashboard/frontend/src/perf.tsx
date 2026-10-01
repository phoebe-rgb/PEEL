import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { aggregate, emptyTotals, metric, METRICS, type Filter, type MetricId } from './lib/agg';
import { DIM_LABEL, fmt, label } from './lib/format';
import { explain } from './lib/explain';
import { comparePair, modeLabel, type Pair } from './lib/pair';
import { reallocSuggestions, onOffSuggestions, BOSS_SPECS, GOOGLE_SPECS, META_SPECS, optName, type AdStat, type OnOff, type ReallocSpec, type Suggestion } from './lib/realloc';
import { marketName } from './lib/names';
import { useShared } from './lib/shared';
import { useCtx } from './components';
import { GoogleActions, MetaActions } from './actions';
import { ComboTimeline } from './charts';
import { BossPivot } from './drill';
import { FlatPivot } from './flatpivot';
import { DirectLeads } from './halo';

type View = 'boss' | 'google' | 'meta';

export function Block({ tone, n, title, sub, children, right }: { tone: 'cards' | 'charts' | 'analysis' | 'tables'; n?: string; title: ReactNode; sub?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className={`block tone-${tone}`}>
      <header className="block-head"><div><span className="block-tag">{n ?? tone}</span><h3>{title}</h3>{sub && <p className="block-sub">{sub}</p>}</div>{right}</header>
      <div className="block-body">{children}</div>
    </section>
  );
}

/** Scorecards: value = all selected data; change = comparison period. */
export function PairCards({ pair, metrics }: { pair: Pair; metrics: MetricId[] }) {
  const { store } = useCtx();
  const full = useMemo(() => aggregate(store, pair.full).get('') ?? emptyTotals(), [store, pair]);
  const cur = useMemo(() => aggregate(store, pair.cur).get('') ?? emptyTotals(), [store, pair]);
  const prev = useMemo(() => (pair.prev ? aggregate(store, pair.prev).get('') ?? emptyTotals() : null), [store, pair]);
  return (
    <div className="kpis-grid">{metrics.map((id) => {
      const def = METRICS[id], v = metric(full, id), a = metric(cur, id), b = prev ? metric(prev, id) : NaN;
      let ch = '', cls = 'flat';
      if (Number.isFinite(a) && Number.isFinite(b)) {
        if (def.kind === 'rate') { const d = (a - b) * 100; ch = `${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(2)} pp`; cls = Math.abs(d) < 0.1 || def.better === 'neutral' ? 'flat' : (d > 0) === (def.better === 'up') ? 'up' : 'down'; }
        else if (Math.abs(b) < (def.kind === 'money' ? 50 : 3) && Math.abs(a - b) > Math.abs(b)) { ch = 'small base'; }
        else if (b !== 0) { const d = (a - b) / Math.abs(b); ch = `${d >= 0 ? '▲' : '▼'} ${Math.abs(d) >= 10 ? '>999' : Math.abs(d * 100).toFixed(0)}%`; cls = Math.abs(d) < 0.05 || def.better === 'neutral' ? 'flat' : (d > 0) === (def.better === 'up') ? 'up' : 'down'; }
      }
      return (
        <div className={`kpi kpi-${cls}`} key={id} title={def.help}>
          <div className="kpi-label">{def.label}</div>
          <div className="kpi-value">{fmt(id, v, true)}</div>
          <div className="kpi-delta"><span className={`chg ${cls}`}>{ch || '—'}</span><span className="kpi-prev">{Number.isFinite(b) ? `vs ${fmt(id, b, true)}` : 'no comparison'}</span></div>
        </div>
      );
    })}</div>
  );
}

const verdictChip = (v: string) => <span className={`chip ${v.split(' ')[0]}`}>{v}</span>;

// ---------------------------------------------------------------- reallocation cards

const f0 = (v: number) => (Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '–');
const f1 = (v: number) => (Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '–');
const p1 = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '–');

function Reallocations({ specs, dims, platform }: { specs: ReallocSpec[]; dims: Filter['dims']; platform: string }) {
  const { store } = useCtx();
  const shared = useShared('/api/actions');
  const list = useMemo(() => reallocSuggestions(store, dims, specs), [store, JSON.stringify(dims), specs]);
  if (!list.length) return <p className="dim">No reallocation stands out in the last 4 weeks: options within each school are within ±40% on cost per good lead, or too small (fewer than 3 good leads, under CHF 100).</p>;
  const schools = [...new Set(list.map((x) => x.group[0]))];
  const approve = (x: Suggestion, on: boolean, note?: string) => void shared.save(x.id, { data: {
    source: 'realloc', approved: on, resolved: false, platform: x.dims.channel?.[0] === 'Google' ? 'Google Ads' : x.dims.channel?.[0] === 'Meta' ? 'Meta' : platform, priority: 'High',
    school: x.group[0], country: x.spec.within.includes('market') ? x.group[x.spec.within.indexOf('market')] : '', entity: `${x.groupLabel} · ${DIM_LABEL[x.spec.dim]}`,
    actionText: `Move CHF ${f0(x.moveWeek)}/week from ${optName(x.spec.dim, x.from.key)} to ${optName(x.spec.dim, x.to.key)} (${x.groupLabel}).`, dims: { ...x.dims, [x.spec.dim]: [x.from.key, x.to.key] },
    // kept so the Actions page can check the forecast 2 weeks after the move
    forecastNet: x.forecast.net, forecastWeeks: 4, approvedAt: new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10),
    ...(note !== undefined ? { approveNote: note } : {}),
  } });
  return (
    <>{schools.map((sc) => (
      <div key={sc} className="ra-school"><h4>{label(sc)}</h4>
        {list.filter((x) => x.group[0] === sc).map((x) => {
          const st = shared.data[x.id];
          const row = (o: Suggestion['from']) => (
            <div className="ra-opt"><div className="ra-opt-name">{optName(x.spec.dim, o.key)}{x.spec.dim === 'campaign' && <div className="dim ra-camp">{o.key}</div>}</div>
              <div className="ra-stats"><span>Spend 4w <b>CHF {f0(o.t.cost)}</b></span><span>Leads <b>{f0(o.t.leads)}</b></span><span>CPL <b>{f1(o.cpl)}</b></span><span>GL <b>{f0(o.t.gl)}</b></span><span>CPGL <b>{o.t.gl ? f0(o.cpgl) : 'no GL'}</b></span><span>GL rate <b>{p1(o.glr)}</b></span><span>Applied <b>{f0(o.t.app)}</b></span><span>CPApp <b>{o.t.app ? f0(o.t.cost / o.t.app) : '–'}</b></span><span>Accepted <b>{f0(o.t.acc)}</b></span><span>CPAcc <b>{o.t.acc ? f0(o.t.cost / o.t.acc) : '–'}</b></span><span>Share <b>{(o.share * 100).toFixed(0)}%</b></span></div></div>
          );
          return (
            <div key={x.id} data-cmt={`${x.groupLabel}: ${optName(x.spec.dim, x.from.key)} → ${optName(x.spec.dim, x.to.key)}`} className={`racard ${x.recommendation === 'Recommended' ? 'rec' : 'test'}`}>
              <div className="rac-head">
                <div><span className="pill">{x.spec.name}</span> <b>{x.groupLabel}</b></div>
                <div><span className={`chip ${x.recommendation === 'Recommended' ? 'Better' : 'Mixed'}`}>{x.recommendation}</span> <span className="dim">confidence {x.confidence}</span></div>
              </div>
              <div className="rac-flow"><div className="from">{row(x.from)}</div><div className="rac-arrow">→<div className="dim">CHF {f0(x.moveWeek)}/week</div></div><div className="to">{row(x.to)}</div></div>
              <div className="rac-text">
                <p><b>Why.</b> {x.why}</p>
                <p><b>Insight.</b> {x.insight}</p>
                <div className="rac-fc"><b>Forecast (next 4 weeks)</b> — move CHF {f0(x.moveWeek * 4)}: {x.forecast.lost > 0 ? `−${f1(x.forecast.lost)} GL on ${optName(x.spec.dim, x.from.key)}, ` : ''}+{f1(x.forecast.gained)} GL on {optName(x.spec.dim, x.to.key)} → <b>net +{f1(x.forecast.net)} good leads</b> at the same total spend; group CPGL CHF {f0(x.forecast.cpglBefore)} → <b>CHF {f0(x.forecast.cpglAfter)}</b>.</div>
                <p className="dim">{x.risk}</p>
              </div>
              <div className="rac-approve">
                <label><input type="checkbox" className="tick" checked={!!st?.approved} onChange={(e) => approve(x, e.target.checked)} /> <b>Approve</b> — adds it to Actions</label>
                <input className="ra-note" defaultValue={String(st?.approveNote ?? '')} key={x.id + String(st?.at ?? '')} placeholder="Comment (e.g. only half, from next Monday)…" onBlur={(e) => { if (e.target.value !== String(st?.approveNote ?? '')) approve(x, !!st?.approved, e.target.value); }} />
                {st?.at && <span className="dim">{st.approved ? 'Approved' : 'Not approved'} by {String(st.by ?? '')} · {String(st.at).slice(5, 16).replace('T', ' ')}</span>}
              </div>
            </div>
          );
        })}
      </div>
    ))}
    {shared.error && <p className="warnbox">{shared.error}</p>}
    <p className="note">Evidence: last 28 days vs the 28 before, ACT campaigns, options with at least CHF 100. Moves stay inside one school · country · channel line. The move is 25% of the weaker option's weekly spend; the forecast assumes the stronger option keeps its cost per good lead minus 15% for scaling.</p>
    </>
  );
}

// ---------------------------------------------------------------- inside a campaign: ads / themes off and on

function OnOffCards({ dims }: { dims: Filter['dims'] }) {
  const { store } = useCtx();
  const shared = useShared('/api/actions');
  const list = useMemo(() => onOffSuggestions(store, dims), [store, JSON.stringify(dims)]);
  if (!list.length) return <p className="dim">No Meta campaign has a clear split between ads that bring good leads and ads that do not (last 4 weeks, campaigns over CHF 200).</p>;
  const approve = (x: OnOff, on: boolean, note?: string) => void shared.save(x.id, { data: {
    source: 'realloc', approved: on, resolved: false, platform: 'Meta', priority: 'High', school: x.school, country: x.market, entity: x.campaign,
    actionText: `In ${x.campaign}: switch off ${x.off.map((a) => a.ad).join(', ')}${x.themesOff.length ? ` (theme ${x.themesOff.join(', ')})` : ''}; keep on ${x.on.slice(0, 3).map((a) => a.ad).join(', ')}.`,
    dims: { channel: ['Meta'], campaign: [x.campaign] }, ...(note !== undefined ? { note } : {}),
  } });
  const ad = (a: AdStat) => <tr key={a.ad}><td title={a.ad}>{a.ad}</td><td>{a.theme}</td><td>{f0(a.cost)}</td><td>{f0(a.leads)}</td><td>{f0(a.gl)}</td><td>{a.gl ? f0(a.cpgl) : '–'}</td><td>{f0(a.app)}</td><td>{a.app ? f0(a.cost / a.app) : '–'}</td><td>{f0(a.acc)}</td><td>{a.acc ? f0(a.cost / a.acc) : '–'}</td></tr>;
  const head = <thead><tr><th>Ad</th><th>Theme</th><th>Spend 4w</th><th>Leads</th><th>GL</th><th>CPGL</th><th>Applied</th><th>CPApp</th><th>Accepted</th><th>CPAcc</th></tr></thead>;
  return (
    <>{list.map((x) => {
      const st = shared.data[x.id];
      return (
        <div key={x.id} data-cmt={`${x.school} · ${marketName(x.market)}: ads on/off in ${x.campaign}`} className={`racard ${x.confidence !== 'Low' ? 'rec' : 'test'}`}>
          <div className="rac-head">
            <div><span className="pill">Ads & themes · inside the campaign</span> <b>{x.school} · {marketName(x.market)}</b> <span className="dim">{x.campaign}</span></div>
            <div><span className={`chip ${x.confidence !== 'Low' ? 'Better' : 'Mixed'}`}>{x.confidence !== 'Low' ? 'Recommended' : 'Test'}</span> <span className="dim">confidence {x.confidence} · campaign CPGL CHF {f0(x.camp.cpgl)}</span></div>
          </div>
          <div className="rac-flow">
            <div className="from"><div className="ra-opt"><div className="ra-opt-name">Switch off{x.themesOff.length ? ` · theme ${x.themesOff.join(', ')}` : ''}</div><table className="t compact onoff">{head}<tbody>{x.off.map(ad)}</tbody></table></div></div>
            <div className="rac-arrow">→<div className="dim">CHF {f0(x.forecast.freed / 4)}/week flows to</div></div>
            <div className="to"><div className="ra-opt"><div className="ra-opt-name">Keep on{x.themesOn.length ? ` · theme ${x.themesOn.join(', ')}` : ''}</div><table className="t compact onoff">{head}<tbody>{x.on.slice(0, 5).map(ad)}</tbody></table></div></div>
          </div>
          <div className="rac-text">
            <p><b>Why.</b> {x.why}</p>
            <p><b>Insight.</b> {x.insight}</p>
            <div className="rac-fc"><b>Forecast (next 4 weeks)</b> — CHF {f0(x.forecast.freed)} moves to the ads that qualify: {x.forecast.lost > 0 ? `−${f1(x.forecast.lost)} GL from the ads switched off, ` : ''}+{f1(x.forecast.gained)} GL on the ones kept → <b>net +{f1(x.forecast.net)} good leads</b> at the same campaign budget.</div>
            <p className="dim">{x.risk}</p>
          </div>
          <div className="rac-approve">
            <label><input type="checkbox" className="tick" checked={!!st?.approved} onChange={(e) => approve(x, e.target.checked)} /> <b>Approve</b> — adds it to Actions</label>
            <input className="ra-note" defaultValue={String(st?.note ?? '')} key={x.id + String(st?.at ?? '')} placeholder="Comment…" onBlur={(e) => { if (e.target.value !== String(st?.note ?? '')) approve(x, !!st?.approved, e.target.value); }} />
            {st?.at && <span className="dim">{st.approved ? 'Approved' : 'Not approved'} by {String(st.by ?? '')} · {String(st.at).slice(5, 16).replace('T', ' ')}</span>}
          </div>
        </div>
      );
    })}{shared.error && <p className="warnbox">{shared.error}</p>}</>
  );
}

// ---------------------------------------------------------------- views

const CARDS: MetricId[] = ['cost', 'leads', 'cpl', 'gl', 'cpgl', 'glRate', 'reg', 'cpreg', 'app', 'cpapp', 'leadAppRate', 'acc', 'cpacc', 'accRate'];
const CH_CARDS: MetricId[] = ['cost', 'impr', 'ctr', 'cpc', 'leads', 'cpl', 'gl', 'cpgl', 'reg', 'cpreg', 'app', 'cpapp', 'acc', 'cpacc'];

function Scorecard({ pair, metrics }: { pair: Pair; metrics: MetricId[] }) {
  return (
    <Block tone="cards" n="Scorecard" title={`${pair.curLabel || 'Selected period'} vs ${pair.prevLabel || modeLabel(pair.mode)}`}>
      <PairCards pair={pair} metrics={metrics} />
      <p className="pairnote">Values = all selected data (ACT campaigns). Changes compare <b>{pair.curLabel || '—'}</b> with <b>{pair.prevLabel || '—'}</b> ({modeLabel(pair.mode)}). {pair.note}</p>
    </Block>
  );
}

function BudgetBlock({ specs, dims, platform, meta }: { specs: ReallocSpec[]; dims: Filter['dims']; platform: string; meta: boolean }) {
  return (
    <Block tone="analysis" n="Budget allocation" title="Reallocate budget — campaign to campaign, inside each school · country · channel" sub={meta
      ? 'Three levers. 1) Between campaigns of the same school, country and channel (each campaign is one program target, e.g. Parents → Master\'s). 2) Between target audiences (ad sets) inside one campaign. 3) Inside a campaign: switch weak ads / themes off and keep the ones that qualify on. Tick Approve to send a card to Actions.'
      : 'Between campaigns of the same school, country and channel — each campaign is one program target (Meta) or keyword theme (Google: Brand, Generic, Program – Bachelor / Master / Diploma, PMax). One card per line. Tick Approve to send it to Actions.'}>
      {meta && <h4 className="ra-lever">1 · Campaign → campaign · 2 · Audience inside a campaign</h4>}
      <Reallocations specs={specs} dims={dims} platform={platform} />
      {meta && <><h4 className="ra-lever">3 · Ads and themes inside a campaign</h4><OnOffCards dims={dims} /></>}
    </Block>
  );
}

function BossView({ pair }: { pair: Pair }) {
  const { store, filter } = useCtx();
  const cur = useMemo(() => aggregate(store, pair.cur).get('') ?? emptyTotals(), [store, pair]);
  const prev = useMemo(() => (pair.prev ? aggregate(store, pair.prev).get('') ?? undefined : undefined), [store, pair]);
  const schools = useMemo(() => {
    const c = aggregate(store, pair.cur, ['school']), p = pair.prev ? aggregate(store, pair.prev, ['school']) : new Map();
    return [...c.entries()].filter(([k]) => k).map(([key, t]) => ({ key, cur: t, ref: p.get(key) }));
  }, [store, pair]);
  const head = explain(cur, prev, schools, 'school', false);
  return (
    <>
      <Scorecard pair={pair} metrics={CARDS} />
      <Block tone="charts" n="Timeline" title="What changed over time" sub="Tick any metrics — volumes, costs and rates share one chart. Hover a metric name for its formula. Rates: GL rate and Lead → App are from the lead; GL → Reg, Reg → App and App → Acc are from the stage before. Funnel score = Lead × 1 + Good Lead × 3 + Applied × 6 + Accepted × 10 (one number that weighs later stages more).">
        <ComboTimeline initial={['leads', 'gl', 'cpl', 'cpgl']} title="Timeline" />
      </Block>
      <Block tone="analysis" n="Headline" title={<>{verdictChip(head.verdict)} {head.what}</>}>
        {head.why && <p><b>Why.</b> {head.why}</p>}
        <p><b>Next.</b> {head.next}</p>
      </Block>
      <Block tone="tables" n="Drill-down" title="School → Country → Channel — data" sub="Data only. School is always on; tick Country and Channel to go one layer deeper (e.g. first school, then country, then channel). Each cell: value, change vs the comparison period, and the last three periods underneath.">
        <FlatPivot pair={pair} options={['school', 'market', 'channel']} fixed={['school']} initial={['school']} />
      </Block>
      <Block tone="analysis" n="Drill-down insights" title="School → Country → Channel — insights" sub="The same rows with the written insight per channel (what happened and why). 🟢 good · 🟡 watch · 🔴 needs action.">
        <BossPivot pair={pair} dims={['school', 'market', 'channel']} />
      </Block>
      <DirectLeads />
      <BudgetBlock specs={BOSS_SPECS} dims={filter.dims} platform="Budget" meta={false} />
    </>
  );
}

function ChannelView({ channel }: { channel: 'Google' | 'Meta' }) {
  const { store, filter, view } = useCtx();
  const f: Filter = useMemo(() => ({ ...filter, dims: { ...filter.dims, channel: [channel] } }), [filter, channel]);
  const pair = useMemo(() => comparePair(store, f, view.view, view.compare ?? 'prev'), [store, f, view.view, view.compare]);
  const google = channel === 'Google';
  // actions marked done on the Actions page, shown as ✓ markers on this channel's timeline
  const acts = useShared('/api/actions');
  const doneMarks = useMemo(() => Object.values(acts.data).filter((e) => e.resolved && e.resolvedAt && (google ? /Google|Search/.test(String(e.platform)) || (e.dims as { channel?: string[] } | undefined)?.channel?.[0] === 'Google' : String(e.platform) === 'Meta' || (e.dims as { channel?: string[] } | undefined)?.channel?.[0] === 'Meta'))
    .map((e) => ({ day: String(e.resolvedAt), text: `${String(e.actionText ?? '')}${e.note ? ` — ${String(e.note)}` : ''}` })), [acts.data, google]);
  return (
    <>
      <Scorecard pair={pair} metrics={CH_CARDS} />
      <Block tone="charts" n="Timeline" title={`${google ? 'Google Ads' : 'Meta'} over time`}>
        <ComboTimeline filter={f} initial={['leads', 'gl', 'cpl', 'cpgl']} title="Timeline" marks={doneMarks} />
      </Block>
      <Block tone="tables" n="Comparison" title="Compare anything" sub={`Tick the columns — equal values are merged in tick order (${google ? 'school › country › campaign type › program › keyword theme › campaign' : 'school › country › program › campaign › audience › ad set › format › ad'}). Rows without a value (e.g. no program) show as "(no value)".${google ? ' Channel types: only Search and PMax run as ACT — YouTube is BRAND and Display is CONV, so they are outside this ACT view (see Budget & Pacing for all activities).' : ' Audience = the ad set\'s audience type (Parents, Lookalike, Retargeting…).'}`}>
        <FlatPivot pair={pair} noUtm={google}
          options={google ? ['school', 'market', 'subchannel', 'program', 'audience', 'campaign'] : ['school', 'market', 'program', 'campaign', 'audience', 'ad_group', 'ad_format', 'ad']}
          initial={google ? ['school', 'market', 'subchannel', 'audience'] : ['school', 'market', 'campaign', 'ad_group']} />
      </Block>
      <Block tone="analysis" n="Read" title={google ? 'Google Ads — campaign health (school → country)' : 'Meta — weekly read (school → country → campaign)'} sub="Mini scorecards: last 7 days vs previous 7 for spend and leads, last 14 vs previous 14 for good leads (they lag). Chart: last 12 weeks.">
        {google ? <GoogleActions /> : <MetaActions />}
      </Block>
      <BudgetBlock specs={google ? GOOGLE_SPECS : META_SPECS} dims={f.dims} platform={google ? 'Google Ads' : 'Meta'} meta={!google} />
    </>
  );
}
export function PerformancePage() {
  const { store, filter, view } = useCtx();
  const pair = useMemo(() => comparePair(store, filter, view.view, view.compare ?? 'prev'), [store, filter, view.view, view.compare]);
  const [v, setV] = useState<View>(() => { try { return (localStorage.getItem('seg-view3') as View) || 'boss'; } catch { return 'boss'; } });
  const setView = (x: View) => { setV(x); try { localStorage.setItem('seg-view3', x); } catch { /* ignore */ } };
  // the comment panel can switch the view to show where a comment points
  useEffect(() => { const f = (e: Event) => setV((e as CustomEvent<View>).detail); addEventListener('seg-view', f); return () => removeEventListener('seg-view', f); }, []);
  return (
    <>
      <div className="pagehead sticky-views">
        <div><h2 className="page">Performance</h2><p className="lede">ACT campaigns · data through {store.lastDate} · <a href="#/must-read">how to read</a></p></div>
        <div className="seg big">
          <button className={v === 'boss' ? 'on' : ''} onClick={() => setView('boss')}>Boss</button>
          <button className={v === 'google' ? 'on' : ''} onClick={() => setView('google')}>Google Ads</button>
          <button className={v === 'meta' ? 'on' : ''} onClick={() => setView('meta')}>Meta</button>
        </div>
      </div>
      {v === 'boss' ? <BossView pair={pair} /> : <ChannelView key={v} channel={v === 'google' ? 'Google' : 'Meta'} />}
    </>
  );
}
