// Where an action is (platform = its channel) and what kind of problem it is. Used by the Actions page.
import type { Entry } from './shared';

/** Platform follows the channel. Budget and search-term actions belong to their channel; 'Tracking' is only for comments that name none. */
export type Platform = 'Google Ads' | 'Meta' | 'LinkedIn' | 'Tracking';
export type Kind = 'Setup' | 'Performance' | 'Scale' | 'Budget pacing' | 'Keywords' | 'Feedback' | 'Reallocation';
export type Priority = 'High' | 'Medium' | 'Low';

export const KINDS: Kind[] = ['Setup', 'Performance', 'Scale', 'Budget pacing', 'Keywords', 'Feedback', 'Reallocation'];
export const KIND_HELP: Record<Kind, string> = {
  Setup: 'Something is not set up right: a budget line missing or not launched, tracking, URL, target location. Always High.',
  Performance: 'Results are off: no leads, CPL / cost per good lead too high, ads to pause.',
  Scale: 'Doing well: room to give more budget.',
  'Budget pacing': 'Daily budget is ahead of or behind the plan. Always in the main table.',
  Keywords: 'New negative keywords (search terms) to review.',
  Feedback: 'Comments someone flagged "Needs action".',
  Reallocation: 'Approved budget moves between campaigns or audiences. Always in the main table.',
};

/** Anything about set-up is High, whatever priority the rule that raised it gave. */
export const withPriority = <T extends { kind: Kind; priority: Priority }>(a: T): T => (a.kind === 'Setup' ? { ...a, priority: 'High' } : a);

/** Budget actions (pacing, a plan line missing or not launched, approved budget moves) are never pushed down to the backlog. */
export const isBudgetAction = (a: { kind: Kind; budget?: boolean }) => !!a.budget || a.kind === 'Budget pacing' || a.kind === 'Reallocation';

/**
 * This week's table: every budget action, plus the top `top` other actions per owner.
 * `open` must already be sorted by urgency; everything not picked waits in the backlog.
 */
export function pickWeek<T extends { id: string; kind: Kind; budget?: boolean }>(open: T[], ownerOf: (a: T) => string, top: number): Set<string> {
  const picked = new Set<string>(), perOwner = new Map<string, number>();
  for (const a of open) {
    if (isBudgetAction(a)) { picked.add(a.id); continue; }
    const o = ownerOf(a), n = perOwner.get(o) ?? 0;
    if (n < top) { picked.add(a.id); perOwner.set(o, n + 1); }
  }
  return picked;
}

/** The platform of a channel name as it appears in the data. */
export const platformOfChannel = (channel: string): Platform => (channel === 'Google' ? 'Google Ads' : channel === 'Meta' ? 'Meta' : channel === 'LinkedIn' ? 'LinkedIn' : 'Tracking');

const PLATFORMS: string[] = ['Google Ads', 'Meta', 'LinkedIn', 'Tracking'];
/**
 * Platform of an action saved earlier. Old saves used 'Budget' (now the channel in its dims) and 'Search keywords' (now Google Ads).
 */
export function storedPlatform(e: Entry): Platform {
  const p = String(e.platform);
  if (p === 'Search keywords') return 'Google Ads';
  if (p === 'Budget') return platformOfChannel(String((e.dims as { channel?: string[] } | undefined)?.channel?.[0] ?? ''));
  return PLATFORMS.includes(p) ? (p as Platform) : 'Tracking';
}

/** Was this saved action a budget action? */
export const storedBudget = (e: Entry) => e.budget === true || e.platform === 'Budget' || e.source === 'realloc';

/** A comment (or saved action text) that talks about set-up or tracking. */
export const SETUP_WORDS = /\bset ?-?up\b|tracking|\butm\b|pixel|final url|target location/i;

/** Kind of an action that was saved as done / dismissed / approved: the stored kind if there is one, else worked out from what was saved. */
export function storedKind(e: Entry): Kind {
  if ((KINDS as string[]).includes(String(e.kind))) return e.kind as Kind;
  if (e.source === 'realloc') return 'Reallocation';
  const t = String(e.actionText ?? '');
  switch (e.platform) {
    // a "Not started" plan line says to launch it; the text of a "No plan" line is a cut, so it can only be told apart when the kind was saved
    case 'Budget': return /launch it or confirm it starts later/i.test(t) ? 'Setup' : 'Budget pacing';
    case 'Search keywords': return 'Keywords';
    case 'Tracking': return SETUP_WORDS.test(t) ? 'Setup' : 'Feedback';
    default: return /^(scale budget|increase budget|consider scaling|give .+ more budget)/i.test(t) ? 'Scale' : 'Performance';
  }
}
