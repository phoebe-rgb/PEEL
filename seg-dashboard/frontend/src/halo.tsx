// Direct leads (no UTM) and how much of them paid media drives: CRM direct leads by country next to Meta / Google spend,
// the estimated lift per CHF 1,000 (weekly regression with month dummies), and GA4 new users / form leads by source.
import { useEffect, useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCtx } from './components';
import { Block } from './perf';

type Enc = { cols: string[]; dims: string[][]; rows: number[][] };
type Feed = { builtAt: string; crm: Enc; ga4: Enc };
let cache: Promise<Feed | null> | null = null;
function useHalo() {
  const [v, setV] = useState<Feed | null | undefined>(undefined);
  useEffect(() => {
    const get = (u: string) => fetch(u).then((r) => (r.ok ? (r.json() as Promise<Feed | null>) : null)).catch(() => null);
    cache ??= get('/api/halo').then((j) => j ?? get('/data/halo.json'));
    cache.then(setV);
  }, []);
  return v;
}

const f0 = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '–');
const pct = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(0)}%` : '–');
const chg = (a: number, b: number) => (b > 0 ? (a / b - 1) : NaN);
const Chg = ({ a, b, neutral = false }: { a: number; b: number; neutral?: boolean }) => {
  const d = chg(a, b);
  if (!Number.isFinite(d)) return <span className="dim"> {a > 0 ? 'new' : ''}</span>;
  return <span className={`dd-chg ${neutral || Math.abs(d) < 0.1 ? 'flat' : d > 0 ? 'up' : 'down'}`}> {d >= 0 ? '+' : '−'}{Math.abs(d * 100).toFixed(0)}%</span>;
};

/** Least squares y ~ X with a small ridge for stability; returns coefficients. */
function ols(X: number[][], y: number[]): number[] {
  const k = X[0].length, A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let i = 0; i < X.length; i++) for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) A[a][b] += X[i][a] * X[i][b]; A[a][k] += X[i][a] * y[i]; }
  for (let a = 1; a < k; a++) A[a][a] += 1e-6;
  for (let c = 0; c < k; c++) {
    let p = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    if (Math.abs(A[c][c]) < 1e-12) continue;
    for (let r = 0; r < k; r++) if (r !== c) { const m = A[r][c] / A[c][c]; for (let j = c; j <= k; j++) A[r][j] -= m * A[c][j]; }
  }
  return A.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[k] / row[i]));
}

export function DirectLeads() {
  const { filter } = useCtx();
  const feed = useHalo();
  const [weeks, setWeeks] = useState(4);
  const [sel, setSel] = useState('');
  const model = useMemo(() => {
    if (!feed) return null;
    const schoolF = filter.dims.school, countryF = filter.dims.country;
    const okS = (s: string) => !schoolF?.length || schoolF.includes(s.trim());
    const okC = (c: string) => !countryF?.length || countryF.includes(c);
    // country → week → [metaCost, googleCost, direct, directGl, directApp, paidLeads]
    const C = feed.crm, by = new Map<string, Map<string, number[]>>();
    const allWeeks = new Set<string>();
    for (const r of C.rows) {
      const week = C.dims[0][r[0]], school = C.dims[1][r[1]], country = C.dims[2][r[2]], grp = C.dims[3][r[3]];
      if (!okS(school) || !okC(country) || !country) continue;
      allWeeks.add(week);
      const m = by.get(country) ?? by.set(country, new Map()).get(country)!;
      const a = m.get(week) ?? m.set(week, [0, 0, 0, 0, 0, 0]).get(week)!;
      const [cost, leads, gl, , app] = r.slice(4);
      if (grp === 'Meta') { a[0] += cost; a[5] += leads; } else if (grp === 'Google') { a[1] += cost; a[5] += leads; } else if (grp === 'Direct') { a[2] += leads; a[3] += gl; a[4] += app; }
    }
    // complete weeks only (the current week is partial)
    const today = new Date().toISOString().slice(0, 10);
    const ws = [...allWeeks].sort().filter((w) => new Date(Date.parse(w) + 6 * 864e5).toISOString().slice(0, 10) < today);
    const cur = ws.slice(-weeks), prev = ws.slice(-2 * weeks, -weeks);
    const G = feed.ga4, ga = new Map<string, Map<string, number[]>>(); // country → source → [newUsers, leads] in the current window
    const curSet = new Set(cur);
    for (const r of G.rows) {
      const week = G.dims[0][r[0]], school = G.dims[1][r[1]], country = G.dims[2][r[2]], src = G.dims[3][r[3]];
      if (!curSet.has(week) || !okS(school) || !okC(country)) continue;
      const m = ga.get(country) ?? ga.set(country, new Map()).get(country)!;
      const a = m.get(src) ?? m.set(src, [0, 0]).get(src)!; a[0] += r[4]; a[1] += r[5];
    }
    const sum = (m: Map<string, number[]>, w: string[]) => w.reduce((acc, x) => { const a = m.get(x); if (a) a.forEach((v, i) => (acc[i] += v)); return acc; }, [0, 0, 0, 0, 0, 0]);
    const rows = [...by.entries()].map(([country, m]) => {
      const c = sum(m, cur), p = sum(m, prev);
      // lift per CHF 1,000: direct ~ meta + google + month dummies over all complete weeks
      const hist = ws.filter((w) => m.has(w));
      let meta = NaN, google = NaN;
      if (hist.length >= 20 && hist.reduce((a, w) => a + m.get(w)![0] + m.get(w)![1], 0) > 2000) {
        const X = hist.map((w) => [1, m.get(w)![0] / 1000, m.get(w)![1] / 1000, ...Array.from({ length: 11 }, (_, i) => (Number(w.slice(5, 7)) === i + 2 ? 1 : 0))]);
        const b = ols(X, hist.map((w) => m.get(w)![2]));
        meta = b[1]; google = b[2];
      }
      const g = ga.get(country) ?? new Map<string, number[]>();
      const gTot = [...g.values()].reduce((a, x) => [a[0] + x[0], a[1] + x[1]], [0, 0]);
      const gPaid = ['Meta', 'Google', 'Other paid'].reduce((a, s) => [a[0] + (g.get(s)?.[0] ?? 0), a[1] + (g.get(s)?.[1] ?? 0)], [0, 0]);
      // direct leads explained by paid in the window (only positive, credible lifts)
      const fromPaid = Math.max(0, Number.isFinite(meta) && meta > 0 ? meta * c[0] / 1000 : 0) + Math.max(0, Number.isFinite(google) && google > 0 ? google * c[1] / 1000 : 0);
      return { country, c, p, meta, google, fromPaid, gTot, gPaid, gDirect: g.get('Direct') ?? [0, 0] };
    }).filter((r) => r.c[2] + r.p[2] >= 3).sort((a, b) => b.c[2] - a.c[2]);
    const series = (country: string) => ws.slice(-26).map((w) => { const a = by.get(country)?.get(w) ?? [0, 0, 0, 0, 0, 0]; return { w: `${Number(w.slice(8))} ${new Date(w + 'T00:00:00Z').toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`, meta: Math.round(a[0]), google: Math.round(a[1]), direct: a[2] }; });
    return { rows, cur, prev, series };
  }, [feed, filter.dims.school, filter.dims.country, weeks]);
  if (feed === undefined) return <Block tone="tables" n="Direct leads" title="Direct leads and the paid halo"><p className="note">Loading…</p></Block>;
  if (!feed || !model) return null;
  const { rows, cur, prev } = model;
  const T = rows.reduce((a, r) => a.map((v, i) => v + r.c[i]), [0, 0, 0, 0, 0, 0]), P = rows.reduce((a, r) => a.map((v, i) => v + r.p[i]), [0, 0, 0, 0, 0, 0]);
  const country = sel && rows.some((r) => r.country === sel) ? sel : rows[0]?.country ?? '';
  const span = (w: string[]) => (w.length ? `${w[0]} → ${new Date(Date.parse(w.at(-1)!) + 6 * 864e5).toISOString().slice(0, 10)}` : '—');
  return (
    <Block tone="tables" n="Direct leads" title="Direct leads (no UTM) and how much paid media drives them"
      sub={`Direct leads = CRM leads with channel Direct_Lead (no campaign / UTM). They are the highest-quality leads, and they rise when we spend more on Meta. Last ${weeks} complete weeks (${span(cur)}) vs the ${weeks} before (${span(prev)}). Follows the School and Country filters.`}
      right={<div className="seg">{[4, 8, 13].map((w) => <button key={w} className={weeks === w ? 'on' : ''} onClick={() => setWeeks(w)}>{w} weeks</button>)}</div>}>
      <div className="kpis-grid">
        {[['Direct leads', f0(T[2]), <Chg a={T[2]} b={P[2]} />], ['Direct GL rate', pct(T[3] / T[2]), <span className="dim"> vs {pct(P[3] / P[2])}</span>], ['Direct applied', f0(T[4]), <Chg a={T[4]} b={P[4]} />],
          ['Meta spend (CHF)', f0(T[0]), <Chg a={T[0]} b={P[0]} neutral />], ['Google spend (CHF)', f0(T[1]), <Chg a={T[1]} b={P[1]} neutral />], ['Direct leads explained by paid', f0(rows.reduce((a, r) => a + r.fromPaid, 0)), <span className="dim"> ≈{pct(rows.reduce((a, r) => a + r.fromPaid, 0) / T[2])} of direct</span>]]
          .map(([l, v, d], i) => <div key={i} className="kpi"><div className="kpi-label">{l}</div><div className="kpi-value">{v}</div><div className="kpi-delta">{d}</div></div>)}
      </div>
      <div className="tablewrap"><table className="t">
        <thead><tr><th style={{ textAlign: 'left' }}>Country</th><th>Direct leads</th><th>GL rate</th><th>Applied</th><th>Meta spend</th><th>Google spend</th><th title="Extra direct leads per CHF 1,000 of spend, from a weekly regression over the last year with month dummies (season removed)">Lift / CHF 1k Meta</th><th title="Same, for Google">Lift / CHF 1k Google</th><th title="Lift × spend in the window">Direct from paid (est.)</th><th title="GA4 first visits whose session came from a paid campaign">GA4 new users from paid</th><th title="GA4 generate_lead events by session source">GA4 form leads: paid · direct</th></tr></thead>
        <tbody>{rows.slice(0, 15).map((r) => (
          <tr key={r.country} className={r.country === country ? 'sel' : ''} onClick={() => setSel(r.country)} style={{ cursor: 'pointer' }} data-cmt={`Direct leads › ${r.country}`}>
            <td style={{ textAlign: 'left' }}><b>{r.country}</b></td>
            <td>{f0(r.c[2])}<Chg a={r.c[2]} b={r.p[2]} /></td><td>{pct(r.c[3] / r.c[2])}</td><td>{f0(r.c[4])}</td>
            <td>{f0(r.c[0])}<Chg a={r.c[0]} b={r.p[0]} neutral /></td><td>{f0(r.c[1])}<Chg a={r.c[1]} b={r.p[1]} neutral /></td>
            <td className={r.meta > 0.5 ? 'good' : 'dim'}>{Number.isFinite(r.meta) ? `${r.meta >= 0 ? '+' : ''}${r.meta.toFixed(1)}` : '–'}</td>
            <td className={r.google > 0.5 ? 'good' : 'dim'}>{Number.isFinite(r.google) ? `${r.google >= 0 ? '+' : ''}${r.google.toFixed(1)}` : '–'}</td>
            <td>{r.fromPaid ? `${f0(r.fromPaid)} (${pct(r.fromPaid / Math.max(1, r.c[2]))})` : '–'}</td>
            <td>{r.gTot[0] ? pct(r.gPaid[0] / r.gTot[0]) : '–'}</td>
            <td>{r.gTot[1] ? `${f0(r.gPaid[1])} · ${f0(r.gDirect[1])}` : '–'}</td>
          </tr>))}</tbody>
      </table></div>
      {country && <div className="panel" style={{ marginTop: 12 }}>
        <div className="chart-title">{country} — weekly direct leads (line) vs Meta and Google spend (columns, CHF) · last 26 weeks <span className="dim">· click a row to switch country</span></div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={model.series(country)} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="w" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
            <YAxis yAxisId="chf" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={50} />
            <YAxis yAxisId="n" orientation="right" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={36} />
            <Tooltip formatter={(v, n) => [f0(Number(v)), n === 'meta' ? 'Meta spend (CHF)' : n === 'google' ? 'Google spend (CHF)' : 'Direct leads']} />
            <Bar yAxisId="chf" dataKey="meta" stackId="s" fill="var(--c1)" fillOpacity={0.55} isAnimationActive={false} />
            <Bar yAxisId="chf" dataKey="google" stackId="s" fill="var(--c2)" fillOpacity={0.45} isAnimationActive={false} />
            <Line yAxisId="n" dataKey="direct" stroke="var(--c3, #d97706)" strokeWidth={2.5} dot={{ r: 2 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="legend"><span><i className="sw" style={{ background: 'var(--c1)' }} />Meta spend</span><span><i className="sw" style={{ background: 'var(--c2)' }} />Google spend</span><span><i className="sw" style={{ background: 'var(--c3, #d97706)' }} />Direct leads</span></div>
      </div>}
      <p className="note">How to read: <b>Lift / CHF 1k</b> = how many extra direct leads a week comes with each extra CHF 1,000 of that channel's spend, estimated over the last year with the month of the year held constant (so the application season is not counted as an effect). It is an association, not a test: treat values under ~1 or a "–" (too little history) as no clear effect. <b>Direct from paid</b> = lift × spend in the window. GA4 columns use the session's campaign: GA4 only sees website forms, so its counts are lower than the CRM's; "new users from paid" shows how much of the new website traffic paid media brings. Data: Funnel exports "SEG Leads by Channel (direct + organic)" and "SEG GA4 by channel", refreshed daily.</p>
    </Block>
  );
}
