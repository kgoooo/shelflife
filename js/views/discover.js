import { books, getState } from '../store.js';
import { MOODS, SPICE, TROPE_SUBJECTS, PACES } from '../data.js';
import { bySeries, findBooks, foreignBlurb, googleKey, looksTranslated, norm, notANovel, popularBySubjects } from '../api.js';
import { suggestTags } from '../autotag.js';
import { esc, icons, coverHTML, authorLine, spiceInline, fmtDate } from '../ui.js';
import { resultCache } from './add.js';

export const pickFilters = { moods: [], minSpice: 0, maxSpice: 5, maxPages: 0, pace: '', pickId: null };
const cache = new Map(); // shelf id -> Promise<results>, for this session

export function matchingTbr() {
  const f = pickFilters;
  return books().filter((b) => b.status === 'tbr'
    && (!f.moods.length || f.moods.some((m) => b.moods.includes(m)))
    && (b.spice == null || (b.spice >= f.minSpice && b.spice <= f.maxSpice))
    && (!f.maxPages || !b.pages || b.pages <= f.maxPages)
    && (!f.pace || !b.pace || b.pace === f.pace));
}

/* ------------------------------------------------------------------
   Recommendations
   1. Your taste: tropes and moods weighted by how you rated the books they're on
      (loved books count for, disliked and DNF books count against), your 4★+ authors,
      and series you've started.
   2. Candidates: Apple Books (plus Google Books with a key) searched for your favourite
      tropes, with Open Library subjects as a fallback. Apple results carry a blurb and
      genres, so each candidate's tropes and moods are estimated the same way new books
      get tagged.
   3. Ranking: matches with your liked tropes and moods, minus disliked ones, plus a
      little for popularity (rating count) and recency.
   Anything already in your library (any shelf, After Dark included) or dismissed is hidden.
------------------------------------------------------------------- */

const lastName = (a) => String(a || '').toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).pop() || '';
export const bookId = (b) => `${norm(b.title)}|${lastName(b.authors?.[0])}`;

// Everything you own or said no to, matched by title + author (editions and sources differ).
function excluded() {
  const s = getState();
  const ids = new Set(s.books.map(bookId));
  s.dismissed.forEach((d) => ids.add(d));
  const keys = new Set(s.books.flatMap((b) => [b.olKey, b.appleId && `apple:${b.appleId}`, b.googleId && `google:${b.googleId}`].filter(Boolean)));
  return (r) => ids.has(bookId(r)) || keys.has(r.key) || (r.olKey && keys.has(r.olKey));
}

function tasteProfile() {
  const all = getState().books.filter((b) => !b.private || books().includes(b));
  const tropes = {}, moods = {}, authors = {};
  for (const b of all) {
    let w;
    if (b.status === 'dnf') w = -1.5;
    else if (b.status === 'read') w = b.rating ? b.rating - 2.75 : 0.4;
    else if (b.status === 'reading') w = 0.5;
    else w = 0.25;                                   // your to-read pile hints at taste too
    b.tropes.forEach((t) => { tropes[t] = (tropes[t] || 0) + w; });
    b.moods.forEach((m) => { moods[m] = (moods[m] || 0) + w; });
    if (b.status === 'read' && b.rating >= 4) b.authors.slice(0, 1).forEach((a) => { authors[a] = (authors[a] || 0) + b.rating; });
  }
  const top = (o) => Object.entries(o).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const series = {};
  all.filter((b) => b.seriesKey && (b.status === 'read' || b.status === 'reading')).forEach((b) => {
    const n = parseFloat(b.seriesNum) || 0;
    if (!series[b.seriesKey] || n > series[b.seriesKey].n) series[b.seriesKey] = { n, name: b.series };
  });
  const rated = all.filter((b) => b.status === 'read' || b.status === 'reading');
  const romanceReader = rated.length > 0 && rated.filter((b) => b.tropes.length || /romance/i.test((b.subjects || []).join(' '))).length >= rated.length / 2;
  return { tropes, moods, topTropes: top(tropes), topAuthors: top(authors), series, romanceReader };
}

const year = new Date().getFullYear();
const todayISO = () => new Date().toISOString().slice(0, 10);

function score(r, taste) {
  const est = suggestTags({ description: r.description || '', subjects: r.subjects || [] });
  const tropes = [...new Set([...(r.seedTropes || []), ...est.tropes])];
  let s = 0;
  const reasons = [];
  for (const t of tropes) {
    const w = taste.tropes[t] || 0;
    s += Math.max(-3, Math.min(3, w)) * 1.2;
    if (w > 0) reasons.push([t, w]);
  }
  for (const m of est.moods) s += Math.max(-2, Math.min(2, taste.moods[m] || 0)) * 0.4;
  if (r.popularity) s += Math.log10(r.popularity + 1) * 0.9;            // readers who've shelved it
  else if (r.rating?.count) s += Math.log10(r.rating.count + 1) * 0.7;
  if (taste.romanceReader && !/romance|love stories|romantasy|erotic|lovers/i.test(`${(r.subjects || []).join(' ')} ${(r.seedTropes || []).join(' ')}`)) s -= 4;
  const y = r.year || 0;
  s += y >= year - 2 ? 1.2 : y >= year - 6 ? 0.6 : y && y < year - 25 ? -1 : 0;
  if (!r.cover) s -= 1;
  return { ...r, score: s, reasons: reasons.sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 2) };
}

