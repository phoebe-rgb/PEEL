import { useMemo } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { aggregate, emptyTotals, metric, METRICS, type Filter, type MetricId } from './lib/agg';
import { weekDays, weekRange, weekTick, type Dim } from './lib/data';
import { fmt } from './lib/format';
import { addDays, refDate } from './lib/rules';
import { useCtx } from './components';

const range = (end: string, n: number) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

/** Small scorecards: value on top, comparison underneath. `win` 7 = L7 vs P7 (leads/CPL), 14 = L14 vs P14 (good leads). */
export function MiniCards({ dims, items }: { dims: Partial<Record<Dim, string[]>>; items: { id: MetricId; win: 7 | 14 }[] }) {
  const { store } = useCtx();
  const y = refDate(store.lastDate);
  const data = useMemo(() => {
    const g = (dates: string[]) => aggregate(store, { cycle: '*', weeks: null, months: null, dims, dates } as Filter).get('') ?? emptyTotals();
    return { 7: [g(range(y, 7)), g(range(addDays(y, -7), 7))], 14: [g(range(y, 14)), g(range(addDays(y, -14), 14))] };
  }, [store, JSON.stringify(dims), y]);
  return (
    <div className="minicards">{items.map(({ id, win }) => {
      const [c, p] = data[win], a = metric(c, id), b = metric(p, id), def = METRICS[id];
      let d = '', cls = 'flat';
      if (Number.isFinite(a) && Number.isFinite(b)) {
        if (def.kind === 'rate') { const x = (a - b) * 100; d = `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}pp`; cls = Math.abs(x) < 0.5 ? 'flat' : (x > 0) === (def.better === 'up') ? 'up' : 'down'; }
        else if (b !== 0) { const x = (a - b) / Math.abs(b); d = `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(0)}%`; cls = Math.abs(x) < 0.1 || def.better === 'neutral' ? 'flat' : (x > 0) === (def.better === 'up') ? 'up' : 'down'; }
      }
      return (
        <div className="mc" key={id + win}>
          <div className="mc-l">{def.label} <span className="dim">L{win}</span></div>
          <div className="mc-v">{fmt(id, a, true)}</div>
          <div className="mc-p"><span className={`chg ${cls}`}>{d || '—'}</span> <span className="dim">P{win} {fmt(id, b, true)}</span></div>
        </div>
      );
    })}</div>
  );
}

/** Weekly columns (Leads, Good Leads) with CPL and CPGL lines, last 12 ISO weeks. */
export function WeekChart({ dims, height = 150 }: { dims: Partial<Record<Dim, string[]>>; height?: number }) {
  const { store } = useCtx();
  const rows = useMemo(() => {
    const m = aggregate(store, { cycle: '*', weeks: null, months: null, dims } as Filter, ['week']);
    return [...m.entries()].sort().slice(-12).map(([w, t]) => ({ w: weekTick(w), wr: weekRange(w), leads: t.leads, gl: t.gl, cpl: Number.isFinite(metric(t, 'cpl')) ? Math.round(metric(t, 'cpl') * 10) / 10 : null, cpgl: Number.isFinite(metric(t, 'cpgl')) ? Math.round(metric(t, 'cpgl')) : null, partial: weekDays(w)[6] > store.lastDate }));
  }, [store, JSON.stringify(dims)]);
  if (!rows.length) return null;
  return (
    <div className="weekchart">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="w" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
          <YAxis yAxisId="n" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={40} />
          <YAxis yAxisId="c" orientation="right" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={34} />
          <Tooltip formatter={(v, n) => [n === 'cpl' || n === 'cpgl' ? `CHF ${v}` : v, n === 'leads' ? 'Leads' : n === 'gl' ? 'Good Leads' : n === 'cpl' ? 'CPL' : 'CPGL']} labelFormatter={(l, pl) => `Week of ${(pl?.[0]?.payload as { wr?: string } | undefined)?.wr ?? l}`} />
          <Bar yAxisId="n" dataKey="leads" fill="var(--c1)" radius={[3, 3, 0, 0]} maxBarSize={12} isAnimationActive={false} />
          <Bar yAxisId="n" dataKey="gl" fill="var(--c2)" radius={[3, 3, 0, 0]} maxBarSize={12} isAnimationActive={false} />
          <Line yAxisId="c" dataKey="cpl" stroke="var(--c3)" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} connectNulls />
          <Line yAxisId="c" dataKey="cpgl" stroke="var(--c7)" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} isAnimationActive={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="legend small"><span><i className="sw" style={{ background: 'var(--c1)' }} />Leads</span><span><i className="sw" style={{ background: 'var(--c2)' }} />Good Leads</span><span><i className="sw" style={{ background: 'var(--c3)' }} />CPL</span><span><i className="sw" style={{ background: 'var(--c7)' }} />CPGL (CHF, right)</span></div>
    </div>
  );
}

export const READ_ITEMS: { id: MetricId; win: 7 | 14 }[] = [
  { id: 'cost', win: 7 }, { id: 'leads', win: 7 }, { id: 'cpl', win: 7 }, { id: 'gl', win: 14 }, { id: 'cpgl', win: 14 }, { id: 'glRate', win: 14 },
];
