// On-demand JSON API: current Netlify leads + (if configured) their CRM match status.
// Used by the optional dashboard page. The auto-tracking/alert lives in lost-lead-alert.mjs.
import { getLeads, getCrmIds, classify } from "./_lib.mjs";

export default async () => {
  const leads = await getLeads();
  const crmIds = await getCrmIds();
  let summary = null;
  if (crmIds) {
    const real = leads.filter((l) => !l.is_test);
    const { matched, lost, pending } = classify(real, crmIds);
    summary = { total: real.length, matched: matched.length, lost: lost.length, pending: pending.length };
    const set = crmIds;
    for (const l of leads) l.in_crm = set.has((l.event_id || "").toLowerCase());
  }
  return new Response(JSON.stringify({ generated_at: new Date().toISOString(), crm_connected: !!crmIds, summary, leads }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};
