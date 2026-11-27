import * as store from './store.js';
import { toast, openSheet, closeSheet, esc } from './ui.js';
import { tropeSheetBody, warningSheetBody, infoSheetBody } from './views/book.js';
import { libFilters } from './views/library.js';
import { pickFilters, matchingTbr } from './views/discover.js';
import { resultCache } from './views/add.js';
import { openPreview, getDetails, refreshPreviewActions } from './views/preview.js';
import { sampleLibrary } from './sample.js';
import { openCoverPicker, setCover } from './covers.js';
import { testGoogleKey, seriesFromTitle, stripSeriesSuffix, sameBook } from './api.js';
import { connectHardcover, disconnectHardcover, testHardcover } from './hardcover.js';
import { applySuggestions, undoSuggestions } from './autotag.js';

const rerender = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

async function addFromResult(key, status) {
  const r = resultCache.get(key);
  if (!r || store.findByKey(key)) return;
  const { seriesKeyList, positions, key: _k, rating, olCover, ...fields } = r;
  const fromTitle = !fields.series ? seriesFromTitle(fields.title) : null;
  if (fromTitle) Object.assign(fields, fromTitle, { title: stripSeriesSuffix(fields.title) });
  const b = store.addBook({ ...fields, status, seriesChecked: false });
  toast({ tbr: 'Added to your pile', reading: 'Added to reading', read: 'Added to read', upcoming: b.releaseDate ? 'Added to Upcoming' : 'Added to Upcoming. Set its release date.' }[status]);
  refreshPreviewActions();
  const extra = await getDetails(key);
  const patch = {};
  if (extra.description && !b.description) patch.description = extra.description;
  if (!b.subjects.length && extra.subjects?.length) patch.subjects = extra.subjects.slice(0, 25);
  if (Object.keys(patch).length) store.updateBook(b.id, patch);
  // Pre-fill tropes, moods, pace and stated content warnings from the blurb and genres.
  const fresh = store.getBook(b.id);
  const sug = fresh && applySuggestions(fresh, { description: extra.description, subjects: [...(extra.subjects || []), ...(r.subjects || [])] });
  if (sug) store.updateBook(b.id, sug.patch);
}

// Refresh an open picker sheet in place, keeping its search text.
function refreshSheet(kind, id) {
  const body = document.querySelector('#sheet [data-picker-list]');
  if (!body) return;
  const b = store.getBook(id);
  const q = document.querySelector('#sheet [data-picker-q]')?.value || '';
  body.innerHTML = kind === 'trope' ? tropeSheetBody(b, q) : warningSheetBody(b, q);
}

