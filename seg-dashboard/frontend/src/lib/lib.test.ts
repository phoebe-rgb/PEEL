import { countryOfAdSet } from './data';
import { describe, expect, it } from 'vitest';
import { cycleOf, isoWeek, mergeLayers, prevCycle, prevWeek, weekDays, type Layer } from './data';
import { compare, delta, emptyTotals, metric, total, weekComplete } from './agg';
import { classify } from './analysis';

const layer = (grain: 'day' | 'week', rows: { k: string; cycle?: string; channel: string; cost: number | null; leads: number | null; gl?: number }[]): Layer => {
  const key = grain === 'day' ? 'date' : 'week';
  const dk = [...new Set(rows.map((r) => r.k))], ch = [...new Set(rows.map((r) => r.channel))];
  const cy = [...new Set(rows.map((r) => r.cycle ?? cycleOf(r.k)))];
  const mo = [...new Set(rows.map((r) => (grain === 'day' ? r.k : weekDays(r.k)[3]).slice(0, 7)))];
  return {
    grain, n: rows.length,
    dims: { [key]: dk, channel: ch, cycle: cy, month: mo },
    cols: {
      [key]: rows.map((r) => dk.indexOf(r.k)), channel: rows.map((r) => ch.indexOf(r.channel)),
      cycle: rows.map((r) => cy.indexOf(r.cycle ?? cycleOf(r.k))),
      month: rows.map((r) => mo.indexOf((grain === 'day' ? r.k : weekDays(r.k)[3]).slice(0, 7))),
      cost: rows.map((r) => r.cost), leads: rows.map((r) => r.leads), gl: rows.map((r) => r.gl ?? 0),
    },
  };
};

describe('calendar', () => {
  it('ISO weeks and year boundaries', () => {
    expect(isoWeek('2026-09-21')).toBe('2026-W39');
    expect(isoWeek('2026-01-01')).toBe('2026-W01');
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
    expect(weekDays('2026-W39')[0]).toBe('2026-09-21');
  });
  it('cycle is Aug–Jul from the date', () => {
    expect(cycleOf('2026-07-31')).toBe('25/26');
    expect(cycleOf('2026-08-01')).toBe('26/27');
    expect(prevCycle('26/27')).toBe('25/26');
    expect(prevCycle('00/01')).toBe('99/00');
  });
  it('same ISO week one year earlier; W53 unmatched when absent', () => {
    expect(prevWeek('2026-W38')).toBe('2025-W38');
    expect(prevWeek('2026-W53')).toBeNull();
  });
  it('week straddling 1 Aug is not a complete cycle week', () => {
    expect(weekComplete('2026-W31', '26/27', '2026-09-26')).toBe(false);
    expect(weekComplete('2026-W38', '26/27', '2026-09-26')).toBe(true);
    expect(weekComplete('2026-W39', '26/27', '2026-09-26')).toBe(false);
  });
});

describe('metrics', () => {
  it('zero denominator and missing measures are unavailable, not zero', () => {
    const t = emptyTotals(); t.cost = 100; t.avail.cost = true; t.avail.leads = true;
    expect(Number.isNaN(metric(t, 'cpl'))).toBe(true);
    expect(Number.isNaN(metric(t, 'sessions'))).toBe(true);
  });
  it('rates change in percentage points; zero baseline is new activity', () => {
    const a = emptyTotals(), b = emptyTotals();
    Object.assign(a, { leads: 10, gl: 3 }); Object.assign(b, { leads: 10, gl: 2 });
    a.avail.leads = a.avail.gl = b.avail.leads = b.avail.gl = true;
    expect(delta(a, b, 'glRate')).toMatchObject({ kind: 'pp', good: true });
    expect(delta(a, b, 'glRate').value).toBeCloseTo(10);
    const z = emptyTotals(); z.avail.gl = true;
    expect(delta(a, z, 'gl').kind).toBe('new');
  });
  it('funnel score uses SEG weights', () => {
    const t = emptyTotals(); Object.assign(t, { leads: 10, gl: 2, app: 1, acc: 1 });
    expect(metric(t, 'score')).toBe(10 + 6 + 6 + 10);
    expect(classify(t, t).verdict).toBe('Stable');
  });
});

