// Series page: every book in a series in reading order, merged with what's on your shelves.
import { books, updateBook } from '../store.js';
import { bySeries, searchBooks, olMatch, detectSeries, googleKey, googleSeriesFor, googleSeriesMembers, seriesMembersByName, sameBook, norm as titleKey, stripSeriesSuffix, hardcoverConnected, hcSeriesFor, hcSeriesMembers } from '../api.js';
import { esc, icons, coverHTML, starsInline, countdown } from '../ui.js';
import { resultCache } from './add.js';

const cache = new Map();      // series id -> { state: 'loading'|'done'|'error', items, key, name }
const checking = new Set();   // book ids being looked up

const norm = (s) => String(s || '').toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]/g, '');

export const seriesHref = (b) => b.seriesKey ? `#/series/${b.seriesKey}` : `#/series/name/${encodeURIComponent(b.series)}`;

// Look up a book's series once (and again whenever the detection gets smarter: bump the version).
// Version 2 = checked with the free sources; 3 = also checked with Google. Books get re-checked
// once after you add a Google key.
const seriesCheck = () => (hardcoverConnected() ? 4 : googleKey() ? 3 : 2); // 4 = checked with Hardcover
export function ensureSeries(b) {
  if (b.seriesKey || b.seriesChecked >= seriesCheck() || checking.has(b.id)) return;
  if (b.series && b.seriesNum) return;                        // you've filled it in yourself
  checking.add(b.id);
  (async () => {
    const patch = { seriesChecked: seriesCheck() };
    // Books found only on Apple/Google: match them to an Open Library work first (series, page count).
    let book = b;
    if (!b.olKey && b.title) {
      const ol = await olMatch(b.title, b.authors[0]).catch(() => null);
      if (ol) { patch.olKey = ol.olKey; if (!b.pages && ol.pages) patch.pages = ol.pages; book = { ...b, olKey: ol.olKey }; }
    }
    const info = await detectSeries(book).catch(() => null);
    if (info?.series && (!b.series || norm(b.series) === norm(info.series))) {
      Object.assign(patch, { series: b.series || info.series, seriesNum: b.seriesNum || info.seriesNum || '' });
      if (info.seriesKey) patch.seriesKey = info.seriesKey;
    }
    updateBook(b.id, patch);
  })().catch(() => {}).finally(() => checking.delete(b.id));
}

