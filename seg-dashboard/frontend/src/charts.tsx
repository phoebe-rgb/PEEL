import { useMemo, useState, type ReactNode } from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { aggregate, emptyTotals, metric, METRICS, type Filter, type MetricId, type Totals } from './lib/agg';
import { isoWeek, monthLabel, weekDays, weekRange, weekTick, type Dim } from './lib/data';
import { fmt, label } from './lib/format';
import { useCtx } from './components';

export interface Col { x: string; v: number; top?: string; sub?: string; sub2?: string; partial?: boolean; tip?: string }

/** Single-axis column chart. The count is the column; cost/rate context is printed under each column (no second axis). */
export function ColumnChart({ title, data, height = 150, color = 'var(--c1)', note }: { title: ReactNode; data: Col[]; height?: number; color?: string; note?: ReactNode }) {
  const max = Math.max(1, ...data.map((d) => (Number.isFinite(d.v) ? d.v : 0)));
  const two = data.some((d) => d.sub2);
  const W = Math.max(data.length * 38, 200), H = height, top = 16, bottom = two ? 46 : 34, colW = Math.min(22, (W / Math.max(1, data.length)) * 0.6);
  const step = W / Math.max(1, data.length);
  return (
    <div className="panel colchart">
      <div className="chart-title">{title}</div>
      <svg viewBox={`0 0 ${W} ${H + bottom}`} width="100%" height={H + bottom} preserveAspectRatio="none" role="img">
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line)" strokeWidth={1} />
        {data.map((d, i) => {
          const v = Number.isFinite(d.v) ? d.v : 0, h = ((H - top) * v) / max, x = i * step + (step - colW) / 2, y = H - h;
          const r = Math.min(4, h / 2);
          return (
            <g key={d.x}>
              <title>{d.tip ?? `${d.x}: ${d.top ?? v}${d.sub ? ` · ${d.sub}` : ''}`}</title>
              <rect x={i * step} y={0} width={step} height={H + bottom} fill="transparent" />
              {h > 0 && <path d={`M${x},${H} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + colW - r},${y} Q${x + colW},${y} ${x + colW},${y + r} L${x + colW},${H} Z`} fill={color} opacity={d.partial ? 0.45 : 1} />}
              <text x={x + colW / 2} y={y - 4} textAnchor="middle" fontSize="10" fill="var(--text-2)">{d.top ?? (v ? Math.round(v) : '')}</text>
              <text x={x + colW / 2} y={H + 12} textAnchor="middle" fontSize="9.5" fill="var(--muted)">{d.x}</text>
              {d.sub && <text x={x + colW / 2} y={H + 25} textAnchor="middle" fontSize="9" fill="var(--text-2)">{d.sub}</text>}
              {d.sub2 && <text x={x + colW / 2} y={H + 37} textAnchor="middle" fontSize="9" fill="var(--muted)">{d.sub2}</text>}
            </g>
          );
        })}
      </svg>
      {note && <div className="note" style={{ margin: 0 }}>{note}</div>}
    </div>
  );
}

/** Horizontal ranked bars: what works best (e.g. Good Leads by theme, with CPGL beside it). */
export function BarList({ title, rows, fmtV, max = 8, color = 'var(--c1)', note }: { title: ReactNode; rows: { key: string; v: number; sub?: string; flag?: 'good' | 'bad' }[]; fmtV: (v: number) => string; max?: number; color?: string; note?: ReactNode }) {
  const top = rows.filter((r) => Number.isFinite(r.v) && r.v > 0).sort((a, b) => b.v - a.v).slice(0, max);
  const m = Math.max(1, ...top.map((r) => r.v));
  return (
    <div className="panel barlist">
      <div className="chart-title">{title}</div>
      {top.length === 0 ? <p className="dim">No data in this view.</p> : top.map((r) => (
        <div className="bl-row" key={r.key} title={`${label(r.key)}: ${fmtV(r.v)}${r.sub ? ` · ${r.sub}` : ''}`}>
          <div className="bl-label">{label(r.key)}</div>
          <div className="bl-track"><div className="bl-fill" style={{ width: `${(r.v / m) * 100}%`, background: color }} /></div>
          <div className="bl-val">{fmtV(r.v)}{r.sub && <span className={`bl-sub ${r.flag ?? ''}`}> {r.sub}</span>}</div>
        </div>
      ))}
      {note && <div className="note" style={{ margin: '6px 0 0' }}>{note}</div>}
    </div>
  );
}

