// Derive analysis dimensions from SEG naming conventions, so history and live data are classified the same way.
//   Campaign  PL_{SCHOOL}_{CH}_{TYPE}_{REGION}_{COUNTRY}_{LEVEL}_{PROGRAM}_{NOTE}
//   Meta ad   {Region}_{theme}_{FMT}_{LANG}_{Concept}_{n}      e.g. ALL_safety_IMG_EN_Campus_1
//   Meta ad set {Region}_{Geo}_{LEVEL}_{PROGRAM}_{TYPE}_{Descriptor}  e.g. APAC_KEY_ALL_ALL_INT_Parents-V2
// Google cost in Funnel has no ad group, so Google "audience" is the search intent in the campaign name.

const THEME: [RegExp, string][] = [
  [/^safety/i, 'Safety & Security'], [/^career/i, 'Career Prospects'], [/^rank/i, 'Overall Ranking'],
  [/^global/i, 'Global Exposure'], [/^heritage/i, 'Swiss Heritage & Innovation'], [/^outcome/i, 'Outcome'],
  [/^alumni/i, 'Alumni Reveal'], [/^human/i, 'Human-Centric Skills'], [/^combinedusp/i, 'Combined USPs'],
  [/^testimonial/i, 'Testimonial'], [/^virtualtour/i, 'Virtual tour'], [/^(ambition|nextchapter|leadership)/i, 'Aspiration'],
  [/^(applicationdeadline|deadline)/i, 'Application deadline'], [/^(openday|seminar|webinar|applicationevent|event)/i, 'Event promotion'],
  [/^scholarship/i, 'Scholarship'],
];
const BOOSTED: [RegExp, string][] = [
  [/alumni/i, 'Alumni Reveal'], [/ranking/i, 'Overall Ranking'], [/faculty|classes|program/i, 'Programme & faculty'],
  [/studentlife/i, 'Student life'], [/openday|event|webinar/i, 'Event promotion'],
];

export function themeOf(ad: string): string {
  if (!ad) return '';
  const t = ad.split('_');
  if (/boostedpost/i.test(t[1] ?? '')) {
    const cat = t.slice(4).join('_');
    return BOOSTED.find(([r]) => r.test(cat))?.[1] ?? 'Boosted post (other)';
  }
  for (const tok of t.slice(1, 5)) { const hit = THEME.find(([r]) => r.test(tok)); if (hit) return hit[1]; }
  // legacy names, e.g. 2024_Adhoc_CAAS_Career_SCANDINAVIA
  for (const tok of t) { const hit = THEME.find(([r]) => r.test(tok)); if (hit) return hit[1]; }
  return 'Other / legacy';
}

export function formatOf(ad: string): string {
  if (!ad) return '';
  if (/(^|_)(VID|VIDEO)(_|$)|video/i.test(ad)) return 'Video';
  if (/(^|_)(CAR|CAROUSEL)(_|$)/i.test(ad)) return 'Carousel';
  if (/(^|_)(IMG|IMAGE|STATIC)(_|$)/i.test(ad)) return 'Image';
  return 'Other';
}

