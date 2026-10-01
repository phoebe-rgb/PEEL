// SEG negative-keyword review (same method as the twice-weekly review task): only search terms that fall into one of six
// reason categories are suggested; brand names (incl. misspellings) and real SEG programmes are protected; anything
// already on the SEG_Negative_Keywords baseline or already Excluded in Google Ads is skipped. Ambiguous → not flagged.

export type Category = 'Competitor' | 'Wrong geography' | 'Free / low-fee intent' | 'Fee shopper' | 'Too broad / low intent' | 'Off-product';
export type MatchType = 'Broad' | 'Phrase' | 'Exact';
export interface BaseNeg { kw: string; match: string; category: string; why: string }
export interface TermRow { school: string; term: string; status: string; campaign: string; keyword: string; impr: number; clicks: number; cost: number; conv: number }
export interface NegSuggestion {
  school: string; category: Category; negative: string; match: MatchType; formatted: string; reason: string;
  terms: string[]; impr: number; clicks: number; cost: number; conv: number; campaigns: string[];
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9&+ ]/g, ' ').replace(/\s+/g, ' ').trim();

// ---- protected -----------------------------------------------------------------------------------------------
// Brand names of every school, with the usual misspellings: never a negative, in any school's account.
const BRAND = new RegExp([
  String.raw`\bc[ae]{1,2}s[ae]r\s*ri[tz]{1,2}s?\b`, String.raw`\bri[tz]{1,2}\s*colleges?\b`, String.raw`\bcrcs\b`,
  String.raw`\bshms\b`, String.raw`swiss\s*hot[ae]l\s*mana?ge?ment\s*school`, String.raw`\bswiss\s*hotel\s*school\b`,
  String.raw`\bhim\b`, String.raw`hot[ae]l\s*institut[e]?\s*(of\s*)?montr[ae]ux`, String.raw`\bhim\s*business`,
  String.raw`\bcaas\b`, String.raw`culinary\s*arts?\s*acad[ae]m(y|ie)`, String.raw`culinary\s*arts?\s*(of\s*)?switzerland`,
  String.raw`swiss\s*education\s*group`, String.raw`\bseg\b`,
].join('|'), 'i');

// Real SEG programmes per school: protect "too broad" / "off-product" calls on these (a competitor, a wrong
// country or a fee search still counts, e.g. "masters in culinary arts in italy").
const PROGRAM: Record<string, RegExp> = {
  SHMS: /hospitality|hotel management|hotel school|food (and|&) beverage|\bf ?& ?b\b|events? management|resort management|luxury management|restaurant manager course|short courses in europe|study in switzerland/,
  HIM: /\bbba\b|international (hospitality|business)|\bfinance\b|\bmarketing\b|business school switzerland|best business schools in europe|best countries to study in|hospitality/,
  CAAS: /culinary|pastry|patisserie|vegetarian|plant based|bachelor|master|diploma|11 week|certificate|chef school|cooking school|swiss culinary/,
  CRCS: /hospitality|hotel management|business|\bbba\b|tourism/,
};

// ---- categories ------------------------------------------------------------------------------------------------

