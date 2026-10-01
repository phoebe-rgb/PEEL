import { useEffect, useMemo, useRef, useState } from 'react';
import { aggregate, coverage, cycleWeeks } from './lib/agg';
import { ALL_DIMS, dayRange, loadStore, prevCycle, weekDays, type Dim, type Store } from './lib/data';
import { cycleMonths, describe, rangeOf, toFilter, type ViewKind, type ViewState } from './lib/period';
import { MustRead } from './mustread';
import { P06Keywords } from './keywords';
import { DIM_LABEL, label } from './lib/format';
import { marketName } from './lib/names';
import { StoreCtx, useCtx } from './components';
import { PerformancePage } from './perf';
import { BudgetPage } from './budget';
import { ActionsPage } from './tracker';
import { Comments, pageName } from './comments';
import { AskClaude } from './askclaude';

// Filter by the campaign's target market (from the campaign name), not the user's geo country,
// so the top filter matches the breakdown tables and Funnel (which report by target market).
const FILTER_DIMS: Dim[] = ['school', 'channel', 'market'];
const SAVE_KEY = 'seg-dash-view-v3';
// Market values are ISO-ish codes (IN, US, AE); show them as names in the filter.
const optLabel = (d: Dim, v: string) => (d === 'market' ? marketName(v) : label(v));

function useRoute() {
  const [hash, setHash] = useState(location.hash || '#/performance');
  useEffect(() => { const f = () => { setHash(location.hash || '#/performance'); scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return hash.slice(2).split('/').map(decodeURIComponent);
}

export default function App() {
  const [store, setStore] = useState<Store | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { loadStore().then(setStore).catch((e) => setErr(String(e))); }, []);
  if (err) return <div className="loading">Could not load data: {err}</div>;
  if (!store) return <div className="loading">Loading SEG performance data…</div>;
  return <Dashboard store={store} />;
}

function Dashboard({ store }: { store: Store }) {
  const cycles = useMemo(() => [...store.cycles].sort().reverse(), [store]);
  const [view, setView] = useState<ViewState>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') as ViewState | null;
      if (v && cycles.includes(v.cycle) && v.view) return v;
    } catch { /* storage unavailable */ }
    return { cycle: cycles[0], view: 'week', dims: {} };
  });
  useEffect(() => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(view)); } catch { /* ignore */ } }, [view]);
  const filter = useMemo(() => toFilter(store, view), [store, view]);
  const supported = useMemo(() => {
    const pc = prevCycle(filter.cycle);
    return new Set(ALL_DIMS.filter((d) => store.cycles.includes(pc) && coverage(store, pc, d) >= 0.5));
  }, [store, filter.cycle]);
  const route = useRoute();
  const ctx = useMemo(() => ({ store, filter, supported, view }), [store, filter, supported, view]);
  const link = (to: string, text: string, child = false, n?: string) => (
    <a key={to} href={`#/${to}`} className={`${child ? 'child ' : ''}${route.join('/') === to ? 'on' : ''}`}>{n && <span className="navnum">{n}</span>}{text}</a>
  );
  return (
    <StoreCtx.Provider value={ctx}>
      <div className="shell">
        <nav className="nav">
          <h1>SEG Performance</h1>
          <p className="sub">ACT campaigns · CHF · Funnel</p>
          {link('performance', 'Performance', false, '01')}
          {link('budget', 'Budget & Pacing', false, '02')}
          {link('keywords', 'Search Keywords', false, '03')}
          {link('actions', 'Actions', false, '04')}
          <hr />
          {link('must-read', 'How to read · rules')}
        </nav>
        <main className="main">
          <FilterBar view={view} setView={setView} cycles={cycles} />
          <Comments route={route[0] ?? 'performance'} view={describe(view, filter)} />
          <AskClaude page={pageName(route[0] ?? 'performance')} view={describe(view, filter)} />
          <Page route={route} />
        </main>
      </div>
    </StoreCtx.Provider>
  );
}

