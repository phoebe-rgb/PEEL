// One comment panel for the whole dashboard (York style): pin a comment to a table / row, tag people with @Name,
// flag "Needs action" (it then appears on the Actions page). Stored in KV via /api/comments, shared by everyone.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShared, type Entry } from './lib/shared';

export interface Loc { sec: string; kind: string; label: string; idx: number; sub?: string }
export interface Comment extends Entry { page: string; view: string; anchor?: string; loc?: Loc; name: string; needsAction?: boolean; resolved?: boolean; mentions?: string[]; parent?: string; sentAt?: string; deleted?: boolean; editedAt?: string }
const NAME_KEY = 'seg-cmt-name';
const PAGES: Record<string, string> = { performance: 'Performance', budget: 'Budget & Pacing', keywords: 'Search Keywords', actions: 'Actions', 'must-read': 'How to read' };
export const pageName = (route: string) => PAGES[route] ?? 'Performance';

const KINDS = 'tr, .kpi, .racard, .readcard, .timeline, .panel, .block';
const title = (x: string) => x.toLowerCase().replace(/(^|[\s-])\S/g, (m) => m.toUpperCase());
/** Short, stable label of an element inside a block: the row path, the scorecard name, the card title. */
function labelOf(t: HTMLElement): string {
  const tagged = (t.closest('[data-cmt]') as HTMLElement | null)?.dataset.cmt;
  if (tagged) return tagged;
  if (t.matches('tr')) return (t.querySelector('td, th')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const q = t.querySelector('.kpi-label, .rc-head b, .rac-head b, .chart-title');
  return (q?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
}
/** Where a comment points: section (block tag) + element kind + label + index, so it can be found and highlighted again. */
function locOf(el: HTMLElement): Loc {
  const t = (el.closest(KINDS) as HTMLElement | null) ?? el;
  const block = t.closest('.block');
  const sec = block?.querySelector('.block-tag')?.textContent?.trim() ?? '';
  const kind = t.matches('tr') ? 'tr' : t.matches('.kpi') ? '.kpi' : t.matches('.racard') ? '.racard' : t.matches('.readcard') ? '.readcard' : t.matches('.timeline, .panel') ? '.timeline, .panel' : '.block';
  const list = block && kind !== '.block' ? [...block.querySelectorAll(kind)] : [];
  let sub: string | undefined;
  try { sub = location.hash.includes('performance') || location.hash === '' || location.hash === '#/' ? localStorage.getItem('seg-view3') ?? 'boss' : undefined; } catch { sub = undefined; }
  // a whole block: use its title without live counts ("Open actions · 91" → "Open actions")
  const blockTitle = (block?.querySelector('.block-head h3')?.textContent ?? '').replace(/\s*·\s*[\d,]+\s*$/, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return { sec, kind, label: kind === '.block' ? blockTitle : labelOf(t), idx: Math.max(0, list.indexOf(t)), sub };
}
const SUB: Record<string, string> = { boss: 'Boss', google: 'Google Ads', meta: 'Meta' };
export const anchorText = (l?: Loc, fallback = 'This page') => (l ? [l.sub ? SUB[l.sub] : '', title(l.sec), l.label].filter(Boolean).join(' › ') : fallback);
/** Find the element a comment points to on the current screen. */
function findLoc(l: Loc): HTMLElement | null {
  const blocks = [...document.querySelectorAll('.block')].filter((b) => b.querySelector('.block-tag')?.textContent?.trim() === l.sec);
  for (const b of blocks) {
    if (l.kind === '.block') return b as HTMLElement;
    const list = [...b.querySelectorAll(l.kind)] as HTMLElement[];
    const hit = list.find((x) => labelOf(x) === l.label) ?? (l.label ? null : list[l.idx]);
    if (hit) return hit;
  }
  return null;
}

const fmtAt = (at?: string) => (at ? new Date(at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const withTags = (t: string) => t.split(/(@[\w.-]+)/g).map((p, i) => (p.startsWith('@') ? <b key={i} className="tag">{p}</b> : p));

export function Comments({ route, view }: { route: string; view: string }) {
  const [open, setOpen] = useState(false);
  const store = useShared('/api/comments');
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } });
  const [text, setText] = useState('');
  const [needs, setNeeds] = useState(false);
  const [loc, setLoc] = useState<Loc | null>(null);
  const anchor = loc ? anchorText(loc) : '';
  const setAnchor = (_: string) => setLoc(null);
  const [found, setFound] = useState<Record<string, boolean>>({});
  const [picking, setPicking] = useState(false);
  const [tab, setTab] = useState<'view' | 'page' | 'action' | 'mine' | 'all'>('view');
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null);
  const [sending, setSending] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string; needs: boolean } | null>(null);
  // Only the author (same name in this browser) can edit or delete. Delete is soft: the comment is hidden for everyone.
  const mineC = (c: Comment) => !!name.trim() && c.name === name.trim();
  const saveEdit = () => { if (!editing?.text.trim()) return; void store.save(editing.id, { text: editing.text.trim(), data: { needsAction: editing.needs, editedAt: new Date().toISOString(), mentions: [...editing.text.matchAll(/@([\w.-]+)/g)].map((m) => m[1]) } }); setEditing(null); };
  const del = (c: Comment & { id: string }) => { if (confirm('Delete this comment for everyone?')) void store.save(c.id, { data: { deleted: true, resolved: true } }); };
  const page = pageName(route);
  useEffect(() => { try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ } }, [name]);
  // pick mode: the next click on the page sets the anchor
  useEffect(() => {
    if (!picking) return;
    let hover: HTMLElement | null = null;
    const over = (e: MouseEvent) => { const t = (e.target as HTMLElement).closest('tr, .kpi, .racard, .readcard, .block') as HTMLElement | null; if (hover !== t) { hover?.classList.remove('cmt-hover'); hover = t; hover?.classList.add('cmt-hover'); } };
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.cmt-panel')) return;
      e.preventDefault(); e.stopPropagation();
      setLoc(locOf(t)); setPicking(false); setOpen(true);
    };
    document.addEventListener('mouseover', over, true); document.addEventListener('click', click, true);
    document.body.classList.add('cmt-picking');
    return () => { document.removeEventListener('mouseover', over, true); document.removeEventListener('click', click, true); hover?.classList.remove('cmt-hover'); document.body.classList.remove('cmt-picking'); };
  }, [picking]);
  const everything = Object.entries(store.data as Record<string, Comment>).map(([id, c]) => ({ id, ...c })).filter((c) => c.text && !c.deleted);
  const replies = (id: string) => everything.filter((c) => c.parent === id).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const all = everything.filter((c) => !c.parent).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const lists = {
    view: all.filter((c) => c.page === page && c.view === view), page: all.filter((c) => c.page === page),
    action: all.filter((c) => c.needsAction && !c.resolved), all, mine: all.filter((c) => name && (c.name === name || c.mentions?.includes(name.replace(/\s+/g, '_')))),
  };
  const send = () => {
    if (!text.trim()) return;
    const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    void store.save(id, { text: text.trim(), data: { page, view, anchor: anchor || 'This page', loc, name: name.trim() || 'Anonymous', needsAction: needs, resolved: false, mentions: [...text.matchAll(/@([\w.-]+)/g)].map((m) => m[1]) } });
    setText(''); setNeeds(false); setLoc(null); setTab('view');
  };
  const saveReply = (parent: Comment & { id: string }, body: string) => {
    const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    void store.save(id, { text: body.trim(), data: { page: parent.page, view: parent.view, anchor: parent.anchor, loc: parent.loc, parent: parent.id, name: name.trim() || 'Anonymous', mentions: [...body.matchAll(/@([\w.-]+)/g)].map((m) => m[1]) } });
  };
  const sendReply = (parent: Comment & { id: string }) => {
    if (!reply?.text.trim()) return;
    const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    void store.save(id, { text: reply.text.trim(), data: { page: parent.page, view: parent.view, anchor: parent.anchor, loc: parent.loc, parent: parent.id, name: name.trim() || 'Anonymous', mentions: [...reply.text.matchAll(/@([\w.-]+)/g)].map((m) => m[1]) } });
    setReply(null);
  };
  // "I'm done": post this person's unsent comments to Slack as one summary (via the Worker's /api/notify)
  const unsent = everything.filter((c) => name.trim() && c.name === name.trim() && !c.sentAt);
  const sendToSlack = async () => {
    if (!unsent.length) return;
    // One line per comment: WHERE (section › item, page, period) and WHAT was said. Action items first.
    const byId = new Map(everything.map((c) => [c.id, c]));
    const where = (c: Comment) => `*${c.loc ? anchorText(c.loc) : c.anchor ?? 'page'}* (${c.page}, ${c.view})`;
    const line = (c: Comment & { id: string }) => c.parent
      ? `↳ reply on "${String(byId.get(c.parent)?.text ?? '').slice(0, 50)}" — ${where(c)}: ${String(c.text)}`
      : `${where(c)}: ${String(c.text)}`;
    const acts = unsent.filter((c) => c.needsAction), notes = unsent.filter((c) => !c.needsAction);
    const text = [
      `💬 *${name.trim()}* reviewed the SEG dashboard — ${unsent.length} comment${unsent.length > 1 ? 's' : ''}${acts.length ? `, ${acts.length} need${acts.length > 1 ? '' : 's'} action` : ''}.`,
      acts.length ? `*🔴 Action needed*\n${acts.map((c) => `• ${line(c)}`).join('\n')}` : '',
      notes.length ? `*💬 Comments*\n${notes.map((c) => `• ${line(c)}`).join('\n')}` : '',
      `${location.origin}/#/actions`,
    ].filter(Boolean).join('\n\n');
    setSending('Sending…');
    try {
      const r = await fetch('/api/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!r.ok) throw new Error(r.status === 501 ? 'Slack is not connected yet (SLACK_WEBHOOK_URL).' : `HTTP ${r.status}`);
      const at = new Date().toISOString();
      for (const c of unsent) await store.save(c.id, { data: { sentAt: at } });
      setSending(`Sent ${unsent.length} comment${unsent.length > 1 ? 's' : ''} to Slack.`);
    } catch (e) { setSending(`Not sent: ${e instanceof Error ? e.message : String(e)}`); }
  };
  // hover a comment → highlight the spot it points to; "Show" → go to its page / view first
  const focus = (c: Comment, on: boolean) => {
    document.querySelectorAll('.cmt-focus').forEach((x) => x.classList.remove('cmt-focus'));
    if (!on || !c.loc || c.page !== page) return;
    const el = findLoc(c.loc);
    setFound((f) => ({ ...f, [String(c.at)]: !!el }));
    if (el) { el.classList.add('cmt-focus'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  };
  const show = (c: Comment) => {
    const route = Object.entries(PAGES).find(([, v]) => v === c.page)?.[0] ?? 'performance';
    if (c.loc?.sub) { try { localStorage.setItem('seg-view3', c.loc.sub); } catch { /* ignore */ } window.dispatchEvent(new CustomEvent('seg-view', { detail: c.loc.sub })); }
    if (!location.hash.includes(route)) location.hash = `#/${route}`;
    setTimeout(() => focus(c, true), 900);
  };
  const openCount = lists.action.length;
  return (
    <>
      {!picking && <CommentMarkers comments={all} page={page} replies={replies} onOpen={() => { setOpen(true); setTab('page'); }} onReply={saveReply} canEdit={mineC}
        onEdit={(c, t) => void store.save(c.id, { text: t.trim(), data: { editedAt: new Date().toISOString() } })} onDelete={del} />}
      <button className="cmt-launch" onClick={() => setOpen(!open)}>💬 Comments{openCount > 0 && <span className="count">{openCount}</span>}</button>
      {picking && <div className="cmt-pickbar">Click a table, row, card or chart to attach the comment · <button onClick={() => setPicking(false)}>Cancel</button></div>}
      {open && !picking && (
        <aside className="cmt-panel">
          <header><h3>Comments · {page}</h3><button className="cmt-x" onClick={() => setOpen(false)} aria-label="Close">×</button></header>
          <div className="cmt-form">
            <div className="cmt-about"><span className="lbl">About</span><span className="pill">{page}</span><span className="pill">View: <b>{view}</b></span></div>
            {anchor && <div className="cmt-anchor">📍 {anchor} <button onClick={() => setAnchor('')} aria-label="Remove">×</button></div>}
            <button className="cmt-pick" onClick={() => setPicking(true)}>📍 {anchor ? 'Pick another spot' : 'Point to a table or row'}</button>
            <input className="cmt-in" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea className="cmt-in" rows={3} placeholder={'Ask or flag something, e.g. "Meta in India looks expensive this week — @Anna can you check the audience?"'} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="cmt-send">
              <label><input type="checkbox" checked={needs} onChange={(e) => setNeeds(e.target.checked)} /> <b>Needs action</b></label>
              <span className="dim">Type @Name to tag a person. "Needs action" puts it on the Actions page.</span>
              <button className="cmt-btn" onClick={send} disabled={!text.trim()}>Save</button>
            </div>
            {store.error && <p className="warnbox">{store.error}</p>}
          </div>
          <div className="cmt-tabs">
            {([['view', 'This view'], ['page', 'Whole page'], ['action', 'Needs action'], ['mine', name ? 'Mine' : 'Mine (add your name)'], ['all', 'All comments']] as const).map(([k, l]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l} {lists[k].length}</button>
            ))}
          </div>
          <div className="cmt-done">
            <button className="cmt-btn" disabled={!unsent.length} onClick={() => void sendToSlack()}>📨 I'm done — send my {unsent.length || ''} comment{unsent.length === 1 ? '' : 's'} to Slack</button>
            <span className="dim">{sending || (name.trim() ? 'Posts a summary of your unsent comments (and what needs action) to the team channel.' : 'Add your name above first.')}</span>
          </div>
          <div className="cmt-list">
            {lists[tab].length === 0 ? <p className="dim">{tab === 'view' ? 'No comments on this view yet. Ask the first question above.' : 'Nothing here.'}</p> : lists[tab].map((c) => (
              <div key={c.id} className={`cmt-item ${c.resolved ? 'done' : ''}`} onMouseEnter={() => focus(c, true)} onMouseLeave={() => focus(c, false)}>
                <div className="cmt-meta"><b>{c.name}</b> <span className="dim">· {fmtAt(c.at)} · {c.page} · {c.view}</span></div>
                <div className="cmt-anchor small">📍 {c.loc ? anchorText(c.loc) : c.anchor} {(c.page !== page || (c.loc?.sub && c.loc.sub !== (localStorage.getItem('seg-view3') ?? 'boss')) || found[String(c.at)] === false) && <button className="linkbtn" onClick={() => show(c)}>Show on {c.page}{c.loc?.sub ? ` · ${SUB[c.loc.sub]}` : ''} →</button>}</div>
                {editing?.id === c.id ? (
                  <div className="cmt-edit"><textarea className="cmt-in" rows={3} autoFocus value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
                    {!c.parent && <label className="dim"><input type="checkbox" checked={editing.needs} onChange={(e) => setEditing({ ...editing, needs: e.target.checked })} /> Needs action</label>}
                    <div><button className="cmt-btn" disabled={!editing.text.trim()} onClick={saveEdit}>Save</button> <button className="linkbtn" onClick={() => setEditing(null)}>Cancel</button></div></div>
                ) : <div className="cmt-text">{withTags(String(c.text))}{c.editedAt && <span className="dim"> (edited)</span>}</div>}
                <div className="cmt-foot">
                  {mineC(c) && editing?.id !== c.id && <><button className="linkbtn" onClick={() => setEditing({ id: c.id, text: String(c.text), needs: !!c.needsAction })}>Edit</button><button className="linkbtn danger" onClick={() => del(c)}>Delete</button></>}
                  {c.needsAction && <span className={`chip ${c.resolved ? 'Better' : 'Worse'}`}>{c.resolved ? 'Done' : 'Needs action'}</span>}
                  {c.sentAt && <span className="dim">sent to Slack</span>}
                  <label className="dim"><input type="checkbox" checked={!!c.resolved} onChange={(e) => void store.save(c.id, { data: { resolved: e.target.checked } })} /> resolved</label>
                  <button className="linkbtn" onClick={() => setReply({ id: c.id, text: '' })}>Reply</button>
                </div>
                {replies(c.id).map((r) => <div key={r.id} className="cmt-reply"><b>{r.name}</b> <span className="dim">· {fmtAt(r.at)}</span>
                  {editing?.id === r.id ? <div className="cmt-edit"><textarea className="cmt-in" rows={2} autoFocus value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} /><div><button className="cmt-btn" disabled={!editing.text.trim()} onClick={saveEdit}>Save</button> <button className="linkbtn" onClick={() => setEditing(null)}>Cancel</button></div></div>
                    : <div className="cmt-text">{withTags(String(r.text))}{r.editedAt && <span className="dim"> (edited)</span>}</div>}
                  {mineC(r) && editing?.id !== r.id && <div className="cmt-foot"><button className="linkbtn" onClick={() => setEditing({ id: r.id, text: String(r.text), needs: false })}>Edit</button><button className="linkbtn danger" onClick={() => del(r)}>Delete</button></div>}</div>)}
                {reply?.id === c.id && <div className="cmt-reply"><textarea className="cmt-in" rows={2} autoFocus placeholder="Reply…" value={reply.text} onChange={(e) => setReply({ id: c.id, text: e.target.value })} /><button className="cmt-btn" disabled={!reply.text.trim()} onClick={() => sendReply(c)}>Save reply</button> <button className="linkbtn" onClick={() => setReply(null)}>Cancel</button></div>}
              </div>
            ))}
          </div>
        </aside>
      )}
    </>
  );
}

