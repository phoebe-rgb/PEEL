import { activityOf, formatOf, googleIntentOf, metaAudienceOf, programOf, subchannelOf, themeOf } from './names';
// One source model for every page: history (static) + archive + live (KV), merged by date.
// Precedence per date: live window > history (<= history_to) > archive. Weekly history rows
// (before FREEZE) are never overridden because no later layer reaches back that far.

export const DIMS = ['channel', 'school', 'country', 'region', 'country_level', 'activity', 'level', 'program',
  'campaign', 'ad_group', 'ad', 'theme', 'audience', 'ad_format'] as const;
export type LayerDim = (typeof DIMS)[number];
/** `market` is derived from the campaign name (Advertiser_Brand_Channel_Type_Region_COUNTRY_…), e.g. IN, US, AE. */
export type Dim = LayerDim | 'market' | 'subchannel' | 'creative' | 'boost';
export const ALL_DIMS: Dim[] = [...DIMS, 'market', 'subchannel', 'creative', 'boost'];
/** Dimensions that only exist for some channels (coverage is judged on those channels only). */
export const DIM_CHANNELS: Partial<Record<Dim, string[]>> = { theme: ['Meta'], ad_format: ['Meta'], creative: ['Meta'], ad: ['Meta', 'LinkedIn'], ad_group: ['Meta', 'LinkedIn'], audience: ['Meta', 'Google'] };

export function marketOf(campaign: string): string {
  const p = campaign.split('_');
  if (p.length < 6 || !/^PL$/i.test(p[0])) return '';
  const cc = p[5].trim().toUpperCase();
  return cc === 'UAE' ? 'AE' : cc;
}
/** Country from a Meta ad set name (Region_COUNTRY_Level_…), e.g. Americas_CA_ALL_MAS_ALL_LAL_… → CA; '' when absent. */
export function countryOfAdSet(adSet: string): string {
  // tolerate typos such as a double underscore ("Americas__US_KEY_…")
  const t = (adSet.split('_').map((x) => x.trim()).filter(Boolean)[1] ?? '').toUpperCase();
  if (t === 'UAE') return 'AE';
  return /^[A-Z]{2}$/.test(t) ? t : '';
}
export const MEAS = ['cost', 'impr', 'clicks', 'sessions', 'leads', 'gl', 'reg', 'app', 'acc', 'budget'] as const;
export type Meas = (typeof MEAS)[number];

export interface Layer {
  grain: 'week' | 'day';
  n: number;
  dims: Record<string, string[]>;
  cols: Record<string, (number | null)[]>;
  window?: { from: string; to: string };
}

export interface Store {
  n: number;
  dicts: Record<Dim, string[]>;
  dim: Record<Dim, Int32Array>;
  cycle: Int32Array; cycles: string[];
  week: Int32Array; weeks: string[];           // ISO week label, e.g. 2026-W38
  date: Int32Array; dates: string[];           // '' for weekly rows
  month: Int32Array; months: string[];         // YYYY-MM, exact for every row
  m: Record<Meas, Float64Array>;               // NaN = unavailable (not zero)
  lastDate: string;                            // last date with data
  source: { historyTo: string; liveWindow?: { from: string; to: string }; syncedAt?: string; archiveWeeks: number; fallback: boolean };
}

