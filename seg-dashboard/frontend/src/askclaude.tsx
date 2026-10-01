// "Ask Claude": hands the question plus the numbers on the current screen to claude.ai (the team's Claude Team plan),
// so there is no API key or extra cost. Nothing is sent anywhere by the dashboard itself.
import { useState } from 'react';

const MAX_URL = 55000;     // claude.ai accepts ~60k-character links (tested 29 Sep 2026: 60k OK, 100k → 414)
const MAX_DATA = 60000;    // characters of dashboard data

const clean = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' / ').trim();

/** The visible dashboard as plain text: each section's title, its cards and its tables (value + change, no pills). */
/** level 0 = everything; 1 = without insight text; 2 = also without the per-ad-set / per-ad detail tables. */
export function screenText(level = 0): string {
  const compact = level >= 1;
  const out: string[] = [];
  for (const b of document.querySelectorAll('main .block')) {
    const el = b as HTMLElement;
    if (el.closest('[hidden]') || el.offsetParent === null) continue;
    const tag = el.querySelector('.block-tag')?.textContent?.trim() ?? '';
    const h = el.querySelector('.block-head h3')?.textContent?.trim() ?? '';
    const lines: string[] = [`## ${tag}${h ? ` — ${h}` : ''}`];
    const kpis = [...el.querySelectorAll('.kpi')].map((k) => clean((k as HTMLElement).innerText));
    if (kpis.length) lines.push(...kpis.map((k) => `- ${k}`));
    for (const t of el.querySelectorAll('table')) {
      if (level >= 2 && t.closest('.specialist, .racard')) continue;
      const ths = [...t.querySelectorAll('thead th')] as HTMLElement[];
      const dimTh = ths.filter((th) => th.classList.contains('fp-dim'));
      // pivot tables: the merged dimension columns become one "row" column (School › Country › Channel)
      const keepTh = (th: HTMLElement) => !(compact && th.classList.contains('dd-ins'));
      const head = [...(dimTh.length ? [dimTh.map((th) => clean(th.childNodes[0]?.textContent ?? '')).join(' › ')] : []),
        ...ths.filter((th) => !th.classList.contains('fp-dim') && keepTh(th)).map((th) => clean((th.childNodes[0]?.textContent ?? th.textContent ?? '')))];
      if (head.length) lines.push(`| ${head.join(' | ')} |`);
      for (const tr of t.querySelectorAll('tbody tr')) {
        // merged pivot cells appear only on a group's first row: label every row with its full path instead
        const path = (tr as HTMLElement).dataset.cmt;
        const tds = [...tr.querySelectorAll('td')].filter((td) => !(path && td.classList.contains('fp-dim')));
        const cells = [...(path ? [path] : []), ...tds.filter((td) => !(compact && td.classList.contains('dd-ins'))).map((td) => clean(((td.querySelector('.dd-top') as HTMLElement | null) ?? (td as HTMLElement)).innerText))];
        if (cells.some(Boolean)) lines.push(`| ${cells.join(' | ')} |`);
      }
    }
    // text sections (headline, insights, read cards, reallocation cards) outside tables and cards
    if (!compact) for (const p of el.querySelectorAll('.block-body > p, .rac-text, .readcard .rc-head, .readcard .todo, .freqnote, .racard .rac-head')) lines.push(clean((p as HTMLElement).innerText));
    if (lines.length > 1) out.push(lines.join('\n'));
  }
  const all = out.join('\n\n');
  return all.length > MAX_DATA ? `${all.slice(0, MAX_DATA)}\n…(cut: the page has more rows — narrow the filters to include them)` : all;
}

export function AskClaude({ page, view }: { page: string; view: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const build = (data: string) => [
    'You are helping the SEG (Swiss Education Group) paid-media team read their performance dashboard.',
    'Answer the question using only the dashboard data below (ACT campaigns, CHF). Say what happened, why, and what to do next, citing the numbers you use.',
    'If the data below does not show something, say so instead of guessing. Keep the answer short and practical.',
    '',
    `QUESTION: ${q.trim()}`,
    '',
    `DASHBOARD: page "${page}", ${view}, filters as shown. Data through the date in the header. Each cell = value and change vs the comparison period.`,
    data,
  ].join('\n');
  const ask = async () => {
    // straight into the Claude chat when it fits in the link; otherwise without the insight text; otherwise via the clipboard
    for (const level of [0, 1, 2]) {
      const url = `https://claude.ai/new?q=${encodeURIComponent(build(screenText(level)))}`;
      if (url.length <= MAX_URL) {
        window.open(url, '_blank', 'noopener');
        setMsg(`Opened in Claude with your question and this page's numbers${level === 1 ? ' (without the insight text)' : level === 2 ? ' (without the per-ad detail tables)' : ''} — press Enter there to send.`);
        return;
      }
    }
    const prompt = build(screenText());
    try { await navigator.clipboard.writeText(prompt); } catch { setMsg('The page is too large for a link and the clipboard is blocked — narrow the filters and try again.'); return; }
    window.open('https://claude.ai/new', '_blank', 'noopener');
    setMsg('This page is too large to send in a link, so it is copied: in the Claude tab press ⌘V (Ctrl+V), then Enter. Tip: narrow the filters to send it directly.');
  };
  return (
    <>
      <button className="ask-launch" onClick={() => setOpen(!open)}>✨ Ask Claude</button>
      {open && (
        <div className="ask-panel">
          <header><b>Ask Claude about this page</b><button className="cmt-x" onClick={() => setOpen(false)} aria-label="Close">×</button></header>
          <p className="dim">Claude gets your question plus the numbers currently on screen ({page} · {view}). It opens in claude.ai with your own Claude Team account — nothing is sent by the dashboard.</p>
          <textarea className="cmt-in" rows={4} autoFocus placeholder="e.g. Why did CAAS India Meta cost per good lead go up? Which Google campaigns should we cut first?" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && q.trim()) void ask(); }} />
          <div className="ask-row"><button className="cmt-btn ask-btn" disabled={!q.trim()} onClick={() => void ask()}>Ask in Claude ↗</button><span className="dim">⌘/Ctrl + Enter</span></div>
          {msg && <p className="ask-msg">{msg}</p>}
          <p className="dim small">Tip: set the filters first (school, country, period) — Claude sees exactly what the page shows. Paste a good answer into 💬 Comments to share it.</p>
        </div>
      )}
    </>
  );
}
