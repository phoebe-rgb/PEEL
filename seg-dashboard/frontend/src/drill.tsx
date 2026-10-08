// York-style drill-down: frozen header and hierarchy column; every cell = value + change, and the last three
// periods as pills underneath; Result chip; deep insight (what · why · next) with a feedback box.
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { aggregate, emptyTotals, metric, METRICS, type MetricId, type Totals } from './lib/agg';
import type { Dim } from './lib/data';
import { DIM_LABEL, fmt, label } from './lib/format';
import { marketName } from './lib/names';
import { googleReview, metaReview } from './lib/rules';
import { stepBack, shortLabel, type Pair } from './lib/pair';
import { buildKids, deepGroup, deepLeaf, ragOf, type Deep, type DeepCtx, type Sides } from './lib/deep';
import { useCtx } from './components';
import { useRefData } from './actions';
import { PivotTable } from './flatpivot';
import type { Verdict } from './lib/analysis';

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
/** Compact number for the period pills. */
export function pill(id: MetricId, v: number): string {
  if (!Number.isFinite(v)) return '–';
  const k = METRICS[id].kind;
  if (k === 'rate') return `${nf1.format(v * 100)}%`;
  if (k === 'money') return v >= 10000 ? `${nf1.format(v / 1000)}k` : nf0.format(v);
  if (k === 'cost') return v >= 100 ? nf0.format(v) : nf1.format(v);
  return nf0.format(v);
}

/** Change of the matched current period vs the comparison period, coloured by the metric's good direction. */
export function change(id: MetricId, cur: Totals, ref?: Totals): { t: string; cls: string } {
  const def = METRICS[id], a = metric(cur, id), b = ref ? metric(ref, id) : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { t: '', cls: 'flat' };
  if (def.kind === 'rate') { const x = (a - b) * 100; return { t: `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)} pp`, cls: Math.abs(x) < 0.5 ? 'flat' : (x > 0) === (def.better === 'up') ? 'up' : 'down' }; }
  if (b === 0) return a > 0 ? { t: 'new', cls: def.better === 'down' ? 'down' : def.better === 'up' ? 'up' : 'flat' } : { t: '0%', cls: 'flat' };
  const x = (a - b) / Math.abs(b);
  return { t: `${x >= 0 ? '+' : '−'}${Math.abs(x) >= 10 ? '>999' : Math.abs(x * 100).toFixed(0)}%`, cls: Math.abs(x) < 0.1 || def.better === 'neutral' ? 'flat' : (x > 0) === (def.better === 'up') ? 'up' : 'down' };
}

export function MetricCell({ id, x, pills = true }: { id: MetricId; x: Sides; pills?: boolean }) {
  const c = change(id, x.cur, x.prev);
  return (
    <td className="dd-num">
      <div className="dd-top"><b>{fmt(id, metric(x.full, id), true)}</b> <span className={`dd-chg ${c.cls}`}>{c.t}</span></div>
      {pills && <div className="dd-pills"><span>{x.prev2 ? pill(id, metric(x.prev2, id)) : '–'}</span><span>{x.prev ? pill(id, metric(x.prev, id)) : '–'}</span><span className="cur">{pill(id, metric(x.cur, id))}</span></div>}
    </td>
  );
}

export const verdictChip = (v: Verdict) => <span className={`chip ${v.split(' ')[0]}`}>{v === 'Low volume' ? 'Low vol.' : v}</span>;

/** Aggregations for the current, previous and the one-before-previous periods at each depth. */
export function useSides(pair: Pair, bys: Dim[][]) {
  const { store } = useCtx();
  const p2 = useMemo(() => stepBack(store, pair), [store, pair]);
  const levels = useMemo(() => bys.map((by) => ({
    full: aggregate(store, pair.full, by), cur: aggregate(store, pair.cur, by),
    prev: pair.prev ? aggregate(store, pair.prev, by) : null, prev2: p2 ? aggregate(store, p2, by) : null,
  })), [store, pair, p2, JSON.stringify(bys)]);
  const total = useMemo<Sides>(() => ({
    full: aggregate(store, pair.full).get('') ?? emptyTotals(), cur: aggregate(store, pair.cur).get('') ?? emptyTotals(),
    prev: pair.prev ? aggregate(store, pair.prev).get('') ?? emptyTotals() : undefined, prev2: p2 ? aggregate(store, p2).get('') ?? emptyTotals() : undefined,
  }), [store, pair, p2]);
  const labels = [shortLabel(p2, pair.mode === 'yoy'), shortLabel(pair.prev, pair.mode === 'yoy'), shortLabel(pair.cur, pair.mode === 'yoy')];
  const sides = useMemo(() => (depth: number, k: string): Sides => {
    const L = levels[depth];
    return { full: L.full.get(k) ?? emptyTotals(), cur: L.cur.get(k) ?? emptyTotals(), prev: L.prev ? L.prev.get(k) ?? emptyTotals() : undefined, prev2: L.prev2 ? L.prev2.get(k) ?? emptyTotals() : undefined };
  }, [levels]);
  return { levels, total, labels, sides, p2 };
}

