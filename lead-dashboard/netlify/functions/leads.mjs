// On-demand JSON API: current Netlify leads + (if configured) their CRM match status.
// Used by the optional dashboard page. The auto-tracking/alert lives in lost-lead-alert.mjs.
import { getLeads, getCrmKeys, classify } from "./_lib.mjs";

export default async () => {
  const leads = await getLeads();
  const keys = await getCrmKeys();
  let summary = null, crm_count = 0;
  if (keys) {
    crm_count = keys.emails.size;
    const real = leads.filter((l) => !l.is_test);
    const { matched, unqualified, lost } = classify(real, keys);
    summary = { total: real.length, matched: matched.length, unqualified: unqualified.length, lost: lost.length };
    for (const l of leads)
      l.in_crm = keys.emails.has((l.email || "").trim().toLowerCase()) || keys.ids.has((l.event_id || "").toLowerCase());
  }
  return new Response(JSON.stringify({ generated_at: new Date().toISOString(), crm_connected: !!keys, crm_count, summary, leads }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};
