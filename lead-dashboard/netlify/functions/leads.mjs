// On-demand JSON API for the dashboard page: current Netlify leads + their CRM match status.
// Serves the cached payload from Netlify Blobs (refreshed every 15 min by refresh-leads.mjs)
// so it answers instantly. Falls back to a live build if the cache is missing or stale,
// or when called with ?refresh=1.
import { getStore } from "@netlify/blobs";
import { buildPayload, STORE, CACHE_KEY } from "./_lib.mjs";

const MAX_AGE_MIN = 60;

export default async (req) => {
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  let store = null;
  try { store = getStore(STORE); } catch (e) { console.error("Blobs unavailable:", e?.message); }

  if (store && !force) {
    try {
      const cached = await store.get(CACHE_KEY, { type: "json" });
      if (cached && (Date.now() - new Date(cached.generated_at).getTime()) / 60000 < MAX_AGE_MIN)
        return json(cached, "hit");
    } catch (e) { console.error("Blobs read:", e?.message); }
  }

  try {
    const { payload } = await buildPayload();
    if (store) { try { await store.setJSON(CACHE_KEY, payload); } catch (e) { console.error("Blobs write:", e?.message); } }
    return json(payload, "miss");
  } catch (e) {
    console.error("leads build failed:", e?.message);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 502, headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
};

const json = (o, cache) => new Response(JSON.stringify(o), {
  headers: { "content-type": "application/json", "cache-control": "no-store", "x-leads-cache": cache },
});
