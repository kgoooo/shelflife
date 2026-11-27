// Book data comes from two free, keyless sources:
//  - Open Library (https://openlibrary.org/developers/api): series, page counts, subjects
//  - Apple Books search (iTunes Search API), ebooks and audiobooks: new releases, pre-orders with release dates, sharp covers
//  - Google Books (optional, needs your own free API key in Settings): exact release dates, print-only books
import { getState } from './store.js';
import { hardcoverConnected, hcSeriesFor, hcSeriesMembers } from './hardcover.js';
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
    releaseDate: releaseFromDates(d.publish_date),
    subjects: (d.subject || []).slice(0, 25),
    seriesKey: d.series_key?.[0] || null,
    series: d.series_name?.[0] || '',
    seriesNum: d.series_position?.[0] || '',
    seriesKeyList: d.series_key || [],
    positions: d.series_position || [],
  };
}

const SEARCH_FIELDS = 'key,title,author_name,cover_i,number_of_pages_median,first_publish_year,publish_date,subject,series_key,series_name,series_position';

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayISO = () => isoDay(new Date());

// Open Library lists a publish date per edition, in many formats ("2027-04-20", "April 20, 2027", "2026").
// Only dates with a day count. A book is upcoming when it has a dated edition in the future and none
// already out; then the earliest future date is its release date.
function releaseFromDates(dates = []) {
  const full = [];
  for (const raw of dates) {
    const t = String(raw).trim();
    const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) { full.push(`${iso[1]}-${iso[2]}-${iso[3]}`); continue; }
    if (!/\d{1,2}(st|nd|rd|th)?,?\s+\d{4}|\d{1,2}\s+[a-z]+\.?\s+\d{4}/i.test(t)) continue; // needs a day
    const d = new Date(t.replace(/(\d)(st|nd|rd|th)/, '$1'));
    if (!isNaN(d)) full.push(isoDay(d));
  }
  const today = todayISO();
  if (!full.length || full.some((d) => d <= today)) return null;
  return full.sort()[0];
}

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
  .replace(/&/g, ' and ')               // "The Serpent & the Wings of Night" = "…and the…"
  .replace(/\s*[:(\[].*$/, '')        // drop subtitles / "(Book 2)"
  .replace(/^(the|a|an)\s+/, '')
  .replace(/[^a-z0-9]/g, '');
const lastName = (a) => String(a || '').toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).pop() || '';

export const bigAppleCover = (url) => url ? url.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/600x900bb.$1') : null;

export function htmlToText(html) {
  const withBreaks = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n');
  return new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent.trim();
}

// Knock-offs like "The Housemaid By Freida McFadden" published by someone else.
function isKnockoff(title, artist) {
  if (JUNK.test(title)) return true;
  const by = title.match(/\bby\s+([^()|]+)$/i);
  return !!by && !by[1].toLowerCase().includes(lastName(artist));
}

const cleanTitle = (t) => String(t || '').replace(/\s*\((unabridged|abridged)\)\s*$/i, '').trim();

function fromApple(x) {
  const audio = x.wrapperType === 'audiobook';
  const id = audio ? x.collectionId : x.trackId;
  const date = x.releaseDate ? x.releaseDate.slice(0, 10) : null;
  return {
    key: `apple:${id}`,
    appleId: id,
    olKey: null,
    title: cleanTitle(audio ? x.collectionName : x.trackName),
    authors: x.artistName ? x.artistName.split(/\s*(?:&|,| and )\s*/) : [],
    cover: bigAppleCover(x.artworkUrl100 || x.artworkUrl60),
    squareCover: audio, // audiobook art is square; a real book cover is preferred when there is one
    pages: null,
    year: date ? +date.slice(0, 4) : null,
    releaseDate: date,
    subjects: (x.genres || [x.primaryGenreName]).filter((g) => g && g !== 'Books' && g !== 'Audiobooks'),
    description: htmlToText(x.description),
    rating: x.userRatingCount ? { average: x.averageUserRating, count: x.userRatingCount, source: 'Apple Books' } : null,
    seriesKey: null, series: '', seriesNum: '',
  };
}

// Apple's ebook store; with { audio: true }, its audiobook store. Some books (often
// Kindle-exclusive ebooks) are only on Apple as audiobooks, so search uses both.
export async function appleSearch(term, { limit = 25, signal, audio = false } = {}) {
  const kind = audio ? 'media=audiobook&entity=audiobook' : 'media=ebook&entity=ebook';
  const url = `${APPLE}?term=${encodeURIComponent(term)}&${kind}&country=us&limit=${limit}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Apple search failed');
  const data = await res.json();
  return (data.results || [])
    .filter((x) => { const t = x.trackName || x.collectionName; return t && !isKnockoff(t, x.artistName); })
    .map(fromApple);
}

export const sameBook = (a, b) => norm(a.title) === norm(b.title) && lastName(a.authors[0]) === lastName(b.authors[0]);

// How well a result matches what was typed: title words count most, then author words.
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'by', 'to', 'in', 'on', 'for']);
export const looksTranslated = (t) => /[^\x00-\x7F‘’“”–—…]/.test(t)
  || /\b(edición|edizione|ausgabe|édition|version française|tome \d)\b/i.test(t)
  || /\b(las|los|del|una|con|nel|della|delle|des|und|mit|eine?|och|het|een|nas|dos)\b/i.test(t)
  || /^(la|le|les|el|los|las|il|der|die|das|den|det|wenn|o|os|een|het)\s/i.test(t);

function matchScore(r, q) {
  const toks = (q.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 1 && !STOP.has(t));
  if (!toks.length) return 0;
  const words = (s) => ` ${String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  const title = words(r.title), auth = words(r.authors.join(' '));
  let s = 0, inAuthor = 0;
  for (const t of toks) {
    const a = auth.includes(` ${t} `);
    if (a) inAuthor++;
    if (title.includes(` ${t} `) || a) s += 2;
    else if (title.includes(t)) s += 0.5;
  }
  let score = s / toks.length;
  if (inAuthor === toks.length) score += 0.5;                 // searched for this author by name
  if (norm(r.title) === norm(q)) score += 1;                  // exact title
  if (r.cover) score += 0.05;
  if (r.olKey) score += r.appleId ? 0.3 : 0.15;                // found in both catalogs = the main English edition
  if (looksTranslated(r.title)) score -= 0.6;                 // keep English editions on top
  return score;
}

function combine(q, olList, appleList, googleList = []) {
  const used = new Set();
  const merged = [];
  for (const a of appleList) {
    if (merged.some((m) => sameBook(m, a))) continue;           // other editions / formats
    const o = olList.find((x) => !used.has(x) && sameBook(x, a));
    if (o) {
      used.add(o);
      merged.push({
        ...o,
        cover: a.squareCover ? o.cover || a.cover : a.cover || o.cover, // Apple's ebook covers are sharper and current
        olCover: o.cover,
        appleId: a.appleId,
        releaseDate: a.releaseDate > todayISO() || !o.releaseDate ? a.releaseDate : o.releaseDate,
        description: a.description,
        rating: a.rating,
        year: o.year || a.year,
      });
    } else merged.push({ ...a });
  }
  for (const o of olList) {
    if (used.has(o)) continue;
    const dup = merged.find((m) => sameBook(m, o));
    if (!dup) { merged.push({ ...o }); continue; }
    // Same book listed twice (placeholder + real entry): keep the fuller details of both.
    if (!dup.cover && o.cover) dup.cover = o.cover;
    if (!dup.pages && o.pages) dup.pages = o.pages;
    if (!dup.seriesKey && o.seriesKey) Object.assign(dup, { seriesKey: o.seriesKey, series: o.series, seriesNum: o.seriesNum });
    if (!dup.appleId && o.releaseDate && (!dup.releaseDate || o.releaseDate < dup.releaseDate)) dup.releaseDate = o.releaseDate;
  }
  // Google Books fills gaps: books neither source has, plus page counts and dated releases.
  for (const g of googleList) {
    const dup = merged.find((m) => sameBook(m, g));
    if (!dup) { merged.push({ ...g }); continue; }
    dup.googleId = g.googleId;
    if (!dup.cover && g.cover) dup.cover = g.cover;
    if (!dup.pages && g.pages) dup.pages = g.pages;
    if (!dup.description && g.description) dup.description = g.description;
    const today = todayISO();
    if (g.releaseDate > today && !(dup.releaseDate > today) && !(dup.releaseDate && dup.appleId)) dup.releaseDate = g.releaseDate;
  }
  // Drop coverless Open Library duplicates of a title that's already listed with a cover.
  const covered = new Set(merged.filter((m) => m.cover).map((m) => norm(m.title)));
  return merged
    .filter((m) => m.cover || !covered.has(norm(m.title)))
    .map((r, i) => ({ r, i, s: matchScore(r, q) }))
    .sort((x, y) => y.s - x.s || x.i - y.i)                      // best match first, then source order
    .map((x) => x.r)
    .slice(0, 30);
}

// Search Apple ebooks, Apple audiobooks and Open Library at once. Results are merged
// (Apple: covers, new releases, pre-order dates; Open Library: series, page counts) and
// ranked by how well they match. onUpdate fires as each source answers, so a slow
// Open Library never holds up the list.
export async function findBooks(q, { signal, onUpdate } = {}) {
  const isbn = /^[\d-]{10,17}$/.test(q.trim());
  const got = { ol: [], ebook: [], audio: [], google: [] };
  const mix = () => combine(q, got.ol, [...got.ebook, ...got.audio], got.google);
  const track = (name, p) => p.then((list) => { got[name] = list; onUpdate?.(mix()); return list; });
  const key = googleKey();
  const results = await Promise.allSettled([
    track('ol', searchBooks(q, { limit: 25, signal }).then((l) => l.filter((r) => !JUNK.test(r.title)))),
    track('ebook', isbn ? Promise.resolve([]) : appleSearch(q, { limit: 25, signal })),
    track('audio', isbn ? Promise.resolve([]) : appleSearch(q, { limit: 15, signal, audio: true })),
    ...(key ? [track('google', googleSearch(isbn ? `isbn:${q.replace(/\D/g, '')}` : q, { key, signal }))] : []),
  ]);
  if (results.every((r) => r.status === 'rejected')) throw results[0].reason;
  return mix();
}

/* ---------------- Google Books (optional) ---------------- */
export const googleKey = () => (getState().googleKey || '').trim();

// Google dates: "2027-04-20", "2027-04" or "2027". Only a full date counts as a release date.
const googleDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null);
const googleCover = (links) => {
  const u = links?.thumbnail || links?.smallThumbnail;
  return u ? u.replace(/^http:/, 'https:').replace(/&edge=curl/, '') : null;
};

function fromGoogle(v) {
  const i = v.volumeInfo || {};
  const date = googleDate(i.publishedDate);
  return {
    key: `google:${v.id}`,
    googleId: v.id,
    olKey: null,
    title: i.title || 'Untitled',
    authors: i.authors || [],
    cover: googleCover(i.imageLinks),
    pages: i.pageCount || null,
    year: i.publishedDate ? +i.publishedDate.slice(0, 4) : null,
    releaseDate: date,
    subjects: i.categories || [],
    description: htmlToText(i.description),
    rating: i.ratingsCount ? { average: i.averageRating, count: i.ratingsCount, source: 'Google Books' } : null,
    seriesKey: null, series: '', seriesNum: '',
  };
}

export async function googleSearch(q, { key = googleKey(), signal, limit = 20 } = {}) {
  if (!key) return [];
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${limit}&printType=books&langRestrict=en&key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || `Google Books error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return (data.items || [])
    .filter((v) => v.volumeInfo?.title && !isKnockoff(v.volumeInfo.title, (v.volumeInfo.authors || [])[0]))
    .map(fromGoogle);
}

// Settings → "Test key": a tiny search that explains what went wrong, in plain words.
export async function testGoogleKey(key) {
  try {
    const list = await googleSearch('fourth wing yarros', { key, limit: 1, signal: withTimeout(12000) });
    return { ok: true, message: list.length ? `Working. Found “${list[0].title}”.` : 'Working.' };
  } catch (e) {
    const m = String(e.message || '');
    if (/API key not valid/i.test(m)) return { ok: false, message: 'Google says this key isn\'t valid. Check it was copied in full.' };
    if (/referer|referrer/i.test(m)) return { ok: false, message: 'Google blocked this website address. Add this app\'s address under the key\'s Website restrictions.' };
    if (/not been used|disabled|enable/i.test(m)) return { ok: false, message: 'The Books API isn\'t turned on for this project yet. Enable it in the Google Cloud console.' };
    if (e.status === 429) return { ok: false, message: 'Google says the daily limit is used up. It resets tomorrow.' };
    return { ok: false, message: m || 'Couldn\'t reach Google. Check your connection.' };
  }
}

// Best Apple Books match for a title + author (used to fill in missing covers).
export async function appleMatch(title, author) {
  const want = { title, authors: [author] };
  for (const audio of [false, true]) {
    const list = await appleSearch(`${title} ${author || ''}`, { limit: 10, signal: withTimeout(12000), audio });
    const hit = list.find((a) => sameBook(a, want));
    if (hit) return hit;
  }
  return null;
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

/* ---------------- Popular books by subject (Discover) ---------------- */
// Open Library can sort a subject by how many readers have shelved each book ("readinglog")
// or by what's being shelved lately ("trending"), which surfaces well-known books rather
// than whatever happens to have the keyword in its title.
export async function popularBySubjects(phrases, { sort = 'readinglog', limit = 40 } = {}) {
  const q = phrases.map((p) => `subject:"${p}"`).join(' OR ');
  const fields = `${SEARCH_FIELDS},want_to_read_count,language`;
  const url = `${OL}/search.json?q=${encodeURIComponent(q)}&sort=${sort}&fields=${fields}&limit=${limit}`;
  const res = await fetch(url, { signal: withTimeout(20000) });
  if (!res.ok) throw new Error('Open Library failed');
  const data = await res.json();
  return (data.docs || [])
    .filter((d) => !d.language || d.language.includes('eng'))
    .map((d) => ({ ...fromSearchDoc(d), popularity: d.want_to_read_count || 0 }));
}

// Not novels: box sets, omnibus listings, journals and non-fiction.
export const notANovel = (r) =>
  /box(ed)? set|collection set|\bbundle\b|books? \d+\s*[-–]\s*\d+|\s\/\s.*\s\/\s|journal\b|cookbook|coloring|companion\b|\bbible\b/i.test(r.title)
  || /\bnon-?fiction\b|self-improvement|self-development|self-help|\bpsychology\b|\breference\b|cookbooks|business & personal finance|religion & spirituality|study aids|family & relationships|health, mind & body/i.test((r.subjects || []).join(' '));

// Is a blurb written in another language? Compares common English words with common
// Spanish / French / German / Italian / Portuguese ones.
const EN_WORDS = /\b(the|and|of|to|her|his|she|he|is|with|that|for|but|when|who)\b/gi;
const OTHER_WORDS = /\b(el|la|los|las|que|y|en|un|una|del|por|para|con|le|les|et|est|une|dans|der|die|das|und|ist|nicht|il|della|che|di|não|uma|ele|ela|je|se|na|že|ale|és|az|egy|hogy|nem|się|nie|jest|och|att|det|som|og|er|ikke)\b/gi;
export function foreignBlurb(text) {
  if (!text || text.length < 60) return false;
  const en = (text.match(EN_WORDS) || []).length;
  const other = (text.match(OTHER_WORDS) || []).length;
  return other > en * 1.5 && other >= 5;
}

/* ---------------- Series detection beyond Open Library's series list ---------------- */
const NUM_WORDS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const toNum = (w) => { if (!w) return ''; const n = NUM_WORDS[String(w).toLowerCase()]; return n ? String(n) : String(parseFloat(w) || ''); };
const cleanSeriesName = (s) => String(s || '').replace(/^(the|a|an)\s+(?=\w+\s+\w)/i, (m) => m) // keep "The" if it's part of the name
  .replace(/\s+(series|saga|trilogy|duology|duet|quartet|novels?|books?)$/i, '').replace(/[\s,;:#-]+$/, '').trim();

// "Bonded by Thorns (Beasts of the Briar, #1)", "…(Beasts of the Briar Book 1)", "Title: Court of Ravens Book 2"
// "Bonded by Thorns: Beasts of the Briar, Book 1" -> "Bonded by Thorns" (the series is stored separately).
export function stripSeriesSuffix(title) {
  const t = String(title || '');
  if (!seriesFromTitle(t)) return t;
  return t.replace(/\s*\(([^()]*?)(book|bk\.?|vol\.?|volume|part|#|prequel|novella)[^()]*\)\s*$/i, '')
    .replace(/\s*:\s*(an?\s+)?[^:]*?\b(book|volume|novel)\s+(\d+(\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\b.*$/i, '')
    .replace(/\s*:\s*an?\s+[^:]*?\b(prequel|novella)\b.*$/i, '')
    .trim() || t;
}

export function seriesFromTitle(title) {
  const t = String(title || '');
  const pre = t.match(/:\s*an?\s+(.{3,60}?)\s+(?:prequel|novella)\b/i);
  if (pre) return { series: cleanSeriesName(pre[1]), seriesNum: '0' };
  let m = t.match(/\(([^()]{3,60}?)[,:]?\s*(?:book|bk\.?|vol\.?|volume|part|#)\s*(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s*\)/i);
  if (m) return { series: cleanSeriesName(m[1]), seriesNum: toNum(m[2]) };
  m = t.match(/:\s*(?:an?\s+)?([^:]{3,60}?)\s+(?:book|volume|novel)\s+(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  if (m) return { series: cleanSeriesName(m[1].replace(/^.*?\b(a|an)\s+/i, '')), seriesNum: toNum(m[2]) };
  return null;
}

// Open Library edition field: "Court of Ravens, 1", "Beasts of the Briar ; 2", "Beasts of the Briar #2", "Beasts of the Briar"
function seriesFromEditionField(s) {
  const m = String(s || '').match(/^(.{2,60}?)(?:\s*[,;#]\s*(?:book|bk\.?|vol\.?|no\.?)?\s*(\d+(?:\.\d+)?))?\s*\.?$/i);
  return m ? { series: cleanSeriesName(m[1]), seriesNum: m[2] || '' } : null;
}

// Blurbs: "the first installment in Melissa K. Roehrich's internationally bestselling Legacy Series".
// Needs a position word nearby, so "for fans of the Court of Thorns and Roses series" doesn't count.
export function seriesFromBlurb(text) {
  const t = String(text || '');
  const re = /((?:[A-Z][\w'’-]*|of|the|and|in)(?:\s+(?:[A-Z][\w'’-]*|of|the|and|in)){0,6})\s+(series|saga|trilogy|duology|duet|quartet)\b/gi;
  let m;
  while ((m = re.exec(t))) {
    const before = t.slice(Math.max(0, m.index - 140), m.index).replace(/\b([A-Z])\./g, '$1'); // "Melissa K. Roehrich"
    if (/fans of|readers of|like the|if you (loved|liked)/i.test(before.slice(-60))) continue;
    const pos = before.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th)|book\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)|#\s?\d+)\b[^.]*$/i);
    if (!pos) continue;
    // Keep the capitalised run right before "Series" ("internationally bestselling Legacy" -> "Legacy").
    const words = m[1].split(/[’']s\s+/).pop().split(/\s+/);
    const keep = [];
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];
      if (/^[A-Z]/.test(w) || (keep.length && /^(of|the|and|in)$/.test(w))) keep.unshift(w); else break;
    }
    while (keep.length > 1 && /^(of|the|and|in)$/.test(keep[0])) keep.shift();      // lowercase lead-ins only
    let name = keep.join(' ').replace(/^(New|Bestselling|Instant|Romantic|Dark|Epic|Spicy|Hit|Viral)\s+/, '');
    if (!/^[A-Z]/.test(name) || name.split(/\s+/).length > 6) continue;
    const n = pos[1].replace(/^book\s+|^#\s?/i, '').replace(/^(\d+)(st|nd|rd|th)$/i, '$1');
    return { series: cleanSeriesName(name), seriesNum: toNum(n) };
  }
  return null;
}

async function seriesFromEditions(olKey) {
  try {
    const res = await fetch(`${OL}${olKey}/editions.json?limit=50`, { signal: withTimeout(15000) });
    if (!res.ok) return null;
    const { entries = [] } = await res.json();
    let best = null;
    for (const e of entries) {
      for (const s of e.series || []) {
        const p = seriesFromEditionField(s);
        if (p && (!best || (!best.seriesNum && p.seriesNum))) best = p;
      }
    }
    return best;
  } catch { return null; }
}

// Google Books series (needs your key): the volume's seriesInfo gives an id and position;
// series/get gives the name and series/membership/get lists every book in it.
async function gfetch(path) {
  const key = googleKey();
  if (!key) return null;
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`, { signal: withTimeout(15000) });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

export async function googleSeriesFor(title, author) {
  const data = await gfetch(`volumes?q=${encodeURIComponent(`intitle:${title} inauthor:${author || ''}`)}&maxResults=10`);
  const want = { title, authors: [author] };
  for (const v of data?.items || []) {
    const info = v.volumeInfo || {};
    const vs = info.seriesInfo?.volumeSeries?.[0];
    if (!vs?.seriesId || !sameBook({ title: info.title, authors: info.authors || [] }, want)) continue;
    const meta = await gfetch(`series/get?series_id=${encodeURIComponent(vs.seriesId)}`);
    const name = meta?.series?.[0]?.title || seriesFromTitle(info.title)?.series || '';
    return { seriesKey: `g:${vs.seriesId}`, series: cleanSeriesName(name), seriesNum: String(info.seriesInfo.bookDisplayNumber || vs.orderNumber || '') };
  }
  return null;
}

export async function googleSeriesMembers(seriesId) {
  const data = await gfetch(`series/membership/get?series_id=${encodeURIComponent(seriesId)}&page_size=40`);
  return (data?.member || []).map((v) => {
    const r = fromGoogle(v);
    const si = v.volumeInfo?.seriesInfo;
    return { ...r, seriesNum: String(si?.bookDisplayNumber || si?.volumeSeries?.[0]?.orderNumber || '') };
  }).filter((r) => r.seriesNum && !notANovel(r));
}

// Best guess at a book's series, trying each source in turn.
// Best guess at a book's series. Hardcover, then Google Books when you have a key (its series data
// tends to be the most accurate where it has the book); everything else is the fallback for books
// Google doesn't carry, such as Kindle-exclusive titles.
export async function detectSeries(book) {
  const author = book.authors?.[0] || '';
  // Hardcover first when connected: reader-maintained, so it covers indie and Kindle-only series.
  if (hardcoverConnected()) {
    const h = await hcSeriesFor(book.title, author, { sameBook }).catch(() => undefined);
    if (h) return h;
    if (h === null) return null;                              // Hardcover has the book and it's a standalone
  }
  if (googleKey()) {
    const g = await googleSeriesFor(book.title, author);
    if (g) return g;
  }
  if (book.olKey) {
    const ol = await seriesForWork(book.olKey).catch(() => null);
    if (ol) return ol;
    const ed = await seriesFromEditions(book.olKey);
    if (ed?.series) return ed;
  }
  return seriesFromTitle(book.title) || seriesFromBlurb(book.description) || null;
}

// Books in a series Open Library doesn't list: search the author's books on every source and keep
// the ones whose title, blurb or edition records name the same series.
export async function seriesMembersByName(name, author) {
  const want = norm(name);
  const same = (s) => s && (norm(s) === want || norm(s).includes(want) || want.includes(norm(s)));
  const [found, olWorks] = await Promise.all([
    findBooks(`${name} ${author}`).catch(() => []),
    searchBooks(`author:"${author}"`, { limit: 20 }).catch(() => []),
  ]);
  const byAuthor = (r) => lastName(r.authors?.[0]) === lastName(author);
  const pool = [...found, ...olWorks].filter(byAuthor);
  const out = [];
  for (const r of pool) {
    const p = (r.seriesKey && { series: r.series, seriesNum: r.seriesNum }) || seriesFromTitle(r.title) || seriesFromBlurb(r.description);
    if (p && same(p.series)) out.push({ ...r, seriesNum: p.seriesNum || r.seriesNum || '' });
  }
  // Edition records for the author's other Open Library works (a handful, in parallel).
  const unknown = olWorks.filter((r) => byAuthor(r) && r.olKey && !out.some((o) => sameBook(o, r))).slice(0, 10);
  const eds = await Promise.all(unknown.map((r) => seriesFromEditions(r.olKey).then((p) => (p && same(p.series) ? { ...r, seriesNum: p.seriesNum || '' } : null))));
  out.push(...eds.filter(Boolean));
  // One entry per book, numbered ones first.
  const uniq = [];
  for (const r of out.sort((a, b) => (b.seriesNum ? 1 : 0) - (a.seriesNum ? 1 : 0))) {
    const i = uniq.findIndex((u) => sameBook(u, r));
    if (i === -1) uniq.push(r);
  }
  return uniq.map((r) => ({ ...r, title: stripSeriesSuffix(r.title), seriesNum: r.seriesNum || '' }));
}

export { hardcoverConnected, hcSeriesFor, hcSeriesMembers };
