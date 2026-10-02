import { describe, expect, it } from 'vitest';
import { KINDS, SETUP_WORDS, isBudgetAction, pickWeek, platformOfChannel, storedBudget, storedKind, storedPlatform, withPriority, type Kind, type Priority } from './kinds';

const act = (kind: Kind, priority: Priority) => ({ id: 'x', kind, priority });

describe('withPriority: set-up is always High', () => {
  it('raises Medium and Low set-up actions to High', () => {
    expect(withPriority(act('Setup', 'Medium')).priority).toBe('High');
    expect(withPriority(act('Setup', 'Low')).priority).toBe('High');
    expect(withPriority(act('Setup', 'High')).priority).toBe('High');
  });
  it('leaves every other kind alone, in both directions', () => {
    for (const k of KINDS.filter((k) => k !== 'Setup')) {
      for (const p of ['High', 'Medium', 'Low'] as const) expect(withPriority(act(k, p)).priority).toBe(p);
    }
  });
  it('keeps the other fields', () => {
    expect(withPriority({ ...act('Setup', 'Low'), text: 'keep me' })).toMatchObject({ id: 'x', text: 'keep me', kind: 'Setup' });
  });
});

describe('platform follows the channel', () => {
  it('maps channel names', () => {
    expect(platformOfChannel('Google')).toBe('Google Ads');
    expect(platformOfChannel('Meta')).toBe('Meta');
    expect(platformOfChannel('LinkedIn')).toBe('LinkedIn');
    expect(platformOfChannel('TikTok')).toBe('Tracking');
  });
  it('old "Search keywords" saves are Google Ads', () => {
    expect(storedPlatform({ platform: 'Search keywords' })).toBe('Google Ads');
  });
  it('old "Budget" saves take the channel from their dims', () => {
    expect(storedPlatform({ platform: 'Budget', dims: { channel: ['Google'] } })).toBe('Google Ads');
    expect(storedPlatform({ platform: 'Budget', dims: { channel: ['Meta'] } })).toBe('Meta');
    expect(storedPlatform({ platform: 'Budget', dims: { channel: ['LinkedIn'] } })).toBe('LinkedIn');
    expect(storedPlatform({ platform: 'Budget', dims: {} })).toBe('Tracking');
    expect(storedPlatform({ platform: 'Budget' })).toBe('Tracking');
  });
  it('current platforms stay as they are; anything unknown is Tracking', () => {
    for (const p of ['Google Ads', 'Meta', 'LinkedIn', 'Tracking']) expect(storedPlatform({ platform: p })).toBe(p);
    expect(storedPlatform({ platform: 'nonsense' })).toBe('Tracking');
    expect(storedPlatform({})).toBe('Tracking');
  });
});

describe('budget actions', () => {
  it('pacing, approved moves and flagged set-up lines are budget actions', () => {
    expect(isBudgetAction({ kind: 'Budget pacing' })).toBe(true);
    expect(isBudgetAction({ kind: 'Reallocation' })).toBe(true);
    expect(isBudgetAction({ kind: 'Setup', budget: true })).toBe(true); // plan line missing / not launched
  });
  it('other actions are not', () => {
    for (const k of ['Performance', 'Scale', 'Keywords', 'Feedback', 'Setup'] as const) expect(isBudgetAction({ kind: k })).toBe(false);
    expect(isBudgetAction({ kind: 'Setup', budget: false })).toBe(false);
  });
  it('old saves: Budget platform, approved reallocations and the saved flag', () => {
    expect(storedBudget({ platform: 'Budget' })).toBe(true);
    expect(storedBudget({ platform: 'Google Ads', source: 'realloc' })).toBe(true);
    expect(storedBudget({ platform: 'Meta', budget: true })).toBe(true);
    expect(storedBudget({ platform: 'Google Ads' })).toBe(false);
  });
});