export function isoWeek(d: string): string {
  const dt = new Date(d + 'T00:00:00Z');
  const day = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - day + 3);
  const y = dt.getUTCFullYear();
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const w = 1 + Math.round(((dt.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

/** Monday..Sunday ISO dates of an ISO week label. */
export function weekDays(label: string): string[] {
  const [y, w] = [Number(label.slice(0, 4)), Number(label.slice(6))];
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const mon = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000 + (w - 1) * 7 * 86400000);
  return Array.from({ length: 7 }, (_, i) => new Date(mon.getTime() + i * 86400000).toISOString().slice(0, 10));
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Short date range, e.g. "14–20 Sep", "31 Aug–6 Sep", "28 Dec 2025–3 Jan 2026". */
export function dayRange(a: string, b: string, year = false): string {
  const d = (x: string) => Number(x.slice(8, 10)), m = (x: string) => MON[Number(x.slice(5, 7)) - 1];
  const y = year || a.slice(0, 4) !== b.slice(0, 4);
  if (a === b) return `${d(a)} ${m(a)}${y ? ` ${a.slice(0, 4)}` : ''}`;
  if (a.slice(0, 7) === b.slice(0, 7)) return `${d(a)}–${d(b)} ${m(b)}${y ? ` ${b.slice(0, 4)}` : ''}`;
  return a.slice(0, 4) !== b.slice(0, 4) ? `${d(a)} ${m(a)} ${a.slice(0, 4)}–${d(b)} ${m(b)} ${b.slice(0, 4)}` : `${d(a)} ${m(a)}–${d(b)} ${m(b)}${y ? ` ${b.slice(0, 4)}` : ''}`;
}
/** A week label as dates: 2026-W38 → "14–20 Sep". */
export const weekRange = (w: string, year = false) => { const ds = weekDays(w); return dayRange(ds[0], ds[6], year); };
/** Monday of a week as a short axis label: 2026-W38 → "14 Sep". */
export const weekTick = (w: string) => { const d = weekDays(w)[0]; return `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}`; };
export const monthLabel = (m: string) => `${MON[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

export function cycleOf(d: string): string {
  const y = Number(d.slice(0, 4));
  const s = d.slice(5) >= '08-01' ? y : y - 1;
  return `${String(s % 100).padStart(2, '0')}/${String((s + 1) % 100).padStart(2, '0')}`;
}

export function prevCycle(c: string): string {
  const s = Number(c.slice(0, 2)) - 1;
  return `${String((s + 100) % 100).padStart(2, '0')}/${String((s + 101) % 100).padStart(2, '0')}`;
}

/** Same ISO week number one year earlier; W53 has no equivalent unless that year has one. */
export function prevWeek(label: string): string | null {
  const p = `${Number(label.slice(0, 4)) - 1}${label.slice(4)}`;
  return label.endsWith('W53') && isoWeek(weekDays(p)[0]) !== p ? null : p;
}

class Builder {
  dicts = Object.fromEntries(DIMS.map((d) => [d, [] as string[]])) as unknown as Record<LayerDim, string[]>;
  maps = Object.fromEntries(DIMS.map((d) => [d, new Map<string, number>()])) as unknown as Record<LayerDim, Map<string, number>>;
  dimv = Object.fromEntries(DIMS.map((d) => [d, [] as number[]])) as unknown as Record<LayerDim, number[]>;
  cycles: string[] = []; cycleMap = new Map<string, number>(); cyc: number[] = [];
  weeks: string[] = []; weekMap = new Map<string, number>(); wk: number[] = [];
  dates: string[] = ['']; dateMap = new Map<string, number>([['', 0]]); dt: number[] = [];
  months: string[] = []; monthMap = new Map<string, number>(); mo: number[] = [];
  mv = Object.fromEntries(MEAS.map((k) => [k, [] as number[]])) as unknown as Record<Meas, number[]>;
  lastDate = '';

  intern(map: Map<string, number>, arr: string[], v: string) {
    let i = map.get(v);
    if (i === undefined) { i = arr.length; arr.push(v); map.set(v, i); }
    return i;
  }

  add(layer: Layer, keep: (date: string) => boolean) {
    const L = layer.dims, C = layer.cols;
    const remap = Object.fromEntries(DIMS.map((d) => [d, (L[d] ?? ['']).map((v) => this.intern(this.maps[d], this.dicts[d], v))])) as Record<LayerDim, number[]>;
    const isDay = layer.grain === 'day';
    for (let i = 0; i < layer.n; i++) {
      const date = isDay ? L.date[C.date[i] as number] : '';
      if (isDay && !keep(date)) continue;
      const week = isDay ? isoWeek(date) : L.week[C.week[i] as number];
      const cyc = isDay ? cycleOf(date) : L.cycle[C.cycle[i] as number];
      for (const d of DIMS) this.dimv[d].push(C[d] ? remap[d][C[d][i] as number] : this.intern(this.maps[d], this.dicts[d], ''));
      this.cyc.push(this.intern(this.cycleMap, this.cycles, cyc));
      this.wk.push(this.intern(this.weekMap, this.weeks, week));
      this.dt.push(this.intern(this.dateMap, this.dates, date));
      this.mo.push(this.intern(this.monthMap, this.months, isDay ? date.slice(0, 7) : L.month[C.month[i] as number]));
      for (const k of MEAS) { const v = C[k]?.[i]; this.mv[k].push(v === null || v === undefined ? NaN : v); }
      const has = !isNaN(this.mv.cost.at(-1)!) || !isNaN(this.mv.leads.at(-1)!);
      if (isDay && has && date > this.lastDate) this.lastDate = date;
    }
  }

  build(source: Store['source']): Store {
    const n = this.cyc.length;
    const dim = Object.fromEntries(DIMS.map((d) => [d, Int32Array.from(this.dimv[d])])) as Record<Dim, Int32Array>;
    const mMap = new Map<string, number>(), mDict: string[] = [];
    // Campaigns targeting a whole region (country token ALL) carry the country in the ad set name: Region_COUNTRY_…
    const campToMarket = this.dicts.campaign.map((c) => marketOf(c));
    const setCountry = this.dicts.ad_group.map((a) => countryOfAdSet(a));
    const mk = new Map<string, number>();
    dim.market = Int32Array.from({ length: n }, (_, i) => {
      let m = campToMarket[dim.campaign[i]];
      if (m === 'ALL') m = setCountry[dim.ad_group[i]] || m;
      let k = mk.get(m); if (k === undefined) { k = this.intern(mMap, mDict, m); mk.set(m, k); }
      return k;
    });
    // Re-derive theme / format / audience / activity from names (see names.ts) so history and live match.
    const dicts = { ...this.dicts, market: mDict } as Record<Dim, string[]>;
    const derive = (d: LayerDim, fn: (i: number) => string) => {
      const map = new Map<string, number>(), dict: string[] = [], cache = new Map<string, number>();
      const col = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        const v = fn(i);
        let k = cache.get(v); if (k === undefined) { k = this.intern(map, dict, v); cache.set(v, k); }
        col[i] = k;
      }
      dim[d] = col; dicts[d] = dict;
    };
    const ch = (i: number) => this.dicts.channel[dim.channel[i]];
    const memo = <T,>(f: (x: string) => T) => { const m = new Map<string, T>(); return (x: string) => { let v = m.get(x); if (v === undefined) { v = f(x); m.set(x, v); } return v; }; };
    const th = memo(themeOf), fo = memo(formatOf), au = memo(metaAudienceOf), gi = memo(googleIntentOf);
    const oldTheme = dim.theme, oldAud = dim.audience, oldFmt = dim.ad_format, oldAct = dim.activity;
    const tD = this.dicts.theme, aD = this.dicts.audience, fD = this.dicts.ad_format, acD = this.dicts.activity;
    derive('theme', (i) => (ch(i) === 'Meta' ? th(this.dicts.ad[dim.ad[i]]) || tD[oldTheme[i]] : ''));
    derive('ad_format', (i) => (ch(i) === 'Meta' ? fo(this.dicts.ad[dim.ad[i]]) || fD[oldFmt[i]] : ''));
    derive('audience', (i) => (ch(i) === 'Meta' ? au(this.dicts.ad_group[dim.ad_group[i]]) || aD[oldAud[i]] : ch(i) === 'Google' ? gi(this.dicts.campaign[dim.campaign[i]]) : ''));
    derive('activity', (i) => activityOf(this.dicts.campaign[dim.campaign[i]], acD[oldAct[i]]));
    const po = memo(programOf), pgD = this.dicts.program, oldProg = dim.program;
    derive('program', (i) => po(this.dicts.campaign[dim.campaign[i]]) || pgD[oldProg[i]]);
    // derived-only dims
    const extra = (name: 'subchannel' | 'creative' | 'boost', fn: (i: number) => string) => {
      const map = new Map<string, number>(), dict: string[] = [], col = new Int32Array(n);
      for (let i = 0; i < n; i++) col[i] = this.intern(map, dict, fn(i));
      dim[name] = col; dicts[name] = dict;
    };
    extra('subchannel', (i) => subchannelOf(ch(i), this.dicts.campaign[dim.campaign[i]]));
    extra('creative', (i) => { if (ch(i) !== 'Meta') return ''; const t = dicts.theme[dim.theme[i]], f = dicts.ad_format[dim.ad_format[i]]; return t && f ? `${t} · ${f}` : ''; });
    // Meta social boosting (SocialBoosting campaigns or boosted-post ads) can be switched off on the Budget page
    extra('boost', (i) => (ch(i) === 'Meta' && (/socialboost/i.test(this.dicts.campaign[dim.campaign[i]]) || /boostedpost/i.test(this.dicts.ad[dim.ad[i]])) ? 'Social boosting' : 'Paid ads'));
    return {
      n, dicts,
      dim,
      cycle: Int32Array.from(this.cyc), cycles: this.cycles,
      week: Int32Array.from(this.wk), weeks: this.weeks,
      date: Int32Array.from(this.dt), dates: this.dates,
      month: Int32Array.from(this.mo), months: this.months,
      m: Object.fromEntries(MEAS.map((k) => [k, Float64Array.from(this.mv[k])])) as Record<Meas, Float64Array>,
      lastDate: this.lastDate || source.historyTo, source,
    };
  }
}

export function mergeLayers(opts: {
  weekly: Layer; daily: Layer; historyTo: string; live?: Layer | null; archive?: Layer[]; syncedAt?: string; fallback?: boolean;
}): Store {
  const b = new Builder();
  const lw = opts.live?.window;
  const inLive = (d: string) => !!lw && d >= lw.from && d <= lw.to;
  b.add(opts.weekly, () => true);
  b.add(opts.daily, (d) => !inLive(d) && d <= opts.historyTo);
  for (const a of opts.archive ?? []) {
    // Archived weeks only ever hold days after history; skip any that would overlap it.
    if (a.grain === 'week') { if (weekDays(a.dims.week[0])[0] > opts.historyTo) b.add(a, () => true); }
    else b.add(a, (d) => !inLive(d) && d > opts.historyTo);
  }
  if (opts.live) b.add(opts.live, () => true);
  return b.build({ historyTo: opts.historyTo, liveWindow: lw, syncedAt: opts.syncedAt, archiveWeeks: opts.archive?.length ?? 0, fallback: !!opts.fallback });
}

export async function loadStore(): Promise<Store> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const get = (u: string): Promise<any> => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [weekly, daily, meta, live, archive, sync] = await Promise.all([
    get('/data/hist_weekly.json'), get('/data/hist_daily.json'), get('/data/hist_meta.json'),
    get('/api/live'), get('/api/archive'), get('/api/meta'),
  ]);
  if (!weekly || !daily || !meta) throw new Error('History files failed to load');
  return mergeLayers({
    weekly, daily, historyTo: meta.history_to, live, archive: archive ?? [], syncedAt: sync?.syncedAt,
    fallback: !live,
  });
}
