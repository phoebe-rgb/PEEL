var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/index.ts
var json = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function same(x, y) {
  const a = new TextEncoder().encode(x), b = new TextEncoder().encode(y);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
__name(same, "same");
var COOKIE = "seg_key";
function keyed(req, env) {
  if (!env.DASH_KEY || env.DASH_KEY.length < 24) return false;
  const c = (req.headers.get("cookie") ?? "").split(/;\s*/).find((x) => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? "";
  return same(decodeURIComponent(c), env.DASH_KEY);
}
__name(keyed, "keyed");
function authorised(req, env) {
  if (!env.DASH_PASSWORD) return false;
  const h = req.headers.get("authorization") ?? "";
  if (!h.startsWith("Basic ")) return false;
  let pass = "";
  try {
    pass = atob(h.slice(6)).split(":").slice(1).join(":");
  } catch {
    return false;
  }
  const a = new TextEncoder().encode(pass), b = new TextEncoder().encode(env.DASH_PASSWORD);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
__name(authorised, "authorised");
function userOf(req) {
  const h = req.headers.get("authorization") ?? "";
  try {
    return h.startsWith("Basic ") ? atob(h.slice(6)).split(":")[0].slice(0, 40) : "";
  } catch {
    return "";
  }
}
__name(userOf, "userOf");
var index_default = {
  async fetch(req, env) {
    const localDev = env.DEV_NO_AUTH === "1" && new URL(req.url).hostname === "localhost";
    const url0 = new URL(req.url);
    const k = url0.searchParams.get("k");
    if (k !== null && env.DASH_KEY && env.DASH_KEY.length >= 24 && same(k, env.DASH_KEY)) {
      url0.searchParams.delete("k");
      return new Response(null, { status: 302, headers: { location: url0.pathname + url0.search + url0.hash, "set-cookie": `${COOKIE}=${encodeURIComponent(env.DASH_KEY)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`, "cache-control": "no-store" } });
    }
    if (!localDev && !env.DASH_PASSWORD && !env.DASH_KEY) return new Response("Dashboard access is not configured yet.", { status: 503 });
    if (!localDev && !keyed(req, env) && !authorised(req, env)) {
      return new Response("Authentication required", { status: 401, headers: { "www-authenticate": 'Basic realm="SEG Performance", charset="UTF-8"' } });
    }
    const { pathname } = new URL(req.url);
    if (pathname === "/api/meta") {
      return new Response(await env.SEG_DATA.get("meta", "stream") ?? "null", { headers: json });
    }
    if (pathname === "/api/bench" || pathname === "/api/setup" || pathname === "/api/keywords" || pathname === "/api/metafreq" || pathname === "/api/budgetlive" || pathname === "/api/negbase") {
      return new Response(await env.SEG_DATA.get(pathname.slice(5), "stream") ?? "null", { headers: json });
    }
    if (pathname === "/api/live") {
      return new Response(await env.SEG_DATA.get("live", "stream") ?? "null", { headers: json });
    }
    if (pathname === "/api/archive") {
      const keys = [];
      let cursor;
      do {
        const page = await env.SEG_DATA.list({ prefix: "arch:", cursor });
        keys.push(...page.keys.map((k2) => k2.name));
        cursor = page.list_complete ? void 0 : page.cursor;
      } while (cursor);
      const { readable, writable } = new TransformStream();
      (async () => {
        const w = writable.getWriter();
        const enc = new TextEncoder();
        await w.write(enc.encode("["));
        let first = true;
        for (const k2 of keys.sort()) {
          const s = await env.SEG_DATA.get(k2, "stream");
          if (!s) continue;
          if (!first) await w.write(enc.encode(","));
          first = false;
          const r = s.getReader();
          for (; ; ) {
            const { done, value } = await r.read();
            if (done) break;
            await w.write(value);
          }
        }
        await w.write(enc.encode("]"));
        await w.close();
      })();
      return new Response(readable, { headers: json });
    }
    if (pathname === "/api/notes" || pathname === "/api/actions" || pathname === "/api/comments") {
      const url = new URL(req.url);
      const week = url.searchParams.get("week") ?? "";
      if (pathname === "/api/notes" && !/^\d{4}-W\d{2}$/.test(week)) return new Response("week required", { status: 400 });
      const key = pathname === "/api/notes" ? `notes:${week}` : pathname.slice(5);
      if (req.method === "GET") return new Response(await env.SEG_DATA.get(key, "stream") ?? "{}", { headers: json });
      if (req.method === "POST") {
        const body = await req.text();
        if (body.length > 2e4) return new Response("too large", { status: 413 });
        let patch;
        try {
          patch = JSON.parse(body);
        } catch {
          return new Response("bad json", { status: 400 });
        }
        if (!patch.id || typeof patch.id !== "string" || patch.id.length > 400) return new Response("id required", { status: 400 });
        const by = userOf(req) || "unknown";
        const cur = JSON.parse(await env.SEG_DATA.get(key) ?? "{}");
        cur[patch.id] = { ...cur[patch.id] ?? {}, ...patch.data ?? {}, ...patch.text !== void 0 ? { text: String(patch.text).slice(0, 2e3) } : {}, by, at: (/* @__PURE__ */ new Date()).toISOString() };
        await env.SEG_DATA.put(key, JSON.stringify(cur));
        return new Response(JSON.stringify(cur[patch.id]), { headers: json });
      }
      return new Response("method not allowed", { status: 405 });
    }
    if (pathname === "/api/notify" && req.method === "POST") {
      if (!env.SLACK_WEBHOOK_URL) return new Response("Slack webhook not configured", { status: 501 });
      let body;
      try {
        body = JSON.parse(await req.text());
      } catch {
        return new Response("bad json", { status: 400 });
      }
      const text = String(body.text ?? "").slice(0, 3900);
      if (!text.trim()) return new Response("text required", { status: 400 });
      const r = await fetch(env.SLACK_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      return new Response(r.ok ? "ok" : "slack error", { status: r.ok ? 200 : 502 });
    }
    if (pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
    return env.ASSETS.fetch(req);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