export const nameOf = (d: Dim, v: string) => (d === 'market' ? marketName(v) : label(v));
const dimName = (d: Dim) => (d === 'market' ? 'Country' : DIM_LABEL[d]);

export const DRILL_METRICS: MetricId[] = ['cost', 'leads', 'cpl', 'gl', 'cpgl', 'glRate', 'reg', 'cpreg', 'app', 'cpapp', 'acc', 'cpacc'];

type Row = { key: string; depth: number; name: string; sides: Sides; deep: Deep; kids: Row[] };

export function Drill({ pair, dims, metrics = DRILL_METRICS, brief = false, minSpend = 20 }: { pair: Pair; dims: Dim[]; metrics?: MetricId[]; brief?: boolean; minSpend?: number }) {
  const { store } = useCtx();
  const ref = useRefData();
  const bys = useMemo(() => dims.map((_, i) => dims.slice(0, i + 1)), [dims.join()]);
  const { levels, total, labels, sides } = useSides(pair, bys);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<'All' | Verdict>('All');
  const [small, setSmall] = useState(false);
  // Insights follow the activity filter at the top (ACT / Paid / All): the same activities as the table, null = all.
  const activities = pair.cur.dims.activity?.length ? pair.cur.dims.activity : null;
  const specialist = useMemo(() => {
    if (!ref) return { google: [], meta: [] };
    const g = googleReview(store, ref.bench, ref.setup, undefined, activities);
    return { google: [...g.critical, ...g.scale], meta: metaReview(store, ref.bench, undefined, activities).markets };
  }, [store, ref, activities?.join()]);
  const kids = useMemo(() => buildKids(store, pair.cur, pair.prev, dims), [store, pair, dims.join()]);
  const tree = useMemo(() => {
    const ctx: DeepCtx = { s: store, hierarchy: dims, p1Label: labels[1], kids, ...specialist };
    const build = (depth: number, prefix: string, parent: Sides): Row[] => {
      const L = levels[depth];
      const keys = new Set<string>();
      for (const k of L.full.keys()) if (!prefix || k.startsWith(prefix + '\u0001')) keys.add(k);
      for (const k of L.prev?.keys() ?? []) if (!prefix || k.startsWith(prefix + '\u0001')) keys.add(k);
      const pc = metric(parent.full, 'cpgl');
      return [...keys].filter((k) => k.split('\u0001').at(-1)).map((k) => ({ k, x: sides(depth, k) }))
        .filter(({ x }) => small || x.full.cost >= minSpend || (x.prev?.cost ?? 0) >= minSpend || x.full.gl > 0)
        .sort((a, b) => b.x.full.cost - a.x.full.cost)
        .map(({ k, x }) => {
          const name = nameOf(dims[depth], k.split('\u0001').at(-1)!);
          if (depth === dims.length - 1) return { key: k, depth, name, sides: x, deep: deepLeaf(ctx, k, x, pc, brief), kids: [] };
          const ch = build(depth + 1, k, x);
          const g = deepGroup(ctx, x, ch.map((c) => ({ key: c.key, name: c.name, sides: c.sides, deep: c.deep })));
          return { key: k, depth, name, sides: x, deep: { ...g, rag: ragOf(x.full, x.cur, x.prev, pc) }, kids: ch };
        });
    };
    return build(0, '', total);
  }, [levels, total, sides, small, minSpend, kids, specialist, labels[1], brief]);
  const groups: string[] = [];
  const walk = (rs: Row[]) => rs.forEach((r) => { if (r.kids.length) { groups.push(r.key); walk(r.kids); } });
  walk(tree);
  const matches = (r: Row): boolean => result === 'All' || (r.kids.length ? r.kids.some(matches) : r.deep.verdict === result);
  const toggle = (k: string) => setClosed((c) => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const render = (rs: Row[]): ReactNode[] => rs.filter(matches).map((r) => {
    const isGroup = r.kids.length > 0, isClosed = closed.has(r.key);
    const showIns = !brief || !isGroup;
    return (
      <Fragment key={r.key}>
        <tr data-cmt={r.key.split('\u0001').map((v, i) => nameOf(dims[i], v)).join(' › ')} className={`dd-row dd-d${Math.min(r.depth, 3)} ${isGroup ? 'dd-group' : 'dd-leaf'} rag-${r.deep.rag}`}>
          <td className="dd-h" style={{ paddingLeft: 10 + r.depth * 18 }}>
            <div className="dd-hn">
              {isGroup ? <button className="dd-tog" onClick={() => toggle(r.key)} aria-label={isClosed ? 'Expand' : 'Collapse'}>{isClosed ? '+' : '−'}</button> : <span className={`rag-dot ${r.deep.rag}`} />}
              <div><div className="dd-name">{r.name}</div><div className="dd-dim">{dimName(dims[r.depth])}</div></div>
            </div>
          </td>
          {metrics.map((id) => <MetricCell key={id} id={id} x={r.sides} />)}
          <td className="dd-res">{verdictChip(r.deep.verdict)}</td>
          <td className="dd-ins">{showIns && <>
            <div className="ins-head">{r.deep.head}</div>
            {r.deep.why.length > 0 && <ul className="ins-why">{r.deep.why.map((w) => <li key={w}>{w}</li>)}</ul>}
            {r.deep.next.length > 0 && <div className="ins-next">{r.deep.next.map((w) => <div key={w}>→ {w}</div>)}</div>}
          </>}</td>
        </tr>
        {isGroup && !isClosed && render(r.kids)}
      </Fragment>
    );
  });
  const top = useMemo(() => deepGroup({ s: store, hierarchy: dims, p1Label: labels[1], kids, ...specialist }, total, tree.map((c) => ({ key: c.key, name: c.name, sides: c.sides, deep: c.deep }))), [tree, total]);
  const RESULTS: ('All' | Verdict)[] = ['All', 'Better', 'Worse', 'Mixed', 'Stable'];
  return (
    <div className="drill">
      <div className="dd-bar">
        <p className="dd-lede">Each cell: the selected period, its change vs <b>{pair.prevLabel || 'the comparison period'}</b>, and the last three periods underneath (<b>{labels.join(' · ')}</b>). Green is better, red is worse, grey is within ±10%. Result weighs Accepted, Applied and Good Leads before Leads (funnel score).</p>
        <div className="dd-ctrl">
          <div className="seg">{RESULTS.map((r) => <button key={r} className={result === r ? 'on' : ''} onClick={() => setResult(r)}>{r}</button>)}</div>
          <button className="btn-o" onClick={() => setClosed(new Set())}>Expand all</button>
          <button className="btn-o red" onClick={() => setClosed(new Set(groups))}>Collapse all</button>
          <label className="pv-small"><input type="checkbox" checked={small} onChange={(e) => setSmall(e.target.checked)} /> rows under CHF {minSpend}</label>
        </div>
      </div>
      <div className="dd-wrap">
        <table className="dd">
          <thead><tr>
            <th className="dd-h">Hierarchy<div className="dd-sub">{dims.map(dimName).join(' › ')}</div></th>
            {metrics.map((id) => <th key={id} title={METRICS[id].help}>{METRICS[id].label}<div className="dd-sub">{labels.join(' · ')}</div></th>)}
            <th className="dd-res">Result</th>
            <th className="dd-ins">{brief ? 'Insight — what happened and why (channel level)' : 'Insight — what · why · next'}</th>
          </tr></thead>
          <tbody>
            <tr className="dd-row dd-total"><td className="dd-h"><div className="dd-name">Total</div><div className="dd-dim">ACT campaigns</div></td>
              {metrics.map((id) => <MetricCell key={id} id={id} x={total} />)}<td className="dd-res">{verdictChip(top.verdict)}</td>
              <td className="dd-ins">{!brief && <><div className="ins-head">{top.head}</div><ul className="ins-why">{top.why.map((w) => <li key={w}>{w}</li>)}</ul></>}</td></tr>
            {render(tree)}
          </tbody>
        </table>
      </div>
      <p className="note">Insight = the trend over the three periods, the funnel lever that moved most (reach cost, clicks, click→lead, lead quality, follow-up), the audience / theme / ad / campaign that drove it, and the latest specialist checks (PPC daily review for Google, weekly read for Meta — rolling 7/14 days). Good leads and later stages lag, so the newest period under-counts them.</p>
    </div>
  );
}

/**
 * Boss table: the same merged-cell pivot as Comparison (School | Country | Channel always visible, no folding),
 * with the channel-level insight on the right.
 */
export function BossPivot({ pair, dims }: { pair: Pair; dims: Dim[] }) {
  const { store } = useCtx();
  const ref = useRefData();
  const { labels } = useSides(pair, [dims]);
  // Insights follow the activity filter at the top (ACT / Paid / All): the same activities as the table, null = all.
  const activities = pair.cur.dims.activity?.length ? pair.cur.dims.activity : null;
  const specialist = useMemo(() => {
    if (!ref) return { google: [], meta: [] };
    const g = googleReview(store, ref.bench, ref.setup, undefined, activities);
    return { google: [...g.critical, ...g.scale], meta: metaReview(store, ref.bench, undefined, activities).markets };
  }, [store, ref, activities?.join()]);
  const kids = useMemo(() => buildKids(store, pair.cur, pair.prev, dims), [store, pair, dims.join()]);
  const ctx: DeepCtx = useMemo(() => ({ s: store, hierarchy: dims, p1Label: labels[1], kids, ...specialist }), [store, dims.join(), labels[1], kids, specialist]);
  return (
    <>
      <p className="dd-lede">Each cell: the selected period, its change vs <b>{pair.prevLabel || 'the comparison period'}</b>, and the last three periods underneath (<b>{labels.join(' · ')}</b>). School and country stay visible while you scroll. Green is better, red is worse, grey is within ±10%.</p>
      <PivotTable pair={pair} dims={dims} extra={{
        head: 'Insight — what happened and why',
        cell: (key, x, pc) => { const d = deepLeaf(ctx, key, x, pc, true); return <><div className="ins-head">{d.head}</div>{d.why.length > 0 && <ul className="ins-why">{d.why.map((w) => <li key={w}>{w}</li>)}</ul>}</>; },
      }} />
    </>
  );
}