const COMPETITORS: [RegExp, string, MatchType][] = [
  [/\behl\b/, 'ehl', 'Broad'], [/\bles roches\b/, 'les roches', 'Phrase'], [/\bglion\b/, 'glion', 'Broad'], [/\bbhms\b/, 'bhms', 'Broad'],
  [/\bgihe\b/, 'gihe', 'Broad'], [/\bst\.? ?gall(en)?\b|\bsaint gall(en)?\b/, 'st gallen', 'Broad'], [/\bcordon( bleu)?\b/, 'le cordon bleu', 'Broad'],
  [/\bducasse\b/, 'ecole ducasse', 'Broad'], [/\bessec\b/, 'essec', 'Phrase'], [/\bedhec\b/, 'edhec', 'Phrase'], [/\bneoma\b/, 'neoma', 'Phrase'],
  [/\bkedge\b/, 'kedge', 'Phrase'], [/\bku ?leuven\b/, 'ku leuven', 'Phrase'], [/\bmcgill\b/, 'mcgill', 'Phrase'], [/\bssbm\b/, 'ssbm', 'Broad'],
  [/\bhes( so)?\b/, 'hes', 'Broad'], [/\bimi\b/, 'imi switzerland', 'Phrase'], [/\bmarangoni\b/, 'istituto marangoni', 'Phrase'], [/\bvatel\b/, 'vatel', 'Broad'],
  [/\bsommet\b/, 'sommet', 'Broad'], [/\bpaul bocuse\b|\bbocuse\b/, 'paul bocuse', 'Phrase'], [/\bferrandi\b/, 'ferrandi', 'Broad'], [/\bescoffier\b/, 'escoffier', 'Broad'],
  [/\blenotre\b/, 'lenotre', 'Broad'], [/\bculinary institute of america\b/, 'culinary institute of america', 'Phrase'], [/\bjohnson (and|&) wales\b/, 'johnson and wales', 'Phrase'],
  [/\beth zurich\b|\bepfl\b/, 'eth zurich', 'Phrase'], [/\brmit\b/, 'rmit', 'Broad'], [/\boxford\b/, 'oxford', 'Broad'], [/\bcambridge\b/, 'cambridge', 'Broad'], [/\bharvard\b/, 'harvard', 'Broad'],
  [/\bihtti\b/, 'ihtti', 'Broad'], [/\bbelvoir\b/, 'belvoir', 'Broad'], [/\bimsg\b/, 'imsg geneve', 'Phrase'], [/\bxenia\b/, 'xenia international institute', 'Phrase'],
  [/\bdunster\b/, 'dunster business school', 'Phrase'], [/\bmontreux business school\b/, 'montreux business school', 'Phrase'], [/\bhso\b/, 'hso basel', 'Phrase'],
  [/\bifm\b/, 'ifm suisse', 'Phrase'], [/\bbrix academy\b/, 'brix academy', 'Phrase'], [/\bavis institute\b/, 'avis institute of baking', 'Phrase'],
  [/\boberoi\b/, 'oberoi centre of learning', 'Phrase'], [/\bihm\b/, 'ihm', 'Broad'], [/\bgeneva business school\b/, 'geneva business school', 'Phrase'],
  [/\beu business school\b/, 'eu business school', 'Phrase'], [/\bswiss school of business\b/, 'swiss school of business and management', 'Phrase'],
  [/\buniversit(y|e|at) (of )?(geneva|geneve|zurich|bern|lausanne|basel|lucerne|fribourg|neuchatel)\b/, '', 'Phrase'],
];

const GEO = 'dubai|abu dhabi|uae|china|australia|india|uk|england|london|cyprus|germany|france|paris|lyon|italy|spain|canada|usa|america|singapore|malaysia|ireland|netherlands|japan|korea|thailand|bali|dublin|toronto|vancouver|sydney|melbourne|new zealand|hungary|austria|portugal|qatar|saudi|egypt|turkey|russia|kenya|nigeria|south africa|philippines|vietnam|indonesia|sri lanka|nepal|pakistan|bangladesh|asia';
const CITY_ALONE = /\b(dubai|london|paris|lyon|munnar|mumbai|delhi|bangalore|bengaluru|pune|hyderabad|chennai|kolkata|jaipur|goa|chandigarh|manipal|singapore|sydney|melbourne|toronto|vancouver|dublin|jakarta|hanoi|ho chi minh)\b/;

