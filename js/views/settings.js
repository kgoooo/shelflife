import { getState, books } from '../store.js';

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