describe('merge + compare', () => {
  const weekly = layer('week', [
    { k: '2025-W38', cycle: '25/26', channel: 'Meta', cost: 100, leads: 10 },
    { k: '2025-W39', cycle: '25/26', channel: 'Meta', cost: 100, leads: 10 },
  ]);
  const daily = layer('day', [
    ...weekDays('2026-W38').map((d) => ({ k: d, channel: 'Meta', cost: 20, leads: 1 })),
    { k: '2026-09-21', channel: 'Meta', cost: 5, leads: 0 },
  ]);
  const live = { ...layer('day', [{ k: '2026-09-21', channel: 'Meta', cost: 50, leads: 2 }]), window: { from: '2026-09-21', to: '2026-09-21' } };
  const s = mergeLayers({ weekly, daily, historyTo: '2026-09-26', live });

  it('live replaces history for dates in its window', () => {
    const t = total(s, { cycle: '26/27', weeks: ['2026-W39'], dims: {} });
    expect(t.cost).toBe(50);
    expect(t.leads).toBe(2);
  });
  it('cards keep partial current data; delta uses matched complete weeks only', () => {
    const c = compare(s, { cycle: '26/27', weeks: null, dims: {} });
    expect(c.totals.cost).toBe(140 + 50);
    expect(c.matchedWeeks).toEqual(['2026-W38']);
    expect(c.comparisonTotals.cost).toBe(140);
    expect(c.prevTotals.cost).toBe(100);
  });
  it('unsupported historical dimension withholds the comparison', () => {
    const c = compare(s, { cycle: '26/27', weeks: null, dims: { campaign: ['X'] } }, new Set(['channel']));
    expect(c.unavailable).toMatch(/campaign/);
  });
});

import { baseAd, parseCampaign, refDate } from './rules';
describe('ACT rules helpers', () => {
  it('parses school and country code from the campaign name (UAE → AE)', () => {
    expect(parseCampaign('PL_SHMS_GA_ACT_MiddleEast_UAE_EN_ALL_ALL_Brand')).toMatchObject({ school: 'SHMS', country: 'AE', type: 'ACT' });
    expect(parseCampaign('PL_CAAS_FB_ACT_APAC_IN_MAS_ALL')).toMatchObject({ school: 'CAAS', country: 'IN' });
  });
  it('merges ad-name variants of the same creative', () => {
    expect(baseAd('APAC_outcome_IMG_EN_Career_3')).toBe('APAC_outcome_IMG_EN_Career');
    expect(baseAd('APAC_outcome_IMG_EN_Career – Copy')).toBe('APAC_outcome_IMG_EN_Career');
  });
  it('judges yesterday (Hanoi), never a partial latest day', () => {
    expect(refDate('2026-09-27', new Date('2026-09-27T12:00:00Z'))).toBe('2026-09-26');
    expect(refDate('2026-09-20', new Date('2026-09-27T12:00:00Z'))).toBe('2026-09-20');
  });
});

