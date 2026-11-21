import { books, getState } from '../store.js';
import { esc, icons, coverHTML, authorLine, starsInline, spiceInline } from '../ui.js';
import { goalRing } from '../charts.js';
import { upcomingCard } from './library.js';

export function readingCard(b) {
  const pct = b.pages ? Math.round((b.progress / b.pages) * 100) : 0;
  return `<div class="card reading-card">
    <a href="#/book/${b.id}">${coverHTML(b)}</a>
    <div class="info">
      <a href="#/book/${b.id}" class="t">${esc(b.title)}</a>
      <div class="small faint">${authorLine(b)}</div>
      <div class="row small">${spiceInline(b.spice)}</div>
      <div style="flex:1"></div>
      <div class="spread small"><span class="muted">${b.pages ? `Page ${b.progress} of ${b.pages}` : 'Pages unknown'}</span><span>${pct}%</span></div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="row" style="margin-top:4px">
        <input class="input mini-input" type="number" inputmode="numeric" min="0" ${b.pages ? `max="${b.pages}"` : ''} value="${b.progress || ''}" placeholder="pg" data-change="progress" data-id="${b.id}" aria-label="Current page">
        <button class="btn btn-sm btn-ghost" data-action="finish" data-id="${b.id}">Mark finished</button>
      </div>
    </div>
  </div>`;
}

export function tile(b, href = `#/book/${b.id}`, extra = '') {
  return `<a class="book-tile" href="${href}">
    ${coverHTML(b)}
    <div><div class="t">${esc(b.title)}</div><div class="a">${authorLine(b)}</div></div>
    ${extra}
  </a>`;
}

export function emptyLibrary() {
  return `<div class="empty">
    <span class="hero-orbit">${icons.orbit}</span>
    <h1 class="display">Blank<br>page</h1>
    <p>Search for a book to start your library, or load a sample shelf to explore the stats and spice tracking first.</p>
    <div class="row" style="justify-content:center; flex-wrap:wrap">
      <a href="#/add" class="btn btn-light">Add a book</a>
      <button class="btn" data-action="load-sample">Load sample library</button>
    </div>
  </div>`;
}

export function homeView() {
  const all = books();
  if (!all.length) return emptyLibrary();
  const year = new Date().getFullYear();
  const reading = all.filter((b) => b.status === 'reading');
  const tbr = all.filter((b) => b.status === 'tbr');
  const upcoming = all.filter((b) => b.status === 'upcoming').sort((a, b) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999'));
  const readThisYear = all.filter((b) => b.status === 'read' && b.dateFinished?.startsWith(String(year)));
  const recent = all.filter((b) => b.status === 'read' && b.dateFinished).sort((a, b) => b.dateFinished.localeCompare(a.dateFinished)).slice(0, 12);
  const goal = getState().goal;
  const pages = readThisYear.reduce((s, b) => s + (b.pages || 0), 0);
  const rated = readThisYear.filter((b) => b.rating);
  const avgRating = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : '—';
  const spiced = readThisYear.filter((b) => b.spice != null);
  const avgSpice = spiced.length ? (spiced.reduce((s, b) => s + b.spice, 0) / spiced.length).toFixed(1) : '—';
  const left = Math.max(0, goal - readThisYear.length);

  const copy = reading.length
    ? `You're in the middle of ${reading.length === 1 ? 'one book' : `${reading.length} books`}, with ${tbr.length} waiting in the pile.`
    : `Nothing on the go. ${tbr.length} books are waiting in your pile.`;

  return `<div class="stack-lg">
    <section class="hero">
      <span class="hero-orbit">${icons.orbit}</span>
      <p class="hero-copy">${copy}<br><br><span class="muted">${readThisYear.length} finished in ${year}${left ? `, ${left} to go.` : '. Goal reached.'}</span></p>
      <h1 class="display">Now<br>reading</h1>
    </section>

    <section>
      ${reading.length
        ? `<div class="reading-list">${reading.map(readingCard).join('')}</div>`
        : `<div class="card center muted small">Pick something from your pile. <a href="#/discover" style="color:var(--text)">Help me choose →</a></div>`}
    </section>

    <section class="grid-2">
      <div class="card goal">
        ${goalRing(readThisYear.length, goal)}
        <div>
          <div class="eyebrow">${year} goal</div>
          <div class="h1" style="margin:6px 0 4px">${readThisYear.length}<span class="faint"> / ${goal}</span></div>
          <a href="#/settings" class="small muted">Change goal</a>
        </div>
      </div>
      <div class="stat-row" style="grid-template-columns:repeat(2,1fr)">
        <div class="stat"><div class="v">${pages.toLocaleString()}</div><div class="l">Pages this year</div></div>
        <div class="stat"><div class="v">${avgRating}</div><div class="l">Avg rating</div></div>
        <div class="stat"><div class="v">${avgSpice}</div><div class="l">Avg spice</div></div>
        <div class="stat"><div class="v">${tbr.length}</div><div class="l">In the pile</div></div>
      </div>
    </section>

    ${upcoming.length ? `<section>
      <div class="section-head"><h2 class="h2">Coming soon</h2><a href="#/library/upcoming">See all ${upcoming.length}</a></div>
      <div class="reading-list">${upcoming.slice(0, 2).map((b) => upcomingCard(b)).join('')}</div>
    </section>` : ''}

    ${tbr.length ? `<section>
      <div class="section-head"><h2 class="h2">Up next</h2><a href="#/library/tbr">See all ${tbr.length}</a></div>
      <div class="shelf">${tbr.slice(0, 14).map((b) => tile(b, `#/book/${b.id}`, `<div class="tile-meta">${spiceInline(b.spice)}</div>`)).join('')}</div>
    </section>` : ''}

    ${recent.length ? `<section>
      <div class="section-head"><h2 class="h2">Recently finished</h2><a href="#/library/read">See all</a></div>
      <div class="shelf">${recent.map((b) => tile(b, `#/book/${b.id}`, `<div class="tile-meta">${starsInline(b.rating)}</div>`)).join('')}</div>
    </section>` : ''}
  </div>`;
}
