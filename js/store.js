// Local-first storage. Everything lives in this device's localStorage; use Settings → Export to back up.
const KEY = 'shelflife.v1';

const defaults = () => ({
  version: 1,
  goal: 40,
  books: [],
  customTropes: [],
  customWarnings: [],
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.books)) return { ...defaults(), ...s };
    }
  } catch { /* fall through */ }
  return defaults();
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error('Could not save', e); }
  listeners.forEach((fn) => fn());
}

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getState = () => state;
export const books = () => state.books;
export const getBook = (id) => state.books.find((b) => b.id === id);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const today = () => new Date().toISOString().slice(0, 10);

export function newBook(fields = {}) {
  return {
    id: uid(),
    olKey: null,
    appleId: null,
    googleId: null,
    title: 'Untitled',
    authors: [],
    cover: null,
    pages: null,
    year: null,
    subjects: [],
    description: '',
    series: '',
    seriesNum: '',
    seriesKey: null,
    releaseDate: null,
    status: 'tbr',
    rating: 0,
    spice: null,
    tropes: [],
    warnings: {},
    moods: [],
    pace: null,
    format: null,
    progress: 0,
    dateAdded: today(),
    dateStarted: null,
    dateFinished: null,
    notes: '',
    favorite: false,
    ...fields,
  };
}

export function addBook(fields) {
  const b = newBook(fields);
  if (b.status === 'reading' && !b.dateStarted) b.dateStarted = today();
  if (b.status === 'read' && !b.dateFinished) b.dateFinished = today();
  state.books.unshift(b);
  persist();
  return b;
}

export function updateBook(id, patch) {
  const b = getBook(id);
  if (!b) return;
  if (patch.status && patch.status !== b.status) {
    if (patch.status === 'reading' && !b.dateStarted) patch.dateStarted = today();
    if (patch.status === 'read') {
      if (!b.dateFinished) patch.dateFinished = today();
      if (b.pages) patch.progress = b.pages;
    }
  }
  Object.assign(b, patch);
  persist();
  return b;
}

export function removeBook(id) {
  state.books = state.books.filter((b) => b.id !== id);
  persist();
}

export function setGoal(n) { state.goal = Math.max(1, n | 0); persist(); }

export function addCustom(kind, name) {
  const list = kind === 'trope' ? state.customTropes : state.customWarnings;
  if (name && !list.includes(name)) { list.push(name); persist(); }
}

// Search results are keyed by Open Library work ("/works/OL…W") or Apple Books id ("apple:123").
export const findByKey = (key) => key && state.books.find((b) =>
  b.olKey === key || (b.appleId && `apple:${b.appleId}` === key) || (b.googleId && `google:${b.googleId}` === key));

// The Google key stays on this device: never written into backup files.
export function exportJSON() {
  const { googleKey, ...rest } = state;
  return JSON.stringify(rest, null, 2);
}

export function setGoogleKey(key) { state.googleKey = key.trim(); persist(); }

export function importJSON(text) {
  const s = JSON.parse(text);
  if (!s || !Array.isArray(s.books)) throw new Error('That file is not a Shelflife backup.');
  const { googleKey } = state;
  state = { ...defaults(), ...s, googleKey };
  persist();
}

export function replaceAll(next) { state = { ...defaults(), ...next, googleKey: state.googleKey }; persist(); }
export function clearAll() { state = defaults(); persist(); }
