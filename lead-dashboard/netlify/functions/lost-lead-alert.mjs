// AUTO LEAD TRACKING — scheduled (see netlify.toml). Runs after the Salesforce export.
// Reports ONLY the previous day's lost leads (Netlify leads created yesterday that are not
// in the all-time CRM export). Sends a Slack DM to Phoebe with counts + a dashboard link.
// No lead PII goes to Slack — contact details live in the password-protected dashboard.
//
// Env vars:
//   NETLIFY_API_TOKEN  - read Netlify Forms on the 4 SEG sites
//   SALESFORCE_CSV_URL - all-time Salesforce lead export (published Google Sheet CSV; date+email)
//   SLACK_BOT_TOKEN    - Slack bot token (xoxb-…) with chat:write + im:write
//   SLACK_DM_USER_ID   - Phoebe's Slack member ID (e.g. U0123ABC) to DM
//   DASHBOARD_URL      - link to the password-protected dashboard
//   ALERT_TZ           - timezone for "yesterday" (default Asia/Ho_Chi_Minh)
//   SLACK_WEBHOOK_URL  - optional fallback if no bot token (posts to a channel, not a DM)

import { getLeads, getCrmKeys, classify } from "./_lib.mjs";

const ymd = (d, tz) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export default async () => {
  const tz = process.env.ALERT_TZ || "Asia/Ho_Chi_Minh";
  const yesterday = ymd(new Date(Date.now() - 86400000), tz);

  const keys = await getCrmKeys();
  if (!keys) {
    await slack("⚠️ SEG Lead Tracking: no CRM source configured — cannot reconcile leads.");
    return json({ error: "no crm source" });
  }
  const leads = await getLeads();
  const real = leads.filter((l) => !l.is_test);
  const { lost } = classify(real, keys);

  // Only yesterday's lost leads (by the lead's created date in ALERT_TZ).
  const fresh = lost.filter((l) => ymd(new Date(l.created_at), tz) === yesterday);

  if (!fresh.length) return json({ yesterday, new_lost: 0, note: "no alert sent" });

  const bySchool = tally(fresh, (l) => l.brand);
  const byChannel = tally(fresh, (l) => l.source || "—");
  const link = process.env.DASHBOARD_URL ? `\n📊 Full list + contact details: ${process.env.DASHBOARD_URL}` : "";
  const plural = fresh.length === 1 ? "lead" : "leads";
  const text =
    `:mag: *SEG Lead Tracking — ${yesterday}*\n` +
    `*${fresh.length}* new lost ${plural} yesterday (not found in CRM).\n` +
    `By school: ${fmt(bySchool)}\n` +
    `By channel: ${fmt(byChannel)}` +
    link;

  await slack(text);
  return json({ yesterday, new_lost: fresh.length });
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
