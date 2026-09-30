// Shared helpers: pull Netlify Forms submissions and the Salesforce/CRM id set.
// Requires env NETLIFY_API_TOKEN (a Netlify personal access token with access to the SEG sites).

const API = "https://api.netlify.com/api/v1";

// The four live SEG production sites (id : brand). Override with env SITE_MAP (JSON) if needed.
export const DEFAULT_SITES = {
  "36b518a4-b08c-48fb-89f0-2b65d738e044": "CAAS", // seg-caas  lp.culinaryartsswitzerland.com
  "0643bf0d-7d4b-4515-87f5-c87ad23de932": "SHMS", // seg-shms  lp.shms.com
  "a29a7635-f8f8-409c-a7a1-825eceb01373": "HIM",  // seg-him   lp.him-business-school.com
  "45589786-08f3-486e-8735-11dd3c6f4e45": "CRCS", // seg-crcs  lp.cesarritzcolleges.edu
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function siteMap() {
  if (process.env.SITE_MAP) { try { return JSON.parse(process.env.SITE_MAP); } catch {} }
  return DEFAULT_SITES;
}

async function nf(path) {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) throw new Error("NETLIFY_API_TOKEN is not set");
  const r = await fetch(API + path, { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) throw new Error(`Netlify API ${path} -> ${r.status}`);
  return r.json();
}

function isTest(l) {
  const name = (l.first_name + " " + l.last_name).trim().toLowerCase();
  const email = (l.email || "").toLowerCase();
  return name.includes("test") || email.includes("test") ||
         email.endsWith("@email.com") || email.includes("example.com") ||
         /pierst/i.test(name) || (l.page_url || "").includes("netlify.app");
}

function slim(sub, brand) {
  const d = sub.data || {};
  const us = (d.utm_source || "").trim();
  const lis = (d.lead_initial_sources || d.lead_initial_source || "").trim();
  let source = us || lis || "Direct";
  if (/^direct(_lead)?$/i.test(source)) source = "Direct";
  const l = {
    brand,
    event_id: (d.event_id || "").trim(),
    created_at: sub.created_at,
    first_name: (d.first_name || sub.first_name || "").trim(),
    last_name: (d.last_name || sub.last_name || "").trim(),
    email: d.email || sub.email || "",
    phone: d.phone || "",
    program: d.program || "",
    market: d.market || "",
    country: d.country || "",
    utm_source: us,
    utm_campaign: d.utm_campaign || "",
    source,
    page_url: d.page_url || "",
  };
  l.is_test = isTest(l);
  delete l.page_url;
  return l;
}

// Pull every admissions-form submission across the four sites.
export async function getLeads() {
  const sites = siteMap();
  const out = [];
  for (const [siteId, brand] of Object.entries(sites)) {
    const forms = await nf(`/sites/${siteId}/forms`);
    for (const form of forms) {
      // only real admissions forms (skip webinar / empty test forms if desired)
      let page = 1;
      while (true) {
        const subs = await nf(`/forms/${form.id}/submissions?per_page=100&page=${page}`);
        if (!subs.length) break;
        for (const s of subs) out.push(slim(s, brand));
        if (subs.length < 100) break;
        page++;
      }
    }
  }
  out.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return out;
}

const EMAIL = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi;

// Read the Salesforce/CRM export and return the keys that prove a lead reached the CRM:
//   { emails:Set, ids:Set }  (both lowercased)
// The current export ("SEG - New Lead from Netify" → tab "Funnel data") has Date+Email,
// so matching is by EMAIL. If a Submission Id column is added later, its UUIDs are picked
// up automatically and used as a stronger key. Returns null if SALESFORCE_CSV_URL is unset.
//
// NOTE: the Google Sheet's default CSV export is the FIRST tab. Point SALESFORCE_CSV_URL at
// the "Funnel data" tab explicitly, e.g.:
//   https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=1301696085
// and share the sheet "anyone with the link (Viewer)" or publish that tab, so the function
// can fetch it without Google auth.
// SALESFORCE_CSV_URL may hold several CSV URLs separated by comma or newline. All are
// fetched and merged, so you can combine an all-time historical baseline export with the
// continuously-updating "new leads" export and always check a lead against the full past.
// Default CRM sources (Google Sheets published/shared as CSV):
//  1) "SEG - New Lead from Netify" (Funnel data tab) — new leads, updates continuously
//  2) "SEG_CRM_baseline_alltime" — all-time historical lead emails (returning-applicant memory)
// Both sheets must be shared "Anyone with the link (Viewer)" so the function can read them.
// Override by setting SALESFORCE_CSV_URL (comma-separated) in Netlify env.
const DEFAULT_CRM_CSV = [
  "https://docs.google.com/spreadsheets/d/1bAvxn13rUsclKOEKe_B0gRVWXbdQDn5vymPba0sBmtM/export?format=csv&gid=1301696085",
  "https://docs.google.com/spreadsheets/d/1vU6ETa6cmWLXP3XnF7epGL2wG3be2RItQCDJSZQ9CfU/export?format=csv&gid=285924473",
].join(",");

export async function getCrmKeys() {
  const raw = process.env.SALESFORCE_CSV_URL || DEFAULT_CRM_CSV;
  const urls = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  if (!urls.length) return null;
  const emails = new Set(), ids = new Set();
  for (const url of urls) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("SALESFORCE_CSV_URL (" + url.slice(0, 60) + "…) -> " + r.status);
    const text = await r.text();
    for (const e of text.match(EMAIL) || []) emails.add(e.toLowerCase());
    for (const u of text.match(UUID) || []) ids.add(u.toLowerCase());
  }
  return { emails, ids };
}

// Split leads into matched / lost against the CRM keys.
// A lead is matched if its email (or event_id, when the export carries one) is in the
// all-time CRM export; otherwise it is lost. (No pending/lag bucket — lost is lost.)
export function classify(leads, keys) {
  const matched = [], lost = [];
  for (const l of leads) {
    const hit = keys.emails.has((l.email || "").trim().toLowerCase()) ||
                keys.ids.has((l.event_id || "").toLowerCase());
    (hit ? matched : lost).push(l);
  }
  return { matched, lost };
}