function openPicker(kind, id) {
  const b = store.getBook(id);
  openSheet(kind === 'trope' ? 'Tropes' : 'Content warnings', `
    <input class="input picker-search" type="search" placeholder="Search or add your own" data-picker-q data-kind="${kind}" data-id="${id}" autocomplete="off">
    <div data-picker-list>${kind === 'trope' ? tropeSheetBody(b) : warningSheetBody(b)}</div>
    <button class="btn btn-light btn-block" data-close style="margin-top:16px">Done</button>`,
  (root) => {
    root.querySelector('[data-picker-q]').addEventListener('input', () => refreshSheet(kind, id));
  });
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function manualAddSheet(d = {}) {
  const upcoming = d.v === 'upcoming';
  const opt = (v, l) => `<option value="${v}" ${d.v === v ? 'selected' : ''}>${l}</option>`;
  openSheet(upcoming ? 'Add an upcoming book' : 'Add manually', `<form class="stack" data-form="manual">
    <label class="field">Title<input class="input" name="title" required></label>
    <label class="field">Author(s)<input class="input" name="authors" value="${esc(d.author || '')}"></label>
    <div class="dates">
      <label class="field">Series<input class="input" name="series" value="${esc(d.series || '')}"></label>
      <label class="field">Book #<input class="input" name="seriesNum" inputmode="decimal" value="${esc(d.series ? d.num || '' : '')}"></label>
    </div>
    <input type="hidden" name="seriesKey" value="${esc(d.seriesKey || '')}">
    <div class="dates">
      <label class="field">Shelf<select class="input" name="status">${opt('tbr', 'To read')}${opt('reading', 'Reading')}${opt('read', 'Read')}${opt('upcoming', 'Upcoming')}</select></label>
      <label class="field">Pages<input class="input" name="pages" type="number" inputmode="numeric"></label>
    </div>
    <label class="field">Release date${upcoming ? '' : ' (if it\'s not out yet)'}<input class="input" name="releaseDate" type="date"></label>
    ${store.isUnlocked() ? '<label class="toggle-row small"><span>Add to After Dark</span><input type="checkbox" class="switch" name="private"></label>' : ''}
    <button class="btn btn-light" type="submit">Add book</button>
  </form>`, (root) => root.querySelector('input').focus());
}

/* ---------- After Dark ---------- */
const PIN_INPUT = (name, label) => `<label class="field">${label}
  <input class="input pin-input" name="${name}" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="8" autocomplete="off" required></label>`;

let pendingPrivateId = null; // book waiting to go private once a PIN exists

function openPinSetup(bookId = null, change = false) {
  pendingPrivateId = bookId;
  openSheet(change ? 'Change After Dark PIN' : 'Set up After Dark', `<form class="stack" data-form="pin-setup">
    <p class="small muted" style="margin:0">After Dark is a private shelf. Books on it are hidden everywhere in the app, stats included, until you unlock it with this PIN. It locks again whenever you leave the app.</p>
    ${PIN_INPUT('pin', 'Choose a PIN (4–8 digits)')}
    ${PIN_INPUT('pin2', 'Type it again')}
    <p class="small" data-pin-error style="color:var(--warn-3);margin:0"></p>
    <button class="btn btn-light" type="submit">${change ? 'Save new PIN' : 'Turn on After Dark'}</button>
  </form>`, (root) => root.querySelector('input').focus());
}

export function openUnlock() {
  if (store.isUnlocked()) { store.lock(); toast('After Dark locked'); return; }
  if (!store.hasPin()) { openPinSetup(); return; }
  openSheet('After Dark', `<form class="stack" data-form="pin-unlock">
    ${PIN_INPUT('pin', 'PIN')}
    <p class="small" data-pin-error style="color:var(--warn-3);margin:0"></p>
    <button class="btn btn-light" type="submit">Unlock</button>
    <button class="btn btn-ghost btn-sm" type="button" data-action="forgot-pin" style="align-self:center;padding:0 12px">Forgot PIN?</button>
  </form>`, (root) => root.querySelector('input').focus());
}

export function handleAction(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id, v } = el.dataset;
  const b = id ? store.getBook(id) : null;

  switch (action) {
    case 'status': store.updateBook(id, { status: v }); if (v === 'reading') toast('Happy reading'); break;
    case 'finish': store.updateBook(id, { status: 'read' }); toast(`Finished “${b.title}”. Rate it!`); location.hash = `#/book/${id}`; break;
    case 'rate': e.stopPropagation(); store.updateBook(id, { rating: b.rating === +v ? 0 : +v }); break;
    case 'spice': store.updateBook(id, { spice: b.spice === +v ? null : +v }); break;
    case 'pace': store.updateBook(id, { pace: b.pace === v ? null : v }); break;
    case 'fav': store.updateBook(id, { favorite: !b.favorite }); break;
    case 'mood': store.updateBook(id, { moods: b.moods.includes(v) ? b.moods.filter((m) => m !== v) : [...b.moods, v] }); break;
    case 'toggle-desc': el.classList.toggle('open'); break;

    case 'pick-tropes': openPicker('trope', id); break;
    case 'pick-warnings': openPicker('warning', id); break;
    case 'toggle-trope':
      store.updateBook(id, { tropes: b.tropes.includes(v) ? b.tropes.filter((t) => t !== v) : [...b.tropes, v] });
      refreshSheet('trope', id); break;
    case 'custom-trope':
      store.addCustom('trope', v); store.updateBook(id, { tropes: [...b.tropes, v] });
      document.querySelector('#sheet [data-picker-q]').value = ''; refreshSheet('trope', id); break;
    case 'cycle-warning': {
      const w = { ...b.warnings }; const s = ((w[v] || 0) + 1) % 4;
      if (s) w[v] = s; else delete w[v];
      store.updateBook(id, { warnings: w }); refreshSheet('warning', id); break;
    }
    case 'custom-warning':
      store.addCustom('warning', v); store.updateBook(id, { warnings: { ...b.warnings, [v]: 2 } });
      document.querySelector('#sheet [data-picker-q]').value = ''; refreshSheet('warning', id); break;

    case 'edit-info': openSheet('Edit details', infoSheetBody(b)); break;
    case 'pick-cover': openCoverPicker(id); break;
    case 'set-cover': setCover(id, v); break;
    case 'delete':
      if (confirm(`Remove “${b.title}” from your library? This can't be undone.`)) {
        store.removeBook(id);
        toast('Removed');
        location.hash = location.hash.startsWith('#/library') ? location.hash.split('/').slice(0, 3).join('/') : '#/library';
      }
      break;

    case 'add-result': addFromResult(el.dataset.key, v); break;
    case 'preview': openPreview(el.dataset.key); break;
    case 'retry-shelf': rerender(); break;
    case 'manual-add': manualAddSheet(el.dataset); break;

    case 'pick-genre':
      pickFilters.genres = pickFilters.genres.includes(v) ? pickFilters.genres.filter((g) => g !== v) : [...pickFilters.genres, v];
      pickFilters.pickId = null; rerender(); break;
    case 'pick-mood':
      pickFilters.moods = pickFilters.moods.includes(v) ? pickFilters.moods.filter((m) => m !== v) : [...pickFilters.moods, v];
      pickFilters.pickId = null; rerender(); break;
    case 'pick-random': {
      const pool = matchingTbr().filter((x) => x.id !== pickFilters.pickId);
      const list = pool.length ? pool : matchingTbr();
      if (list.length) { pickFilters.pickId = list[Math.floor(Math.random() * list.length)].id; rerender(); }
      break;
    }

    case 'load-sample':
      if (!store.books().length || confirm('Replace your current library with the sample library?')) {
        store.replaceAll(sampleLibrary()); toast('Sample library loaded'); location.hash = '#/';
      }
      break;
    case 'save-google-key': {
      const key = document.getElementById('google-key').value.trim();
      const show = (msg, ok) => {
        const el = document.getElementById('google-key-status');
        if (el) { el.textContent = msg; el.style.color = ok ? 'var(--sage)' : 'var(--warn-3)'; }
      };
      if (!key) { show('Paste a key first.', false); break; }
      show('Testing…', true);
      testGoogleKey(key).then(({ ok, message }) => {
        if (ok) { store.setGoogleKey(key); toast('Google Books is on'); }
        show(message, ok);
      });
      break;
    }
    case 'connect-hardcover': connectHardcover(); break;
    case 'disconnect-hardcover': disconnectHardcover(); toast('Hardcover disconnected'); break;
    case 'test-hardcover': {
      const el = document.getElementById('hardcover-status');
      if (el) { el.textContent = 'Testing…'; el.style.color = 'var(--muted)'; }
      testHardcover({ sameBook }).then(({ ok, message }) => {
        const e2 = document.getElementById('hardcover-status');
        if (e2) { e2.textContent = message; e2.style.color = ok ? 'var(--sage)' : 'var(--warn-3)'; }
      });
      break;
    }
    case 'remove-google-key': store.setGoogleKey(''); toast('Google Books key removed'); break;
    case 'suggest-tags': {
      const sug = applySuggestions(b);
      if (sug) { store.updateBook(id, sug.patch); toast(`Suggested ${sug.count} tag${sug.count === 1 ? '' : 's'}`); }
      else toast('Nothing new to suggest from the description');
      break;
    }
    case 'keep-suggestions': store.updateBook(id, { suggested: null }); break;
    case 'undo-suggestions': store.updateBook(id, undoSuggestions(b)); toast('Suggestions removed'); break;
    case 'dismiss-suggestion': {
      store.dismissSuggestion(v);
      const tile = el.closest('.book-tile');
      const row = tile?.parentElement;
      tile?.remove();
      if (row && !row.children.length) row.closest('section')?.remove();
      toast('Got it, you won\'t see that one again');
      break;
    }
    case 'clear-dismissed': store.clearDismissed(); toast('Hidden suggestions are back'); break;
    case 'open-after-dark': openUnlock(); break;
    case 'lock-after-dark': store.lock(); toast('After Dark locked'); break;
    case 'change-pin': openPinSetup(null, true); break;
    case 'forgot-pin': {
      const n = store.privateCount();
      if (confirm(`Your PIN can't be recovered. To start over, the ${n} book${n === 1 ? '' : 's'} on your After Dark shelf will be deleted and the PIN removed. (If you exported a backup, you can import it to get them back, along with the old PIN.)\n\nDelete them and reset?`)) {
        store.resetPrivate(); closeSheet(); toast('After Dark reset');
      }
      break;
    }
    case 'export': download(`shelflife-backup-${store.today()}.json`, store.exportJSON()); break;
    case 'clear-all':
      if (confirm('Erase every book and setting on this device? Export a backup first if you might want it back.')) {
        store.clearAll(); toast('Library erased'); location.hash = '#/';
      }
      break;
  }
}

