import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { aggregate, emptyTotals, metric, METRICS, type Filter, type MetricId, type Totals } from './lib/agg';
import type { Dim } from './lib/data';
import { DIM_LABEL, fmt, label } from './lib/format';
import { quantityQuality } from './lib/insights';
import { marketName } from './lib/names';
import { useCtx } from './components';

// Categorical slots in fixed order (validated reference palette); "Other" is neutral grey.
const SLOTS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)'];
const OTHER = 'var(--c-other)';

function Donut({ parts, center, sub }: { parts: { key: string; v: number; color: string }[]; center: string; sub: string }) {
  const tot = parts.reduce((a, p) => a + p.v, 0);
  const R = 52, r = 34, C = 60;
  let a0 = -Math.PI / 2;
  const arcs = tot > 0 ? parts.filter((p) => p.v > 0).map((p) => {
    const a1 = a0 + (p.v / tot) * Math.PI * 2 - 0.02;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const pt = (rad: number, ang: number) => `${C + rad * Math.cos(ang)} ${C + rad * Math.sin(ang)}`;
    const d = `M ${pt(R, a0)} A ${R} ${R} 0 ${large} 1 ${pt(R, a1)} L ${pt(r, a1)} A ${r} ${r} 0 ${large} 0 ${pt(r, a0)} Z`;
    const el = <path key={p.key} d={d} fill={p.color}><title>{`${label(p.key)}: ${((p.v / tot) * 100).toFixed(1)}%`}</title></path>;
    a0 = a1 + 0.02;
    return el;
  }) : [<circle key="e" cx={C} cy={C} r={(R + r) / 2} fill="none" stroke="var(--grid)" strokeWidth={R - r} />];
  return (
    <svg viewBox="0 0 120 120" width={130} height={130} role="img" aria-label={`${sub} share`}>
      {arcs}
      <text x={C} y={C - 3} textAnchor="middle" fontSize="10" fill="var(--text-2)">{sub}</text>
      <text x={C} y={C + 12} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--text)">{center}</text>
    </svg>
  );
}

const SHARE_DIMS: Dim[] = ['country', 'school', 'channel', 'activity', 'market'];

