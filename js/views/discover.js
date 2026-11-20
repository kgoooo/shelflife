import { books, findByOlKey } from '../store.js';
import { MOODS, SPICE, TROPE_SUBJECTS, PACES } from '../data.js';
import { bySubject, byAuthor } from '../api.js';
import { esc, icons, coverHTML, authorLine, spiceInline } from '../ui.js';
import { resultCache } from './add.js';

export const pickFilters = { moods: [], minSpice: 0, maxSpice: 5, maxPages: 0, pace: '', pickId: null };
const shelfCache = new Map(); // key -> Promise<results>

export function matchingTbr() {
  const f = pickFilters;
  return books().filter((b) => b.status === 'tbr'
    && (!f.moods.length || f.moods.some((m) => b.moods.includes(m)))
    && (b.spice == null || (b.spice >= f.minSpice && b.spice <= f.maxSpice))
    && (!f.maxPages || !b.pages || b.pages <= f.maxPages)
    && (!f.pace || !b.pace || b.pace === f.pace));
}

// Score tropes and authors by how much you liked the books they appear in.
function tasteProfile() {
  const done = books().filter((b) => b.status === 'read' || b.status === 'reading');
  const tropes = {}, authors = {};
  for (const b of done) {
    const w = b.rating ? b.rating - 2.5 : 0.5; // loved books count most, disliked ones count against
    b.tropes.forEach((t) => { tropes[t] = (tropes[t] || 0) + w; });
    if (b.rating >= 4) b.authors.slice(0, 1).forEach((a) => { authors[a] = (authors[a] || 0) + b.rating; });
  }
  const top = (o) => Object.entries(o).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return { tropes: top(tropes), authors: top(authors) };
}

