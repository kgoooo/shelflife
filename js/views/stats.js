import { books } from '../store.js';
import { SPICE } from '../data.js';
import { esc } from '../ui.js';
import { barChart, hBars } from '../charts.js';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const tally = (arr) => {
  const o = {};
  arr.forEach((k) => { if (k) o[k] = (o[k] || 0) + 1; });
  return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
};

export function statsView(yearParam) {
  const all = books();
  const finished = all.filter((b) => b.status === 'read' && b.dateFinished);
  const years = [...new Set(finished.map((b) => b.dateFinished.slice(0, 4)))].sort().reverse();
  const thisYear = String(new Date().getFullYear());
  if (!years.includes(thisYear)) years.unshift(thisYear);
  const year = yearParam || thisYear;
  const isAll = year === 'all';
  const read = isAll ? finished : finished.filter((b) => b.dateFinished.startsWith(year));
  const dnf = all.filter((b) => b.status === 'dnf' && (isAll || (b.dateStarted || b.dateAdded || '').startsWith(year)));

  const pages = read.reduce((s, b) => s + (b.pages || 0), 0);
  const rated = read.filter((b) => b.rating);
  const avgRating = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(2) : '—';
  const spiced = read.filter((b) => b.spice != null);
  const avgSpice = spiced.length ? (spiced.reduce((s, b) => s + b.spice, 0) / spiced.length).toFixed(1) : '—';
  const withPages = read.filter((b) => b.pages);
  const avgLen = withPages.length ? Math.round(pages / withPages.length) : '—';
  const days = read.filter((b) => b.dateStarted).map((b) => Math.max(1, Math.round((new Date(b.dateFinished) - new Date(b.dateStarted)) / 864e5) + 1));
  const avgDays = days.length ? (days.reduce((s, d) => s + d, 0) / days.length).toFixed(1) : '—';

  // Monthly (or yearly for all-time)
  let timeBooks, timePages;
  if (isAll) {
    const ys = [...years].filter((y) => finished.some((b) => b.dateFinished.startsWith(y))).sort();
    timeBooks = ys.map((y) => ({ label: y.slice(2), value: finished.filter((b) => b.dateFinished.startsWith(y)).length, tip: `${y}: ${finished.filter((b) => b.dateFinished.startsWith(y)).length} books` }));
    timePages = ys.map((y) => { const v = finished.filter((b) => b.dateFinished.startsWith(y)).reduce((s, b) => s + (b.pages || 0), 0); return { label: y.slice(2), value: v, tip: `${y}: ${v.toLocaleString()} pages` }; });
  } else {
    timeBooks = MONTHS.map((m, i) => { const v = read.filter((b) => +b.dateFinished.slice(5, 7) === i + 1).length; return { label: m, value: v, tip: `${MONTH_NAMES[i]}: ${v} book${v === 1 ? '' : 's'}` }; });
    timePages = MONTHS.map((m, i) => { const v = read.filter((b) => +b.dateFinished.slice(5, 7) === i + 1).reduce((s, b) => s + (b.pages || 0), 0); return { label: m, value: v, tip: `${MONTH_NAMES[i]}: ${v.toLocaleString()} pages` }; });
  }

  const ratingDist = [1, 2, 3, 4, 5].map((s) => { const v = rated.filter((b) => Math.ceil(b.rating) === s).length; return { label: `${s}★`, value: v, tip: `${s - 0.5}–${s} stars: ${v}` }; });
  const spiceDist = SPICE.map((s) => { const v = spiced.filter((b) => b.spice === s.level).length; return { label: s.level === 0 ? 'Sweet' : String(s.level), value: v, tip: `${s.label}: ${v}` }; });

  const tropes = tally(read.flatMap((b) => b.tropes)).slice(0, 10);
  const moods = tally(read.flatMap((b) => b.moods)).slice(0, 8);
  const pace = tally(read.map((b) => b.pace));
  const authors = tally(read.flatMap((b) => b.authors.slice(0, 1))).slice(0, 6);
  const formats = tally(read.map((b) => b.format));
  const warnings = tally(read.flatMap((b) => Object.keys(b.warnings || {}))).slice(0, 8);

  // Which tropes do you rate highest? (min 2 books)
  const tropeRatings = {};
  rated.forEach((b) => b.tropes.forEach((t) => { (tropeRatings[t] ||= []).push(b.rating); }));
  const bestTropes = Object.entries(tropeRatings).filter(([, r]) => r.length >= 2)
    .map(([label, r]) => ({ label, value: +(r.reduce((s, x) => s + x, 0) / r.length).toFixed(1) }))
    .sort((a, b) => b.value - a.value).slice(0, 6);

  const top = rated.slice().sort((a, b) => b.rating - a.rating)[0];
  const spiciest = spiced.slice().sort((a, b) => b.spice - a.spice)[0];

  return `<div class="stack-lg">
    <div class="spread" style="flex-wrap:wrap">
      <h1 class="h1">Reading stats</h1>
      <nav class="tabs" style="flex:0 1 auto" aria-label="Year">
        ${years.slice(0, 4).map((y) => `<a href="#/stats/${y}" class="${y === year ? 'on' : ''}">${y}</a>`).join('')}
        <a href="#/stats/all" class="${isAll ? 'on' : ''}">All time</a>
      </nav>
    </div>

    ${!read.length ? `<div class="card center muted">No finished books ${isAll ? 'yet' : `in ${year}`}. Mark a book as read and it'll show up here.</div>` : `
    <div class="stat-row">
      <div class="stat"><div class="v">${read.length}</div><div class="l">Books read</div></div>
      <div class="stat"><div class="v">${pages.toLocaleString()}</div><div class="l">Pages read</div></div>
      <div class="stat"><div class="v">${avgRating}</div><div class="l">Avg rating</div></div>
      <div class="stat"><div class="v">${avgSpice}</div><div class="l">Avg spice (0–5)</div></div>
      <div class="stat"><div class="v">${avgLen}</div><div class="l">Avg pages per book</div></div>
      <div class="stat"><div class="v">${avgDays}</div><div class="l">Avg days per book</div></div>
      <div class="stat"><div class="v">${dnf.length}</div><div class="l">Did not finish</div></div>
      <div class="stat"><div class="v">${tropes.length ? tropes[0].value : 0}</div><div class="l">${tropes.length ? esc(tropes[0].label) : 'Top trope'}</div></div>
    </div>

    <div class="stats-grid">
      <div class="card chart-card"><h2 class="h2">Books ${isAll ? 'per year' : 'per month'}</h2><div class="sub">Finished books</div>${barChart(timeBooks)}</div>
      <div class="card chart-card"><h2 class="h2">Pages ${isAll ? 'per year' : 'per month'}</h2><div class="sub">Pages from finished books</div>${barChart(timePages, { color: 'sand' })}</div>
      <div class="card chart-card"><h2 class="h2">Spice levels</h2><div class="sub">How hot your reads ran</div>${barChart(spiceDist, { color: 'rose', height: 150 })}</div>
      <div class="card chart-card"><h2 class="h2">Ratings</h2><div class="sub">Half stars round up</div>${barChart(ratingDist, { height: 150 })}</div>
      <div class="card chart-card"><h2 class="h2">Top tropes</h2><div class="sub">Books tagged with each</div>${hBars(tropes)}</div>
      <div class="card chart-card"><h2 class="h2">Tropes you rate highest</h2><div class="sub">Average rating, tropes on 2+ books</div>${hBars(bestTropes, { color: 'light', max: 5 })}</div>
      <div class="card chart-card"><h2 class="h2">Moods</h2><div class="sub">How your books felt</div>${hBars(moods, { color: 'sage' })}</div>
      <div class="card chart-card"><h2 class="h2">Pace</h2><div class="sub">Slow, medium or fast</div>${hBars(pace, { color: 'sand' })}
        <div class="divider" style="margin:18px 0 12px"></div><h2 class="h2" style="margin-bottom:12px">Formats</h2>${hBars(formats, { color: 'light' })}</div>
      <div class="card chart-card"><h2 class="h2">Most-read authors</h2><div class="sub">By books finished</div>${hBars(authors, { color: 'light' })}</div>
      <div class="card chart-card"><h2 class="h2">Content you encountered</h2><div class="sub">Warnings on finished books</div>${hBars(warnings, { color: 'sand' })}</div>
      ${top || spiciest ? `<div class="card span-2 grid-2">
        ${top ? `<div><div class="eyebrow">Highest rated</div><a href="#/book/${top.id}" class="h2" style="display:block;margin-top:6px">${esc(top.title)}</a><div class="small faint">${top.rating} stars · ${esc(top.authors[0] || '')}</div></div>` : ''}
        ${spiciest ? `<div><div class="eyebrow">Spiciest</div><a href="#/book/${spiciest.id}" class="h2" style="display:block;margin-top:6px">${esc(spiciest.title)}</a><div class="small faint">${SPICE[spiciest.spice].label} · ${esc(spiciest.authors[0] || '')}</div></div>` : ''}
      </div>` : ''}
    </div>`}
  </div>`;
}