// Look up every book in your library that hasn't been checked with the current detection.
export async function backfillSeries() {
  const todo = books().filter((b) => !b.seriesKey && !(b.seriesChecked >= seriesCheck()) && !(b.series && b.seriesNum)).slice(0, 30);
  for (const b of todo) {
    ensureSeries(b);
    await new Promise((r) => setTimeout(r, 1500));            // gentle on the book sites
  }
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
    const owner = books().find((b) => (k && b.seriesKey === k) || (name && norm(b.series) === norm(name)));
    const author = owner?.authors?.[0] || '';
    // Hardcover first (when connected), then Google Books (with a key): the first source that has
    // the series sets the list and numbering; the others only add books it's missing.
    let hardcover = [];
    if (k && k.startsWith('hc:')) {
      const h = await hcSeriesMembers(k.slice(3)).catch(() => ({ items: [] }));
      hardcover = h.items;
      if (h.name) entry.name = h.name;
    } else if (hardcoverConnected() && owner) {
      const found = await hcSeriesFor(owner.title, author, { sameBook }).catch(() => null);
      if (found?.seriesKey) {
        const h = await hcSeriesMembers(found.seriesKey.slice(3)).catch(() => ({ items: [] }));
        hardcover = h.items;
        if (h.name && !entry.name) entry.name = h.name;
      }
    }
    let google = [];
    if (k && k.startsWith('g:')) google = await googleSeriesMembers(k.slice(2)).catch(() => []);
    else if (!hardcover.length && googleKey() && owner) {
      const g = await googleSeriesFor(owner.title, author).catch(() => null);
      if (g?.seriesKey) {
        google = await googleSeriesMembers(g.seriesKey.slice(2)).catch(() => []);
        if (!entry.name && g.series) entry.name = g.series;
      }
    }
    // Then the other sources, which also fill in books Google doesn't carry.
    let others = [];
    if (k && !k.startsWith('g:') && !k.startsWith('hc:')) others = await bySeries(k).catch(() => []);  // Open Library series
    else if (!hardcover.length && name && author) others = await seriesMembersByName(name, author).catch(() => []);  // pieced together
    entry.items = [...hardcover];
    google.forEach((x) => { if (!entry.items.some((i) => sameBook(i, x))) entry.items.push(x); });
    // When Hardcover has the series, only add other sources' books that carry a number Hardcover lacks.
    if (hardcover.length) others = others.filter((x) => x.seriesNum && !hardcover.some((h) => parseFloat(h.seriesNum) === parseFloat(x.seriesNum)));
    others.forEach((x) => { if (!entry.items.some((i) => sameBook(i, x))) entry.items.push(x); });
    entry.items.sort((a, b) => (parseFloat(a.seriesNum) || 999) - (parseFloat(b.seriesNum) || 999));
    if (!entry.name) entry.name = entry.items[0]?.series || name || '';
    entry.state = 'done';
  })()
    .catch(() => { entry.state = 'error'; })
    .finally(() => {
      // Book pages and the library's detail pane show series info too.
      if (/^#\/(series|book|library)/.test(location.hash)) window.dispatchEvent(new HashChangeEvent('hashchange'));
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
  const n = num === '' || num == null ? '·' : String(num) === '0' ? 'P' : String(num).padStart(2, '0');
  const coverLink = own
    ? `<a href="#/book/${own.id}" style="width:62px;flex-shrink:0">${coverHTML(shown)}</a>`
    : `<button class="tile-link" style="width:62px;flex-shrink:0" data-action="preview" data-key="${esc(r.key)}" aria-label="More about ${esc(r.title)}">${coverHTML(shown)}</button>`;
  const title = own
    ? `<a href="#/book/${own.id}" class="t">${esc(own.title)}</a>`
    : `<button class="tile-link t" data-action="preview" data-key="${esc(r.key)}">${esc(stripSeriesSuffix(r.title))}</button>`;
  const thisYear = new Date().getFullYear();
  const future = r && (!r.year || r.year >= thisYear);
  const actions = own
    ? statusBadge(own)
    : `<button class="btn btn-sm" style="padding:0 10px" data-action="add-result" data-key="${esc(r.key)}" data-v="tbr">+ To read</button>
       ${future ? `<button class="btn btn-sm btn-ghost" style="padding:0 10px" data-action="add-result" data-key="${esc(r.key)}" data-v="upcoming">Upcoming</button>` : ''}`;
  if (r) resultCache.set(r.key, r);
  const open = own ? `onclick="if(!event.target.closest('a,button'))location.hash='#/book/${own.id}'"` : `data-action="preview" data-key="${esc(r.key)}"`;
  return `<div class="series-row ${own ? 'owned' : ''}" ${open}>
    <div class="series-num">${esc(n)}</div>
    ${coverLink}
    <div class="info">
      ${title}
      <div class="small faint">${[(shown.authors || [])[0], shown.year, shown.pages ? `${shown.pages} pp` : null].filter(Boolean).map(esc).join(' · ')}</div>
      <div class="row-wrap" style="margin-top:8px;align-items:center">${actions}</div>
    </div>
  </div>`;
}

// Everything known about a series: Open Library's list merged with the books on your shelves.
// `a`/`b` are the route parts: a series key, or 'name' + a series typed in by hand.
export function seriesData(a, b) {
  const byName = a === 'name';
  const id = byName ? `name:${b}` : a;
  const entry = load(id, byName ? null : a, byName ? b : null);
  const name = entry.name || (byName ? b : '') || books().find((x) => x.seriesKey === a)?.series || 'Series';

  const owned = books().filter((x) =>
    (entry.key && x.seriesKey === entry.key) || (x.series && norm(x.series) === norm(name)));
  const used = new Set();
  const merged = entry.items.map((r) => {
    const own = owned.find((o) => !used.has(o.id) && ((r.olKey && o.olKey === r.olKey) || (r.hardcoverId && o.hardcoverId === r.hardcoverId) || titleKey(o.title) === titleKey(r.title)));
    if (own) {
      used.add(own.id);
      // Learned this book's number from the series list: save it, so its page can say "Book 1 of 7".
      if (!own.seriesNum && r.seriesNum) setTimeout(() => updateBook(own.id, { seriesNum: r.seriesNum }), 0);
    }
    return { num: r.seriesNum || own?.seriesNum || '', r, own };
  });
  owned.filter((o) => !used.has(o.id)).forEach((own) => merged.push({ num: own.seriesNum, r: null, own }));
  // Numbered books in order (a prequel "0" first), then unnumbered ones by year.
  const n = (m) => (m.num === '' || m.num == null || isNaN(parseFloat(m.num)) ? Infinity : parseFloat(m.num));
  const yr = (m) => (m.own || m.r)?.year || (m.own || m.r)?.releaseDate?.slice(0, 4) || 9999;
  merged.sort((x, y) => n(x) - n(y) || yr(x) - yr(y));

  // "Book 2 of 5" counts the main books; novellas like 1.5 are listed but not counted.
  const mainNums = merged.map((m) => parseFloat(m.num)).filter((n) => Number.isInteger(n) && n > 0); // prequels (0) don't count
  const mainTotal = Math.max(mainNums.length, ...mainNums, 0);
  return {
    entry, name, merged,
    total: merged.length,
    mainTotal,
    read: merged.filter((m) => m.own?.status === 'read').length,
    author: merged.map((m) => (m.own || m.r).authors?.[0]).find(Boolean) || '',
    lastNum: Math.max(0, ...merged.map((m) => Math.floor(parseFloat(m.num) || 0))),
  };
}

const routeFor = (b) => b.seriesKey ? [b.seriesKey] : ['name', b.series];

// "Book 2 of 5" if the series list is already loaded (never starts a lookup).
export function seriesCountLabel(num, seriesKey) {
  const e = seriesKey && cache.get(seriesKey);
  if (!e || e.state !== 'done' || !e.items.length) return num ? `Book ${num}` : '';
  const total = seriesData(seriesKey).mainTotal;
  return num ? `Book ${num} of ${total}` : `${total} books`;
}

// The series block on a book's page: name, "Book 2 of 5", and a strip of every book in it.
export function seriesCard(book) {
  if (!book.series && !book.seriesKey) {
    if (checking.has(book.id)) return '<p class="small faint" style="margin:0">Checking for a series… <span class="loader" style="width:12px;height:12px;vertical-align:-2px"></span></p>';
    return `<button class="btn btn-sm btn-ghost series-add" data-action="edit-info" data-id="${book.id}">Part of a series? Add it</button>`;
  }
  const d = seriesData(...routeFor(book));
  const loading = d.entry.state === 'loading';
  const pos = book.seriesNum ? `Book ${esc(book.seriesNum)}${d.mainTotal ? ` of ${d.mainTotal}` : ''}` : (d.mainTotal ? `${d.mainTotal} books` : '');
  const strip = d.merged.length > 1 ? `<div class="series-strip">${d.merged.map((m) => {
    const shown = m.own || m.r;
    const current = m.own && m.own.id === book.id;
    if (m.r) resultCache.set(m.r.key, m.r);
    const inner = `${coverHTML(shown)}<span class="strip-num">${esc(m.num || '')}</span>${m.own?.status === 'read' ? '<span class="strip-done" aria-label="Read">✓</span>' : ''}`;
    return current
      ? `<div class="strip-item current" aria-current="true" title="${esc(shown.title)}">${inner}</div>`
      : m.own
        ? `<a class="strip-item" href="#/book/${m.own.id}" title="${esc(shown.title)}">${inner}</a>`
        : `<button class="strip-item" data-action="preview" data-key="${esc(m.r.key)}" title="${esc(shown.title)}">${inner}</button>`;
  }).join('')}</div>` : '';
  return `<section class="series-card">
    <a class="series-card-head" href="${seriesHref(book)}">
      <span>
        <span class="eyebrow">Series</span>
        <span class="series-card-name">${esc(d.name || book.series)}</span>
        <span class="small muted">${pos}${d.total ? ` · you've read ${d.read}` : ''}${loading ? ' <span class="loader" style="width:12px;height:12px;vertical-align:-2px"></span>' : ''}</span>
      </span>
      <span class="series-card-go">See all <span aria-hidden="true">→</span></span>
    </a>
    ${strip}
  </section>`;
}

export function seriesView(a, b) {
  const { entry, name, merged, total, mainTotal, read, author, lastNum } = seriesData(a, b);

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
      <div class="spread small"><span class="muted">${mainTotal} book${mainTotal === 1 ? '' : 's'}${total > mainTotal ? ` + ${total - mainTotal} extra` : ''} · you've read ${read}</span>${entry.state === 'loading' ? '<span class="loader" style="width:14px;height:14px"></span>' : ''}</div>
      <div class="progress"><i style="width:${Math.min(100, (read / Math.max(1, total)) * 100)}%"></i></div>
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
