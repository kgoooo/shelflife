import { books, getVisibleBook, isUnlocked } from '../store.js';
import { STATUSES, SPICE } from '../data.js';
import { esc, icons, starsInline, spiceInline, coverHTML, authorLine, countdownHTML } from '../ui.js';
import { tile, emptyLibrary } from './home.js';
import { bookDetail } from './book.js';

// Filters survive re-renders within the session.
export const libFilters = { q: '', sort: 'recent', spice: 'any', trope: '' };

const sorters = {
  recent: (a, b) => (b.dateFinished || b.dateStarted || b.dateAdded || '').localeCompare(a.dateFinished || a.dateStarted || a.dateAdded || ''),
  title: (a, b) => a.title.localeCompare(b.title),
  author: (a, b) => (a.authors[0] || '').localeCompare(b.authors[0] || ''),
  rating: (a, b) => (b.rating || 0) - (a.rating || 0),
  spice: (a, b) => (b.spice ?? -1) - (a.spice ?? -1),
  short: (a, b) => (a.pages || 9999) - (b.pages || 9999),
};

export function libraryView(status, selectedId) {
  const all = books();
  if (!all.length) return emptyLibrary();
  const counts = Object.fromEntries(STATUSES.map((s) => [s.id, all.filter((b) => b.status === s.id).length]));
  const usedTropes = [...new Set(all.flatMap((b) => b.tropes))].sort();
  const f = libFilters;
  const q = f.q.trim().toLowerCase();
  if (status === 'private' && !isUnlocked()) status = 'reading';
  let list = all.filter((b) => status === 'all' || (status === 'private' ? b.private : b.status === status));
  if (q) list = list.filter((b) => (b.title + ' ' + b.authors.join(' ') + ' ' + b.series + ' ' + b.tropes.join(' ')).toLowerCase().includes(q));
  if (f.spice !== 'any') list = list.filter((b) => b.spice != null && (f.spice === '0' ? b.spice === 0 : b.spice >= +f.spice));
  if (f.trope) list = list.filter((b) => b.tropes.includes(f.trope));
  list = status === 'upcoming'
    ? [...list].sort((a, b) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999'))
    : [...list].sort(sorters[f.sort] || sorters.recent);

  const selected = selectedId && getVisibleBook(selectedId);
  const base = `#/library/${status}`;

  return `<div class="lib ${selected ? 'has-detail' : ''}">
    <div class="lib-list stack">
      <div class="spread"><h1 class="h1">Library</h1><span class="small faint">${all.length} books</span></div>
      <nav class="tabs" aria-label="Shelves">
        ${STATUSES.map((s) => `<a href="#/library/${s.id}" class="${s.id === status ? 'on' : ''}">${s.label} <span class="count">${counts[s.id]}</span></a>`).join('')}
        <a href="#/library/all" class="${status === 'all' ? 'on' : ''}">All</a>
        ${isUnlocked() ? `<a href="#/library/private" class="${status === 'private' ? 'on' : ''}">${icons.moon} After Dark <span class="count">${all.filter((b) => b.private).length}</span></a>` : ''}
      </nav>
      <div class="search-wrap">${icons.search}<input class="input" type="search" placeholder="Filter by title, author, series, trope" value="${esc(f.q)}" data-change="lib-q" aria-label="Filter books"></div>
      <div class="filter-row">
        <select class="input" data-change="lib-sort" aria-label="Sort">
          ${[['recent', 'Recent'], ['title', 'Title'], ['author', 'Author'], ['rating', 'Rating'], ['spice', 'Spice'], ['short', 'Shortest']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <select class="input" data-change="lib-spice" aria-label="Spice">
          <option value="any">Spice</option>
          ${SPICE.map((s) => `<option value="${s.level}" ${f.spice === String(s.level) ? 'selected' : ''}>${s.level === 0 ? 'Sweet only' : `${s.label}+`}</option>`).join('')}
        </select>
        <select class="input" data-change="lib-trope" aria-label="Trope">
          <option value="">Trope</option>
          ${usedTropes.map((t) => `<option ${f.trope === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
        </select>
      </div>
      ${status === 'upcoming' ? upcomingIntro(list.length) : ''}
      ${status === 'upcoming' && list.length
        ? `<div class="upcoming-list">${list.map((b) => upcomingCard(b, `${base}/${b.id}`, b.id === selectedId)).join('')}</div>`
        : list.length
        ? `<div class="book-grid">${list.map((b) => tile(b, `${base}/${b.id}`, metaFor(b)).replace('class="book-tile"', `class="book-tile ${b.id === selectedId ? 'selected' : ''}"`)).join('')}</div>`
        : status === 'upcoming' ? '' : `<p class="empty small">No books match.</p>`}
    </div>
    <aside class="lib-detail" aria-label="Book details">
      ${selected ? bookDetail(selected, base) : ''}
    </aside>
  </div>`;
}

function metaFor(b) {
  if (b.status === 'read' || b.status === 'dnf') return `<div class="tile-meta">${starsInline(b.rating) || spiceInline(b.spice)}</div>`;
  if (b.status === 'reading' && b.pages) return `<div class="progress"><i style="width:${Math.round((b.progress / b.pages) * 100)}%"></i></div>`;
  return `<div class="tile-meta">${spiceInline(b.spice)}</div>`;
}

export function upcomingCard(b, href = `#/book/${b.id}`, selected = false) {
  const series = b.series ? `${esc(b.series)}${b.seriesNum ? ` · Book ${esc(b.seriesNum)}` : ''}` : '';
  return `<div class="card upcoming-card ${selected ? 'selected' : ''}">
    <a href="${href}">${coverHTML(b)}</a>
    <div class="info">
      ${series ? `<div class="eyebrow">${series}</div>` : ''}
      <a href="${href}" class="t">${esc(b.title)}</a>
      <div class="small faint">${authorLine(b)}</div>
      ${countdownHTML(b)}
    </div>
  </div>`;
}

function upcomingIntro(n) {
  return `<div class="row" style="justify-content:space-between;flex-wrap:wrap">
    <p class="small muted" style="margin:0">${n ? 'Books you\'re waiting on, soonest first.' : 'Waiting on the next book in a series? Add it here with its release date and watch the countdown.'}</p>
    <button class="btn btn-sm" style="padding:0 12px" data-action="manual-add" data-v="upcoming">+ Add upcoming book</button>
  </div>`;
}
