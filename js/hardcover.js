// Hardcover (https://hardcover.app): reader-maintained catalogue with the best series data we've found.
// Sign-in uses OAuth for single-page apps (authorization code + PKCE), as described in
// https://docs.hardcover.app/api/oauth/getting-started-spa/. Only `read:catalog` (public book data)
// and `offline_access` (stay signed in) are requested. Tokens stay on this device and are left out
// of backups.
import { getState, setHardcover } from './store.js';

const CLIENT_ID = '3545a591-e650-4a8a-b361-042223a969d8'; // public app id, not a secret
const AUTHORIZE = 'https://hardcover.app/oauth2/authorize';
const TOKEN = 'https://api.hardcover.app/oauth2/token';
const REVOKE = 'https://api.hardcover.app/oauth2/revoke';
const GRAPHQL = 'https://api.hardcover.app/v1/graphql';
const ISSUER = 'https://api.hardcover.app';
const SCOPE = 'read:catalog offline_access';
const redirectUri = () => location.origin + location.pathname; // must match the app's registered redirect URI

export const hardcoverConnected = () => !!getState().hardcover?.refresh || !!getState().hardcover?.access;

/* ---------- Sign-in ---------- */
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (s) => b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));

export async function connectHardcover() {
  const state = randomString(24);
  const verifier = randomString(32);
  sessionStorage.setItem('hc_state', state);
  sessionStorage.setItem('hc_verifier', verifier);
  sessionStorage.setItem('hc_return', location.hash || '#/settings');
  const q = new URLSearchParams({
    response_type: 'code', client_id: CLIENT_ID, redirect_uri: redirectUri(),
    state, code_challenge: await sha256(verifier), code_challenge_method: 'S256', scope: SCOPE,
  });
  location.href = `${AUTHORIZE}?${q}`;
}

// Called on start-up: finishes the sign-in when Hardcover sends you back with ?code=…
// Returns a message to show, or null if this wasn't a sign-in return.
export async function finishHardcoverSignIn() {
  const p = new URLSearchParams(location.search);
  if (!p.has('code') && !p.has('error')) return null;
  const state = sessionStorage.getItem('hc_state');
  const verifier = sessionStorage.getItem('hc_verifier');
  const back = sessionStorage.getItem('hc_return') || '#/settings';
  ['hc_state', 'hc_verifier', 'hc_return'].forEach((k) => sessionStorage.removeItem(k));
  history.replaceState({}, '', redirectUri() + back); // drop ?code= so a refresh can't replay it

  if (p.has('error')) return { ok: false, message: `Hardcover sign-in was cancelled (${p.get('error_description') || p.get('error')}).` };
  if (!verifier || p.get('state') !== state) return { ok: false, message: 'Hardcover sign-in failed: unexpected return. Please try again.' };
  if (p.get('iss') && p.get('iss') !== ISSUER) return { ok: false, message: 'Hardcover sign-in failed: the reply came from the wrong server.' };

  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: redirectUri(), client_id: CLIENT_ID, code_verifier: verifier }),
  }).catch(() => null);
  const t = res ? await res.json().catch(() => ({})) : {};
  if (!res?.ok || !t.access_token) {
    return { ok: false, message: `Hardcover sign-in failed: ${t.error_description || t.error || (res ? res.status : 'no connection')}. If it mentions the redirect, check the app's Redirect URI is exactly ${redirectUri()}` };
  }
  saveTokens(t);
  return { ok: true, message: 'Hardcover connected' };
}

function saveTokens(t) {
  setHardcover({
    access: t.access_token,
    refresh: t.refresh_token || getState().hardcover?.refresh || null,
    expiresAt: Date.now() + (Number(t.expires_in) || 7 * 86400) * 1000 - 60000,
  });
}

// Refresh tokens rotate and may only be used once, so only one refresh runs at a time.
let refreshing = null;
async function accessToken() {
  const hc = getState().hardcover;
  if (!hc) return null;
  if (hc.access && Date.now() < hc.expiresAt) return hc.access;
  if (!hc.refresh) return null;
  if (!refreshing) {
    refreshing = fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: hc.refresh, client_id: CLIENT_ID }),
    }).then(async (res) => {
      const t = await res.json().catch(() => ({}));
      if (!res.ok || !t.access_token) {
        if (res.status === 400 || res.status === 401) setHardcover(null); // revoked or expired: sign in again
        return null;
      }
      saveTokens(t);
      return t.access_token;
    }).catch(() => null).finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function disconnectHardcover() {
  const hc = getState().hardcover;
  setHardcover(null);
  if (hc?.refresh || hc?.access) {
    fetch(REVOKE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: hc.refresh || hc.access, token_type_hint: hc.refresh ? 'refresh_token' : 'access_token', client_id: CLIENT_ID }),
    }).catch(() => {});
  }
}

/* ---------- API ---------- */
export async function hcQuery(query, variables = {}) {
  const token = await accessToken();
  if (!token) throw Object.assign(new Error('Not connected to Hardcover'), { code: 'signed_out' });
  const res = await fetch(GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) { setHardcover(null); throw Object.assign(new Error('Hardcover sign-in expired'), { code: 'signed_out' }); }
  if (!res.ok || body.errors) {
    const msg = body.error_description || body.error || body.message || body.errors?.[0]?.message || `HTTP ${res.status}`;
    throw Object.assign(new Error(`Hardcover: ${msg}`), { status: res.status });
  }
  return body.data;
}

