// Fill in missing covers from Apple Books, and offer alternatives when a cover is poor.
import { books, updateBook } from './store.js';
import { appleMatch, coverOptions } from './api.js';
import { openSheet, esc, toast } from './ui.js';

const busy = new Set();

export function ensureCover(b) {
  if (b.cover || b.coverChecked || busy.has(b.id)) return Promise.resolve();
  busy.add(b.id);
  return appleMatch(b.title, b.authors[0])
    .then((m) => updateBook(b.id, m?.cover ? { cover: m.cover, coverChecked: true } : { coverChecked: true }))
    .catch(() => {}) // offline: try again next time
    .finally(() => busy.delete(b.id));
}

// Once per app start, quietly look up covers for books that don't have one.
export async function backfillCovers() {
  const missing = books().filter((b) => !b.cover && !b.coverChecked).slice(0, 25);
  for (const b of missing) {
    await ensureCover(b);
    await new Promise((r) => setTimeout(r, 600)); // stay well under Apple's rate limit
  }
}

export function openCoverPicker(id) {
  const b = books().find((x) => x.id === id);
  if (!b) return;
  openSheet('Choose a cover', `<p class="small faint" style="margin-top:0">Editions from Apple Books and Open Library.</p>
    <div class="cover-grid" data-cover-grid><div class="center" style="padding:30px;grid-column:1/-1"><span class="loader"></span></div></div>`);
  coverOptions(b.title, b.authors[0]).then((urls) => {
    const grid = document.querySelector('#sheet [data-cover-grid]');
    if (!grid) return;
    grid.innerHTML = urls.length
      ? urls.map((u) => `<button class="cover-choice ${u === b.cover ? 'on' : ''}" data-action="set-cover" data-id="${b.id}" data-v="${esc(u)}" aria-label="Use this cover">
          <div class="cover"><img src="${esc(u)}" alt="" loading="lazy" onerror="this.closest('button').remove()"></div></button>`).join('')
      : '<p class="faint small" style="grid-column:1/-1">No other covers found. You can paste an image link in Edit details.</p>';
  }).catch(() => {
    const grid = document.querySelector('#sheet [data-cover-grid]');
    if (grid) grid.innerHTML = '<p class="faint small" style="grid-column:1/-1">Couldn\'t load covers. Check your connection.</p>';
  });
}

export function setCover(id, url) {
  updateBook(id, { cover: url, coverChecked: true });
  document.querySelectorAll('#sheet .cover-choice').forEach((el) => el.classList.toggle('on', el.dataset.v === url));
  toast('Cover updated');
}
