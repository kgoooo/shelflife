// Book data comes from two free, keyless sources:
//  - Open Library (https://openlibrary.org/developers/api): series, page counts, subjects
//  - Apple Books search (iTunes Search API): new releases, pre-orders with release dates, sharp covers
const OL = 'https://openlibrary.org';

export const coverUrl = (coverId, size = 'M') =>
  coverId ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg` : null;

function fromSearchDoc(d) {
  return {
    key: d.key,
    olKey: d.key,
    title: d.title,
    authors: d.author_name || [],
    cover: coverUrl(d.cover_i),
    pages: d.number_of_pages_median || null,
    year: d.first_publish_year || null,
    subjects: (d.subject || []).slice(0, 25),
    seriesKey: d.series_key?.[0] || null,
    series: d.series_name?.[0] || '',
    seriesNum: d.series_position?.[0] || '',
    seriesKeyList: d.series_key || [],
    positions: d.series_position || [],
  };
}

const SEARCH_FIELDS = 'key,title,author_name,cover_i,number_of_pages_median,first_publish_year,subject,series_key,series_name,series_position';

export async function searchBooks(q, { limit = 20, signal } = {}) {
  const url = `${OL}/search.json?q=${encodeURIComponent(q)}&fields=${SEARCH_FIELDS}&limit=${limit}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return (data.docs || []).map(fromSearchDoc);
}

const withTimeout = (ms) => AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;

// Subject feed first; if Open Library is slow or down, fall back to a subject search.
export async function bySubject(slug, { limit = 24 } = {}) {
  try {
    const res = await fetch(`${OL}/subjects/${encodeURIComponent(slug)}.json?limit=${limit}`, { signal: withTimeout(8000) });
    if (!res.ok) throw new Error('subject feed failed');
    const data = await res.json();
    if (!data.works?.length) throw new Error('empty');
    return data.works.map((w) => ({
      key: w.key,
      olKey: w.key,
      title: w.title,
      authors: (w.authors || []).map((a) => a.name),
      cover: coverUrl(w.cover_id),
      year: w.first_publish_year || null,
      subjects: (w.subject || []).slice(0, 25),
      pages: null,
    }));
  } catch {
    return searchBooks(`subject:"${slug.replace(/_/g, ' ')}"`, { limit, signal: withTimeout(15000) });
  }
}

export async function byAuthor(name, { limit = 12 } = {}) {
  return searchBooks(`author:"${name}"`, { limit });
}

export async function workDetails(olKey) {
  try {
    const res = await fetch(`${OL}${olKey}.json`);
    if (!res.ok) return {};
    const w = await res.json();
    const d = typeof w.description === 'string' ? w.description : w.description?.value || '';
    return {
      description: d.replace(/\(\[source\][^)]*\)/g, '').replace(/-{5,}[\s\S]*$/, '').trim(),
      subjects: (w.subjects || []).slice(0, 40),
    };
  } catch { return {}; }
}

export async function workRatings(olKey) {
  try {
    const res = await fetch(`${OL}${olKey}/ratings.json`);
    if (!res.ok) return null;
    const { summary } = await res.json();
    return summary?.count ? { average: summary.average, count: summary.count } : null;
  } catch { return null; }
}

// Series info for a single work (for books added before series data was stored).
export async function seriesForWork(olKey) {
  const [r] = await searchBooks(`key:"${olKey}"`, { limit: 1, signal: withTimeout(15000) });
  return r?.seriesKey ? { seriesKey: r.seriesKey, series: r.series, seriesNum: r.seriesNum } : null;
}

// Every work Open Library files under a series, in reading order. Box sets ("1-4") are dropped.
export async function bySeries(seriesKey) {
  const all = await searchBooks(`series_key:${seriesKey}`, { limit: 60, signal: withTimeout(15000) });
  return all
    .map((r) => {
      const i = Math.max(0, (r.seriesKeyList || []).indexOf(seriesKey));
      return { ...r, seriesNum: r.positions?.[i] ?? r.seriesNum };
    })
    .filter((r) => r.seriesNum && /^\d+(\.\d+)?$/.test(r.seriesNum))
    .sort((a, b) => parseFloat(a.seriesNum) - parseFloat(b.seriesNum) || (b.cover ? 1 : 0) - (a.cover ? 1 : 0))
    .filter((r, i, arr) => i === 0 || arr[i - 1].seriesNum !== r.seriesNum); // one work per position
}

/* ---------------- Apple Books ---------------- */
const APPLE = 'https://itunes.apple.com/search';
const JUNK = /\b(summary|study guide|workbook|analysis|after reading|sparknotes|cliffsnotes|book companion|trivia|quiz|coloring book)\b/i;

