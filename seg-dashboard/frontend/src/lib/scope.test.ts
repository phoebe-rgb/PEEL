import { describe, expect, it } from 'vitest';
import { mergeLayers, type Layer } from './data';
import { googleReview, metaReview } from './rules';

// 30 days of spend on one Google ACT, one Google BRAND, one Meta ACT and one Meta NURT campaign.
const CAMPS = [
  ['Google', 'PL_SHMS_GA_ACT_APAC_IN_EN_ALL_ALL_Brand'],
  ['Google', 'PL_SHMS_YT_BRAND_APAC_IN_ALL_ALL_MIX'],
  ['Meta', 'PL_CAAS_FB_ACT_APAC_IN_BAC_ALL'],
  ['Meta', 'PL_CAAS_FB_NURT_APAC_IN_ALL_ALL'],
];
const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10));
const rows = days.flatMap((d) => CAMPS.map(([channel, campaign]) => ({ d, channel, campaign })));
const dict = (f: (r: (typeof rows)[number]) => string) => [...new Set(rows.map(f))];
const D = { date: dict((r) => r.d), channel: dict((r) => r.channel), campaign: dict((r) => r.campaign) };
const live: Layer = {
  grain: 'day', n: rows.length, window: { from: days[0], to: days.at(-1)! },
  dims: { ...D, school: ['SHMS', 'CAAS'] },
  cols: {
    date: rows.map((r) => D.date.indexOf(r.d)), channel: rows.map((r) => D.channel.indexOf(r.channel)),
    campaign: rows.map((r) => D.campaign.indexOf(r.campaign)), school: rows.map((r) => (r.campaign.includes('SHMS') ? 0 : 1)),
    cost: rows.map(() => 40), leads: rows.map(() => 1), gl: rows.map(() => 0),
  },
};
const empty: Layer = { grain: 'week', n: 0, dims: {}, cols: {} };
const s = mergeLayers({ weekly: empty, daily: { ...empty, grain: 'day' }, historyTo: '2026-08-31', live });
const bench = { google: {}, meta: {} };

describe('review scope follows the activity filter', () => {
  it('Google: ACT by default, all activities with null, one activity when listed', () => {
    expect(googleReview(s, bench, {}).reviewed).toBe(1);
    expect(googleReview(s, bench, {}, undefined, null).reviewed).toBe(2);
    expect(googleReview(s, bench, {}, undefined, ['BRAND']).reviewed).toBe(1);
  });
  it('Meta: non-ACT campaigns get their own market entry, never merged with ACT', () => {
    expect(metaReview(s, bench).markets.map((m) => m.segment)).toEqual(['Bachelor']);
    expect(metaReview(s, bench, undefined, null).markets.map((m) => m.segment).sort()).toEqual(['Bachelor', 'NURT · All programmes']);
  });
});
