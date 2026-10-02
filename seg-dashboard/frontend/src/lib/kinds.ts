// What kind of problem an action is about (the platform says where it is). Used by the Actions page.
import type { Entry } from './shared';

export type Kind = 'Setup' | 'Performance' | 'Scale' | 'Budget pacing' | 'Keywords' | 'Feedback' | 'Reallocation';
export type Priority = 'High' | 'Medium' | 'Low';

export const KINDS: Kind[] = ['Setup', 'Performance', 'Scale', 'Budget pacing', 'Keywords', 'Feedback', 'Reallocation'];
export const KIND_HELP: Record<Kind, string> = {
  Setup: 'Something is not set up right: a budget line missing or not launched, tracking, URL, target location. Always High.',
  Performance: 'Results are off: no leads, CPL / cost per good lead too high, ads to pause.',
  Scale: 'Doing well: room to give more budget.',
  'Budget pacing': 'Spend is ahead of or behind the plan.',
  Keywords: 'New negative keywords to review.',
  Feedback: 'Comments someone flagged "Needs action".',
  Reallocation: 'Approved budget moves between campaigns or audiences.',
};

/** Anything about set-up is High, whatever priority the rule that raised it gave. */
export const withPriority = <T extends { kind: Kind; priority: Priority }>(a: T): T => (a.kind === 'Setup' ? { ...a, priority: 'High' } : a);

/** A comment (or saved action text) that talks about set-up or tracking. */
export const SETUP_WORDS = /\bset ?-?up\b|tracking|\butm\b|pixel|final url|target location/i;

/** Kind of an action that was saved as done / dismissed / approved: the stored kind if there is one, else worked out from what was saved. */
export function storedKind(e: Entry): Kind {
  if ((KINDS as string[]).includes(String(e.kind))) return e.kind as Kind;
  if (e.source === 'realloc') return 'Reallocation';
  const t = String(e.actionText ?? '');
  switch (e.platform) {
    // the action text of a "No plan" line / a "Not started" line (see paceByCountry in budget.tsx)
    case 'Budget': return /without a plan line|launch it or confirm it starts later/i.test(t) ? 'Setup' : 'Budget pacing';
    case 'Search keywords': return 'Keywords';
    case 'Tracking': return SETUP_WORDS.test(t) ? 'Setup' : 'Feedback';
    default: return /^(scale budget|increase budget|consider scaling|give .+ more budget)/i.test(t) ? 'Scale' : 'Performance';
  }
}