const TOO_BROAD: [RegExp, string][] = [
  [/\bstudy abroad\b/, 'study abroad'], [/\bstud(y|ent) visa\b/, 'study visa'], [/\bwork permit\b/, 'work permit'],
  [/\buniversit(y|ies) in switzerland\b/, 'university in switzerland'], [/\bpublic universit/, 'public universities in switzerland'],
  [/\binternships? in europe\b/, 'internships in europe'], [/\bcolleges for indian students\b/, 'colleges for indian students'],
  [/\bgraduation in switzerland\b/, 'graduation in switzerland'], [/\bcan i get a degree in\b/, 'can i get a degree in'],
  [/\b(best|top) (finance|universities|colleges) (universities )?in (europe|the world)\b/, ''], [/\branking of universities\b/, 'ranking of universities'],
];
const OFF_PRODUCT: [RegExp, string, MatchType][] = [
  [/\bbts\b/, 'bts', 'Broad'], [/\berasmus\b/, 'erasmus', 'Broad'], [/\bsummer (school|camp)s?\b/, 'summer school', 'Phrase'],
  [/\b100 ?(%|percent)? placement\b/, '100 placement', 'Phrase'], [/\bparcoursup\b/, 'formation hors parcoursup', 'Phrase'],
  [/\b(jobs?|vacanc(y|ies)|hiring|recruit\w*|salary|salaries)\b/, '', 'Phrase'], [/\brecipes?\b/, 'recipe', 'Broad'],
  [/\b(online|free online) (cooking|baking|culinary|hotel management) (course|class)/, '', 'Phrase'],
  [/\bcooking class(es)?\b|\bbaking class(es)?\b|\bhobby\b/, '', 'Phrase'],
];

/** Classify one search term for one school; null = not a negative (protected, ambiguous or simply relevant). */
export function classify(school: string, raw: string): { category: Category; negative: string; match: MatchType; reason: string } | null {
  const t = norm(raw);
  if (!t || BRAND.test(t)) return null;
  const program = PROGRAM[school]?.test(t) ?? false;
  for (const [re, neg, match] of COMPETITORS) {
    const m = t.match(re);
    if (m) return { category: 'Competitor', negative: neg || m[0], match, reason: `Competing school (${m[0]})` };
  }
  if (!/switzerland|swiss|suisse|schweiz|svizzera/.test(t)) {
    const g = t.match(new RegExp(`\\b(in|at|near|from)\\s+(${GEO})\\b`));
    if (g && g[1] !== 'from') {
      // one negative per country ("in italy") rather than one per query
      return { category: 'Wrong geography', negative: `in ${g[2]}`, match: 'Phrase', reason: `Study in ${g[2]}, not Switzerland` };
    }
    const c = t.match(CITY_ALONE);
    if (c && !/\bfrom\s+\w+$/.test(t.slice(0, c.index))) return { category: 'Wrong geography', negative: c[1], match: 'Broad', reason: `Searches a school in ${c[1]}` };
    if (/\bstudy abroad\b/.test(t)) return { category: 'Too broad / low intent', negative: 'study abroad', match: 'Phrase', reason: 'Generic study-abroad search' };
    if (/\b(course|courses|program|programme|masters?) abroad\b/.test(t)) return { category: 'Wrong geography', negative: (t.match(/\b\w+ abroad\b/) ?? ['course abroad'])[0], match: 'Phrase', reason: 'Generic abroad intent' };
  }
  if (/\bfree\b|\blow (fee|fees|cost)\b|\bcheap(est)?\b|\bwithout fees?\b/.test(t)) {
    const m = t.match(/\bfree\b|\blow (fee|fees|cost)\b|\bcheap(est)?\b|\bwithout fees?\b/)!;
    return { category: 'Free / low-fee intent', negative: m[0].includes(' ') ? m[0] : m[0], match: m[0].includes(' ') ? 'Phrase' : 'Broad', reason: 'Free / low-fee study search' };
  }
  if (/\bfees?\b|\bfee structure\b|\bprice\b/.test(t)) {
    const m = t.match(/\bfees?\b|\bfee structure\b|\bprice\b/)!;
    return { category: 'Fee shopper', negative: m[0] === 'fee' ? 'fees' : m[0], match: 'Broad', reason: 'Price-shopping search' };
  }
  if (school === 'CAAS' && /\b(1|2|3|4|5|6|one|two|three|four|five|six) ?months? (cooking|culinary|baking|pastry|chef)\b/.test(t)) {
    return { category: 'Off-product', negative: t, match: 'Exact', reason: 'No 3- or 6-month CAAS programme (6 months = internship length)' };
  }
  if (program) return null;
  for (const [re, neg] of TOO_BROAD) { const m = t.match(re); if (m) return { category: 'Too broad / low intent', negative: neg || m[0], match: 'Phrase', reason: 'Generic search, no programme intent' }; }
  for (const [re, neg, match] of OFF_PRODUCT) { const m = t.match(re); if (m) return { category: 'Off-product', negative: neg || m[0], match, reason: 'Real intent but not an SEG programme' }; }
  return null;
}