export function handleChange(e) {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const { change, id } = el.dataset;
  const val = el.value;
  switch (change) {
    case 'progress': {
      const b = store.getBook(id);
      let p = Math.max(0, parseInt(val, 10) || 0);
      if (b.pages) p = Math.min(p, b.pages);
      if (b.pages && p >= b.pages) { store.updateBook(id, { progress: p, status: 'read' }); toast(`Finished “${b.title}”!`); }
      else store.updateBook(id, { progress: p });
      break;
    }
    case 'private': {
      if (!el.checked) { store.updateBook(id, { private: false }); toast('Moved back to your main library'); break; }
      if (!store.hasPin()) { el.checked = false; openPinSetup(id); break; }
      store.updateBook(id, { private: true });
      if (!store.isUnlocked()) { toast('Moved to After Dark'); location.hash = '#/library'; }
      else toast('Moved to After Dark');
      break;
    }
    case 'releaseDate': store.updateBook(id, { releaseDate: val || null }); break;
    case 'dateStarted': case 'dateFinished': case 'notes':
      store.updateBook(id, { [change]: val || (change === 'notes' ? '' : null) }); break;
    case 'format': store.updateBook(id, { format: val || null }); break;
    case 'lib-sort': libFilters.sort = val; rerender(); break;
    case 'lib-spice': libFilters.spice = val; rerender(); break;
    case 'lib-trope': libFilters.trope = val; rerender(); break;
    case 'pick-min': pickFilters.minSpice = +val; pickFilters.maxSpice = Math.max(pickFilters.maxSpice, +val); pickFilters.pickId = null; rerender(); break;
    case 'pick-max': pickFilters.maxSpice = +val; pickFilters.minSpice = Math.min(pickFilters.minSpice, +val); pickFilters.pickId = null; rerender(); break;
    case 'pick-pages': pickFilters.maxPages = +val; pickFilters.pickId = null; rerender(); break;
    case 'pick-pace': pickFilters.pace = val; pickFilters.pickId = null; rerender(); break;
    case 'goal': store.setGoal(+val); toast('Goal updated'); break;
    case 'import': {
      const file = el.files?.[0];
      if (!file) return;
      file.text().then((t) => {
        try {
          if (store.books().length && !confirm('Replace your current library with this backup?')) return;
          store.importJSON(t); toast('Backup imported'); location.hash = '#/';
        } catch (err) { alert(err.message); }
      });
      break;
    }
  }
}