type Marker = { key: string; x: number; y: number; items: (Comment & { id: string })[]; el: HTMLElement };

/**
 * Google-Docs-style markers: a small 💬 bubble on every spot of the current page/view that has comments.
 * Click a bubble to read the thread in a popup (and reply there or open it in the panel).
 */
export function CommentMarkers({ comments, page, replies, onOpen, onReply, canEdit, onEdit, onDelete }: {
  comments: (Comment & { id: string })[]; page: string; replies: (id: string) => (Comment & { id: string })[];
  onOpen: () => void; onReply: (parent: Comment & { id: string }, text: string) => void;
  canEdit: (c: Comment) => boolean; onEdit: (c: Comment & { id: string }, text: string) => void; onDelete: (c: Comment & { id: string }) => void;
}) {
  const [marks, setMarks] = useState<Marker[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [ed, setEd] = useState<{ id: string; text: string } | null>(null);
  useEffect(() => {
    let raf = 0;
    const calc = () => {
      raf = 0;
      let sub = 'boss'; try { sub = localStorage.getItem('seg-view3') ?? 'boss'; } catch { /* ignore */ }
      const groups = new Map<HTMLElement, (Comment & { id: string })[]>();
      for (const c of comments) {
        if (c.page !== page || !c.loc || (c.loc.sub && page === 'Performance' && c.loc.sub !== sub)) continue;
        const el = findLoc(c.loc); if (!el) continue;
        (groups.get(el) ?? groups.set(el, []).get(el)!).push(c);
      }
      const out: Marker[] = [];
      for (const [el, items] of groups) {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight || r.width === 0) continue;
        // keep the bubble inside the element's own scroll box (tables scroll inside .dd-wrap / .tablewrap)
        const box = (el.closest('.dd-wrap, .tablewrap') as HTMLElement | null)?.getBoundingClientRect();
        if (box && (r.bottom < box.top + 30 || r.top > box.bottom)) continue;
        const x = Math.min(r.right, box ? box.right : r.right) - 14, y = Math.max(r.top, box ? box.top + 30 : r.top) + 4;
        out.push({ key: items[0].id, x, y, items, el });
      }
      setMarks(out);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(calc); };
    kick();
    const t = setInterval(kick, 800);
    addEventListener('scroll', kick, true); addEventListener('resize', kick);
    return () => { clearInterval(t); removeEventListener('scroll', kick, true); removeEventListener('resize', kick); if (raf) cancelAnimationFrame(raf); };
  }, [comments, page]);
  const open = marks.find((m) => m.key === openKey);
  useEffect(() => {
    document.querySelectorAll('.cmt-focus').forEach((x) => x.classList.remove('cmt-focus'));
    open?.el.classList.add('cmt-focus');
  }, [open?.el]);
  return createPortal(<>
    {marks.map((m) => {
      const n = m.items.length, act = m.items.some((c) => c.needsAction && !c.resolved);
      return <button key={m.key} className={`cmt-mark ${act ? 'act' : ''} ${openKey === m.key ? 'on' : ''}`} style={{ left: m.x, top: m.y }} title={`${n} comment${n > 1 ? 's' : ''}`}
        onMouseEnter={() => m.el.classList.add('cmt-focus')} onMouseLeave={() => { if (openKey !== m.key) m.el.classList.remove('cmt-focus'); }}
        onClick={() => { setOpenKey(openKey === m.key ? null : m.key); setDraft(''); }}>💬{n > 1 ? n : ''}</button>;
    })}
    {open && (
      <div className="cmt-pop" style={{ left: Math.max(12, Math.min(open.x - 300, innerWidth - 340)), top: Math.min(open.y + 22, innerHeight - 320) }}>
        <div className="cmt-pop-head"><b>📍 {anchorText(open.items[0].loc)}</b><button className="cmt-x" onClick={() => setOpenKey(null)} aria-label="Close">×</button></div>
        <div className="cmt-pop-body">
          {open.items.map((c) => (
            <div key={c.id} className={`cmt-pop-item ${c.resolved ? 'done' : ''}`}>
              <div className="cmt-meta"><b>{c.name}</b> <span className="dim">· {fmtAt(c.at)} · {c.view}</span> {c.needsAction && <span className={`chip ${c.resolved ? 'Better' : 'Worse'}`}>{c.resolved ? 'Done' : 'Needs action'}</span>}</div>
              {[c, ...replies(c.id)].map((r, i) => (
                <div key={r.id} className={i ? 'cmt-reply' : ''}>
                  {i > 0 && <><b>{r.name}</b> <span className="dim">· {fmtAt(r.at)}</span></>}
                  {ed?.id === r.id ? <div className="cmt-edit"><textarea className="cmt-in" rows={2} autoFocus value={ed.text} onChange={(e) => setEd({ id: r.id, text: e.target.value })} /><div><button className="cmt-btn" disabled={!ed.text.trim()} onClick={() => { onEdit(r, ed.text); setEd(null); }}>Save</button> <button className="linkbtn" onClick={() => setEd(null)}>Cancel</button></div></div>
                    : <div className="cmt-text">{withTags(String(r.text))}{r.editedAt && <span className="dim"> (edited)</span>}</div>}
                  {canEdit(r) && ed?.id !== r.id && <div className="cmt-foot"><button className="linkbtn" onClick={() => setEd({ id: r.id, text: String(r.text) })}>Edit</button><button className="linkbtn danger" onClick={() => onDelete(r)}>Delete</button></div>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="cmt-pop-foot">
          <textarea className="cmt-in" rows={2} placeholder="Reply…" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div><button className="cmt-btn" disabled={!draft.trim()} onClick={() => { onReply(open.items[0], draft); setDraft(''); }}>Save reply</button> <button className="linkbtn" onClick={() => { setOpenKey(null); onOpen(); }}>Open all comments</button></div>
        </div>
      </div>
    )}
  </>, document.body);
}
