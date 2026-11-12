// Scheduled (see netlify.toml): rebuilds the dashboard payload every 15 min and stores it
// in Netlify Blobs, so /.netlify/functions/leads can answer from cache instantly.
import { getStore } from "@netlify/blobs";
import { buildPayload, STORE, CACHE_KEY } from "./_lib.mjs";

export default async () => {
  const t = Date.now();
  const { payload } = await buildPayload();
  await getStore(STORE).setJSON(CACHE_KEY, payload);
  console.log(`refresh-leads: ${payload.leads.length} leads cached in ${Date.now() - t}ms`);
  return new Response("ok");
};