const shortCost = (v: number) => (Number.isFinite(v) ? (v >= 100 ? v.toFixed(0) : v.toFixed(1)) : '–');
const shortPct = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(0)}%` : '–');

export type Grain = 'week' | 'month';

/** Tooltip heading for a period key: 2026-W38 → "14–20 Sep 2026 (W38)", 2026-09 → "Sep 2026". */
export const pLabel = (p: string) => (/W\d\d$/.test(p) ? `${weekRange(p, true)} (W${p.slice(-2)})` : /^\d{4}-\d{2}$/.test(p) ? monthLabel(p) : p);

export function periodSeries(s: ReturnType<typeof useCtx>['store'], f: Filter, grain: Grain, n = 12) {
  const cf: Filter = { ...f, weeks: null, months: null, dates: null, range: null };
  const key = grain === 'week' ? 'week' : 'month';
  const m = aggregate(s, cf, [key, 'channel']);
  const periods = [...new Set([...m.keys()].map((k) => k.split('\u0001')[0]))].sort().slice(-n);
  const by = (ch: string | null) => periods.map((p) => {
    if (ch) return { p, t: m.get(`${p}\u0001${ch}`) ?? emptyTotals() };
    const t = emptyTotals();
    for (const [k, v] of m) if (k.startsWith(p + '\u0001')) { (['cost', 'impr', 'clicks', 'leads', 'gl', 'reg', 'app', 'acc', 'budget'] as const).forEach((x) => { t[x] += v[x]; t.avail[x] = t.avail[x] || v.avail[x]; }); }
    return { p, t };
  });
  const partial = (p: string) => (grain === 'week' ? weekDays(p)[6] > s.lastDate : `${p}-31` > s.lastDate && p === s.lastDate.slice(0, 7));
  return { periods, by, partial };
}

/** Week-by-week (or month) columns per channel: Leads (CPL), Good Leads (CPGL · GL rate), Applied (CPApp · App rate). */
export function ChannelColumns({ filter, grain }: { filter?: Filter; grain: Grain }) {
  const { store, filter: f0 } = useCtx();
  const f = filter ?? f0;
  const { periods, by, partial } = useMemo(() => periodSeries(store, f, grain), [store, f, grain]);
  const channels = useMemo(() => {
    const m = aggregate(store, { ...f, weeks: null, months: null }, ['channel']);
    return [...m.entries()].filter(([k, t]) => k && (t.cost > 0 || t.leads > 0)).sort((a, b) => b[1].cost - a[1].cost).map(([k]) => k);
  }, [store, f]);
  const x = (p: string) => (grain === 'week' ? weekTick(p) : monthLabel(p));
  const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)'];
  return (
    <>
      {channels.map((ch) => {
        const rows = by(ch);
        const mk = (vol: MetricId, sub: (t: Totals) => string, sub2?: (t: Totals) => string): Col[] => rows.map(({ p, t }) => ({ x: x(p), v: metric(t, vol) || 0, sub: sub(t), sub2: sub2?.(t), partial: partial(p), tip: `${p} · ${METRICS[vol].label} ${fmt(vol, metric(t, vol))} · ${sub(t)}${sub2 ? ` · ${sub2(t)}` : ''}` }));
        return (
          <div key={ch} className="chan-block">
            <h4>{ch}</h4>
            <div className="grid3">
              <ColumnChart title={<>Leads <span className="dim">· CPL under each column</span></>} color={COLORS[0]} data={mk('leads', (t) => shortCost(metric(t, 'cpl')))} />
              <ColumnChart title={<>Good Leads <span className="dim">· CPGL, then GL rate, under each column</span></>} color={COLORS[1]} data={mk('gl', (t) => shortCost(metric(t, 'cpgl')), (t) => shortPct(metric(t, 'glRate')))} />
              <ColumnChart title={<>Applied <span className="dim">· CPApp, then App rate (Applied ÷ Register)</span></>} color={COLORS[2]} data={mk('app', (t) => shortCost(metric(t, 'cpapp')), (t) => shortPct(metric(t, 'appRate')))} />
            </div>
          </div>
        );
      })}
      <p className="note">Last {periods.length} {grain === 'week' ? 'ISO weeks' : 'months'}. Faded column = period not finished yet. Costs in CHF.</p>
    </>
  );
}

/** What works best: Good Leads by a dimension, with CPGL next to each bar (green = at or below the view's average). */
export function BestBy({ dim, filter, title, max = 8, extra }: { dim: Dim; filter?: Filter; title?: ReactNode; max?: number; extra?: ReactNode }) {
  const { store, filter: f0 } = useCtx();
  const f = filter ?? f0;
  const { rows, avg } = useMemo(() => {
    const m = aggregate(store, f, [dim]);
    let C = 0, G = 0; for (const t of m.values()) { C += t.cost; G += t.gl; }
    const avg = G ? C / G : NaN;
    return { avg, rows: [...m.entries()].filter(([k]) => k).map(([k, t]) => { const c = metric(t, 'cpgl'); return { key: k, v: t.gl, sub: Number.isFinite(c) ? `CPGL ${c.toFixed(0)}` : '', flag: (Number.isFinite(c) && Number.isFinite(avg) ? (c <= avg ? 'good' : c >= 1.5 * avg ? 'bad' : undefined) : undefined) as 'good' | 'bad' | undefined }; }) };
  }, [store, f, dim]);
  return <BarList title={title ?? <>Good Leads by {dim}</>} rows={rows} max={max} fmtV={(v) => v.toFixed(0)} color="var(--c2)"
    note={<>Green CPGL = at or below the view average ({Number.isFinite(avg) ? `CHF ${avg.toFixed(0)}` : '–'}); red = 1.5× or more.{extra}</>} />;
}

/** Small multiples: one metric over time for the top values of a dimension. */
export function TrendBy({ dim, metricId = 'gl', filter, grain = 'week', top = 4 }: { dim: Dim; metricId?: MetricId; filter?: Filter; grain?: Grain; top?: number }) {
  const { store, filter: f0 } = useCtx();
  const f = filter ?? f0;
  const data = useMemo(() => {
    const cf: Filter = { ...f, weeks: null, months: null, dates: null, range: null };
    const tot = aggregate(store, cf, [dim]);
    const keys = [...tot.entries()].filter(([k, t]) => k && (t.cost > 0 || t.leads > 0 || t.gl > 0)).sort((a, b) => b[1].cost - a[1].cost || b[1].leads - a[1].leads).slice(0, top).map(([k]) => k);
    const m = aggregate(store, cf, [grain, dim]);
    const periods = [...new Set([...m.keys()].map((k) => k.split('\u0001')[0]))].sort().slice(-10);
    return keys.map((k) => ({ k, cols: periods.map((p) => { const t = m.get(`${p}\u0001${k}`) ?? emptyTotals(); return { x: grain === 'week' ? weekTick(p) : monthLabel(p), v: metric(t, metricId) || 0, tip: `${p} · ${label(k)}: ${fmt(metricId, metric(t, metricId))}` }; }) }));
  }, [store, f, dim, metricId, grain, top]);
  const C = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)'];
  return <div className="grid4">{data.map((d, i) => <ColumnChart key={d.k} title={<>{label(d.k)} <span className="dim">· {METRICS[metricId].label} by {grain}</span></>} data={d.cols} color={C[i % 4]} height={100} />)}</div>;
}

// ---------------------------------------------------------------- metric timeline (multi-select)

const PICKABLE: MetricId[] = ['cost', 'impr', 'clicks', 'ctr', 'cpm', 'cpc', 'leads', 'cpl', 'leadCvr', 'gl', 'cpgl', 'glRate', 'reg', 'cpreg', 'app', 'cpapp', 'appRate', 'leadAppRate', 'acc', 'cpacc', 'accRate', 'score', 'cpScore', 'budget'];
const LINE_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)'];

/** Timeline where the viewer picks the metrics. Separate = one aligned mini-chart per metric (own scale); Indexed = one chart, each metric rebased to 100. */
export function MetricTimeline({ filter, initial = ['cost', 'leads', 'gl', 'cpgl'] }: { filter?: Filter; initial?: MetricId[] }) {
  const { store, filter: f0 } = useCtx();
  const f = filter ?? f0;
  const [picked, setPicked] = useState<MetricId[]>(initial);
  const [grain, setGrain] = useState<Grain>('week');
  const [mode, setMode] = useState<'separate' | 'indexed'>('separate');
  const { periods, by, partial } = useMemo(() => periodSeries(store, { ...f, cycle: '*' }, grain, grain === 'week' ? 60 : 26), [store, f, grain]);
  const rows = useMemo(() => by(null).map(({ p, t }) => {
    const r: Record<string, number | string | boolean | null> = { p, x: grain === 'week' ? weekTick(p) : monthLabel(p), partial: partial(p) };
    for (const id of PICKABLE) { const v = metric(t, id); r[id] = Number.isFinite(v) ? v : null; }
    return r;
  }), [by, grain, partial]);
  const indexed = useMemo(() => rows.map((r) => {
    const o: Record<string, number | string | boolean | null> = { ...r };
    for (const id of picked) { const base = rows.find((x) => typeof x[id] === 'number' && (x[id] as number) !== 0)?.[id] as number | undefined; o[`${id}_i`] = base && typeof r[id] === 'number' ? ((r[id] as number) / base) * 100 : null; }
    return o;
  }), [rows, picked]);
  const toggle = (id: MetricId) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const colorOf = (id: MetricId) => LINE_COLORS[picked.indexOf(id) % LINE_COLORS.length];
  void periods;
  return (
    <div className="panel timeline">
      <div className="tl-head">
        <div className="chart-title">Timeline — pick the metrics</div>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={grain === 'week' ? 'on' : ''} onClick={() => setGrain('week')}>Weekly</button>
          <button className={grain === 'month' ? 'on' : ''} onClick={() => setGrain('month')}>Monthly</button>
          <span style={{ width: 10 }} />
          <button className={mode === 'separate' ? 'on' : ''} onClick={() => setMode('separate')}>Separate scales</button>
          <button className={mode === 'indexed' ? 'on' : ''} onClick={() => setMode('indexed')}>Indexed (first = 100)</button>
        </div>
      </div>
      <div className="picker">{PICKABLE.map((id) => (
        <label key={id} className={`pick ${picked.includes(id) ? 'on' : ''}`} title={METRICS[id].help}>
          <input type="checkbox" checked={picked.includes(id)} onChange={() => toggle(id)} />
          {picked.includes(id) && <i className="sw" style={{ background: colorOf(id) }} />}{METRICS[id].label}
        </label>
      ))}</div>
      {picked.length === 0 ? <p className="dim">Tick at least one metric.</p> : mode === 'indexed' ? (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={indexed} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="x" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} minTickGap={16} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={40} />
            <Tooltip content={({ active, payload }) => active && payload?.length ? (
              <div className="tip"><b>{pLabel((payload[0].payload as { p: string }).p)}</b>{picked.map((id) => { const r = payload[0].payload as Record<string, number | null>; return <div key={id}><i className="sw" style={{ background: colorOf(id) }} />{METRICS[id].label}: {fmt(id, r[id] ?? NaN)} <span className="dim">(index {r[`${id}_i`] !== null && r[`${id}_i`] !== undefined ? (r[`${id}_i`] as number).toFixed(0) : '–'})</span></div>; })}</div>) : null} />
            {picked.map((id) => <Line key={id} type="linear" dataKey={`${id}_i`} stroke={colorOf(id)} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="tl-stack">{picked.map((id) => (
          <div key={id} className="tl-row">
            <div className="tl-label"><i className="sw" style={{ background: colorOf(id) }} />{METRICS[id].label}<div className="dim">{fmt(id, (rows.at(-1)?.[id] as number) ?? NaN)} latest</div></div>
            <ResponsiveContainer width="100%" height={78}>
              <LineChart data={rows} syncId="tl" margin={{ top: 6, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="x" hide={id !== picked.at(-1)} tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} minTickGap={16} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => (METRICS[id].kind === 'rate' ? `${(v * 100).toFixed(1)}%` : v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : v >= 10 ? v.toFixed(0) : v.toFixed(1))} tickCount={3} />
                <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="tip"><b>{pLabel((payload[0].payload as { p: string }).p)}{(payload[0].payload as { partial: boolean }).partial ? ' (partial)' : ''}</b>{METRICS[id].label}: {fmt(id, (payload[0].payload as Record<string, number | null>)[id] ?? NaN)}</div> : null} />
                <Line type="linear" dataKey={id} stroke={colorOf(id)} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}</div>
      )}
      <p className="note" style={{ margin: '4px 0 0' }}>Follows the school/channel/country/activity filters across all cycles (not the week selector). Each metric keeps its own scale; "Indexed" rebases every line to 100 at the first period so trends are comparable on one axis. Hover to read exact values; the latest {grain} may be partial.</p>
    </div>
  );
}

// ---------------------------------------------------------------- combined timeline (one chart)

const VOL: MetricId[] = ['cost', 'budget', 'impr', 'clicks', 'leads', 'gl', 'reg', 'app', 'acc', 'score'];
const COST: MetricId[] = ['cpl', 'cpgl', 'cpreg', 'cpapp', 'cpacc', 'cpc', 'cpm', 'cpScore'];
const RATE: MetricId[] = ['ctr', 'leadCvr', 'glRate', 'leadAppRate', 'regRate', 'appRate', 'accRate'];
const PAL = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', '#8a8a86'];

/**
 * One chart for the whole story: counts as columns (left axis), CHF costs as lines (right axis), rates as dashed lines (% axis).
 * Spend/budget are CHF volumes and use the CHF axis as columns. Every axis is labelled and every value is in the tooltip.
 */
export function ComboTimeline({ filter, initial = ['leads', 'gl', 'cpl', 'cpgl'] as MetricId[], title = 'Timeline', marks = [] }: { filter?: Filter; initial?: MetricId[]; title?: ReactNode; marks?: { day: string; text: string }[] }) {
  const { store, filter: f0 } = useCtx();
  const f = filter ?? f0;
  const [picked, setPicked] = useState<MetricId[]>(initial);
  const [grain, setGrain] = useState<Grain>('week');
  const [n, setN] = useState(26);
  const { by, partial } = useMemo(() => periodSeries(store, { ...f, cycle: '*' }, grain, 200), [store, f, grain]);
  const rows = useMemo(() => by(null).slice(-(grain === 'week' ? n : Math.ceil(n / 4))).map(({ p, t }) => {
    const r: Record<string, number | string | boolean | null> = { p, x: grain === 'week' ? weekTick(p) : monthLabel(p), partial: partial(p) };
    for (const id of [...VOL, ...COST, ...RATE]) { const v = metric(t, id); r[id] = Number.isFinite(v) ? (RATE.includes(id) ? v * 100 : v) : null; }
    return r;
  }), [by, grain, partial, n]);
  // ✓ markers: done actions grouped by the period they were done in
  const markBy = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const k of marks) { const p = grain === 'week' ? isoWeek(k.day) : k.day.slice(0, 7); (m.get(p) ?? m.set(p, []).get(p)!).push(k.text); }
    return m;
  }, [marks, grain]);
  const colorOf = (id: MetricId) => PAL[picked.indexOf(id) % PAL.length];
  const money = (id: MetricId) => id === 'cost' || id === 'budget';
  const toggle = (id: MetricId) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const counts = picked.filter((id) => VOL.includes(id) && !money(id)), chfBars = picked.filter(money), costs = picked.filter((id) => COST.includes(id)), rates = picked.filter((id) => RATE.includes(id));
  const k = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`);
  const group = (name: string, ids: MetricId[]) => (
    <div className="pick-group"><span className="pg-name">{name}</span>{ids.map((id) => (
      <label key={id} className={`pick ${picked.includes(id) ? 'on' : ''}`} title={METRICS[id].help}>
        <input type="checkbox" checked={picked.includes(id)} onChange={() => toggle(id)} />
        {picked.includes(id) && <i className="sw" style={{ background: colorOf(id) }} />}{METRICS[id].label}
      </label>
    ))}</div>
  );
  return (
    <div className="panel timeline">
      <div className="tl-head">
        <div className="chart-title">{title}</div>
        <div className="seg">
          <button className={grain === 'week' ? 'on' : ''} onClick={() => setGrain('week')}>Weekly</button>
          <button className={grain === 'month' ? 'on' : ''} onClick={() => setGrain('month')}>Monthly</button>
        </div>
        <div className="seg">{[13, 26, 52, 104].map((x) => <button key={x} className={n === x ? 'on' : ''} onClick={() => setN(x)}>{x === 13 ? '3 mo' : x === 26 ? '6 mo' : x === 52 ? '1 yr' : '2 yr'}</button>)}</div>
      </div>
      <div className="picker">{group('Volumes (columns)', VOL)}{group('Costs (lines, CHF)', COST)}{group('Rates (dashed, %)', RATE)}</div>
      {picked.length === 0 ? <p className="dim">Tick at least one metric.</p> : (
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="x" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} minTickGap={14} />
            <YAxis yAxisId="n" hide={!counts.length} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={44} tickFormatter={k} label={{ value: 'count', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'var(--muted)' }} />
            <YAxis yAxisId="chf" orientation="right" hide={!(costs.length || chfBars.length)} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={50} tickFormatter={k} label={{ value: 'CHF', angle: 90, position: 'insideRight', fontSize: 10, fill: 'var(--muted)' }} />
            <YAxis yAxisId="pct" orientation="right" hide={!rates.length} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as Record<string, number | null | string | boolean>;
              return <div className="tip"><b>{pLabel(r.p as string)}{r.partial ? ' (not finished)' : ''}</b>{picked.map((id) => <div key={id}><i className="sw" style={{ background: colorOf(id) }} />{METRICS[id].label}: <b>{fmt(id, RATE.includes(id) ? ((r[id] as number) ?? NaN) / 100 : ((r[id] as number) ?? NaN))}</b></div>)}</div>;
            }} />
            {[...chfBars.map((id) => ({ id, ax: 'chf' })), ...counts.map((id) => ({ id, ax: 'n' }))].map(({ id, ax }) => (
              <Bar key={id} yAxisId={ax} dataKey={id} fill={colorOf(id)} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false}>
                {rows.map((r, i) => <Cell key={i} fillOpacity={r.partial ? 0.45 : 0.9} />)}
              </Bar>
            ))}
            {costs.map((id) => <Line key={id} yAxisId="chf" type="linear" dataKey={id} stroke={colorOf(id)} strokeWidth={2.5} dot={{ r: 2.5, fill: colorOf(id) }} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />)}
            {rates.map((id) => <Line key={id} yAxisId="pct" type="linear" dataKey={id} stroke={colorOf(id)} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />)}
            {rows.filter((r) => markBy.has(r.p as string)).map((r) => <ReferenceLine key={r.p as string} x={r.x as string} yAxisId={counts.length ? 'n' : costs.length || chfBars.length ? 'chf' : 'pct'} stroke="var(--good)" strokeDasharray="3 3" label={{ value: `✓${markBy.get(r.p as string)!.length}`, position: 'top', fill: 'var(--good)', fontSize: 11, fontWeight: 700 }} />)}
          </ComposedChart>
        </ResponsiveContainer>
      )}
      {markBy.size > 0 && <div className="tl-marks"><b className="good">✓ = actions marked done that {grain}</b>{[...markBy.entries()].filter(([p]) => rows.some((r) => r.p === p)).slice(-4).reverse().map(([p, ts]) => <div key={p}><b>{grain === 'week' ? weekRange(p) : monthLabel(p)}:</b> {ts.slice(0, 3).join(' · ')}{ts.length > 3 ? ` (+${ts.length - 3})` : ''}</div>)}</div>}
      <div className="legend">{picked.map((id) => <span key={id}><i className="sw" style={{ background: colorOf(id) }} />{METRICS[id].label} <span className="dim">({VOL.includes(id) ? (money(id) ? 'column, CHF' : 'column, count') : COST.includes(id) ? 'line, CHF' : 'dashed, %'})</span></span>)}</div>
      <p className="note" style={{ margin: '4px 0 0' }}>Follows the school/channel/country/activity filters across all cycles. Faded column = period not finished (good leads and later stages still filling in).</p>
    </div>
  );
}