import { activityOf, formatOf, googleIntentOf, metaAudienceOf, segmentOf, themeOf } from './names';
describe('names → dimensions', () => {
  it('Meta theme and format from the ad name', () => {
    expect(themeOf('ALL_safety_IMG_EN_Campus_1')).toBe('Safety & Security');
    expect(themeOf('APAC_career_VID_EN_CauxCampus_1')).toBe('Career Prospects');
    expect(themeOf('ALL_BoostedPost_VID_EN_Alumni_LeadershipMindset-Ivan')).toBe('Alumni Reveal');
    expect(formatOf('ALL_safety_IMG_EN_Campus_1')).toBe('Image');
    expect(formatOf('APAC_rank_VID_EN_CauxCampus_1')).toBe('Video');
  });
  it('audience from Meta ad set and Google campaign intent', () => {
    expect(metaAudienceOf('APAC_KEY_ALL_ALL_INT_Parents-V2')).toBe('Parents');
    expect(metaAudienceOf('APAC_IN_ALL_ALL_WEB_WebsiteVisitors-180Days')).toBe('Retargeting (web / engagers)');
    expect(metaAudienceOf('Americas_KEY_SD_ALL_LAL_QualifiedLeadsSept22-1-18-22')).toBe('Lookalike');
    expect(metaAudienceOf('Scandi_SE_SD_ALL_INT_HSLeavers-18-36')).toBe('High-school leavers');
    expect(googleIntentOf('PL_CRCS_GA_ACT_Global_Tier1_EN_ALL_ALL_Brand')).toBe('Brand');
    expect(googleIntentOf('PL_CAAS_GA_ACT_APAC_IN_EN_BAC_Culinary_Programs')).toBe('Program – Bachelor');
    expect(googleIntentOf('PL_SHMS_GA_ACT_Americas_US_EN_ALL_ALL_Hospitality-Switzerland')).toBe('Generic (school / Switzerland)');
  });
  it('activity and Meta segment from the campaign name', () => {
    expect(activityOf('PL_SHMS_FB_NURT_ALL_ALL_ALL_ALL_X', '')).toBe('NURT');
    expect(activityOf('SEG_Search_Conversion', 'CONVERT')).toBe('CONV');
    expect(segmentOf('PL_CAAS_FB_ACT_APAC_IN_MAS_Culinary-Mgmt')).toBe("Master's · Culinary-Mgmt");
    expect(segmentOf('PL_SHMS_FB_ACT_APAC_IN_ALL_ALL_Parents')).toBe('Parents');
    expect(segmentOf('PL_CAAS_FB_ACT_ALL_ALL_ALL_ALL_Retargeting')).toBe('Retargeting');
  });
});

describe('countryOfAdSet', () => {
  it('reads Region_COUNTRY_ and tolerates a double underscore', () => {
    expect(countryOfAdSet('Americas_CA_ALL_MAS_ALL_LAL_QualifiedLeads2-20-24')).toBe('CA');
    expect(countryOfAdSet('Americas__US_KEY_MAS_ALL_INT_HospitalityStudyAbroad-20-24')).toBe('US');
    expect(countryOfAdSet('APAC_KEY_ALL_ALL_INT_Parents')).toBe('');
    expect(countryOfAdSet('MiddleEast_UAE_MAS')).toBe('AE');
  });
});

describe('countryCodes', () => {
  it('maps the filter-bar country names to campaign codes', async () => {
    const { countryCodes } = await import('./names');
    expect(countryCodes('India')).toEqual(['IN']);
    expect(countryCodes('United Arab Emirates')).toContain('AE');
    expect(countryCodes('United Kingdom')).toEqual(['UK', 'GB']);
    expect(countryCodes('Atlantis')).toEqual([]);
  });
});

describe('Lead → App rate', () => {
  it('is Applied / Leads, from the lead', () => {
    const t = { ...emptyTotals(), leads: 200, app: 10 };
    t.avail.leads = true; t.avail.app = true;
    expect(metric(t, 'leadAppRate')).toBeCloseTo(0.05);
  });
});

describe('negative keywords', () => {
  it('never flags school names (incl. misspellings) and flags competitors / other countries', async () => {
    const { classify } = await import('./negatives');
    for (const t of ['caesar ritz colleges', 'cesar rits', 'swiss hotel managment school', 'shms fees', 'culinary arts academy switzerland', 'him business school', 'hotel institute montreux'])
      expect(classify('SHMS', t)).toBeNull();
    expect(classify('SHMS', 'ehl lausanne')?.category).toBe('Competitor');
    expect(classify('CAAS', 'culinary school in italy')?.negative).toBe('in italy');
    expect(classify('CAAS', 'culinary arts diploma switzerland')).toBeNull();
    expect(classify('CAAS', '6 month culinary program')?.match).toBe('Exact');
  });
});
