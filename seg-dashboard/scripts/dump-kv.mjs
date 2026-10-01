import { writeFileSync, mkdirSync } from "node:fs";
const ACCOUNT = "bbc8c9f67b33609ec79d39279749024d";
const KV_NS = "003c141e9f4545afb5a6f9cbabc20415";
const OUT = "/tmp/claude-0/-home-user-PEEL/0f087444-5503-5e31-a0f7-208e99d64629/scratchpad/seg-dashboard-src/kv";
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) { console.error("NO_TOKEN"); process.exit(2); }
const base = "https://api.cloudflare.com/client/v4";
const auth = { Authorization: `Bearer ${token}` };
mkdirSync(OUT, { recursive: true });

const keys = ["live","meta","metafreq","bench","setup","keywords","budgetlive","negbase","actions","comments","notes:2026-W39"];
for (const key of keys) {
  const r = await fetch(`${base}/accounts/${ACCOUNT}/storage/kv/namespaces/${KV_NS}/values/${encodeURIComponent(key)}`, { headers: auth });
  if (r.status !== 200) { console.log(key.padEnd(16), "HTTP", r.status); continue; }
  const txt = await r.text();
  const fn = key.replace(/[^A-Za-z0-9._-]/g,"_") + ".json";
  writeFileSync(`${OUT}/${fn}`, txt);
  // report top-level shape
  let shape="";
  try { const j=JSON.parse(txt);
    if (Array.isArray(j)) shape=`array[${j.length}]`;
    else if (j && typeof j==="object") shape="obj{"+Object.keys(j).slice(0,12).join(",")+"}";
    else shape=typeof j;
  } catch { shape="(non-json)"; }
  console.log(key.padEnd(16), String(txt.length).padStart(8), "bytes ->", fn, "|", shape);
}
