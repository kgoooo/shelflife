// Series page: every book in a series in reading order, merged with what's on your shelves.
import { books, updateBook } from '../store.js';
import { bySeries, seriesForWork, searchBooks, olMatch } from '../api.js';
import { esc, icons, coverHTML, starsInline, countdown } from '../ui.js';
import { resultCache } from './add.js';

const cache = new Map();      // series id -> { state: 'loading'|'done'|'error', items, key, name }
const checking = new Set();   // book ids being looked up

const norm = (s) => String(s || '').toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]/g, '');

export const seriesHref = (b) => b.seriesKey ? `#/series/${b.seriesKey}` : `#/series/name/${encodeURIComponent(b.series)}`;

// Books added before series data was stored: look it up once in the background.
export function ensureSeries(b) {
  if (b.seriesKey || b.seriesChecked || checking.has(b.id) || (!b.olKey && !b.appleId && !b.googleId)) return;
  checking.add(b.id);
  // Books found only on Apple Books get matched to their Open Library work first (for series + page count).
  const lookup = b.olKey
    ? seriesForWork(b.olKey).then((info) => ({ info }))
    : olMatch(b.title, b.authors[0]).then((o) => ({
      ol: o,
      info: o?.seriesKey ? { seriesKey: o.seriesKey, series: o.series, seriesNum: o.seriesNum } : null,
    }));
  lookup
    .then(({ info, ol }) => {
      const patch = { seriesChecked: true };
      if (ol) { patch.olKey = ol.olKey; if (!b.pages && ol.pages) patch.pages = ol.pages; }
      if (info && (!b.series || norm(b.series) === norm(info.series))) Object.assign(patch, info, { series: b.series || info.series, seriesNum: b.seriesNum || info.seriesNum });
      updateBook(b.id, patch);
    })
    .catch(() => {})
    .finally(() => checking.delete(b.id));
}

