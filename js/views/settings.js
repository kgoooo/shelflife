import { getState, books } from '../store.js';
import { esc } from '../ui.js';

export function settingsView() {
  const s = getState();
  return `<div class="stack-lg" style="max-width:640px;margin:0 auto">
    <h1 class="h1">Settings</h1>

    <section class="card stack">
      <h2 class="h2">Reading goal</h2>
      <label class="field">Books to finish this year
        <input class="input" type="number" inputmode="numeric" min="1" value="${s.goal}" data-change="goal">
      </label>
    </section>

    <section class="card stack">
      <div class="spread"><h2 class="h2">Google Books</h2><span class="tag ${s.googleKey ? 'sage' : ''}">${s.googleKey ? 'On' : 'Off'}</span></div>
      <p class="small muted" style="margin:0">Optional. With your own free API key, search also checks Google Books, which helps with exact release dates and print-only books. The key is saved on this device only and is left out of backups.</p>
      <label class="field">API key
        <input class="input" id="google-key" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your key (starts with AIza…)" value="${esc(s.googleKey || '')}">
      </label>
      <div class="row" style="flex-wrap:wrap">
        <button class="btn btn-light" data-action="save-google-key">Save &amp; test</button>
        ${s.googleKey ? '<button class="btn btn-ghost" data-action="remove-google-key">Remove key</button>' : ''}
      </div>
      <p class="small" id="google-key-status" role="status" style="margin:0"></p>
    </section>

    <section class="card stack">
      <h2 class="h2">Your data</h2>
      <p class="small muted" style="margin:0">Your library (${books().length} books) is saved on this device only. Export a backup now and then, and import it to move to a new phone.</p>
      <div class="row" style="flex-wrap:wrap">
        <button class="btn" data-action="export">Export backup</button>
        <label class="btn" style="cursor:pointer">Import backup<input type="file" accept="application/json,.json" data-change="import" hidden></label>
      </div>
      <div class="divider"></div>
      <div class="row" style="flex-wrap:wrap">
        <button class="btn btn-ghost" data-action="load-sample">Load sample library</button>
        <button class="btn btn-danger" data-action="clear-all">Erase everything</button>
      </div>
    </section>

    <section class="card stack">
      <h2 class="h2">Install on your phone</h2>
      <p class="small muted" style="margin:0">Open this app's web address in Chrome or Samsung Internet, tap the menu, then <b>Add to Home screen</b> (or <b>Install app</b>). It then opens full-screen and works offline, folded or unfolded.</p>
    </section>

    <p class="tiny faint center">Book data and covers from Open Library.</p>
  </div>`;
}