const pickAuthors = (b) => {
  const list = Array.isArray(b.cached_contributors) ? b.cached_contributors : [];
  const names = list.map((c) => c?.author?.name || c?.name).filter(Boolean);
  return names.length ? names : (b.author_names || []);
};
const pickCover = (img) => (typeof img === 'string' ? img : img?.url) || null;

// Find a book on Hardcover and its featured series (name, position, id).
export async function hcSeriesFor(title, author, { sameBook }) {
  const data = await hcQuery(
    'query FindBook($q: String!) { search(query: $q, query_type: "Book", per_page: 8, page: 1) { results } }',
    { q: `${title} ${author || ''}`.trim() },
  );
  const hits = data?.search?.results?.hits || [];
  for (const h of hits) {
    const d = h.document || h;
    const authors = d.author_names || pickAuthors(d);
    if (!sameBook({ title: d.title, authors }, { title, authors: [author] })) continue;
    const fs = d.featured_series || {};
    const series = fs.series || fs;
    const name = series?.name || d.series_names?.[0];
    const id = series?.id ?? fs.series_id;
    const pos = d.featured_series_position ?? fs.position ?? fs.details;
    if (!name) return null;                                    // found the book; it isn't in a series
    let seriesId = id;
    if (seriesId == null) seriesId = await hcSeriesIdByName(name, author);
    return { seriesKey: seriesId != null ? `hc:${seriesId}` : null, series: name, seriesNum: pos != null ? String(pos) : '', hcBookId: d.id };
  }
  return undefined;                                            // Hardcover doesn't have this book
}

async function hcSeriesIdByName(name, author) {
  const data = await hcQuery(
    'query FindSeries($q: String!) { search(query: $q, query_type: "Series", per_page: 5, page: 1) { results } }',
    { q: name },
  );
  const hits = data?.search?.results?.hits || [];
  const want = String(author || '').toLowerCase().split(/\s+/).pop();
  const hit = hits.map((h) => h.document || h).find((d) => !want || String(d.author_name || d.author?.name || '').toLowerCase().includes(want)) || hits[0]?.document;
  return hit?.id ?? null;
}

// Every book in a series in reading order: one book per position (the most-shelved), merged
// duplicates, partial books and box sets left out, as Hardcover's own series page does.
export async function hcSeriesMembers(seriesId) {
  const data = await hcQuery(`query SeriesBooks($id: Int!) {
    series(where: {id: {_eq: $id}}) {
      id name primary_books_count
      author { name }
      book_series(
        distinct_on: position
        order_by: [{position: asc}, {book: {users_count: desc}}]
        where: {book: {canonical_id: {_is_null: true}, is_partial_book: {_eq: false}}, compilation: {_eq: false}}
      ) {
        position details
        book { id title slug release_date release_year pages users_count description cached_image cached_contributors }
      }
    }
  }`, { id: Number(seriesId) });
  const s = data?.series?.[0];
  if (!s) return { name: '', primary: 0, items: [] };
  const items = (s.book_series || []).filter((bs) => bs.book).map((bs) => {
    const b = bs.book;
    const authors = pickAuthors(b);
    return {
      key: `hc:book:${b.id}`,
      hardcoverId: b.id,
      olKey: null,
      title: b.title,
      authors: authors.length ? authors : [s.author?.name].filter(Boolean),
      cover: pickCover(b.cached_image),
      pages: b.pages || null,
      year: b.release_year || (b.release_date ? +String(b.release_date).slice(0, 4) : null),
      releaseDate: b.release_date && /^\d{4}-\d{2}-\d{2}/.test(b.release_date) ? String(b.release_date).slice(0, 10) : null,
      description: b.description || '',
      subjects: [],
      series: s.name,
      seriesKey: `hc:${s.id}`,
      seriesNum: bs.position != null ? String(bs.position) : (bs.details || ''),
      popularity: b.users_count || 0,
    };
  });
  return { name: s.name, primary: s.primary_books_count || 0, items };
}

// Settings → "Test": looks up a well-known series book and reports what came back, in words.
export async function testHardcover({ sameBook }) {
  try {
    const r = await hcSeriesFor('Bonded by Thorns', 'Elizabeth Helen', { sameBook });
    if (r === undefined) return { ok: true, message: 'Connected, but the test book wasn\'t found. Series lookups may still work.' };
    if (!r) return { ok: true, message: 'Connected. (The test book came back without a series.)' };
    let count = '';
    if (r.seriesKey) {
      const m = await hcSeriesMembers(r.seriesKey.slice(3));
      count = m.items.length ? ` · ${m.items.length} books listed` : '';
    }
    return { ok: true, message: `Working: Bonded by Thorns is book ${r.seriesNum || '?'} of ${r.series}${count}.` };
  } catch (e) {
    return { ok: false, message: e.message || 'Couldn\'t reach Hardcover.' };
  }
}
