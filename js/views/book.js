import { getVisibleBook, getState, isUnlocked } from '../store.js';
import { STATUSES, SPICE, MOODS, PACES, FORMATS, SEVERITY, TROPE_GROUPS, WARNINGS } from '../data.js';
import { esc, icons, coverHTML, starSvg, flameSvg, countdownHTML } from '../ui.js';
import { ensureSeries, seriesHref } from './series.js';
import { ensureCover } from '../covers.js';

export function bookPage(id) {
  const b = getVisibleBook(id);
  if (!b) return `<div class="empty"><p>That book isn't in your library.</p><a class="btn" href="#/library">Back to library</a></div>`;
  return `<div style="max-width:680px;margin:0 auto">${bookDetail(b, 'back')}</div>`;
}

function ratingControl(b) {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    const full = b.rating >= i, half = !full && b.rating >= i - 0.5;
    out += `<button data-action="rate" data-id="${b.id}" data-v="${i}" aria-label="${i} stars" class="${full || half ? 'c-star' : 'c-off'}">
      ${starSvg(half ? 'half' : 'full')}
      <span class="half-hit" data-action="rate" data-id="${b.id}" data-v="${i - 0.5}" aria-hidden="true"></span>
    </button>`;
  }
  return `<div class="rate">${out}<span class="rate-label">${b.rating ? `${b.rating} / 5` : 'Tap to rate · left half for ½'}</span></div>`;
}

function spiceControl(b) {
  let out = `<button data-action="spice" data-id="${b.id}" data-v="0" class="chip ${b.spice === 0 ? 'on' : ''}" style="width:auto;padding:0 12px;margin-right:6px">Sweet</button>`;
  for (let i = 1; i <= 5; i++) {
    out += `<button data-action="spice" data-id="${b.id}" data-v="${i}" aria-label="Spice ${i}" class="${b.spice >= i ? 'c-spice' : 'c-off'}">${flameSvg()}</button>`;
  }
  const s = b.spice != null ? SPICE[b.spice] : null;
  return `<div class="rate" style="flex-wrap:wrap">${out}</div>
    <div class="small muted" style="margin-top:6px">${s ? `<b style="color:var(--text)">${s.label}</b> · ${s.blurb}` : 'Not rated yet'}</div>`;
}

function warningChips(b) {
  const entries = Object.entries(b.warnings || {}).sort((x, y) => y[1] - x[1]);
  if (!entries.length) return '<p class="small faint" style="margin:0">None added.</p>';
  return `<div class="row-wrap">${entries.map(([w, s]) => `<span class="chip warn-${s}" style="cursor:default">${esc(w)} <span class="sev">${SEVERITY[s]}</span></span>`).join('')}</div>`;
}