function load(id, key, name) {
  if (cache.has(id) && cache.get(id).state !== 'error') return cache.get(id);
  const entry = { state: 'loading', items: [], key, name };
  cache.set(id, entry);
  (async () => {
    let k = key;
    if (!k && name) {
      // A series typed in by hand: try to find Open Library's matching series.
      const owner = books().find((b) => norm(b.series) === norm(name));
      const hits = await searchBooks(`${name} ${owner?.authors?.[0] || ''}`, { limit: 20 });
      k = hits.find((r) => r.seriesKey && norm(r.series) === norm(name))?.seriesKey || null;
    }
    entry.key = k;
    entry.items = k ? await bySeries(k) : [];
    if (!entry.name) entry.name = entry.items[0]?.series || '';
    entry.state = 'done';
  })()
    .catch(() => { entry.state = 'error'; })
    .finally(() => {
      if (location.hash.startsWith('#/series')) window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  return entry;
}

function statusBadge(b) {
  switch (b.status) {
    case 'read': return `<span class="tag sage">✓ Read</span> ${starsInline(b.rating)}`;
    case 'reading': return `<span class="tag sand">Reading${b.pages ? ` · ${Math.round((b.progress / b.pages) * 100)}%` : ''}</span>`;
    case 'tbr': return '<span class="tag">On your pile</span>';
    case 'dnf': return '<span class="tag">DNF</span>';
    case 'upcoming': {
      const c = countdown(b.releaseDate);
      if (c === undefined) return '<span class="tag rose">Upcoming · date TBA</span>';
      if (c === null) return '<span class="tag rose">Out now</span>';
      return `<span class="tag rose">${[c.y && `${c.y}y`, c.m && `${c.m}m`, `${c.d}d`].filter(Boolean).join(' ')} to go</span>`;
    }
    default: return '';
  }
}

function row(num, r, own) {
  const shown = own || r;
  const n = String(num ?? '').padStart(2, '0');
  const coverLink = own
    ? `<a href="#/book/${own.id}" style="width:62px;flex-shrink:0">${coverHTML(shown)}</a>`
    : `<button class="tile-link" style="width:62px;flex-shrink:0" data-action="preview" data-key="${esc(r.key)}" aria-label="More about ${esc(r.title)}">${coverHTML(shown)}</button>`;
  const title = own
    ? `<a href="#/book/${own.id}" class="t">${esc(own.title)}</a>`
    : `<button class="tile-link t" data-action="preview" data-key="${esc(r.key)}">${esc(r.title)}</button>`;
  const thisYear = new Date().getFullYear();
  const future = r && (!r.year || r.year >= thisYear);
  const actions = own
    ? statusBadge(own)
    : `<button class="btn btn-sm" style="padding:0 10px" data-action="add-result" data-key="${esc(r.key)}" data-v="tbr">+ To read</button>
       ${future ? `<button class="btn btn-sm btn-ghost" style="padding:0 10px" data-action="add-result" data-key="${esc(r.key)}" data-v="upcoming">Upcoming</button>` : ''}`;
  if (r) resultCache.set(r.key, r);
  return `<div class="series-row ${own ? 'owned' : ''}">
    <div class="series-num">${esc(n)}</div>
    ${coverLink}
    <div class="info">
      ${title}
      <div class="small faint">${[(shown.authors || [])[0], shown.year, shown.pages ? `${shown.pages} pp` : null].filter(Boolean).map(esc).join(' · ')}</div>
      <div class="row-wrap" style="margin-top:8px;align-items:center">${actions}</div>
    </div>
  </div>`;
}

export function seriesView(a, b) {
  const byName = a === 'name';
  const id = byName ? `name:${b}` : a;
  const entry = load(id, byName ? null : a, byName ? b : null);
  const name = entry.name || (byName ? b : '') || books().find((x) => x.seriesKey === a)?.series || 'Series';

  const owned = books().filter((x) =>
    (entry.key && x.seriesKey === entry.key) || (x.series && norm(x.series) === norm(name)));
  const used = new Set();
  const merged = entry.items.map((r) => {
    const own = owned.find((o) => !used.has(o.id) && (o.olKey === r.olKey || norm(o.title) === norm(r.title)));
    if (own) used.add(own.id);
    return { num: r.seriesNum, r, own };
  });
  owned.filter((o) => !used.has(o.id)).forEach((own) => merged.push({ num: own.seriesNum, r: null, own }));
  merged.sort((x, y) => (parseFloat(x.num) || 999) - (parseFloat(y.num) || 999));

  const total = merged.length;
  const read = merged.filter((m) => m.own?.status === 'read').length;
  const author = merged.map((m) => (m.own || m.r).authors?.[0]).find(Boolean) || '';
  const lastNum = Math.max(0, ...merged.map((m) => Math.floor(parseFloat(m.num) || 0)));

  const list = entry.state === 'loading' && !merged.length
    ? '<div class="center" style="padding:40px"><span class="loader"></span></div>'
    : merged.length
      ? `<div class="series-list">${merged.map((m) => row(m.num, m.r, m.own)).join('')}</div>`
      : '<p class="faint small">Open Library doesn\'t have the other books in this series yet. You can add them yourself below.</p>';

  return `<div class="stack-lg" style="max-width:760px;margin:0 auto">
    <div>
      <a href="javascript:history.back()" class="back-link">${icons.back} Back</a>
      <div class="eyebrow">Series</div>
      <h1 class="h1" style="margin-top:6px">${esc(name)}</h1>
      ${author ? `<div class="muted" style="margin-top:6px">${esc(author)}</div>` : ''}
    </div>
    ${total ? `<div class="stack" style="gap:8px">
      <div class="spread small"><span class="muted">You've read ${read} of ${total}</span>${entry.state === 'loading' ? '<span class="loader" style="width:14px;height:14px"></span>' : ''}</div>
      <div class="progress"><i style="width:${(read / total) * 100}%"></i></div>
    </div>` : ''}
    ${entry.state === 'error' ? `<div class="row small faint">Couldn't reach Open Library. <button class="btn btn-sm" style="padding:0 12px" data-action="retry-shelf">Try again</button></div>` : ''}
    ${list}
    <button class="btn" data-action="manual-add" data-v="upcoming"
      data-series="${esc(name)}" data-series-key="${esc(entry.key || '')}" data-num="${lastNum + 1}" data-author="${esc(author)}">
      + Add an upcoming book in this series
    </button>
    <p class="tiny faint center" style="margin:0">Series lists come from Open Library and can be incomplete for brand-new books.</p>
  </div>`;
}