export function metaAudienceOf(adSet: string): string {
  if (!adSet) return '';
  const s = adSet;
  if (/parent/i.test(s)) return 'Parents';
  if (/_CL_|qualifiedlead|customerlist/i.test(s) && !/_LAL_/i.test(s)) return 'Customer list (qualified leads)';
  if (/_LAL_|lookalike|look-a-like/i.test(s)) return 'Lookalike';
  if (/_WEB_|webvisitor|websitevisitor|engager|web90|_MIX_/i.test(s)) return 'Retargeting (web / engagers)';
  if (/hsleaver|highschool/i.test(s)) return 'High-school leavers';
  if (/studyabroad|internat?ionaledu/i.test(s)) return 'Study-abroad interest';
  if (/chef/i.test(s)) return 'Aspiring chefs';
  if (/careerchang|upskill/i.test(s)) return 'Career changers';
  if (/acquisition \(/i.test(s)) return 'Broad (legacy acquisition)';
  if (/_INT_/i.test(s)) return 'Interest (other)';
  return 'Other';
}

/** Google keyword theme from the campaign name (Funnel has no ad groups): Brand, Generic, Program – level, or the non-search type. */
export function googleIntentOf(campaign: string): string {
  if (!campaign) return '';
  const c = campaign, p = c.split('_');
  if (/_YT_|youtube/i.test(c)) return 'YouTube';
  if (/pmax/i.test(c)) return 'PMax (all themes)';
  if (/_GDN_|display|_DG_|demandgen/i.test(c)) return 'Display / Demand Gen';
  if (/brand/i.test(c)) return 'Brand';
  if (/alternative|competitor/i.test(c)) return 'Competitor';
  const lvl = (p[7] ?? '').toUpperCase();
  const LV: Record<string, string> = { BAC: 'Bachelor', BBA: 'Bachelor', MAS: 'Master', SD: 'Diploma', DIP: 'Diploma', PGD: 'Postgraduate' };
  if (LV[lvl]) return `Program – ${LV[lvl]}`;
  if (/program|fasttrack|mescyt/i.test(c)) return 'Program – all levels';
  if (/switzerland|school|hospitality|culinary|pastry|business/i.test(c)) return 'Generic (school / Switzerland)';
  return 'Other search';
}

const ACTIVITY: Record<string, string> = { ACT: 'ACT', BRAND: 'BRAND', CONV: 'CONV', CONVERT: 'CONV', NURT: 'NURT', NURTURE: 'NURT' };
export function activityOf(campaign: string, funnelValue: string): string {
  const p = campaign.split('_');
  if (/^PL$/i.test(p[0] ?? '') && p[3]) return ACTIVITY[p[3].toUpperCase()] ?? p[3].toUpperCase();
  return ACTIVITY[funnelValue.toUpperCase()] ?? funnelValue;
}

const LEVEL: Record<string, string> = { MAS: "Master's", SD: 'Swiss Diploma', BAC: 'Bachelor', BBA: 'BBA', PGD: 'Postgraduate Diploma', ALL: 'All programmes' };
/** Meta market entry for the weekly read, e.g. "Master's · Culinary-Mgmt", "Parents", "Retargeting". */
export function segmentOf(campaign: string): string {
  if (/retargeting/i.test(campaign)) return 'Retargeting';
  if (/socialboost/i.test(campaign)) return 'Social Boosting';
  if (/parent/i.test(campaign)) return 'Parents';
  const p = campaign.split('_');
  const lvl = LEVEL[(p[6] ?? '').toUpperCase()] ?? p[6] ?? '';
  const prog = (p[7] ?? '').replace(/\+|–|Copy/g, ' ').trim();
  return prog && !/^ALL$/i.test(prog) ? `${lvl} · ${prog}` : lvl || 'Other';
}

export const COUNTRY_CODE: Record<string, string> = {
  IN: 'India', ID: 'Indonesia', VN: 'Vietnam', TH: 'Thailand', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', US: 'United States', AE: 'UAE',
  UK: 'United Kingdom', GB: 'United Kingdom', CH: 'Switzerland', DE: 'Germany', FR: 'France', KZ: 'Kazakhstan', GE: 'Georgia', AM: 'Armenia',
  JO: 'Jordan', MM: 'Myanmar', KH: 'Cambodia', LK: 'Sri Lanka', BD: 'Bangladesh', NP: 'Nepal', PK: 'Pakistan', QA: 'Qatar', KW: 'Kuwait', OM: 'Oman', BH: 'Bahrain', EG: 'Egypt', ZA: 'South Africa', TR: 'Turkey', IT: 'Italy', ES: 'Spain', NL: 'Netherlands', BE: 'Belgium', PL: 'Poland', FI: 'Finland', IS: 'Iceland', JP: 'Japan', KR: 'South Korea', TW: 'Taiwan', HK: 'Hong Kong', NZ: 'New Zealand', PE: 'Peru', CL: 'Chile', AR: 'Argentina', EC: 'Ecuador', PA: 'Panama', CR: 'Costa Rica', GT: 'Guatemala', AU: 'Australia', BR: 'Brazil', CA: 'Canada', CO: 'Colombia', MX: 'Mexico', NG: 'Nigeria', KE: 'Kenya', RO: 'Romania', DO: 'Dominican Republic', SA: 'Saudi Arabia', PH: 'Philippines', MY: 'Malaysia', SG: 'Singapore', CN: 'China', ALL: 'All markets',
  TIER1: 'Tier 1 (global)', TIER2: 'Tier 2 (global)', TIER3: 'Tier 3 (global)',
};
/** Campaign country codes for a Funnel country name (the filter bar uses names): India → [IN], United Kingdom → [UK, GB]. */
export function countryCodes(name: string): string[] {
  const n = name.trim().toLowerCase();
  if (n === 'united arab emirates' || n === 'uae') return ['AE', 'UAE'];
  return Object.entries(COUNTRY_CODE).filter(([, v]) => v.toLowerCase() === n).map(([k]) => k);
}
export const marketName = (code: string) => (code ? COUNTRY_CODE[code.toUpperCase()] ?? code : '(no market)');

const LEVEL_TOK: Record<string, string> = { MAS: "Master's", SD: 'Swiss Diploma', BAC: 'Bachelor', BBA: 'BBA', PGD: 'Postgraduate Diploma', DIP: 'Diploma' };
/** Program target from the campaign name: level (+ programme) — e.g. "Master's · Culinary-Mgmt", "Parents", "All programmes". */
export function programOf(campaign: string): string {
  const p = campaign.split('_');
  if (!/^PL$/i.test(p[0] ?? '')) return campaign ? 'Legacy campaigns' : '';
  if (/parent/i.test(campaign)) return 'Parents (all programmes)';
  if (/retargeting/i.test(campaign)) return 'Retargeting (all programmes)';
  if (/socialboost/i.test(campaign)) return 'Social boosting';
  for (let i = 6; i <= 8 && i < p.length; i++) {
    const lvl = LEVEL_TOK[p[i].toUpperCase()];
    if (lvl) {
      const prog = (p[i + 1] ?? '').replace(/[+–]|Copy/g, ' ').trim();
      return prog && !/^(ALL|Programs?|Brand)$/i.test(prog) ? `${lvl} · ${prog}` : lvl;
    }
  }
  return 'All programmes';
}

/** Channel type: Google split into Search / Performance Max / YouTube / Display. */
export function subchannelOf(channel: string, campaign: string): string {
  if (channel !== 'Google') return channel;
  const t = (campaign.split('_')[2] ?? '').toUpperCase();
  if (/^PL_/i.test(campaign)) {
    if (t === 'GA') return 'Google Search';
    if (t === 'PMAX') return 'Google PMax';
    if (t === 'YT') return 'Google YouTube';
    if (t === 'GDN' || t === 'DG') return 'Google Display';
  }
  if (/pmax/i.test(campaign)) return 'Google PMax';
  if (/youtube|_yt/i.test(campaign)) return 'Google YouTube';
  if (/gdn|display|demand/i.test(campaign)) return 'Google Display';
  if (/search/i.test(campaign)) return 'Google Search';
  return campaign ? 'Google (other)' : 'Google (no campaign)';
}