export function discoverView() {
  const all = books();
  const tbr = all.filter((b) => b.status === 'tbr');
  const f = pickFilters;
  const matches = matchingTbr();
  const pick = f.pickId && all.find((b) => b.id === f.pickId);
  const taste = tasteProfile();
  const tropeShelves = taste.tropes.filter((t) => TROPE_SUBJECTS[t]).slice(0, 3);
  if (!tropeShelves.length) tropeShelves.push('__romance');
  const authorShelves = taste.authors.slice(0, 2);

  return `<div class="stack-lg">
    <div><h1 class="h1">Discover</h1><p class="muted small" style="margin:6px 0 0">Pick your next read from the pile, or find new books that match what you love.</p></div>

    <section class="card picker-card stack">
      <div class="spread"><h2 class="h2">What should I read next?</h2><span class="small faint">${matches.length} of ${tbr.length} match</span></div>
      <div>
        <div class="eyebrow" style="margin-bottom:8px">In the mood for</div>
        <div class="row-wrap">${MOODS.map((m) => `<button class="chip mood ${f.moods.includes(m) ? 'on' : ''}" data-action="pick-mood" data-v="${m}">${m}</button>`).join('')}</div>
      </div>
      <div class="grid-2">
        <label class="field">Spice between
          <div class="row">
            <select class="input" data-change="pick-min">${SPICE.map((s) => `<option value="${s.level}" ${f.minSpice === s.level ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
            <span class="faint">–</span>
            <select class="input" data-change="pick-max">${SPICE.map((s) => `<option value="${s.level}" ${f.maxSpice === s.level ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
          </div>
        </label>
        <div class="row" style="gap:8px; align-items:flex-end">
          <label class="field" style="flex:1">Length
            <select class="input" data-change="pick-pages">
              ${[[0, 'Any length'], [300, 'Under 300 pages'], [400, 'Under 400 pages'], [500, 'Under 500 pages']].map(([v, l]) => `<option value="${v}" ${f.maxPages === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </label>
          <label class="field" style="flex:1">Pace
            <select class="input" data-change="pick-pace"><option value="">Any pace</option>${PACES.map((p) => `<option ${f.pace === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
          </label>
        </div>
      </div>
      <button class="btn btn-light btn-block" data-action="pick-random" ${matches.length ? '' : 'disabled style="opacity:.5"'}>${icons.dice} Pick for me</button>
      ${pick ? `<div class="pick-result card" style="background:rgba(0,0,0,.3)">
        ${coverHTML(pick)}
        <div class="stack" style="gap:6px;flex:1;min-width:0">
          <div class="eyebrow">Tonight's pick</div>
          <a href="#/book/${pick.id}" class="h2">${esc(pick.title)}</a>
          <div class="small faint">${authorLine(pick)}${pick.pages ? ` · ${pick.pages} pp` : ''}</div>
          <div class="row-wrap">${spiceInline(pick.spice)}${pick.tropes.slice(0, 3).map((t) => `<span class="tag rose">${esc(t)}</span>`).join('')}</div>
          <div class="row" style="margin-top:4px"><button class="btn btn-sm btn-light" style="padding:0 12px" data-action="status" data-id="${pick.id}" data-v="reading">Start reading</button><button class="btn btn-sm btn-ghost" style="padding:0 12px" data-action="pick-random">Another</button></div>
        </div>
      </div>` : ''}
      ${!tbr.length ? '<p class="small faint" style="margin:0">Your to-read pile is empty. Add some books first.</p>' : ''}
    </section>

    ${tropeShelves.map((t) => `<section>
      <div class="section-head"><h2 class="h2">${t === '__romance' ? 'Popular romance' : `Because you love <span style="color:var(--rose)">${esc(t.toLowerCase())}</span>`}</h2></div>
      <div class="shelf" data-shelf="trope:${esc(t)}"><div class="center" style="padding:30px"><span class="loader"></span></div></div>
    </section>`).join('')}

    ${authorShelves.map((a) => `<section>
      <div class="section-head"><h2 class="h2">More from ${esc(a)}</h2></div>
      <div class="shelf" data-shelf="author:${esc(a)}"><div class="center" style="padding:30px"><span class="loader"></span></div></div>
    </section>`).join('')}

    <p class="tiny faint center">Suggestions come from Open Library subjects and authors. Spice and tropes are yours to tag once you add a book.</p>
  </div>`;
}

function load(key) {
  if (!shelfCache.has(key)) {
    const [kind, val] = key.split(/:(.*)/s);
    const p = kind === 'author'
      ? byAuthor(val, { limit: 20 })
      : bySubject(val === '__romance' ? 'romance' : TROPE_SUBJECTS[val], { limit: 30 });
    shelfCache.set(key, p.catch(() => { shelfCache.delete(key); return null; }));
  }
  return shelfCache.get(key);
}

function suggestionTile(r) {
  resultCache.set(r.olKey, r);
  return `<div class="book-tile">
    <button class="tile-link" data-action="preview" data-key="${esc(r.olKey)}" aria-label="More about ${esc(r.title)}">
      ${coverHTML(r)}
      <div><div class="t">${esc(r.title)}</div><div class="a">${authorLine(r)}</div></div>
    </button>
    <button class="btn btn-sm" style="padding:0 10px" data-action="add-result" data-key="${esc(r.olKey)}" data-v="tbr">+ To read</button>
  </div>`;
}

export function mountDiscover(root) {
  const ownedTitles = new Set(books().map((b) => b.title.toLowerCase()));
  root.querySelectorAll('[data-shelf]').forEach(async (el) => {
    const results = await load(el.dataset.shelf);
    if (!el.isConnected) return;
    if (!results) {
      el.innerHTML = `<div class="row small faint" style="padding:0 4px">Open Library didn't answer. <button class="btn btn-sm" style="padding:0 12px" data-action="retry-shelf">Try again</button></div>`;
      return;
    }
    const fresh = results.filter((r) => !findByOlKey(r.olKey) && !ownedTitles.has(r.title.toLowerCase())).slice(0, 16);
    if (!fresh.length && el.dataset.shelf.startsWith('author:')) { el.closest('section').remove(); return; }
    el.innerHTML = fresh.length ? fresh.map(suggestionTile).join('') : '<p class="faint small" style="padding:0 4px">You already have everything here.</p>';
  });
}
