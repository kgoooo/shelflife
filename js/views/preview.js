// "Learn more" sheet for a book that isn't in your library yet (Discover suggestions, search results).
import { workDetails, workRatings } from '../api.js';
import { findByKey, isUnlocked } from '../store.js';
import { TROPES, TROPE_SUBJECTS } from '../data.js';
import { esc, coverHTML, openSheet, starsInline, fmtDate } from '../ui.js';
import { resultCache } from './add.js';

const detailCache = new Map(); // result key -> Promise<{description, subjects, ratings}>

// Apple results already carry a description and rating; Open Library ones need two lookups.
// Merged results prefer Apple's (usually fuller) description and larger rating sample.
export function getDetails(key) {
  if (!detailCache.has(key)) {
    const r = resultCache.get(key) || {};
    const ol = r.olKey
      ? Promise.all([workDetails(r.olKey), workRatings(r.olKey)]).then(([d, ratings]) => ({ ...d, ratings }))
      : Promise.resolve({});
    detailCache.set(key, ol.then((d) => ({
      description: r.description || d.description || '',
      subjects: d.subjects || [],
      ratings: r.rating && (!d.ratings || r.rating.count > d.ratings.count) ? r.rating : d.ratings && { ...d.ratings, source: 'Open Library' },
    })));
  }
  return detailCache.get(key);
}

const isFuture = (date) => date && date > new Date().toISOString().slice(0, 10);

// Turn Open Library's messy subject list into likely tropes + a few clean genre tags.
function sortSubjects(subjects) {
  const slugToTrope = Object.fromEntries(Object.entries(TROPE_SUBJECTS).map(([t, s]) => [s.replace(/_/g, ' '), t]));
  const tropes = new Set();
  const tags = new Set();
  for (const raw of subjects) {
    const s = String(raw).trim();
    const l = s.toLowerCase();
    if (!s || s.includes(':') || s.length > 32 || /^fiction,|general$|^\d/.test(l)) continue;
    const trope = TROPES.find((t) => l.includes(t.toLowerCase().replace(/ \/ /g, ' '))) || slugToTrope[l];
    if (trope) tropes.add(trope);
    else tags.add(s.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  return { tropes: [...tropes].slice(0, 8), tags: [...tags].slice(0, 10) };
}

function actionsHTML(key) {
  const owned = findByKey(key);
  if (owned && owned.private && !isUnlocked()) return '<div class="btn btn-block" style="cursor:default">✓ In your library</div>';
  if (owned) {
    return `<a class="btn btn-light btn-block" href="#/book/${owned.id}" data-close>✓ In your library · Open it</a>`;
  }
  if (isFuture(resultCache.get(key)?.releaseDate)) {
    return `<button class="btn btn-light btn-block" data-action="add-result" data-key="${esc(key)}" data-v="upcoming">+ Add to Upcoming</button>`;
  }
  return `<div class="preview-actions">
    <button class="btn btn-light" data-action="add-result" data-key="${esc(key)}" data-v="tbr">+ To read</button>
    <button class="btn" data-action="add-result" data-key="${esc(key)}" data-v="reading">Reading</button>
    <button class="btn" data-action="add-result" data-key="${esc(key)}" data-v="read">Read</button>
  </div>`;
}

export function refreshPreviewActions() {
  const box = document.querySelector('#sheet [data-preview-actions]');
  if (box) box.innerHTML = actionsHTML(box.dataset.previewActions);
}

export function openPreview(key) {
  const r = resultCache.get(key);
  if (!r) return;
  openSheet('About this book', `<div class="stack-lg">
    <div class="preview-head">
      ${coverHTML(r, 'L')}
      <div class="stack" style="gap:6px;min-width:0">
        <h2 class="detail-title">${esc(r.title)}</h2>
        <div class="muted">${esc(r.authors.join(', ') || 'Unknown author')}</div>
        <div class="small faint">${[isFuture(r.releaseDate) ? null : r.year, r.pages ? `${r.pages} pages` : null].filter(Boolean).join(' · ')}</div>
        ${isFuture(r.releaseDate) ? `<span class="tag rose" style="align-self:flex-start">Comes out ${fmtDate(r.releaseDate)}</span>` : ''}
        ${r.seriesKey ? `<a class="series-link" href="#/series/${esc(r.seriesKey)}" data-close>${r.seriesNum ? `Book ${esc(r.seriesNum)} · ` : ''}${esc(r.series)} · See the series <span aria-hidden="true">→</span></a>` : ''}
      </div>
    </div>
    <div data-preview-actions="${esc(key)}">${actionsHTML(key)}</div>
    <div data-preview-body><div class="center" style="padding:24px"><span class="loader"></span></div></div>
  </div>`);

  getDetails(key).then((d) => {
    const body = document.querySelector('#sheet [data-preview-body]');
    if (!body) return;
    const { tropes, tags } = sortSubjects([...(d.subjects || []), ...(r.subjects || [])]);
    body.innerHTML = `<div class="stack-lg">
      ${d.ratings ? `<div class="preview-stats">
        <span>${starsInline(Math.round(d.ratings.average * 2) / 2)} <b>${d.ratings.average.toFixed(1)}</b> on ${esc(d.ratings.source || 'Open Library')}</span>
        <span><b>${d.ratings.count.toLocaleString()}</b> ratings</span>
      </div>` : ''}
      <section class="detail-section" style="border:0;padding:0">
        <h3>About</h3>
        ${d.description
          ? `<div class="desc open" style="max-height:none">${esc(d.description).replace(/(\r?\n\s*)+/g, '<br><br>')}</div>`
          : '<p class="small faint" style="margin:0">Open Library doesn\'t have a description for this one.</p>'}
      </section>
      ${tropes.length ? `<section class="detail-section"><h3>Possible tropes</h3><div class="row-wrap">${tropes.map((t) => `<span class="tag rose">${esc(t)}</span>`).join('')}</div></section>` : ''}
      ${tags.length ? `<section class="detail-section"><h3>Subjects</h3><div class="row-wrap">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></section>` : ''}
      <p class="tiny faint" style="margin:0">Spice and content warnings are yours to tag once it's on your shelf.</p>
    </div>`;
  });
}