export const norm = (s) => String(s || '').toLowerCase()
  .replace(/\s*[:(\[].*$/, '')        // drop subtitles / "(Book 2)"
  .replace(/^(the|a|an)\s+/, '')
  .replace(/[^a-z0-9]/g, '');
const lastName = (a) => String(a || '').toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).pop() || '';

export const bigAppleCover = (url) => url ? url.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/600x900bb.$1') : null;

export function htmlToText(html) {
  const withBreaks = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n');
  return new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent.trim();
}

function fromApple(x) {
  const date = x.releaseDate ? x.releaseDate.slice(0, 10) : null;
  return {
    key: `apple:${x.trackId}`,
    appleId: x.trackId,
    olKey: null,
    title: x.trackName,
    authors: x.artistName ? x.artistName.split(/\s*(?:&|,| and )\s*/) : [],
    cover: bigAppleCover(x.artworkUrl100 || x.artworkUrl60),
    pages: null,
    year: date ? +date.slice(0, 4) : null,
    releaseDate: date,
    subjects: (x.genres || []).filter((g) => g !== 'Books'),
    description: htmlToText(x.description),
    rating: x.userRatingCount ? { average: x.averageUserRating, count: x.userRatingCount, source: 'Apple Books' } : null,
    seriesKey: null, series: '', seriesNum: '',
  };
}

export async function appleSearch(term, { limit = 25, signal } = {}) {
  const url = `${APPLE}?term=${encodeURIComponent(term)}&media=ebook&entity=ebook&country=us&limit=${limit}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Apple search failed');
  const data = await res.json();
  return (data.results || []).filter((x) => x.trackName && !JUNK.test(x.trackName)).map(fromApple);
}

const sameBook = (a, b) => norm(a.title) === norm(b.title) && lastName(a.authors[0]) === lastName(b.authors[0]);

// Search both sources at once. Apple's ranking surfaces popular and brand-new books;
// Open Library adds series info and page counts. Matching books are merged into one result.
export async function findBooks(q, { signal } = {}) {
  const isbn = /^[\d-]{10,17}$/.test(q.trim());
  const [ol, apple] = await Promise.allSettled([
    searchBooks(q, { limit: 25, signal }),
    isbn ? Promise.resolve([]) : appleSearch(q, { limit: 25, signal }),
  ]);
  if (ol.status === 'rejected' && apple.status === 'rejected') throw ol.reason;
  const olList = (ol.value || []).filter((r) => !JUNK.test(r.title));
  const appleList = apple.value || [];
  const used = new Set();
  const merged = [];
  for (const a of appleList) {
    if (merged.some((m) => sameBook(m, a))) continue;           // other editions / languages
    const o = olList.find((x) => !used.has(x) && sameBook(x, a));
    if (o) {
      used.add(o);
      merged.push({
        ...o,
        cover: a.cover || o.cover,                              // Apple's covers are sharper and current
        olCover: o.cover,
        appleId: a.appleId,
        releaseDate: a.releaseDate,
        description: a.description,
        rating: a.rating,
        year: o.year || a.year,
      });
    } else merged.push(a);
  }
  for (const o of olList) if (!used.has(o) && !merged.some((m) => sameBook(m, o))) merged.push(o);
  return merged.slice(0, 30);
}

// Best Apple Books match for a title + author (used to fill in missing covers).
export async function appleMatch(title, author) {
  const list = await appleSearch(`${title} ${author || ''}`, { limit: 10, signal: withTimeout(12000) });
  return list.find((a) => sameBook(a, { title, authors: [author] })) || null;
}

// Cover choices for the "Change cover" picker.
export async function coverOptions(title, author) {
  const [apple, ol] = await Promise.allSettled([
    appleSearch(`${title} ${author || ''}`, { limit: 15, signal: withTimeout(12000) }),
    searchBooks(`${title} ${author || ''}`, { limit: 10, signal: withTimeout(15000) }),
  ]);
  const want = norm(title);
  const urls = [
    ...(apple.value || []).filter((a) => norm(a.title) === want).map((a) => a.cover),
    ...(ol.value || []).filter((o) => norm(o.title) === want).map((o) => o.cover),
  ].filter(Boolean);
  return [...new Set(urls)].slice(0, 12);
}

// Open Library work for an Apple-only book, so it can get series info later.
export async function olMatch(title, author) {
  const list = await searchBooks(`${title} ${author || ''}`, { limit: 8, signal: withTimeout(15000) });
  return list.find((o) => sameBook(o, { title, authors: [author] })) || null;
}
