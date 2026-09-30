// AUTO LEAD TRACKING — runs on a schedule (see netlify.toml: "0 8 * * *").
// It pulls Netlify Forms leads, reads the CRM (Salesforce) Submission Ids, matches on
// event_id, and posts a Slack alert listing leads that never reached the CRM (= lost leads).
// No human has to open anything — this is the notification Funnel can't do.
//
// Required env vars:
//   NETLIFY_API_TOKEN   - Netlify personal access token (read Forms on the 4 SEG sites)
//   SALESFORCE_CSV_URL  - URL of the Salesforce lead export (published Google Sheet CSV,
//                         or any CSV containing the Submission Id / event_id column)
//   SLACK_WEBHOOK_URL    - Slack Incoming Webhook for the alert channel
// Optional:
//   ALERT_LAG_DAYS      - how many days to wait before calling a lead "lost" (default 2)
//   ALERT_WINDOW_DAYS   - how far back to look for newly-confirmed lost leads (default 3)

import { getLeads, getCrmIds, classify } from "./_lib.mjs";

export default async () => {
  const lag = Number(process.env.ALERT_LAG_DAYS || 2);
  const windowDays = Number(process.env.ALERT_WINDOW_DAYS || 3);
  const hook = process.env.SLACK_WEBHOOK_URL;

  const leads = await getLeads();
  const crmIds = await getCrmIds();
  if (!crmIds) {
    await slack(hook, "⚠️ Lead tracking không chạy được: chưa cấu hình `SALESFORCE_CSV_URL` (nguồn lead CRM).");
    return new Response("no crm source", { status: 200 });
  }

  const real = leads.filter((l) => !l.is_test);
  const { lost, matched, pending } = classify(real, crmIds, lag);

  // Newly-confirmed lost: past the lag window, but created within the last windowDays.
  const now = Date.now();
  const fresh = lost.filter((l) => {
    const age = (now - new Date(l.created_at).getTime()) / 86400000;
    return age >= lag && age <= lag + windowDays;
  });

  const byBrand = (arr) => arr.reduce((m, l) => ((m[l.brand] = (m[l.brand] || 0) + 1), m), {});
  const total = real.length;
  const lostRate = total ? ((lost.length / (total - pending.length)) * 100).toFixed(1) : "0";

  const lines = [];
  lines.push(`*🔎 SEG Lead Tracking — ${new Date().toISOString().slice(0, 10)}*`);
  lines.push(`Netlify: *${total}* lead · Vào CRM: *${matched.length}* · Mất: *${lost.length}* (${lostRate}%) · Chờ (<${lag}d): ${pending.length}`);
  lines.push(`Mất theo trường: ${fmt(byBrand(lost))}`);
  if (fresh.length) {
    lines.push(`\n*⛔️ ${fresh.length} lead vừa xác nhận MẤT (cần liên hệ lại):*`);
    for (const l of fresh.slice(0, 20)) {
      lines.push(`• [${l.brand}] ${(l.first_name + " " + l.last_name).trim()} — ${l.email} ${l.phone ? "· " + l.phone : ""} · ${l.source} · ${l.created_at.slice(0, 10)}`);
    }
    if (fresh.length > 20) lines.push(`…và ${fresh.length - 20} lead nữa.`);
  } else {
    lines.push(`\n✅ Không có lead mới bị mất trong ${windowDays} ngày qua.`);
  }

  await slack(hook, lines.join("\n"));
  return new Response(JSON.stringify({ total, matched: matched.length, lost: lost.length, fresh: fresh.length }), {
    headers: { "content-type": "application/json" },
  });
};

function fmt(o) {
  return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") || "0";
}
async function slack(hook, text) {
  if (!hook) { console.log("[no SLACK_WEBHOOK_URL]\n" + text); return; }
  await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
}