function clean(list, isOut) {
  const seen = new Set();
  return list.filter((r) => {
    const id = bookId(r);
    if (seen.has(id) || isOut(r) || looksTranslated(r.title) || foreignBlurb(r.description) || notANovel(r) || !r.authors?.length) return false;
    seen.add(id);
    return true;
  });
}

// Open Library subject names readers use for each trope (lower case).
const EXTRA_SUBJECTS = {
  'Romantasy': ['romantasy', 'fantasy romance', 'romantic fantasy'],
  'Fae': ['fae', 'faeries', 'fairies'],
  'Hockey romance': ['hockey romance', 'hockey stories'],
  'Sports romance': ['sports romance'],
  'College': ['college romance', 'new adult romance'],
  'Grumpy / sunshine': ['grumpy sunshine', 'grumpy/sunshine'],
  'Small town': ['small town romance'],
  'Dark romance': ['dark romance'],
  'Romcom': ['romantic comedy', 'romcom'],
  'Mafia': ['mafia romance', 'mafia'],
  'Shifters': ['shifter romance', 'shapeshifters'],
  'Vampires': ['vampire romance', 'vampires'],
  'Why choose': ['why choose', 'reverse harem'],
  'Queer romance': ['lgbtq romance', 'gay romance', 'sapphic romance'],
};
const subjectsFor = (t) => [...new Set([
  t.toLowerCase().replace(' / ', ' '),
  ...(EXTRA_SUBJECTS[t] || []),
  ...(TROPE_SUBJECTS[t] ? [TROPE_SUBJECTS[t].replace(/_/g, ' ')] : []),
])];

// Candidates for one trope: the most-shelved books with it, plus what's trending.
function tropeCandidates(trope) {
  const id = `trope:${trope}`;
  if (!cache.has(id)) {
    const phrases = subjectsFor(trope);
    cache.set(id, Promise.allSettled([
      popularBySubjects(phrases, { sort: 'readinglog', limit: 40 }),
      popularBySubjects(phrases, { sort: 'trending', limit: 20 }),
    ]).then((res) => {
      if (res.every((x) => x.status === 'rejected')) throw new Error('offline');
      return res.flatMap((x) => x.value || []).map((r) => ({ ...r, seedTropes: [trope] }));
    }).catch((e) => { cache.delete(id); throw e; }));
  }
  return cache.get(id);
}

function authorCandidates(author) {
  const id = `author:${author}`;
  if (!cache.has(id)) {
    cache.set(id, findBooks(author).then((list) => list.filter((r) => lastName(r.authors[0]) === lastName(author)))
      .catch((e) => { cache.delete(id); throw e; }));
  }
  return cache.get(id);
}

function nextInSeries(seriesKey, after) {
  const id = `series:${seriesKey}`;
  if (!cache.has(id)) cache.set(id, bySeries(seriesKey).catch((e) => { cache.delete(id); throw e; }));
  return cache.get(id).then((list) => list.filter((r) => parseFloat(r.seriesNum) > after));
}

