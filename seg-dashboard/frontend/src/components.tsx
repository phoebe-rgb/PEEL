import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { aggregate, compare, cycleWeeks, delta, emptyTotals, metric, prevCycleFilter, weekComplete, METRICS, type Filter, type MetricId, type Totals } from './lib/agg';
import { prevCycle, prevWeek, type Dim, type Store } from './lib/data';
import { fourWeek, latestWoW, type Window } from './lib/analysis';
import { compact, DIM_LABEL, fmt, fmtDelta, label } from './lib/format';
import type { ViewState } from './lib/period';

export interface Ctx { store: Store; filter: Filter; supported: Set<Dim>; view: ViewState }
export const StoreCtx = createContext<Ctx>(null as unknown as Ctx);
export const useCtx = () => useContext(StoreCtx);

// ---------------------------------------------------------------- scorecards

export const CARD_METRICS: MetricId[] = ['cost', 'impr', 'clicks', 'ctr', 'leads', 'gl', 'reg', 'app', 'acc',
  'cpl', 'cpgl', 'cpapp', 'cpacc', 'glRate', 'score'];

export function Scorecards({ filter, metrics = CARD_METRICS }: { filter?: Filter; metrics?: MetricId[] }) {
  const { store, filter: f0, supported } = useCtx();
  const f = filter ?? f0;
  const c = useMemo(() => compare(store, f, supported), [store, f, supported]);
  const pc = prevCycle(f.cycle);
  const mw = c.matchedWeeks;
  return (
    <>
      <div className="cards">
        {metrics.map((id) => {
          const d = c.unavailable ? null : fmtDelta(delta(c.comparisonTotals, c.prevTotals, id));
          return (
            <div className="card" key={id} title={METRICS[id].help}>
              <div className="lbl">{METRICS[id].label}</div>
              <div className="val">{fmt(id, metric(c.totals, id), true)}</div>
              <div className="dl">{d ? <span className={d.cls}>{d.text}</span> : <span className="dim">No comparison</span>}</div>
            </div>
          );
        })}
      </div>
      <p className="cmpnote">
        Cards show all selected data through {store.lastDate}.{' '}
        {c.unavailable
          ? `Comparison unavailable: ${c.unavailable}.`
          : `Deltas compare ${mw.length} matched complete week${mw.length > 1 ? 's' : ''} (${mw[0]}${mw.length > 1 ? `–${mw.at(-1)}` : ''}) with the same ISO weeks in ${pc}; rates in percentage points. Spend is not colour-judged.`}
      </p>
    </>
  );
}

// ---------------------------------------------------------------- trends

function weeklySeries(store: Store, f: Filter, ids: MetricId[]) {
  const weeks = f.weeks ?? cycleWeeks(store, f.cycle);
  const pc = prevCycle(f.cycle);
  const cur = aggregate(store, { ...f, weeks }, ['week']);
  const prevMap = new Map(weeks.map((w) => [w, prevWeek(w)]));
  const prevLabels = [...prevMap.values()].filter(Boolean) as string[];
  const prev = store.cycles.includes(pc) ? aggregate(store, { ...f, cycle: pc, weeks: prevLabels }, ['week']) : new Map<string, Totals>();
  return weeks.map((w) => {
    const pw = prevMap.get(w);
    const row: Record<string, number | string | boolean | null> = { week: w, x: w.slice(5), prevWeek: pw ?? '', partial: !weekComplete(w, f.cycle, store.lastDate) };
    for (const id of ids) {
      const c = cur.get(w), p = pw ? prev.get(pw) : undefined;
      const cv = c ? metric(c, id) : NaN, pv = p ? metric(p, id) : NaN;
      row[id] = Number.isFinite(cv) ? cv : null;
      row[`${id}_prev`] = Number.isFinite(pv) ? pv : null;
    }
    return row;
  });
}