function FilterBar({ view, setView, cycles }: { view: ViewState; setView: (v: ViewState) => void; cycles: string[] }) {
  const { store, filter } = useCtx();
  const weeks = useMemo(() => cycleWeeks(store, view.cycle), [store, view.cycle]);
  const months = useMemo(() => cycleMonths(store, view.cycle), [store, view.cycle]);
  const options = useMemo(() => {
    const out: Partial<Record<Dim, string[]>> = {};
    for (const d of FILTER_DIMS) {
      const other = { ...filter, dims: { ...filter.dims, [d]: [] } };
      out[d] = [...aggregate(store, other, [d]).entries()].filter(([, t]) => t.cost > 0 || t.leads > 0).map(([k]) => k).sort();
    }
    return out;
  }, [store, filter]);
  const s = store.source;
  const fmtWeek = (w: string) => {
    const days = weekDays(w), inView = days.filter((d) => d <= store.lastDate).length;
    return `${dayRange(days[0], days[6])} (W${w.slice(6)})${inView < 7 ? ` · ${inView}/7 days` : ''}`;
  };
  const week = view.week ?? filter.weeks?.[0] ?? weeks.at(-1), month = view.month ?? months.at(-1);
  // dates can run to the end of the cycle (31 Jul): Budget & Pacing plans ahead; performance pages stop at the latest data
  const cycleEnd = `${2000 + Number(view.cycle.slice(3, 5))}-07-31`;
  const range = rangeOf(store, view);
  // the filter bar is frozen at the top; its height lets the Performance view switch stick right under it
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current; if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--filters-h', `${el.offsetHeight}px`));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return (
    <div className="filters" ref={bar}>
      <label>Cycle (Aug–Jul)
        <select value={view.cycle} onChange={(e) => setView({ ...view, cycle: e.target.value, week: undefined, month: undefined, from: undefined, to: undefined })}>
          {cycles.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label>View
        <select value={view.view} onChange={(e) => setView({ ...view, view: e.target.value as ViewKind })}>
          <option value="week">Week</option><option value="month">Month</option><option value="cycle">Cycle to date</option><option value="custom">Date range</option>
        </select>
      </label>
      {view.view === 'week' && <label>Week<select value={week} onChange={(e) => setView({ ...view, week: e.target.value })}>{[...weeks].reverse().map((w) => <option key={w} value={w}>{fmtWeek(w)}</option>)}</select></label>}
      {view.view === 'month' && <label>Month<select value={month} onChange={(e) => setView({ ...view, month: e.target.value })}>{[...months].reverse().map((m) => <option key={m}>{m}</option>)}</select></label>}
      {view.view === 'custom' && <>
        <label>Start date<input type="date" value={range[0]} max={cycleEnd} onChange={(e) => e.target.value && setView({ ...view, from: e.target.value })} /></label>
        <label>End date<input type="date" value={range[1]} max={cycleEnd} onChange={(e) => e.target.value && setView({ ...view, to: e.target.value })} /></label>
      </>}
      <label className="cmp">Compare to
        <select value={view.compare ?? 'prev'} onChange={(e) => setView({ ...view, compare: e.target.value as 'prev' | 'yoy' })}>
          <option value="prev">Previous period</option><option value="yoy">Same period last year</option>
        </select>
      </label>
      {FILTER_DIMS.map((d) => (
        <label key={d}>{DIM_LABEL[d]}
          <select value={view.dims[d]?.[0] ?? ''} onChange={(e) => setView({ ...view, dims: { ...view.dims, [d]: e.target.value === '' ? [] : [e.target.value] } })}>
            <option value="">All</option>
            {view.dims[d]?.[0] && !options[d]?.includes(view.dims[d]![0]) && <option value={view.dims[d]![0]}>{optLabel(d, view.dims[d]![0])}</option>}
            {options[d]?.map((v) => <option key={v} value={v}>{optLabel(d, v)}</option>)}
          </select>
        </label>
      ))}
      <button className="reset" onClick={() => setView({ cycle: view.cycle, view: 'week', dims: {}, compare: view.compare })}>Reset</button>
      <div className="status">
        Data through <b>{store.lastDate}</b>
        {s.syncedAt ? <> · synced {new Date(s.syncedAt).toLocaleString()}</> : null}
        <br />
        {s.fallback ? <span className="warn">Live feed unavailable: showing history snapshot to {s.historyTo}</span>
          : <>Live window {s.liveWindow?.from}…{s.liveWindow?.to}</>}
      </div>
      <div className="current-view">Current view: <b>{describe(view, filter)}</b>{Object.entries(view.dims).filter(([, v]) => v?.length).map(([k, v]) => <span key={k} className="pill">{DIM_LABEL[k as Dim]}: {optLabel(k as Dim, v![0])}</span>)}</div>
    </div>
  );
}

function Page({ route }: { route: string[] }) {
  switch (route[0]) {
    case 'must-read': return <MustRead />;
    case 'budget': return <BudgetPage />;
    case 'keywords': return <P06Keywords />;
    case 'actions': return <ActionsPage />;
    default: return <PerformancePage />;
  }
}

