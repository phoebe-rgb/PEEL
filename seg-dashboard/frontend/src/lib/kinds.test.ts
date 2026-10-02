import { describe, expect, it } from 'vitest';
import { KINDS, SETUP_WORDS, storedKind, withPriority, type Kind, type Priority } from './kinds';

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
  it('old Budget actions: no plan line / not launched are Setup, pacing is pacing', () => {
    expect(storedKind({ platform: 'Budget', actionText: 'Spending without a plan line — add it to the budget sheet or stop.' })).toBe('Setup');
    expect(storedKind({ platform: 'Budget', actionText: 'Launch it or confirm it starts later — the plan needs ≈CHF 40/day.' })).toBe('Setup');
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