export function bookDetail(b, backHref) {
  const back = backHref === 'back'
    ? `<a href="javascript:history.back()" class="back-link">${icons.back} Back</a>`
    : `<a href="${backHref}" class="back-link">${icons.back} Back to shelf</a>`;
  const pct = b.pages ? Math.round((b.progress / b.pages) * 100) : 0;
  ensureSeries(b);
  ensureCover(b);
  const series = b.series
    ? `<a class="series-link" href="${seriesHref(b)}">${b.seriesNum ? `Book ${esc(b.seriesNum)} · ` : ''}${esc(b.series)} <span aria-hidden="true">→</span></a>`
    : '';

  return `<article class="stack-lg" data-book="${b.id}">
    <div>
      ${back}
      <div class="detail-head">
        ${coverHTML(b, 'L')}
        <div class="info">
          ${series}
          ${b.private ? `<span class="tag private-tag">${icons.moon} After Dark</span>` : ''}
          <h1 class="detail-title">${esc(b.title)}</h1>
          <div class="muted">${esc(b.authors.join(', ') || 'Unknown author')}</div>
          <div class="small faint">${[b.year, b.pages ? `${b.pages} pages` : null, b.format].filter(Boolean).join(' · ')}</div>
          <div class="row" style="margin-top:4px">
            <button class="icon-btn" data-action="fav" data-id="${b.id}" aria-label="Favorite" aria-pressed="${b.favorite}" style="${b.favorite ? 'color:var(--rose)' : ''}">${b.favorite ? icons.heart.replace('fill="none"', 'fill="currentColor"') : icons.heart}</button>
            <button class="btn btn-sm btn-ghost" data-action="edit-info" data-id="${b.id}" style="padding:0 10px">Edit</button>
            <button class="btn btn-sm btn-ghost" data-action="pick-cover" data-id="${b.id}" style="padding:0 10px">Change cover</button>
          </div>
        </div>
      </div>
    </div>

    <div class="status-pick" role="group" aria-label="Status">
      ${STATUSES.map((s) => `<button data-action="status" data-id="${b.id}" data-v="${s.id}" class="${b.status === s.id ? 'on' : ''}">${s.label}</button>`).join('')}
    </div>

    ${b.status === 'upcoming' ? `<section class="stack">
      ${countdownHTML(b, { big: true })}
      <label class="field">Release date<input class="input" type="date" value="${b.releaseDate || ''}" data-change="releaseDate" data-id="${b.id}"></label>
    </section>` : ''}

    ${b.status === 'reading' ? `<section class="stack" style="gap:8px">
      <div class="spread small"><span class="muted">Progress</span><span>${pct}%</span></div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="row">
        <input class="input mini-input" type="number" inputmode="numeric" min="0" value="${b.progress || ''}" placeholder="pg" data-change="progress" data-id="${b.id}" aria-label="Current page">
        <span class="small faint">of ${b.pages || '?'} pages</span>
        <div style="flex:1"></div>
        <button class="btn btn-sm btn-light" style="padding:0 12px" data-action="finish" data-id="${b.id}">Finished</button>
      </div>
    </section>` : ''}

    ${b.status === 'read' || b.status === 'dnf' ? `<section class="detail-section"><h3>Your rating</h3>${ratingControl(b)}</section>` : ''}

    <section class="detail-section"><h3>Spice level</h3>${spiceControl(b)}</section>

    <section class="detail-section">
      <h3>Tropes <button class="btn btn-sm btn-ghost" data-action="pick-tropes" data-id="${b.id}" style="padding:0 10px">${b.tropes.length ? 'Edit' : '+ Add'}</button></h3>
      ${b.tropes.length ? `<div class="row-wrap">${b.tropes.map((t) => `<span class="chip trope on" style="cursor:default">${esc(t)}</span>`).join('')}</div>` : '<p class="small faint" style="margin:0">Enemies to lovers? Only one bed? Tag it.</p>'}
    </section>

    <section class="detail-section">
      <h3>Content warnings <button class="btn btn-sm btn-ghost" data-action="pick-warnings" data-id="${b.id}" style="padding:0 10px">${Object.keys(b.warnings).length ? 'Edit' : '+ Add'}</button></h3>
      ${warningChips(b)}
    </section>

    <section class="detail-section">
      <h3>Mood</h3>
      <div class="row-wrap">${MOODS.map((m) => `<button class="chip mood ${b.moods.includes(m) ? 'on' : ''}" data-action="mood" data-id="${b.id}" data-v="${m}">${m}</button>`).join('')}</div>
    </section>

    <section class="detail-section">
      <h3>Pace</h3>
      <div class="pace-pick">${PACES.map((p) => `<button class="chip ${b.pace === p ? 'on' : ''}" data-action="pace" data-id="${b.id}" data-v="${p}">${p}</button>`).join('')}</div>
    </section>

    <section class="detail-section stack">
      <h3 style="margin:0">Reading log</h3>
      <div class="dates">
        <label class="field">Started<input class="input" type="date" value="${b.dateStarted || ''}" data-change="dateStarted" data-id="${b.id}"></label>
        <label class="field">Finished<input class="input" type="date" value="${b.dateFinished || ''}" data-change="dateFinished" data-id="${b.id}"></label>
      </div>
      <label class="field">Format
        <select class="input" data-change="format" data-id="${b.id}">
          <option value="">—</option>
          ${FORMATS.map((f) => `<option ${b.format === f ? 'selected' : ''}>${f}</option>`).join('')}
        </select>
      </label>
      <label class="field">Notes &amp; quotes
        <textarea class="input" data-change="notes" data-id="${b.id}" placeholder="Favorite lines, thoughts, who you'd recommend it to…">${esc(b.notes)}</textarea>
      </label>
    </section>

    <section class="detail-section">
      <label class="toggle-row">
        <span>
          <b>${icons.moon} After Dark</b>
          <span class="small faint">Keep this book on your private shelf. It's hidden everywhere, stats included, until you unlock After Dark with your PIN.</span>
        </span>
        <input type="checkbox" class="switch" data-change="private" data-id="${b.id}" ${b.private ? 'checked' : ''} aria-label="Keep on After Dark shelf">
      </label>
    </section>

    ${b.description ? `<section class="detail-section"><h3>About</h3><div class="desc" data-action="toggle-desc">${esc(b.description).replace(/(\r?\n\s*)+/g, '<br><br>')}</div></section>` : ''}

    <section class="detail-section row" style="justify-content:space-between">
      <span class="tiny faint">Added ${esc(b.dateAdded || '')}</span>
      <button class="btn btn-sm btn-danger" style="padding:0 12px" data-action="delete" data-id="${b.id}">Remove from library</button>
    </section>
  </article>`;
}

