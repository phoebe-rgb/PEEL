// Pivot: one column per ticked dimension in tick order; equal values are merged (SHMS once for all its rows, then each
// country, channel…). Groups are ordered by their own total on the sort metric. Frozen header and dimension columns.
import { useMemo, useState, type ReactNode } from 'react';
import { metric, METRICS, type Filter, type MetricId } from './lib/agg';
import type { Dim } from './lib/data';
import { classify } from './lib/analysis';
import { DIM_LABEL } from './lib/format';
import { ragOf } from './lib/deep';
import type { Pair } from './lib/pair';
import type { Sides } from './lib/deep';
import { DRILL_METRICS, MetricCell, nameOf, useSides, verdictChip } from './drill';

const dimName = (d: Dim) => (d === 'market' ? 'Country' : DIM_LABEL[d]);
const W = 150; // frozen dimension column width

export function FlatPivot({ pair, options, initial, metrics = DRILL_METRICS, noUtm = false, fixed = [] }: { pair: Pair; options: Dim[]; initial: Dim[]; metrics?: MetricId[]; noUtm?: boolean; fixed?: Dim[] }) {
  const [sel, setSel] = useState<Dim[]>(initial);
  const [small, setSmall] = useState(false);
  const [withNoUtm, setWithNoUtm] = useState(false);
  const dims = options.filter((d) => sel.includes(d) || fixed.includes(d));
  // leads with no campaign (no UTM) have no activity type, so the ACT scope leaves them out unless asked for
  const p = useMemo(() => (withNoUtm ? widen(pair) : pair), [pair, withNoUtm]);
  return (
    <>
      <div className="dimpick"><span className="pg-name">Columns</span>{options.map((d) => (
        <label key={d} className={`pick ${dims.includes(d) ? 'on' : ''} ${fixed.includes(d) ? 'fixed' : ''}`}><input type="checkbox" disabled={fixed.includes(d)} checked={dims.includes(d)} onChange={() => setSel((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))} />{dimName(d)}</label>
      ))}
        <label className="pv-small"><input type="checkbox" checked={small} onChange={(e) => setSmall(e.target.checked)} /> rows under 20 spend</label>
        {noUtm && <label className="pv-small" title="Leads the CRM gives to this channel without a campaign (no UTM). They have no spend and no activity type, so they are outside the ACT scope by default."><input type="checkbox" checked={withNoUtm} onChange={(e) => setWithNoUtm(e.target.checked)} /> include leads with no campaign (no UTM)</label>}
      </div>
      {!dims.length ? <p className="dim">Tick at least one dimension.</p> : <PivotTable pair={p} dims={dims} metrics={metrics} small={small} />}
    </>
  );
}

/** The same comparison with the no-campaign rows (activity '') added to the activity filter. */
function widen(pair: Pair): Pair {
  const w = (f: Filter): Filter => (f.dims.activity?.length ? { ...f, dims: { ...f.dims, activity: [...f.dims.activity, ''] } } : f);
  return { ...pair, full: w(pair.full), cur: w(pair.cur), prev: pair.prev ? w(pair.prev) : null };
}

/** Extra plain columns on the right (header cells + one set of cells per row; key '' = the Total row). */
export interface RightCols { head: ReactNode; cells: (key: string, parts: string[]) => ReactNode }

export interface ExtraCol { head: ReactNode; cell: (key: string, x: Sides, parentCpgl: number) => ReactNode; total?: ReactNode }

