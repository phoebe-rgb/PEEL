import { writeFileSync, mkdirSync } from "node:fs";
const ACCOUNT = "bbc8c9f67b33609ec79d39279749024d";
const SCRIPT = "seg-dashboard";
const OUT = "/tmp/claude-0/-home-user-PEEL/0f087444-5503-5e31-a0f7-208e99d64629/scratchpad/seg-dashboard-src";
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) { console.error("NO_TOKEN"); process.exit(2); }
const base = "https://api.cloudflare.com/client/v4";
const auth = { Authorization: `Bearer ${token}` };
mkdirSync(OUT, { recursive: true });

const r = await fetch(`${base}/accounts/${ACCOUNT}/workers/scripts/${SCRIPT}`, { headers: auth });
const ct = r.headers.get("content-type")||"";
console.log("HTTP", r.status, "ct", ct);
const fd = await r.formData();
for (const [name, val] of fd.entries()) {
  let buf, fn;
  if (typeof val === "string") { buf = Buffer.from(val, "utf8"); fn = name; }
  else { buf = Buffer.from(await val.arrayBuffer()); fn = val.name || name; }
  fn = fn.replace(/[^A-Za-z0-9._/-]/g, "_");
  const p = `${OUT}/${fn}`;
  mkdirSync(p.split("/").slice(0,-1).join("/")||OUT, { recursive: true });
  writeFileSync(p, buf);
  console.log("PART", name, "->", fn, buf.length, "bytes");
}