function TrendChart({ data, id, height = 190 }: { data: Record<string, unknown>[]; id: MetricId; height?: number }) {
  const pc = prevCycle(useCtx().filter.cycle);
  return (
    <div className="panel">
      <div className="chart-title">{METRICS[id].label} by week</div>
      <div className="legend"><span><i />{useCtx().filter.cycle}</span><span><i className="prev" />{pc} (same ISO week)</span></div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="x" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => compact(v)} />
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload as Record<string, number | string | boolean | null>;
            return (
              <div className="tip">
                <b>{r.week as string}{r.partial ? ' (partial)' : ''}</b>
                {tipLine(id, r[id] as number | null)}
                <div className="dim">{r.prevWeek || 'no equivalent week'}: {fmt(id, (r[`${id}_prev`] as number) ?? NaN)}</div>
              </div>
            );
          }} />
          <Line type="linear" dataKey={`${id}_prev`} stroke="var(--accent-soft)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: 'var(--surface)', strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
          <Line type="linear" dataKey={id} stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
const tipLine = (id: MetricId, v: number | null) => <div>{METRICS[id].label}: {fmt(id, v ?? NaN)}</div>;

export function Trends({ spend = true, stages = ['leads', 'gl', 'reg', 'app', 'acc'] as MetricId[], filter: fIn }: { spend?: boolean; stages?: MetricId[]; filter?: Filter }) {
  const { store, filter: f0 } = useCtx();
  const filter = fIn ?? f0;
  const ids = [...(spend ? (['cost'] as MetricId[]) : []), ...stages];
  const data = useMemo(() => weeklySeries(store, filter, ids), [store, filter, ids.join()]);
  return (
    <>
      {spend && <TrendChart data={data} id="cost" height={220} />}
      <h3>Funnel stages by week</h3>
      <p className="note">One chart per stage (each on its own scale). Missing weeks are gaps, not zeros.</p>
      <div className="grid5">{stages.map((id) => <TrendChart key={id} data={data} id={id} height={150} />)}</div>
    </>
  );
}

// ---------------------------------------------------------------- tables

export const TABLE_METRICS: MetricId[] = ['cost', 'impr', 'clicks', 'ctr', 'leads', 'gl', 'reg', 'app', 'acc', 'cpl', 'cpgl', 'cpapp', 'glRate', 'score'];

type Row = { key: string; t: Totals; prev?: Totals };

