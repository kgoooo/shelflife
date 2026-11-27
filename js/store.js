// Local-first storage. Everything lives in this device's localStorage; use Settings → Export to back up.
const KEY = 'shelflife.v1';

const defaults = () => ({
  version: 1,
  goal: 40,
  books: [],
  customTropes: [],
  customWarnings: [],
  dismissed: [], // Discover suggestions you said no to (title|author)
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
/* ---------- After Dark (private shelf) ----------
   Books marked private are left out of everything the app shows until After Dark is
   unlocked with the PIN. Unlocking lasts until the app is closed or put in the background.
   This hides books from people looking at your screen; it is not encryption. */
let unlocked = false;
const notify = () => listeners.forEach((fn) => fn());
export const isUnlocked = () => unlocked;
export const hasPin = () => !!state.privatePin;
export function lock() { if (unlocked) { unlocked = false; notify(); } }

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function setPin(pin) {
  const salt = uid() + uid();
  state.privatePin = { salt, hash: await hashPin(pin, salt) };
  unlocked = true;
  persist();
}
export async function unlock(pin) {
  if (!state.privatePin) return false;
  const ok = (await hashPin(pin, state.privatePin.salt)) === state.privatePin.hash;
  if (ok) { unlocked = true; notify(); }
  return ok;
}
// Forgotten PIN: the only way back in is to delete the private books.
export function resetPrivate() {
  state.books = state.books.filter((b) => !b.private);
  state.privatePin = null;
  unlocked = false;
  persist();
}

// What the app shows. Private books only while After Dark is unlocked.
export const books = () => (unlocked ? state.books : state.books.filter((b) => !b.private));
export const getBook = (id) => state.books.find((b) => b.id === id);          // for edits
export const getVisibleBook = (id) => books().find((b) => b.id === id);      // for screens
export const privateCount = () => state.books.filter((b) => b.private).length;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const today = () => new Date().toISOString().slice(0, 10);

export function newBook(fields = {}) {
  return {
    id: uid(),
    olKey: null,
    appleId: null,
    googleId: null,
    hardcoverId: null,
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
    private: false,
    suggested: null, // tags filled in automatically, so they can be undone
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

// Saved quietly (no re-render) so the Discover rows don't jump while you dismiss things.
export function dismissSuggestion(id) {
  if (state.dismissed.includes(id)) return;
  state.dismissed.push(id);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full */ }
}
export function clearDismissed() { state.dismissed = []; persist(); }

export function setGoal(n) { state.goal = Math.max(1, n | 0); persist(); }

export function addCustom(kind, name) {
  const list = kind === 'trope' ? state.customTropes : state.customWarnings;
  if (name && !list.includes(name)) { list.push(name); persist(); }
}

// Search results are keyed by Open Library work ("/works/OL…W") or Apple Books id ("apple:123").
export const findByKey = (key) => key && state.books.find((b) =>
  b.olKey === key || (b.appleId && `apple:${b.appleId}` === key) || (b.googleId && `google:${b.googleId}` === key)
  || (b.hardcoverId && `hc:book:${b.hardcoverId}` === key));

// The Google key stays on this device: never written into backup files.
export function exportJSON() {
  const { googleKey, hardcover, ...rest } = state;
  return JSON.stringify(rest, null, 2);
}

export function setGoogleKey(key) { state.googleKey = key.trim(); persist(); }

// Hardcover sign-in tokens: on this device only, never in backups.
export function setHardcover(tokens) { state.hardcover = tokens || null; persist(); }

export function importJSON(text) {
  const s = JSON.parse(text);
  if (!s || !Array.isArray(s.books)) throw new Error('That file is not a Shelflife backup.');
  const { googleKey, hardcover } = state;
  state = { ...defaults(), ...s, googleKey, hardcover };
  persist();
}

export function replaceAll(next) {
  // The sample library keeps your Google key and PIN.
  state = { ...defaults(), ...next, googleKey: state.googleKey, hardcover: state.hardcover, privatePin: state.privatePin };
  persist();
}
export function clearAll() { state = defaults(); unlocked = false; persist(); }