/** Where the spend and results come from: shares of Spend, Leads and Good Leads by a chosen breakdown. */
export function ShareBy({ filter }: { filter?: Filter }) {
  const { store, filter: f0 } = useCtx();
  const f = filter ?? f0;
  const [dim, setDim] = useState<Dim>('country');
  const { rows, tot } = useMemo(() => {
    const m = aggregate(store, f, [dim]);
    const tot = [...m.values()].reduce((a, t) => ({ cost: a.cost + t.cost, leads: a.leads + t.leads, gl: a.gl + t.gl }), { cost: 0, leads: 0, gl: 0 });
    const all = [...m.entries()].sort((a, b) => b[1].cost - a[1].cost || b[1].leads - a[1].leads);
    const top = all.slice(0, 7), rest = all.slice(7);
    const other = rest.reduce((a, [, t]) => ({ cost: a.cost + t.cost, leads: a.leads + t.leads, gl: a.gl + t.gl }), { cost: 0, leads: 0, gl: 0 });
    const rows = top.map(([k, t], i) => ({ key: k, color: SLOTS[i], cost: t.cost, leads: t.leads, gl: t.gl }));
    if (rest.length) rows.push({ key: 'Other', color: OTHER, ...other });
    return { rows, tot };
  }, [store, f, dim]);
  const share = (v: number, t: number) => (t ? `${((v / t) * 100).toFixed(v / t < 0.1 ? 1 : 0)}%` : '–');
  return (
    <div className="panel share">
      <div className="share-head">
        <div className="chart-title">Where the spend and results come from</div>
        <label className="inline">Share by <select value={dim} onChange={(e) => setDim(e.target.value as Dim)}>{SHARE_DIMS.map((d) => <option key={d} value={d}>{DIM_LABEL[d]}</option>)}</select></label>
      </div>
      <div className="share-body">
        <div className="donuts">
          <Donut parts={rows.map((r) => ({ key: r.key, v: r.cost, color: r.color }))} sub="Spend" center={fmt('cost', tot.cost, true)} />
          <Donut parts={rows.map((r) => ({ key: r.key, v: r.leads, color: r.color }))} sub="Leads" center={fmt('leads', tot.leads, true)} />
          <Donut parts={rows.map((r) => ({ key: r.key, v: r.gl, color: r.color }))} sub="Good Leads" center={fmt('gl', tot.gl, true)} />
        </div>
        <table className="t compact">
          <thead><tr><th>{DIM_LABEL[dim]}</th><th>Spend</th><th>Leads</th><th>Good Leads</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.key}><td><i className="sw" style={{ background: r.color }} />{r.key === 'Other' ? 'Other' : label(r.key)}</td>
              <td>{share(r.cost, tot.cost)}</td><td>{share(r.leads, tot.leads)}</td><td>{share(r.gl, tot.gl)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/** Lead quantity vs quality: Leads show volume; Good Lead / Lead shows quality. */
export function QualityPanel({ filter, dims = ['country', 'channel', 'school'], tables = false }: { filter?: Filter; dims?: Dim[]; tables?: boolean }) {
  const { store, filter: f0 } = useCtx();
  const f = filter ?? f0;
  const qs = useMemo(() => dims.map((d) => ({ d, q: quantityQuality(store, f, d) })), [store, f, dims.join()]);
  return (
    <div className="panel">
      <div className="chart-title">Lead quantity vs quality</div>
      {qs.map(({ d, q }) => (
        <div key={d} style={{ marginTop: 6 }}>
          <b>{DIM_LABEL[d]}:</b> {q.text}
          {tables && q.rows.length > 0 && (
            <div className="tablewrap" style={{ marginTop: 6 }}>
              <table className="t compact">
                <thead><tr><th>{DIM_LABEL[d]}</th><th>Leads</th><th>Lead share</th><th>Good Leads</th><th>GL share</th><th>GL/Lead</th><th>vs average</th><th>Quality</th></tr></thead>
                <tbody>{q.rows.slice(0, 15).map((r) => (
                  <tr key={r.key}><td>{label(r.key)}</td><td>{fmt('leads', r.leads)}</td><td>{(r.leadShare * 100).toFixed(1)}%</td><td>{fmt('gl', r.gl)}</td>
                    <td>{(r.glShare * 100).toFixed(1)}%</td><td>{(r.rate * 100).toFixed(1)}%</td>
                    <td className={r.quality === 'Low quality' ? 'bad' : r.quality === 'High quality' ? 'good' : 'dim'}>{r.leads >= 20 ? `${r.vsAvg >= 0 ? '+' : ''}${(r.vsAvg * 100).toFixed(0)}%` : '–'}</td>
                    <td>{r.quality}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      ))}
      <p className="note">Good Lead / Lead is compared with this view's average ({(qs[0]?.q.avg * 100 || 0).toFixed(1)}%). 20% or more below average is low quality; a quality concern also needs at least 10% of leads. Areas need at least 20 leads to be judged.</p>
    </div>
  );
}

// ---------------------------------------------------------------- hierarchy table

export interface HierCol { id: string; head: ReactNode; title?: string; render: (cur: Totals, ref: Totals | undefined, extra: Totals[], key?: string, depth?: number) => ReactNode; sort?: (cur: Totals, ref: Totals | undefined) => number; className?: string }

/**
 * Expandable drill-down (e.g. Country → School → Channel → Campaign). `refFilter` supplies the comparison
 * period aggregated with the same keys; `extraFilters` supply more periods (e.g. W-2, W-1) for mini series.
 */
export function HierTable({ levels, filter, refFilter, extraFilters = [], cols, rowNote, limit = 40, minCost = 0, extraArrays, keep }: {
  levels: Dim[]; filter: Filter; refFilter?: Filter | null; extraFilters?: Filter[]; cols: HierCol[];
  rowNote?: (cur: Totals, ref: Totals | undefined, children: { key: string; cur: Totals; ref?: Totals }[]) => ReactNode;
  limit?: number; minCost?: number; extraArrays?: Record<string, Float64Array>; keep?: (cur: Totals, ref: Totals | undefined) => boolean;
}) {
  const { store } = useCtx();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 }>({ col: cols[0].id, dir: -1 });
  const maps = useMemo(() => levels.map((_, i) => ({
    cur: aggregate(store, filter, levels.slice(0, i + 1), extraArrays),
    ref: refFilter ? aggregate(store, refFilter, levels.slice(0, i + 1), extraArrays) : undefined,
    ext: extraFilters.map((ef) => aggregate(store, ef, levels.slice(0, i + 1), extraArrays)),
  })), [store, filter, refFilter, extraFilters, levels.join(), extraArrays]);
  const total = useMemo(() => ({
    cur: aggregate(store, filter, [], extraArrays).get('') ?? emptyTotals(),
    ref: refFilter ? aggregate(store, refFilter, [], extraArrays).get('') : undefined,
    ext: extraFilters.map((ef) => aggregate(store, ef, [], extraArrays).get('') ?? emptyTotals()),
  }), [store, filter, refFilter, extraFilters, extraArrays]);
  const sortCol = cols.find((c) => c.id === sort.col)!;
  const children = (depth: number, prefix: string) => {
    const m = maps[depth];
    const keys = new Set<string>();
    for (const k of m.cur.keys()) if (!prefix || k.startsWith(prefix + '\u0001')) keys.add(k);
    for (const k of m.ref?.keys() ?? []) if (!prefix || k.startsWith(prefix + '\u0001')) keys.add(k);
    return [...keys].map((k) => ({ key: k, cur: m.cur.get(k) ?? emptyTotals(), ref: m.ref?.get(k), ext: m.ext.map((e) => e.get(k) ?? emptyTotals()) }))
      .filter((r) => r.cur.cost >= minCost && (r.cur.cost > 0 || r.cur.leads > 0 || r.cur.gl > 0 || (r.ref && (r.ref.cost > 0 || r.ref.leads > 0))))
      .sort((a, b) => {
        const va = sortCol.sort ? sortCol.sort(a.cur, a.ref) : a.cur.cost, vb = sortCol.sort ? sortCol.sort(b.cur, b.ref) : b.cur.cost;
        return ((Number.isFinite(va) ? va : -Infinity) > (Number.isFinite(vb) ? vb : -Infinity) ? 1 : -1) * sort.dir;
      });
  };
  const toggle = (k: string) => setOpen((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const expandAll = () => {
    const all = new Set<string>();
    for (let d = 0; d < levels.length - 1; d++) for (const k of maps[d].cur.keys()) all.add(k);
    setOpen(all);
  };
  const render = (depth: number, prefix: string): ReactNode => children(depth, prefix).filter((r) => depth > 0 || !keep || keep(r.cur, r.ref)).slice(0, depth === 0 ? limit : 60).map((r) => {
    const name = r.key.split('\u0001').at(-1)!;
    const can = depth < levels.length - 1;
    const kids = can && open.has(r.key) ? children(depth + 1, r.key) : [];
    return (
      <Fragment key={r.key}>
        <tr className={`lvl${depth}`}>
          <td style={{ paddingLeft: 8 + depth * 18 }} title={name}>
            {can ? <button className="twisty" onClick={() => toggle(r.key)} aria-expanded={open.has(r.key)}>{open.has(r.key) ? '▾' : '›'}</button> : <span className="twisty" />}
            <span className="lvl-dim">{DIM_LABEL[levels[depth]]}</span> {levels[depth] === 'market' ? marketName(name) : label(name)}
          </td>
          {cols.map((c) => <td key={c.id} className={c.className}>{c.render(r.cur, r.ref, r.ext, r.key, depth)}</td>)}
        </tr>
        {rowNote && <tr className={`noterow lvl${depth}`}><td colSpan={cols.length + 1} style={{ paddingLeft: 26 + depth * 18 }}>{rowNote(r.cur, r.ref, can ? children(depth + 1, r.key) : [])}</td></tr>}
        {kids.length > 0 && render(depth + 1, r.key)}
      </Fragment>
    );
  });
  return (
    <>
      <div className="tabs"><button onClick={expandAll}>Expand all</button><button onClick={() => setOpen(new Set())}>Collapse all</button></div>
      <div className="tablewrap">
        <table className="t hier">
          <thead><tr>
            <th>{levels.map((l) => DIM_LABEL[l]).join(' › ')}</th>
            {cols.map((c) => <th key={c.id} title={c.title} onClick={() => setSort((s) => ({ col: c.id, dir: s.col === c.id ? (-s.dir as 1 | -1) : -1 }))}>{c.head}{sort.col === c.id ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}</th>)}
          </tr></thead>
          <tbody>
            <tr className="total"><td>Total</td>{cols.map((c) => <td key={c.id} className={c.className}>{c.render(total.cur, total.ref, total.ext, '', -1)}</td>)}</tr>
            {rowNote && <tr className="noterow total-note"><td colSpan={cols.length + 1}>{rowNote(total.cur, total.ref, children(0, ''))}</td></tr>}
            {render(0, '')}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Value with the comparison value underneath and the change. */
export function vsCell(id: MetricId, cur: Totals, ref: Totals | undefined, refLabel = '') {
  const a = metric(cur, id), b = ref ? metric(ref, id) : NaN;
  const def = METRICS[id];
  let ch = '', cls = 'dim';
  if (Number.isFinite(a) && Number.isFinite(b)) {
    if (def.kind === 'rate') { const d = (a - b) * 100; ch = `${d >= 0 ? '+' : ''}${d.toFixed(2)} pp`; cls = Math.abs(d) < 0.05 || def.better === 'neutral' ? 'dim' : (d > 0) === (def.better === 'up') ? 'good' : 'bad'; }
    else if (def.kind !== 'cost' && Math.abs(b) < (def.kind === 'money' ? 50 : 5) && Math.abs(a - b) > Math.abs(b)) { ch = 'small base'; cls = 'dim'; }
    else if (b !== 0) { const d = (a - b) / Math.abs(b); ch = `${d >= 0 ? '+' : ''}${Math.abs(d) >= 10 ? '>999' : (d * 100).toFixed(0)}%`; cls = Math.abs(d) < 0.1 || def.better === 'neutral' ? 'dim' : (d > 0) === (def.better === 'up') ? 'good' : 'bad'; }
    else if (a > 0) { ch = 'new'; cls = def.better === 'down' ? 'bad' : 'good'; }
  }
  return (
    <span className="vs">
      <span>{fmt(id, a)}</span>
      {ref !== undefined && <span className="vs-sub">{refLabel}{fmt(id, b)} {ch && <b className={cls}>{ch}</b>}</span>}
    </span>
  );
}

export const tip = (id: MetricId) => METRICS[id].help;
