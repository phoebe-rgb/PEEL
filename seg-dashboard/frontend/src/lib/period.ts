import { cycleOf, dayRange, isoWeek, monthLabel, weekDays, weekRange, type Dim, type Store } from './data';
import { cycleWeeks, type Filter } from './agg';

export type ViewKind = 'week' | 'month' | 'cycle' | 'custom';
export interface ViewState {
  cycle: string;
  view: ViewKind;
  week?: string; month?: string; from?: string; to?: string;
  dims: Partial<Record<Dim, string[]>>;
  compare?: 'prev' | 'yoy';
}

export function cycleMonths(s: Store, cycle: string): string[] {
  const c = s.cycles.indexOf(cycle), set = new Set<number>();
  for (let i = 0; i < s.n; i++) if (s.cycle[i] === c) set.add(s.month[i]);
  return [...set].map((i) => s.months[i]).sort();
}

/** The Filter for the selected view. Unset week/month default to the latest one in the cycle. */
export function toFilter(s: Store, v: ViewState): Filter {
  // ACT campaigns only (owner decision 2026-09-28): BRAND, CONV and NURT are excluded everywhere.
  const base = { cycle: v.cycle, dims: { ...v.dims, activity: ['ACT'] } };
  if (v.view === 'week') {
    const ws = cycleWeeks(s, v.cycle);
    const done = ws.filter((w) => weekDays(w)[6] <= s.lastDate);
    return { ...base, weeks: [v.week ?? done.at(-1) ?? ws.at(-1)!] };
  }
  if (v.view === 'month') return { ...base, weeks: null, months: [v.month ?? cycleMonths(s, v.cycle).at(-1)!] };
  if (v.view === 'custom') {
    const [from, to] = rangeOf(s, v);
    return { ...base, cycle: '*', weeks: null, months: null, range: [from, to] };
  }
  return { ...base, weeks: null };
}

/** Custom view: start / end dates (defaults: the last 28 days). Old saved week labels are ignored. */
export function rangeOf(s: Store, v: ViewState): [string, string] {
  const iso = (x?: string) => (x && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : '');
  const to = iso(v.to) || s.lastDate;
  const from = iso(v.from) || shift(to, -27);
  return from <= to ? [from, to] : [to, from];
}

const shift = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const hasDaily = (s: Store, ds: string[]) => ds.every((d) => s.dates.includes(d));

export interface PeriodPair { cur: Filter; prev: Filter | null; curLabel: string; prevLabel: string; note: string }

/**
 * Selected week (or month) vs the one before. A partial latest period is matched on the same
 * weekdays / days of month, which needs daily rows on both sides; otherwise the comparison is withheld.
 */
export function previousPeriod(s: Store, f: Filter, view: ViewKind): PeriodPair {
  if (view === 'week' && f.weeks?.length === 1) {
    const w = f.weeks[0], days = weekDays(w).filter((d) => d <= s.lastDate);
    const pDays = weekDays(w).map((d) => shift(d, -7)).slice(0, days.length);
    const pw = isoWeek(pDays[0]);
    const partial = days.length < 7;
    const label = (ds: string[]) => dayRange(ds[0], ds.at(-1)!);
    if (partial && !(hasDaily(s, days) && hasDaily(s, pDays))) return { cur: f, prev: null, curLabel: w, prevLabel: pw, note: 'Latest week is partial and daily history is not available for a matched comparison.' };
    return {
      cur: partial ? { ...f, dates: days } : f,
      prev: { ...f, cycle: cycleOf(pDays[3] ?? pDays[0]), weeks: [pw], months: null, dates: partial ? pDays : null },
      curLabel: `${label(days)} (W${w.slice(6)})`, prevLabel: `${label(pDays)} (W${pw.slice(6)})`,
      note: partial ? `${w} has ${days.length}/7 days, so both weeks use the same weekdays.` : '',
    };
  }
  if (view === 'month' && f.months?.length === 1) {
    const m = f.months[0];
    const pm = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
    const lastDay = s.lastDate.slice(0, 7) === m ? Number(s.lastDate.slice(8, 10)) : 31;
    const pmDays = new Date(Date.UTC(Number(pm.slice(0, 4)), Number(pm.slice(5, 7)), 0)).getUTCDate();
    const partial = s.lastDate.slice(0, 7) === m && lastDay < new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
    const pc = cycleOf(`${pm}-15`);
    if (!partial) return { cur: f, prev: { ...f, cycle: pc, months: [pm], weeks: null, dates: null }, curLabel: monthLabel(m), prevLabel: monthLabel(pm), note: '' };
    const cDays = Array.from({ length: lastDay }, (_, i) => `${m}-${String(i + 1).padStart(2, '0')}`);
    const pDays = Array.from({ length: Math.min(lastDay, pmDays) }, (_, i) => `${pm}-${String(i + 1).padStart(2, '0')}`);
    if (!hasDaily(s, cDays) || !hasDaily(s, pDays)) return { cur: f, prev: null, curLabel: m, prevLabel: pm, note: `${m} is in progress and ${pm} has no daily history for a like-for-like comparison.` };
    return {
      cur: { ...f, dates: cDays }, prev: { ...f, cycle: pc, months: [pm], weeks: null, dates: pDays },
      curLabel: dayRange(cDays[0], cDays.at(-1)!), prevLabel: dayRange(pDays[0], pDays.at(-1)!), note: `${m} is in progress, so both months use days 1–${lastDay}.`,
    };
  }
  return { cur: f, prev: null, curLabel: '', prevLabel: '', note: 'Pick a single week or month to compare with the period before.' };
}

export function describe(v: ViewState, f: Filter): string {
  if (v.view === 'week') return f.weeks?.[0] ? `Week ${weekRange(f.weeks[0], true)}` : 'Week';
  if (v.view === 'month') return f.months?.[0] ? monthLabel(f.months[0]) : 'Month';
  if (v.view === 'custom') return f.range ? dayRange(f.range[0], f.range[1], true) : 'Date range';
  return `Cycle ${v.cycle} to date`;
}
