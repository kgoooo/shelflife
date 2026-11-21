import { findBooks } from '../api.js';
import { findByKey, isUnlocked } from '../store.js';
import { esc, icons, coverHTML, authorLine, fmtDate } from '../ui.js';

const today = () => new Date().toISOString().slice(0, 10);
let lastQuery = '';
let lastResults = [];
let controller;
export const resultCache = new Map(); // result key -> search result, used when adding

export function addView() {
  return `<div class="stack" style="max-width:720px;margin:0 auto">
    <h1 class="h1">Add a book</h1>
    <p class="muted small" style="margin:0">Search Apple Books and Open Library, including books that aren't out yet.</p>
    <div class="search-wrap">${icons.search}<input class="input" id="add-q" type="search" placeholder="Title, author or ISBN" value="${esc(lastQuery)}" autocomplete="off" enterkeyhint="search" aria-label="Search books"></div>
    <div id="add-results" class="stack" style="gap:4px"></div>
    <div class="divider"></div>
    <button class="btn" data-action="manual-add">Can't find it? Add manually</button>
  </div>`;
}

function resultRow(r) {
  resultCache.set(r.key, r);
  const owned = findByKey(r.key);
  return `<div class="result">
    <button class="tile-link" data-action="preview" data-key="${esc(r.key)}" aria-label="More about ${esc(r.title)}" style="width:56px">${coverHTML(r)}</button>
    <div class="info">
      <button class="tile-link t" data-action="preview" data-key="${esc(r.key)}">${esc(r.title)}</button>
      <div class="a">${authorLine(r)}${r.year && !(r.releaseDate > today()) ? ` · ${r.year}` : ''}${r.pages ? ` · ${r.pages} pp` : ''}</div>
      ${r.seriesKey ? `<a class="series-link small" href="#/series/${esc(r.seriesKey)}">${r.seriesNum ? `Book ${esc(r.seriesNum)} · ` : ''}${esc(r.series)} <span aria-hidden="true">→</span></a>` : ''}
      <div class="actions" style="margin-top:8px">
        ${owned
          ? owned.private && !isUnlocked() ? '<span class="in-lib">✓ In your library</span>' : `<a class="in-lib" href="#/book/${owned.id}">✓ In your library</a>`
          : r.releaseDate > today()
          ? `<span class="tag rose">Out ${fmtDate(r.releaseDate)}</span>
             <button class="btn btn-sm" style="padding:0 10px" data-action="add-result" data-key="${esc(r.key)}" data-v="upcoming">+ Upcoming</button>`
          : `<button class="btn btn-sm" style="padding:0 10px" data-action="add-result" data-key="${esc(r.key)}" data-v="tbr">+ To read</button>
             <button class="btn btn-sm btn-ghost" style="padding:0 10px" data-action="add-result" data-key="${esc(r.key)}" data-v="reading">Reading</button>
             <button class="btn btn-sm btn-ghost" style="padding:0 10px" data-action="add-result" data-key="${esc(r.key)}" data-v="read">Read</button>`}
      </div>
    </div>
  </div>`;
}

function paint(root) {
  const box = root.querySelector('#add-results');
  if (!box) return;
  if (!lastQuery.trim()) { box.innerHTML = ''; return; }
  box.innerHTML = lastResults.length ? lastResults.map(resultRow).join('') : '<p class="faint small center">No results.</p>';
}

export function mountAdd(root, { refresh } = {}) {
  if (refresh) { paint(root); return; }
  const input = root.querySelector('#add-q');
  paint(root);
  if (!lastQuery) input.focus();
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => run(root, input.value), 380);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(t); run(root, input.value); input.blur(); } });
}

async function run(root, q) {
  lastQuery = q;
  if (!q.trim()) { lastResults = []; paint(root); return; }
  controller?.abort();
  controller = new AbortController();
  root.querySelector('#add-results').innerHTML = '<div class="center" style="padding:20px"><span class="loader"></span></div>';
  try {
    const mine = controller;
    lastResults = await findBooks(q, {
      signal: controller.signal,
      onUpdate: (partial) => { if (mine === controller && partial.length) { lastResults = partial; paint(root); } },
    });
    if (mine === controller) paint(root);
  } catch (e) {
    if (e.name === 'AbortError') return;
    root.querySelector('#add-results').innerHTML = '<p class="faint small center">Couldn\'t reach Open Library. Check your connection and try again.</p>';
  }
}