describe('pickWeek: budget is never in the backlog', () => {
  const mk = (id: string, owner: string, kind: Kind = 'Performance', budget = false) => ({ id, owner, kind, budget });
  const owner = (a: { owner: string }) => a.owner;

  it('takes the top N others per owner, in the order given', () => {
    const open = ['a1', 'a2', 'a3'].map((id) => mk(id, 'John')).concat(['b1', 'b2', 'b3'].map((id) => mk(id, 'Phoebe')));
    expect([...pickWeek(open, owner, 2)].sort()).toEqual(['a1', 'a2', 'b1', 'b2']);
  });
  it('adds every budget action on top of the cap, whoever owns it', () => {
    const open = [mk('p1', 'John'), mk('p2', 'John'), mk('p3', 'John'), ...Array.from({ length: 12 }, (_, i) => mk(`b${i}`, i % 2 ? 'John' : 'Phoebe', 'Budget pacing', true)), mk('s1', 'Phoebe', 'Setup', true)];
    const week = pickWeek(open, owner, 2);
    for (const a of open.filter((a) => a.kind === 'Budget pacing' || a.id === 's1')) expect(week.has(a.id)).toBe(true);
    expect(week.has('p1')).toBe(true);
    expect(week.has('p2')).toBe(true);
    expect(week.has('p3')).toBe(false); // the cap still holds for non-budget actions
  });
  it('budget actions do not use up the cap of the others', () => {
    const open = [mk('b1', 'John', 'Budget pacing', true), mk('b2', 'John', 'Budget pacing', true), mk('p1', 'John'), mk('p2', 'John')];
    expect([...pickWeek(open, owner, 2)].sort()).toEqual(['b1', 'b2', 'p1', 'p2']);
  });
  it('an empty list gives an empty week', () => {
    expect(pickWeek([], owner, 8).size).toBe(0);
  });
});

describe('storedKind: actions saved as done / dismissed', () => {
  it('uses the kind that was saved with the action', () => {
    expect(storedKind({ kind: 'Setup', platform: 'Meta' })).toBe('Setup');
    expect(storedKind({ kind: 'Keywords', platform: 'Google Ads' })).toBe('Keywords');
  });
  it('ignores a saved kind that is not one of ours', () => {
    expect(storedKind({ kind: 'nonsense', platform: 'Search keywords' })).toBe('Keywords');
  });
  it('approved reallocations are Reallocation', () => {
    expect(storedKind({ source: 'realloc', platform: 'Google Ads', actionText: 'Move CHF 50/week from A to B' })).toBe('Reallocation');
  });
  it('old Budget actions: a plan line that was not launched is Setup, the rest is pacing', () => {
    expect(storedKind({ platform: 'Budget', actionText: 'Launch it or confirm it starts later — the plan needs ≈CHF 40/day.' })).toBe('Setup');
    expect(storedKind({ platform: 'Budget', actionText: 'Raise CAAS India Adwords (Search) from CHF 30 to CHF 45/day (+15).' })).toBe('Budget pacing');
    expect(storedKind({ platform: 'Budget', actionText: 'Account is over pace: cut to ≈CHF 30/day.' })).toBe('Budget pacing');
  });
  it('old Google / Meta actions: scale wording is Scale, everything else Performance', () => {
    expect(storedKind({ platform: 'Google Ads', actionText: 'Scale budget by 20–30% while monitoring CPL and good lead rate.' })).toBe('Scale');
    expect(storedKind({ platform: 'Meta', actionText: 'Give Ad_X more budget — cheap good leads.' })).toBe('Scale');
    expect(storedKind({ platform: 'Google Ads', actionText: 'Pause or reduce budget. Check landing page, keyword intent, and tracking immediately.' })).toBe('Performance');
    expect(storedKind({ platform: 'Meta', actionText: 'Pause Ad_Y (CPGL 3× benchmark).' })).toBe('Performance');
  });
  it('old Tracking (comment) actions: set-up wording is Setup, else Feedback', () => {
    expect(storedKind({ platform: 'Tracking', actionText: 'UTM missing on the India form' })).toBe('Setup');
    expect(storedKind({ platform: 'Tracking', actionText: 'Please add a CVR column' })).toBe('Feedback');
  });
});

describe('SETUP_WORDS', () => {
  it.each(['check the set-up of this campaign', 'setup is wrong', 'Set up missing', 'need to check tracking', 'UTM is empty', 'pixel not firing', 'Final URL is wrong', 'target location is the US'])('matches %s', (t) => expect(SETUP_WORDS.test(t)).toBe(true));
  it.each(['Look good, scale up', 'what?', 'add a CVR column', 'upsetting numbers', 'the utmost care'])('does not match %s', (t) => expect(SETUP_WORDS.test(t)).toBe(false));
});
