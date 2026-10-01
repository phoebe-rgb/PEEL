// One comparison model for every page: the selected period vs either the previous period or the same period last year.
import { cycleWeeks, prevCycleFilter, weekComplete, type Filter } from './agg';
import { cycleOf, dayRange, isoWeek, monthLabel, prevCycle, prevWeek, weekDays, type Store } from './data';
import { previousPeriod, type ViewKind } from './period';

export type CompareMode = 'prev' | 'yoy';
export interface Pair {
  full: Filter;          // what cards show (all selected data)
  cur: Filter;           // current side of the comparison (may be a matched subset)
  prev: Filter | null;   // comparison side; null = unavailable
  curLabel: string; prevLabel: string; note: string; mode: CompareMode;
}

const shift = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
const rlabel = (r: [string, string]) => dayRange(r[0], r[1], true);

export function comparePair(s: Store, f: Filter, view: ViewKind, mode: CompareMode): Pair {
  const base = { full: f, mode };
  if (f.range) {
    // date range: the same number of days immediately before, or the same dates 52 weeks earlier (same weekdays)
    const to = f.range[1] < s.lastDate ? f.range[1] : s.lastDate, from = f.range[0];
    if (from > to) return { ...base, cur: f, prev: null, curLabel: '', prevLabel: '', note: 'The range starts after the latest data.' };
    const n = mode === 'prev' ? days(from, to) : 364;
    const cur: Filter = { ...f, range: [from, to] }, prev: Filter = { ...f, range: [shift(from, -n), shift(to, -n)] };
    return { ...base, cur, prev, curLabel: rlabel(cur.range!), prevLabel: rlabel(prev.range!), note: to < f.range[1] ? `The range runs past the latest data, so both sides use ${days(from, to)} days.` : '' };
  }
  if (mode === 'prev') {
    if (view === 'week' || view === 'month') {
      const p = previousPeriod(s, f, view);
      return { ...base, cur: p.cur, prev: p.prev, curLabel: p.curLabel, prevLabel: p.prevLabel, note: p.note };
    }
    // cycle to date / week range: the same number of weeks immediately before
    const weeks = f.weeks ?? cycleWeeks(s, f.cycle);
    const done = weeks.filter((w) => weekComplete(w, f.cycle, s.lastDate));
    if (!done.length) return { ...base, cur: f, prev: null, curLabel: '', prevLabel: '', note: 'No complete weeks to compare.' };
    const n = done.length, first = weekDays(done[0])[0];
    const prevWeeks = Array.from({ length: n }, (_, i) => isoWeek(shift(first, -7 * (n - i))));
    return {
      ...base, cur: { ...f, cycle: '*', weeks: done, months: null }, prev: { ...f, cycle: '*', weeks: prevWeeks, months: null, dates: null },
      curLabel: dayRange(weekDays(done[0])[0], weekDays(done.at(-1)!)[6], true), prevLabel: dayRange(weekDays(prevWeeks[0])[0], weekDays(prevWeeks.at(-1)!)[6], true),
      note: done.length < weeks.length ? 'The unfinished latest week is left out of the comparison.' : '',
    };
  }
  // same period last year: matched complete ISO weeks (and the same calendar month when a month is selected)
  const pc = prevCycle(f.cycle);
  if (!s.cycles.includes(pc)) return { ...base, cur: f, prev: null, curLabel: '', prevLabel: '', note: `No ${pc} data.` };
  const weeks = f.weeks ?? cycleWeeks(s, f.cycle);
  const inMonth = (w: string, ms?: string[] | null) => !ms || weekDays(w).every((d) => ms.includes(d.slice(0, 7)));
  const prevMonths = f.months?.map((m) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`) ?? null;
  const pWeeks = cycleWeeks(s, pc);
  // a complete calendar month compares whole months
  if (view === 'month' && f.months?.length === 1) {
    const m = f.months[0], last = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10);
    if (last <= s.lastDate) return { ...base, cur: f, prev: { ...f, cycle: cycleOf(`${prevMonths![0]}-15`), months: prevMonths, weeks: null, dates: null }, curLabel: monthLabel(m), prevLabel: monthLabel(prevMonths![0]), note: '' };
  }
  const matched = weeks.filter((w) => {
    const p = prevWeek(w);
    return p && weekComplete(w, f.cycle, s.lastDate) && weekComplete(p, pc, s.lastDate) && pWeeks.includes(p) && inMonth(w, f.months) && inMonth(p, prevMonths);
  });
  if (!matched.length) return { ...base, cur: f, prev: null, curLabel: '', prevLabel: '', note: 'The period is not finished yet, and last year only has whole weeks — switch Compare to "Previous period", or pick a completed week.' };
  const pf = prevCycleFilter(f, matched);
  return {
    ...base, cur: { ...f, weeks: matched }, prev: pf,
    curLabel: dayRange(weekDays(matched[0])[0], weekDays(matched.at(-1)!)[6], true),
    prevLabel: dayRange(weekDays(pf.weeks![0])[0], weekDays(pf.weeks!.at(-1)!)[6], true),
    note: matched.length < weeks.length ? `Compared on ${matched.length} complete matching week${matched.length > 1 ? 's' : ''}.` : '',
  };
}

export const modeLabel = (m: CompareMode) => (m === 'prev' ? 'previous period' : 'same period last year');

const monthAdd = (m: string, n: number) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 7);
const monthDays = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();

/** One more step back from the comparison side: the period before the previous one, or the same period two years back. */
export function stepBack(s: Store, pair: Pair): Filter | null {
  const p = pair.prev;
  if (!p) return null;
  if (p.range && pair.cur.range) {
    const n = pair.mode === 'prev' ? days(pair.cur.range[0], pair.cur.range[1]) : 364;
    return { ...p, range: [shift(p.range[0], -n), shift(p.range[1], -n)] };
  }
  if (pair.mode === 'yoy') {
    const pc = prevCycle(p.cycle);
    if (!s.cycles.includes(pc)) return null;
    const weeks = p.weeks?.map((w) => prevWeek(w));
    if (weeks?.some((w) => !w)) return null;
    return { ...p, cycle: pc, weeks: (weeks as string[] | undefined) ?? null, months: p.months?.map((m) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`) ?? null, dates: null };
  }
  if (p.months?.length === 1 && !p.weeks) {
    const pm = monthAdd(p.months[0], -1);
    const dates = p.dates ? p.dates.map((d) => `${pm}-${d.slice(8)}`).filter((d) => Number(d.slice(8)) <= monthDays(pm)) : null;
    return { ...p, cycle: '*', months: [pm], weeks: null, dates };
  }
  if (p.weeks?.length) {
    const n = 7 * p.weeks.length;
    return { ...p, cycle: '*', months: null, weeks: p.weeks.map((w) => isoWeek(shift(weekDays(w)[0], -n))), dates: p.dates?.map((d) => shift(d, -n)) ?? null };
  }
  return null;
}

/** Compact period label for column headers, e.g. W37, W30–38, Aug, W39 ’25. */
export function shortLabel(f: Filter | null, yoy = false): string {
  if (!f) return '—';
  if (f.range) return dayRange(f.range[0], f.range[1], yoy);
  if (f.weeks?.length) {
    const a = weekDays(f.weeks[0])[0], b = weekDays(f.weeks.at(-1)!)[6];
    const ds = f.dates?.length ? [f.dates[0], f.dates.at(-1)!] : [a, b];
    return dayRange(ds[0], ds[1], yoy);
  }
  const yr = (d: string) => (yoy ? ` ’${d.slice(2, 4)}` : '');
  if (f.months?.length) return new Date(`${f.months[0]}-15T00:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }) + yr(f.months[0]);
  return f.cycle;
}
