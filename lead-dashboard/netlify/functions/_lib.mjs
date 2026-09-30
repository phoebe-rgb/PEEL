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
  return (l.email || "").endsWith("@email.com") ||
         name.startsWith("test") || /pierst/i.test(name) ||
         (l.page_url || "").includes("netlify.app");
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

// Read the Salesforce/CRM export (published Google Sheet CSV or any CSV URL) and
// return a lowercase Set of every UUID found (the Submission Ids that reached the CRM).
// Returns null if SALESFORCE_CSV_URL is not configured.
export async function getCrmIds() {
  const url = process.env.SALESFORCE_CSV_URL;
  if (!url) return null;
  const r = await fetch(url);
  if (!r.ok) throw new Error("SALESFORCE_CSV_URL -> " + r.status);
  const text = await r.text();
  return new Set((text.match(UUID) || []).map((s) => s.toLowerCase()));
}

// Split leads into matched / lost using the CRM id set. Leads younger than lagDays
// are held as "pending" (CRM export lag) instead of counted as lost.
export function classify(leads, crmIds, lagDays = 2) {
  const now = Date.now();
  const matched = [], lost = [], pending = [];
  for (const l of leads) {
    if (crmIds.has((l.event_id || "").toLowerCase())) matched.push(l);
    else if ((now - new Date(l.created_at).getTime()) / 86400000 < lagDays) pending.push(l);
    else lost.push(l);
  }
  return { matched, lost, pending };
}
