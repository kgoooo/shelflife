import { searchBooks } from '../api.js';
import { findByOlKey } from '../store.js';
import { esc, icons, coverHTML, authorLine } from '../ui.js';

let lastQuery = '';
let lastResults = [];
let controller;
export const resultCache = new Map(); // olKey -> search result, used when adding

export function addView() {
  return `<div class="stack" style="max-width:720px;margin:0 auto">
    <h1 class="h1">Add a book</h1>
    <p class="muted small" style="margin:0">Search millions of titles from Open Library, or add one by hand.</p>
    <div class="search-wrap">${icons.search}<input class="input" id="add-q" type="search" placeholder="Title, author or ISBN" value="${esc(lastQuery)}" autocomplete="off" enterkeyhint="search" aria-label="Search books"></div>
    <div id="add-results" class="stack" style="gap:4px"></div>
    <div class="divider"></div>
    <button class="btn" data-action="manual-add">Can't find it? Add manually</button>
  </div>`;
}

function resultRow(r) {
  resultCache.set(r.olKey, r);
  const owned = findByOlKey(r.olKey);
  return `<div class="result">
    <button class="tile-link" data-action="preview" data-key="${esc(r.olKey)}" aria-label="More about ${esc(r.title)}" style="width:56px">${coverHTML(r)}</button>
    <div class="info">
      <button class="tile-link t" data-action="preview" data-key="${esc(r.olKey)}">${esc(r.title)}</button>
      <div class="a">${authorLine(r)}${r.year ? ` · ${r.year}` : ''}${r.pages ? ` · ${r.pages} pp` : ''}</div>
      <div class="actions" style="margin-top:8px">
        ${owned
          ? `<a class="in-lib" href="#/book/${owned.id}">✓ In your library</a>`
          : `<button class="btn btn-sm" style="padding:0 10px" data-action="add-result" data-key="${esc(r.olKey)}" data-v="tbr">+ To read</button>
             <button class="btn btn-sm btn-ghost" style="padding:0 10px" data-action="add-result" data-key="${esc(r.olKey)}" data-v="reading">Reading</button>
             <button class="btn btn-sm btn-ghost" style="padding:0 10px" data-action="add-result" data-key="${esc(r.olKey)}" data-v="read">Read</button>`}
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
    lastResults = await searchBooks(q, { signal: controller.signal });
    paint(root);
  } catch (e) {
    if (e.name === 'AbortError') return;
    root.querySelector('#add-results').innerHTML = '<p class="faint small center">Couldn\'t reach Open Library. Check your connection and try again.</p>';
  }
}