export function BreakdownTable({ dim, filter, metrics = TABLE_METRICS, onRow, limit = 60, title, extraDims = [] }: {
  dim: Dim; filter?: Filter; metrics?: MetricId[]; onRow?: (key: string) => void; limit?: number; title?: ReactNode; extraDims?: Dim[];
}) {
  const { store, filter: f0, supported } = useCtx();
  const f = filter ?? f0;
  const [sort, setSort] = useState<{ id: MetricId | 'share' | 'eff' | 'yoy'; dir: 1 | -1 }>({ id: 'cost', dir: -1 });
  const by = [dim, ...extraDims];
  const cmpOk = by.every((d) => supported.has(d));
  const { rows, tot } = useMemo(() => {
    const c = compare(store, f, supported);
    const cur = aggregate(store, f, by);
    let prev = new Map<string, Totals>(), curM = new Map<string, Totals>();
    if (!c.unavailable && cmpOk) {
      curM = aggregate(store, { ...f, weeks: c.matchedWeeks }, by);
      prev = aggregate(store, prevCycleFilter(f, c.matchedWeeks), by);
    }
    const rows: (Row & { cm?: Totals })[] = [...cur.entries()]
      .filter(([, t]) => t.cost > 0 || t.leads > 0 || t.gl > 0 || t.app > 0 || t.acc > 0 || t.impr > 0)
      .map(([key, t]) => ({ key, t, cm: curM.get(key), prev: prev.get(key) }));
    const tot = aggregate(store, f).get('') ?? emptyTotals();
    return { rows, tot };
  }, [store, f, by.join(), supported, cmpOk]);
  const totScore = metric(tot, 'score');
  const val = (r: (typeof rows)[number], id: typeof sort.id) =>
    id === 'share' ? r.t.cost / (tot.cost || 1)
      : id === 'eff' ? effIndex(r.t, tot, totScore)
      : id === 'yoy' ? (r.cm && r.prev ? delta(r.cm, r.prev, 'score').value : NaN)
      : metric(r.t, id);
  const sorted = [...rows].sort((a, b) => {
    const x = val(a, sort.id), y = val(b, sort.id);
    return (Number.isNaN(x) ? -Infinity : x) > (Number.isNaN(y) ? -Infinity : y) ? sort.dir : -sort.dir;
  }).slice(0, limit);
  const max: Record<string, number> = {};
  for (const id of metrics) max[id] = Math.max(...rows.map((r) => metric(r.t, id)).filter(Number.isFinite), 0);
  const th = (id: typeof sort.id, text: string, tip?: string) => (
    <th title={tip} onClick={() => setSort((s) => ({ id, dir: s.id === id ? (-s.dir as 1 | -1) : -1 }))}>{text}{sort.id === id ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}</th>
  );
  const bars = new Set<MetricId>(['cost', 'leads', 'gl', 'app', 'acc', 'score']);
  return (
    <>
      {title && <h3>{title}</h3>}
      <div className="tablewrap">
        <table className="t">
          <thead><tr>
            <th>{by.map((d) => DIM_LABEL[d]).join(' × ')}</th>
            {metrics.map((id) => th(id, METRICS[id].label, METRICS[id].help))}
            {th('share', 'Spend share')}
            {th('eff', 'Score eff.', 'Share of funnel score ÷ share of spend. 1.00× = proportional')}
            {th('yoy', `Score Δ vs ${prevCycle(f.cycle)}`, 'Funnel score, matched complete weeks, same ISO weeks previous cycle')}
          </tr></thead>
          <tbody>
            <tr className="total">
              <td>Total ({rows.length} rows)</td>
              {metrics.map((id) => <td key={id}>{fmt(id, metric(tot, id))}</td>)}
              <td>100%</td><td>1.00×</td><td></td>
            </tr>
            {sorted.map((r) => {
              const yoy = r.cm && r.prev ? fmtDelta(delta(r.cm, r.prev, 'score')) : null;
              return (
                <tr key={r.key} className={onRow ? 'click' : ''} onClick={onRow ? () => onRow(r.key) : undefined}>
                  <td title={r.key}>{r.key.split('\u0001').map(label).join(' · ')}</td>
                  {metrics.map((id) => {
                    const v = metric(r.t, id);
                    return (
                      <td key={id}>{bars.has(id) && max[id] > 0 && Number.isFinite(v)
                        ? <span className="mini">{fmt(id, v)}<span className="bar" style={{ width: `${Math.max(1, (v / max[id]) * 60)}px` }} /></span>
                        : fmt(id, v)}</td>
                    );
                  })}
                  <td>{((r.t.cost / (tot.cost || 1)) * 100).toFixed(1)}%</td>
                  <td>{fmtEff(effIndex(r.t, tot, totScore))}</td>
                  <td>{!cmpOk ? <span className="dim" title="No history for this breakdown">n/a</span> : yoy ? <span className={yoy.cls}>{yoy.text}</span> : <span className="dim">–</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > limit && <p className="note">Showing top {limit} of {rows.length} by the sorted column.</p>}
      {!cmpOk && <p className="note">{prevCycle(f.cycle)} history has no {by.filter((d) => !supported.has(d)).map((d) => DIM_LABEL[d]).join(', ')} breakdown, so year-over-year is unavailable here.</p>}
    </>
  );
}

const effIndex = (t: Totals, tot: Totals, totScore: number) =>
  tot.cost > 0 && totScore > 0 && t.cost > 0 ? (metric(t, 'score') / totScore) / (t.cost / tot.cost) : NaN;
const fmtEff = (v: number) => (Number.isFinite(v) ? `${v.toFixed(2)}×` : '–');

// ---------------------------------------------------------------- weekly table

export function WeeklyTable({ filter: fIn }: { filter?: Filter } = {}) {
  const { store, filter: f0 } = useCtx();
  const filter = fIn ?? f0;
  const ids: MetricId[] = ['cost', 'clicks', 'leads', 'gl', 'reg', 'app', 'acc', 'cpl', 'cpgl', 'glRate', 'score'];
  const rows = useMemo(() => {
    const weeks = filter.weeks ?? cycleWeeks(store, filter.cycle);
    const agg = aggregate(store, { ...filter, weeks }, ['week']);
    return weeks.map((w) => ({ w, t: agg.get(w) ?? emptyTotals(), partial: !weekComplete(w, filter.cycle, store.lastDate) })).reverse();
  }, [store, filter]);
  const max: Record<string, number> = {};
  for (const id of ids) max[id] = Math.max(...rows.map((r) => metric(r.t, id)).filter(Number.isFinite), 0);
  return (
    <div className="tablewrap">
      <table className="t">
        <thead><tr><th>Week</th>{ids.map((id) => <th key={id} title={METRICS[id].help}>{METRICS[id].label}</th>)}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.w}><td>{r.w}{r.partial && <span className="dim"> · partial</span>}</td>
            {ids.map((id) => {
              const v = metric(r.t, id);
              return <td key={id}>{METRICS[id].kind !== 'rate' && METRICS[id].kind !== 'cost' && max[id] > 0 && Number.isFinite(v)
                ? <span className="mini">{fmt(id, v)}<span className="bar" style={{ width: `${Math.max(1, (v / max[id]) * 50)}px` }} /></span>
                : fmt(id, v)}</td>;
            })}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- analysis

export function Analysis({ dim, filter }: { dim: Dim; filter?: Filter }) {
  const { store, filter: f0 } = useCtx();
  const f = filter ?? f0;
  const [mode, setMode] = useState<'wow' | '4w'>('wow');
  const win: Window | null = useMemo(() => (mode === 'wow' ? latestWoW(store, f, dim) : fourWeek(store, f, dim)), [store, f, dim, mode]);
  return (
    <>
      <h3>Analysis by {DIM_LABEL[dim].toLowerCase()}</h3>
      <div className="tabs">
        <button className={mode === 'wow' ? 'on' : ''} onClick={() => setMode('wow')}>Latest WoW</button>
        <button className={mode === '4w' ? 'on' : ''} onClick={() => setMode('4w')}>4-week trend</button>
      </div>
      {!win ? <p className="note">Not enough daily or complete-week data in the selected cycle for this view.</p> : (
        <>
          <p className="note">{win.label}: {win.curLabel} vs {win.prevLabel}. Verdict ranks on SEG funnel score (Lead×1, Good Lead×3, Applied×6, Accepted×10) and cost per score point; ±10% thresholds. Signals are prompts to check, not proven causes.</p>
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>{DIM_LABEL[dim]}</th><th>Verdict</th><th>Spend</th><th>Score</th><th>Prev score</th><th>Cost / pt</th><th>Prev cost / pt</th><th>Leads</th><th>Good Leads</th><th>Applied</th><th style={{ textAlign: 'left' }}>Next check</th></tr></thead>
              <tbody>
                {[win.total, ...win.rows.slice(0, 20)].map((r, i) => (
                  <tr key={r.key + i} className={i === 0 ? 'total' : ''}>
                    <td title={r.key}>{i === 0 ? 'Total' : label(r.key)}</td>
                    <td><span className={`chip ${r.verdict.split(' ')[0]}`}>{r.verdict}</span></td>
                    <td>{fmt('cost', r.cur.cost)}</td>
                    <td>{fmt('score', metric(r.cur, 'score'))}</td><td className="dim">{fmt('score', metric(r.prev, 'score'))}</td>
                    <td>{fmt('cpScore', metric(r.cur, 'cpScore'))}</td><td className="dim">{fmt('cpScore', metric(r.prev, 'cpScore'))}</td>
                    <td>{fmt('leads', r.cur.leads)}</td><td>{fmt('gl', r.cur.gl)}</td><td>{fmt('app', r.cur.app)}</td>
                    <td style={{ textAlign: 'left', whiteSpace: 'normal', minWidth: 260 }}>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- funnel bars

export function FunnelBars({ filter }: { filter?: Filter }) {
  const { store, filter: f0 } = useCtx();
  const t = useMemo(() => aggregate(store, filter ?? f0).get('') ?? emptyTotals(), [store, filter, f0]);
  const stages: [MetricId, MetricId | null][] = [['leads', null], ['gl', 'glRate'], ['reg', 'regRate'], ['app', 'appRate'], ['acc', 'accRate']];
  const top = t.leads || 1;
  return (
    <div className="panel funnel">
      <div className="chart-title">Funnel (stage counts on their own dates; aggregate ratios, not a person-level cohort)</div>
      {stages.map(([id, rate]) => (
        <div className="row" key={id}>
          <div>{METRICS[id].label}</div>
          <div className="track"><div className="fill" style={{ width: `${Math.max(0.3, (t[id as 'leads'] / top) * 100)}%` }} /></div>
          <div><b>{fmt(id, t[id as 'leads'])}</b> <span className="conv">{rate ? `${METRICS[rate].label} ${fmt(rate, metric(t, rate))}` : ''}</span></div>
        </div>
      ))}
    </div>
  );
}
