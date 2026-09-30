// AUTO LEAD TRACKING — scheduled (see netlify.toml). Runs shortly after each Salesforce
// export. It flags Netlify leads not found in the all-time CRM export and Slack-alerts
// each NEW lost lead exactly once (remembered in Netlify Blobs, so no repeats).
// The first run has an empty memory, so it reports the whole current backlog, then it's
// incremental. No lead PII in Slack — counts + a dashboard link only.
//
// Env vars:
//   NETLIFY_API_TOKEN   - read Netlify Forms on the 4 SEG sites
//   SLACK_BOT_TOKEN + SLACK_DM_USER_ID  - DM Phoebe (or SLACK_WEBHOOK_URL for a channel)
//   DASHBOARD_URL       - link included in the alert
//   ALERT_MIN_AGE_HOURS - min lead age before it can be called lost (default 24; covers the
//                         CRM export lag so a just-submitted lead isn't a false alarm)

import { getStore } from "@netlify/blobs";
import { getLeads, getCrmKeys, classify } from "./_lib.mjs";

const STORE = "seg-lead-tracking";
const KEY = "alerted_event_ids";

export default async () => {
  const minAgeH = Number(process.env.ALERT_MIN_AGE_HOURS || 24);

  const keys = await getCrmKeys();
  if (!keys) {
    await slack("⚠️ SEG Lead Tracking: no CRM source configured — cannot reconcile leads.");
    return json({ error: "no crm source" });
  }
  const leads = await getLeads();
  const real = leads.filter((l) => !l.is_test);
  const { lost } = classify(real, keys);

  // Already-alerted memory (survives runs). Falls back to no-memory if Blobs is unavailable.
  let store = null, seen = new Set();
  try {
    store = getStore(STORE);
    const raw = await store.get(KEY);
    if (raw) seen = new Set(JSON.parse(raw));
  } catch (e) { console.error("Blobs unavailable:", e?.message); }

  const now = Date.now();
  const ageH = (iso) => (now - new Date(iso).getTime()) / 3600000;

  // New lost leads = lost, old enough to be confirmed (past export lag), not yet alerted.
  const fresh = lost.filter((l) => ageH(l.created_at) >= minAgeH && l.event_id && !seen.has(l.event_id));

  if (fresh.length) {
    const link = process.env.DASHBOARD_URL ? `\n📊 Full list + contact details: ${process.env.DASHBOARD_URL}` : "";
    const plural = fresh.length === 1 ? "lead" : "leads";
    const first = seen.size === 0; // first ever run → whole backlog
    const heading = first
      ? `:mag: *SEG Lead Tracking — initial report (all lost leads to date)*\n*${fresh.length}* lost ${plural} not found in CRM.`
      : `:rotating_light: *SEG Lead Tracking — ${fresh.length} new lost ${plural} detected*`;
    await slack(
      `${heading}\n` +
      `By school: ${fmt(tally(fresh, (l) => l.brand))}\n` +
      `By channel: ${fmt(tally(fresh, (l) => l.source || "—"))}` +
      link
    );
    if (store) {
      for (const l of fresh) seen.add(l.event_id);
      try { await store.set(KEY, JSON.stringify([...seen])); } catch (e) { console.error("Blobs write:", e?.message); }
    }
  }
  return json({ lost_total: lost.length, newly_alerted: fresh.length, remembered: seen.size });
};

function tally(arr, fn) {
  const m = {};
  arr.forEach((x) => { const k = fn(x) || "—"; m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
const fmt = (pairs) => pairs.map(([k, v]) => `${k} ${v}`).join(", ") || "0";
const json = (o) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });

async function slack(text) {
  const token = process.env.SLACK_BOT_TOKEN, user = process.env.SLACK_DM_USER_ID, hook = process.env.SLACK_WEBHOOK_URL;
  if (token && user) {
    const r = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8", authorization: "Bearer " + token },
      body: JSON.stringify({ channel: user, text }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) console.error("Slack error:", j.error || r.status);
    return;
  }
  if (hook) {
    await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    return;
  }
  console.log("[no Slack config]\n" + text);
}