/** Is the term (or a suggested negative) already covered by the school's baseline list? */
export function covered(base: BaseNeg[] | undefined, raw: string): boolean {
  if (!base?.length) return false;
  const t = ` ${norm(raw)} `;
  return base.some((b) => {
    const k = norm(b.kw.replace(/^["[]|["\]]$/g, ''));
    if (!k) return false;
    if (/^\[.*\]$/.test(b.kw.trim()) || /exact/i.test(b.match)) return t.trim() === k;
    if (/^".*"$/.test(b.kw.trim()) || /phrase/i.test(b.match)) return t.includes(` ${k} `);
    return k.split(' ').every((w) => t.includes(` ${w} `)); // broad: every word present
  });
}

export const formatNeg = (kw: string, m: MatchType) => (m === 'Exact' ? `[${kw}]` : m === 'Phrase' ? `"${kw}"` : kw);

/** The review: rows in the window → one suggestion per (school, negative). */
export function reviewNegatives(rows: TermRow[], baseline: Record<string, BaseNeg[]>): { suggestions: NegSuggestion[]; reviewed: number; skippedBaseline: number; skippedExcluded: number } {
  const terms = new Map<string, TermRow & { campaigns: Set<string> }>();
  let skippedExcluded = 0;
  for (const r of rows) {
    if (/excluded/i.test(r.status)) { skippedExcluded++; continue; }
    if (!r.term || r.impr < 1) continue;
    const k = `${r.school}\u0001${norm(r.term)}`;
    const x = terms.get(k) ?? { ...r, term: norm(r.term), impr: 0, clicks: 0, cost: 0, conv: 0, campaigns: new Set<string>() };
    x.impr += r.impr; x.clicks += r.clicks; x.cost += r.cost; x.conv += r.conv; x.campaigns.add(r.campaign);
    terms.set(k, x);
  }
  const out = new Map<string, NegSuggestion>();
  let skippedBaseline = 0;
  for (const x of terms.values()) {
    if (covered(baseline[x.school], x.term)) { skippedBaseline++; continue; }
    const c = classify(x.school, x.term);
    if (!c) continue;
    if (covered(baseline[x.school], c.negative)) { skippedBaseline++; continue; }
    const k = `${x.school}\u0001${c.match}\u0001${c.negative}`;
    const s = out.get(k) ?? { school: x.school, ...c, formatted: formatNeg(c.negative, c.match), terms: [], impr: 0, clicks: 0, cost: 0, conv: 0, campaigns: [] };
    s.terms.push(x.term); s.impr += x.impr; s.clicks += x.clicks; s.cost += x.cost; s.conv += x.conv;
    for (const cp of x.campaigns) if (!s.campaigns.includes(cp)) s.campaigns.push(cp);
    out.set(k, s);
  }
  const order: Category[] = ['Competitor', 'Wrong geography', 'Free / low-fee intent', 'Fee shopper', 'Too broad / low intent', 'Off-product'];
  const suggestions = [...out.values()].sort((a, b) => a.school.localeCompare(b.school) || order.indexOf(a.category) - order.indexOf(b.category) || b.impr - a.impr);
  return { suggestions, reviewed: terms.size, skippedBaseline, skippedExcluded };
}