// Live filtering on the library search box without losing focus.
export function handleInput(e) {
  const el = e.target;
  if (el.dataset?.change !== 'lib-q') return;
  libFilters.q = el.value;
  const pos = el.selectionStart;
  rerender();
  const next = document.querySelector('[data-change="lib-q"]');
  if (next) { next.focus(); try { next.setSelectionRange(pos, pos); } catch { /* search inputs may not support it */ } }
}

export function handleSubmit(e) {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(form));
  const pinError = (msg) => { const el = form.querySelector('[data-pin-error]'); if (el) el.textContent = msg; };
  if (form.dataset.form === 'pin-setup') {
    if (!/^\d{4,8}$/.test(fd.pin)) return pinError('Use 4 to 8 digits.');
    if (fd.pin !== fd.pin2) return pinError("Those PINs don't match.");
    const wasSet = store.hasPin();
    store.setPin(fd.pin).then(() => {
      closeSheet();
      if (pendingPrivateId) { store.updateBook(pendingPrivateId, { private: true }); toast('After Dark is on. Book moved there.'); }
      else toast(wasSet ? 'PIN changed' : 'After Dark is on');
      pendingPrivateId = null;
    });
    return;
  }
  if (form.dataset.form === 'pin-unlock') {
    store.unlock(fd.pin).then((ok) => {
      if (!ok) { pinError('Wrong PIN.'); form.pin.value = ''; form.pin.focus(); return; }
      closeSheet(); toast('After Dark unlocked');
    });
    return;
  }
  const authors = (fd.authors || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (form.dataset.form === 'manual') {
    const releaseDate = fd.releaseDate || null;
    const status = releaseDate && releaseDate > store.today() && fd.status === 'tbr' ? 'upcoming' : fd.status;
    const b = store.addBook({
      title: fd.title.trim(), authors, pages: +fd.pages || null, status, releaseDate,
      series: fd.series.trim(), seriesNum: fd.seriesNum.trim(), seriesKey: fd.seriesKey || null, seriesChecked: true,
      private: !!fd.private,
    });
    closeSheet();
    toast(`Added “${b.title}”`);
    location.hash = `#/book/${b.id}`;
  } else if (form.dataset.form === 'info') {
    store.updateBook(form.dataset.id, {
      title: fd.title.trim(), authors, series: fd.series.trim(), seriesNum: fd.seriesNum.trim(),
      pages: +fd.pages || null, year: +fd.year || null, cover: fd.cover.trim() || null,
      releaseDate: fd.releaseDate || null,
    });
    closeSheet();
    toast('Saved');
  }
}
