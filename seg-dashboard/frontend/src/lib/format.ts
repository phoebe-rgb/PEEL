import { METRICS, type Delta, type MetricId } from './agg';
import type { Dim } from './data';

export const DIM_LABEL: Record<Dim, string> = {
  channel: 'Channel', school: 'School', country: 'Country', region: 'Region', country_level: 'Country level',
  activity: 'Activity type', level: 'Level', program: 'Program target', campaign: 'Campaign', ad_group: 'Ad set / ad group',
  ad: 'Ad', theme: 'Message theme', audience: 'Target audience / keyword theme', ad_format: 'Ad format', market: 'Country (market)', subchannel: 'Channel type', creative: 'Theme × format', boost: 'Social boosting',
};

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${nf1.format(v / 1e6)}M`;
  if (a >= 1e4) return `${nf1.format(v / 1e3)}K`;
  return nf0.format(v);
}

export function fmt(id: MetricId, v: number, short = false): string {
  if (!Number.isFinite(v)) return '–';
  const k = METRICS[id].kind;
  if (k === 'rate') return `${nf2.format(v * 100)}%`;
  if (k === 'money') return short ? compact(v) : nf0.format(v); // currency is in the header, not in every cell
  if (k === 'cost') return v >= 100 ? nf0.format(v) : nf2.format(v);
  if (id === 'score') return short ? compact(v) : nf0.format(v);
  return short ? compact(v) : nf0.format(v);
}

export function fmtDelta(d: Delta): { text: string; cls: string } {
  const cls = d.good === null ? 'dim' : d.good ? 'good' : 'bad';
  if (d.kind === 'none') return { text: '–', cls: 'dim' };
  if (d.kind === 'new') return { text: 'New activity', cls };
  const arrow = d.value > 0 ? '▲' : d.value < 0 ? '▼' : '';
  const v = Math.abs(d.value);
  return { text: `${arrow} ${d.kind === 'pp' ? `${nf2.format(v)} pp` : `${v >= 1000 ? '>999' : nf1.format(v)}%`}`, cls };
}

export const label = (v: string) => v || '(no value)';