export function discoverView() {
  const all = books();
  const tbr = all.filter((b) => b.status === 'tbr');
  const f = pickFilters;
  const matches = matchingTbr();
  const pick = f.pickId && all.find((b) => b.id === f.pickId);
  const taste = tasteProfile();
  const tropeShelves = taste.topTropes.slice(0, 3);
  const hasSeries = Object.keys(taste.series).length > 0;
  const dismissedCount = getState().dismissed.length;

  const shelf = (id, title, sub = '') => `<section>
      <div class="section-head" style="display:block"><h2 class="h2">${title}</h2>${sub ? `<p class="small faint" style="margin:4px 0 0">${sub}</p>` : ''}</div>
      <div class="shelf" data-shelf="${esc(id)}"><div class="center" style="padding:30px"><span class="loader"></span></div></div>
    </section>`;

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
    ${shelf('picked', tropeShelves.length ? 'Picked for you' : 'Popular romance right now', tropeShelves.length ? 'From the tropes and moods you rate highest' : '')}
    ${hasSeries ? shelf('series', 'Next in your series') : ''}
    ${tropeShelves.map((t) => shelf(`trope:${t}`, `Because you love <span style="color:var(--rose)">${esc(t.toLowerCase())}</span>`)).join('')}
    ${taste.topAuthors.slice(0, 3).map((a) => shelf(`author:${a}`, `New &amp; more from ${esc(a)}`)).join('')}

    <p class="tiny faint center">Suggestions come from what Open Library readers shelve most for your favourite tropes, plus Apple Books${googleKey() ? ' and Google Books' : ''} for your authors, ranked by the tropes and moods of books you've rated. Books already in your library are left out.
      ${dismissedCount ? `<button class="btn btn-sm btn-ghost" style="padding:0 8px" data-action="clear-dismissed">Show ${dismissedCount} hidden</button>` : ''}</p>
  </div>`;
}

function suggestionTile(r, { why } = {}) {
  resultCache.set(r.key, r);
  const upcoming = r.releaseDate && r.releaseDate > todayISO();
  const reason = why || (r.reasons?.length ? r.reasons.join(' · ') : '');
  return `<div class="book-tile suggestion">
    <button class="dismiss" data-action="dismiss-suggestion" data-v="${esc(bookId(r))}" aria-label="Not interested in ${esc(r.title)}" title="Not interested">${icons.close}</button>
    <button class="tile-link" data-action="preview" data-key="${esc(r.key)}" aria-label="More about ${esc(r.title)}">
      ${coverHTML(r)}
      <div><div class="t">${esc(r.title)}</div><div class="a">${authorLine(r)}</div></div>
    </button>
    ${reason ? `<div class="reason">${esc(reason)}</div>` : ''}
    ${upcoming
      ? `<span class="tag rose" style="align-self:flex-start">Out ${fmtDate(r.releaseDate)}</span>
         <button class="btn btn-sm" style="padding:0 10px" data-action="add-result" data-key="${esc(r.key)}" data-v="upcoming">+ Upcoming</button>`
      : `<button class="btn btn-sm" style="padding:0 10px" data-action="add-result" data-key="${esc(r.key)}" data-v="tbr">+ To read</button>`}
  </div>`;
}

function fill(el, list, opts) {
  if (!el?.isConnected) return;
  if (!list.length) { el.closest('section').remove(); return; }
  el.innerHTML = list.map((r) => suggestionTile(r, opts?.(r))).join('');
}
function failed(el) {
  if (el?.isConnected) el.innerHTML = `<div class="row small faint" style="padding:0 4px">Couldn't load suggestions. <button class="btn btn-sm" style="padding:0 12px" data-action="retry-shelf">Try again</button></div>`;
}

export async function mountDiscover(root) {
  const taste = tasteProfile();
  const isOut = excluded();
  const get = (id) => root.querySelector(`[data-shelf="${CSS.escape(id)}"]`);
  const tropes = taste.topTropes.slice(0, 3);

  // Trope shelves + "Picked for you" (the best of all of them, so it fills once they load).
  const used = new Set();
  const lists = await Promise.all((tropes.length ? tropes : ['Romance']).map((t) =>
    (t === 'Romance' ? popularBySubjects(['romance', 'contemporary romance'], { sort: 'trending', limit: 40 }) : tropeCandidates(t))
      .then((l) => clean(l, isOut).map((r) => score(r, taste)).sort((a, b) => b.score - a.score))
      .catch(() => null)));
  if (lists.every((l) => l === null)) { failed(get('picked')); tropes.forEach((t) => failed(get(`trope:${t}`))); }
  else {
    const merged = clean(lists.flat().filter(Boolean).sort((a, b) => b.score - a.score), () => false).slice(0, 12);
    merged.forEach((r) => used.add(bookId(r)));
    fill(get('picked'), merged);
    tropes.forEach((t, i) => {
      if (!lists[i]) return failed(get(`trope:${t}`));
      fill(get(`trope:${t}`), lists[i].filter((r) => !used.has(bookId(r))).slice(0, 14));
    });
  }

  // Next in your series: the first book after the furthest one you've read or started.
  const seriesEl = get('series');
  if (seriesEl) {
    const picks = await Promise.all(Object.entries(taste.series).slice(0, 8).map(([key, { n, name }]) =>
      nextInSeries(key, n).then((l) => {
        const next = clean(l, isOut)[0];
        return next && { ...next, why: `Book ${next.seriesNum} · ${name}` };
      }).catch(() => null)));
    const found = picks.filter(Boolean);
    fill(seriesEl, found, (r) => ({ why: r.why }));
  }

  // Authors you rate 4★+: upcoming first, then newest.
  for (const a of taste.topAuthors.slice(0, 3)) {
    const el = get(`author:${a}`);
    authorCandidates(a).then((l) => {
      const list = clean(l, isOut)
        .sort((x, y) => (y.releaseDate || `${y.year || 0}`).localeCompare(x.releaseDate || `${x.year || 0}`))
        .slice(0, 14);
      fill(el, list);
    }).catch(() => failed(el));
  }
}
