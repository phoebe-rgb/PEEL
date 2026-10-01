// Shared, persisted state (Worker → KV): boss notes per campaign per week, and the action tracker.
import { useCallback, useEffect, useState } from 'react';

export type Entry = Record<string, unknown> & { text?: string; by?: string; at?: string };

export function useShared(url: string | null) {
  const [data, setData] = useState<Record<string, Entry>>({});
  const [error, setError] = useState('');
  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetch(url).then((r) => (r.ok ? (r.json() as Promise<Record<string, Entry> | null>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Record<string, Entry> | null) => { if (alive) setData(d ?? {}); }).catch((e) => alive && setError(String(e)));
    return () => { alive = false; };
  }, [url]);
  const save = useCallback(async (id: string, patch: { text?: string; data?: Record<string, unknown> }) => {
    if (!url) return;
    setData((d) => ({ ...d, [id]: { ...(d[id] ?? {}), ...(patch.data ?? {}), ...(patch.text !== undefined ? { text: patch.text } : {}) } }));
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const saved = await r.json() as Entry;
      setData((d) => ({ ...d, [id]: saved }));
      setError('');
    } catch (e) { setError(`Not saved: ${String(e)}`); }
  }, [url]);
  return { data, save, error };
}