/* ---------- Sheets ---------- */
export function tropeSheetBody(b, q = '') {
  const custom = getState().customTropes;
  const groups = { ...TROPE_GROUPS, ...(custom.length ? { 'Your tropes': custom } : {}) };
  const ql = q.toLowerCase();
  let html = '';
  for (const [g, list] of Object.entries(groups)) {
    const items = list.filter((t) => !ql || t.toLowerCase().includes(ql));
    if (!items.length) continue;
    html += `<div class="picker-group"><span class="eyebrow">${esc(g)}</span><div class="row-wrap">
      ${items.map((t) => `<button class="chip trope ${b.tropes.includes(t) ? 'on' : ''}" data-action="toggle-trope" data-id="${b.id}" data-v="${esc(t)}">${esc(t)}</button>`).join('')}
    </div></div>`;
  }
  if (q && !Object.values(groups).flat().some((t) => t.toLowerCase() === ql)) {
    html += `<button class="btn btn-sm" style="padding:0 12px" data-action="custom-trope" data-id="${b.id}" data-v="${esc(q)}">+ Add “${esc(q)}” as a trope</button>`;
  }
  return html || '<p class="faint small">No matches.</p>';
}

export function warningSheetBody(b, q = '') {
  const all = [...WARNINGS, ...getState().customWarnings];
  const ql = q.toLowerCase();
  const items = all.filter((w) => !ql || w.toLowerCase().includes(ql));
  let html = `<p class="small faint" style="margin-top:0">Tap to cycle: minor → moderate → graphic → off.</p><div class="row-wrap">
    ${items.map((w) => { const s = b.warnings[w] || 0; return `<button class="chip ${s ? `warn-${s}` : ''}" data-action="cycle-warning" data-id="${b.id}" data-v="${esc(w)}">${esc(w)}${s ? ` <span class="sev">${SEVERITY[s]}</span>` : ''}</button>`; }).join('')}
  </div>`;
  if (q && !all.some((w) => w.toLowerCase() === ql)) {
    html += `<div style="margin-top:12px"><button class="btn btn-sm" style="padding:0 12px" data-action="custom-warning" data-id="${b.id}" data-v="${esc(q)}">+ Add “${esc(q)}”</button></div>`;
  }
  return html;
}

export function infoSheetBody(b) {
  return `<form class="stack" data-form="info" data-id="${b.id}">
    <label class="field">Title<input class="input" name="title" value="${esc(b.title)}" required></label>
    <label class="field">Author(s), comma separated<input class="input" name="authors" value="${esc(b.authors.join(', '))}"></label>
    <div class="dates">
      <label class="field">Series<input class="input" name="series" value="${esc(b.series)}"></label>
      <label class="field">Book #<input class="input" name="seriesNum" value="${esc(b.seriesNum)}" inputmode="decimal"></label>
    </div>
    <div class="dates">
      <label class="field">Pages<input class="input" name="pages" type="number" inputmode="numeric" value="${b.pages || ''}"></label>
      <label class="field">Year<input class="input" name="year" type="number" inputmode="numeric" value="${b.year || ''}"></label>
    </div>
    <label class="field">Release date (for upcoming books)<input class="input" name="releaseDate" type="date" value="${b.releaseDate || ''}"></label>
    <label class="field">Cover image URL<input class="input" name="cover" value="${esc(b.cover || '')}" placeholder="https://…"></label>
    <button class="btn btn-light" type="submit">Save</button>
  </form>`;
}
