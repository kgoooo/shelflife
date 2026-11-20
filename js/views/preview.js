// "Learn more" sheet for a book that isn't in your library yet (Discover suggestions, search results).
import { workDetails, workRatings } from '../api.js';
import { findByOlKey } from '../store.js';
import { TROPES, TROPE_SUBJECTS } from '../data.js';
import { esc, coverHTML, openSheet, starsInline } from '../ui.js';
import { resultCache } from './add.js';

const detailCache = new Map(); // olKey -> Promise<{description, subjects, ratings}>

export function getDetails(key) {
  if (!detailCache.has(key)) {
    detailCache.set(key, Promise.all([workDetails(key), workRatings(key)])
      .then(([d, ratings]) => ({ ...d, ratings })));
  }
  return detailCache.get(key);
}

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
  const owned = findByOlKey(key);
  if (owned) {
    return `<a class="btn btn-light btn-block" href="#/book/${owned.id}" data-close>✓ In your library · Open it</a>`;
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
        <div class="small faint">${[r.year, r.pages ? `${r.pages} pages` : null].filter(Boolean).join(' · ')}</div>
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
        <span>${starsInline(Math.round(d.ratings.average * 2) / 2)} <b>${d.ratings.average.toFixed(1)}</b> on Open Library</span>
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
