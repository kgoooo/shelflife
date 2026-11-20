import * as store from './store.js';
import { toast, openSheet, closeSheet } from './ui.js';
import { tropeSheetBody, warningSheetBody, infoSheetBody } from './views/book.js';
import { libFilters } from './views/library.js';
import { pickFilters, matchingTbr } from './views/discover.js';
import { resultCache } from './views/add.js';
import { openPreview, getDetails, refreshPreviewActions } from './views/preview.js';
import { sampleLibrary } from './sample.js';

const rerender = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

async function addFromResult(key, status) {
  const r = resultCache.get(key);
  if (!r || store.findByOlKey(key)) return;
  const b = store.addBook({ ...r, status });
  toast(`Added to ${status === 'tbr' ? 'your pile' : status === 'reading' ? 'reading' : 'read'}`);
  refreshPreviewActions();
  const extra = await getDetails(key);
  const patch = {};
  if (extra.description) patch.description = extra.description;
  if (!b.subjects.length && extra.subjects?.length) patch.subjects = extra.subjects.slice(0, 25);
  if (Object.keys(patch).length) store.updateBook(b.id, patch);
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
    case 'manual-add':
      openSheet('Add manually', `<form class="stack" data-form="manual">
        <label class="field">Title<input class="input" name="title" required></label>
        <label class="field">Author(s)<input class="input" name="authors"></label>
        <div class="dates">
          <label class="field">Pages<input class="input" name="pages" type="number" inputmode="numeric"></label>
          <label class="field">Shelf<select class="input" name="status"><option value="tbr">To read</option><option value="reading">Reading</option><option value="read">Read</option></select></label>
        </div>
        <button class="btn btn-light" type="submit">Add book</button>
      </form>`, (root) => root.querySelector('input').focus());
      break;

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
  const authors = (fd.authors || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (form.dataset.form === 'manual') {
    const b = store.addBook({ title: fd.title.trim(), authors, pages: +fd.pages || null, status: fd.status });
    closeSheet();
    toast(`Added “${b.title}”`);
    location.hash = `#/book/${b.id}`;
  } else if (form.dataset.form === 'info') {
    store.updateBook(form.dataset.id, {
      title: fd.title.trim(), authors, series: fd.series.trim(), seriesNum: fd.seriesNum.trim(),
      pages: +fd.pages || null, year: +fd.year || null, cover: fd.cover.trim() || null,
    });
    closeSheet();
    toast('Saved');
  }
}