/** The merged-cell pivot itself; `extra` adds a right-hand column (e.g. the insight). */
export function PivotTable({ pair, dims, metrics = DRILL_METRICS, small = false, extra, pills = true, right }: { pair: Pair; dims: Dim[]; metrics?: MetricId[]; small?: boolean; extra?: ExtraCol; pills?: boolean; right?: RightCols }) {
  const [sort, setSort] = useState<{ id: MetricId | 'dim'; desc: boolean }>({ id: 'cost', desc: true });
  const bys = useMemo(() => dims.map((_, i) => dims.slice(0, i + 1)), [dims.join()]);
  const { levels, total, labels, sides } = useSides(pair, dims.length ? bys : [['school']]);
  const rows = useMemo(() => {
    if (!dims.length) return [];
    const L = levels[dims.length - 1], keys = new Set([...L.full.keys(), ...(L.prev?.keys() ?? [])]);
    const parentCpgl = (k: string) => { const p = k.split('\u0001').slice(0, -1).join('\u0001'); return metric(dims.length > 1 ? levels[dims.length - 2].full.get(p) ?? total.full : total.full, 'cpgl'); };
    return [...keys].map((k) => ({ k, parts: k.split('\u0001'), x: sides(dims.length - 1, k) }))
      .filter(({ x }) => small || x.full.cost >= 20 || (x.prev?.cost ?? 0) >= 20 || x.full.gl > 0 || x.full.leads >= 5 || (x.prev?.leads ?? 0) >= 5)
      .map((r) => { const pc = parentCpgl(r.k); return { ...r, pc, verdict: classify(r.x.cur, r.x.prev ?? r.x.cur).verdict, rag: ragOf(r.x.full, r.x.cur, r.x.prev, pc) }; });
  }, [levels, total, sides, small, dims.join()]);
  // sort key for any prefix: the group's own total on the sort metric (spend by default)
  const keyOf = (depth: number, prefix: string) => {
    const t = levels[depth]?.full.get(prefix);
    if (sort.id === 'dim') return 0;
    const v = t ? metric(t, sort.id) : NaN;
    return Number.isFinite(v) ? v : -Infinity;
  };
  const sorted = [...rows].sort((a, b) => {
    for (let i = 0; i < dims.length; i++) {
      const pa = a.parts.slice(0, i + 1).join('\u0001'), pb = b.parts.slice(0, i + 1).join('\u0001');
      if (pa === pb) continue;
      if (sort.id === 'dim') return (a.parts[i].localeCompare(b.parts[i])) * (sort.desc ? -1 : 1);
      const d = keyOf(i, pa) - keyOf(i, pb);
      return (sort.desc ? -d : d) || pa.localeCompare(pb);
    }
    return 0;
  }).slice(0, 400);
  // merged cells: rowSpan for the first row of each run of equal prefixes
  const span = sorted.map((r, idx) => dims.map((_, i) => {
    const pre = r.parts.slice(0, i + 1).join('\u0001');
    if (idx > 0 && sorted[idx - 1].parts.slice(0, i + 1).join('\u0001') === pre) return 0;
    let n = 1; while (idx + n < sorted.length && sorted[idx + n].parts.slice(0, i + 1).join('\u0001') === pre) n++;
    return n;
  }));
  const clickSort = (id: MetricId | 'dim') => setSort((s) => ({ id, desc: s.id === id ? !s.desc : id !== 'dim' }));
  const arrow = (id: MetricId | 'dim') => (sort.id === id ? (sort.desc ? ' ▼' : ' ▲') : '');
  return (
    <>
        <div className="dd-wrap">
          <table className={`dd flat ${pills ? "" : "lean"}`}>
            <thead><tr>
              {dims.map((d, i) => <th key={d} className="fp-dim" style={{ left: i * W, minWidth: W, maxWidth: W }} onClick={() => clickSort('dim')}>{dimName(d)}{i === 0 ? arrow('dim') : ''}</th>)}
              {metrics.map((id) => <th key={id} title={METRICS[id].help} onClick={() => clickSort(id)} className="sortable">{METRICS[id].label}{arrow(id)}{pills && <div className="dd-sub">{labels.join(' · ')}</div>}</th>)}
              <th className="dd-res">Result</th>
              {extra && <th className="dd-ins">{extra.head}</th>}
              {right?.head}
            </tr></thead>
            <tbody>
              <tr className="dd-row dd-total" data-cmt="Total">{dims.map((d, i) => <td key={d} className="fp-dim" style={{ left: i * W, minWidth: W, maxWidth: W }}>{i === 0 ? <b>Total</b> : ''}</td>)}
                {metrics.map((id) => <MetricCell key={id} id={id} x={total} pills={pills} />)}<td className="dd-res">{verdictChip(classify(total.cur, total.prev ?? total.cur).verdict)}</td>{extra && <td className="dd-ins">{extra.total}</td>}{right?.cells('', [])}</tr>
              {sorted.map((r, idx) => (
                <tr key={r.k} data-cmt={r.parts.map((v, i) => nameOf(dims[i], v)).join(' › ')} className={`dd-row dd-leaf rag-${r.rag} ${span[idx].some((n, i) => n > 0 && i < dims.length - 1) && idx > 0 ? 'fp-break' : ''}`}>
                  {r.parts.map((v, i) => {
                    const n = span[idx][i];
                    if (!n) return null;
                    const last = i === dims.length - 1, t = !last ? levels[i].full.get(r.parts.slice(0, i + 1).join('\u0001')) : undefined;
                    return (
                      <td key={i} rowSpan={n} className={`fp-dim ${last ? '' : 'fp-merged'}`} style={{ left: i * W, minWidth: W, maxWidth: W }} title={v}>
                        <div className="fp-stick">{last && <span className={`rag-dot ${r.rag}`} />}{nameOf(dims[i], v)}
                          {t && n > 1 && <div className="fp-sub">{Math.round(t.cost).toLocaleString('en-US')} spend · {t.gl} GL</div>}</div>
                      </td>
                    );
                  })}
                  {metrics.map((id) => <MetricCell key={id} id={id} x={r.x} pills={pills} />)}
                  <td className="dd-res">{verdictChip(r.verdict)}</td>
                  {extra && <td className="dd-ins">{extra.cell(r.k, r.x, r.pc)}</td>}
                  {right?.cells(r.k, r.parts)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      <p className="note">One row per combination of the ticked columns ({rows.length} rows{rows.length > 400 ? ', top 400 shown' : ''}). Equal values are merged in the order of the ticked columns; groups are ordered by their own total. Click a metric header to sort. Each cell: selected period and change vs {pair.prevLabel || 'the comparison period'}{pills ? `, and the last three periods (${labels.join(' · ')})` : ''}. Dot = cost per good lead vs the total (green ≤80%, red ≥140% or spend without good leads).</p>
    </>
  );
}
