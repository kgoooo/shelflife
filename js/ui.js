import { COVER_TONES } from './data.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

export const icons = {
  home: svg('<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>'),
  library: svg('<path d="M5 4h3v16H5zM10 4h3v16h-3z"/><path d="m15.2 5.1 2.9-.8 3.9 14.6-2.9.8z"/>'),
  discover: svg('<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'),
  stats: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2"'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>', 'width="16" height="16"'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>', 'width="18" height="18"'),
  heart: svg('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>', 'width="18" height="18"'),
  sparkle: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>', 'width="15" height="15"'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 'width="18" height="18"'),
  moon: svg('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>', 'width="18" height="18"'),
  dice: svg('<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>', 'width="18" height="18"'),
  orbit: `<svg viewBox="0 0 64 24" fill="none" stroke="currentColor" stroke-width="1"><ellipse cx="32" cy="12" rx="31" ry="11"/><ellipse cx="32" cy="12" rx="20" ry="11"/><ellipse cx="32" cy="12" rx="8" ry="11"/><path d="M1 12h62M4 6.5h56M4 17.5h56"/></svg>`,
};

const STAR = '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/>';
const FLAME = '<path d="M12 2.5c.6 3.2 4.8 5.6 4.8 10.7A4.8 4.8 0 0 1 12 18a4.8 4.8 0 0 1-4.8-4.8c0-2 .9-3.2 1.9-4.3.2 1.5.9 2.5 1.9 2.8-.5-3.4 1-6.8 1-9.2z"/><path d="M8 19.5c1 1.2 2.4 2 4 2s3-.8 4-2" stroke-width="1.6" stroke="currentColor" fill="none" stroke-linecap="round"/>';

export const starSvg = (fill = 'full') => {
  if (fill === 'half') {
    return `<svg viewBox="0 0 24 24"><defs><linearGradient id="hg"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="rgba(236,231,220,.14)"/></linearGradient></defs><path d="${STAR.match(/d="([^"]+)"/)[1]}" fill="url(#hg)"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="currentColor">${STAR}</svg>`;
};
export const flameSvg = () => `<svg viewBox="0 0 24 24" fill="currentColor">${FLAME}</svg>`;

export function starsInline(rating) {
  if (!rating) return '';
  let out = '';
  for (let i = 1; i <= 5; i++) {
    const cls = rating >= i ? 'c-star' : rating >= i - 0.5 ? 'c-star' : 'c-off';
    out += `<span class="${cls}">${starSvg(rating >= i ? 'full' : rating >= i - 0.5 ? 'half' : 'full')}</span>`;
  }
  return `<span class="stars-inline" aria-label="${rating} stars">${out}</span>`;
}

export function spiceInline(level) {
  if (level == null) return '';
  if (level === 0) return '<span class="tag">Sweet</span>';
  let out = '';
  for (let i = 1; i <= 5; i++) out += `<span class="${i <= level ? 'c-spice' : 'c-off'}">${flameSvg()}</span>`;
  return `<span class="spice-inline" aria-label="Spice ${level} of 5">${out}</span>`;
}

function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

export function coverHTML(book, size = 'M') {
  const tones = COVER_TONES[hash(book.title + (book.authors?.[0] || '')) % COVER_TONES.length];
  const ph = `<div class="cover-ph" style="background:linear-gradient(160deg, ${tones[1]}, ${tones[0]} 70%)"><b>${esc(book.title)}</b><i>${esc(book.authors?.[0] || '')}</i></div>`;
  const src = book.cover && size === 'L' ? book.cover.replace('-M.jpg', '-L.jpg') : book.cover;
  const img = src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<div class="cover">${ph}${img}</div>`;
}

export const authorLine = (b) => esc((b.authors || []).slice(0, 2).join(', ') || 'Unknown author');

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// Bottom sheet on the folded screen, centered dialog when unfolded.
export function openSheet(title, bodyHTML, onMount) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.id = 'sheet';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-grip"></div>
    <div class="sheet-head"><h2 class="h2">${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>
    <div class="sheet-body">${bodyHTML}</div></div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) closeSheet(); });
  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  onMount?.(wrap.querySelector('.sheet-body'));
  return wrap;
}
export function closeSheet() {
  document.getElementById('sheet')?.remove();
  document.body.style.overflow = '';
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

export const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

// Calendar countdown to a YYYY-MM-DD release date. null once it's out.
export function countdown(dateStr) {
  if (!dateStr) return undefined;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const r = new Date(dateStr + 'T00:00:00');
  if (r <= t) return null;
  let y = r.getFullYear() - t.getFullYear();
  let m = r.getMonth() - t.getMonth();
  let d = r.getDate() - t.getDate();
  if (d < 0) { m--; d += new Date(r.getFullYear(), r.getMonth(), 0).getDate(); }
  if (m < 0) { y--; m += 12; }
  return { y, m, d, total: Math.round((r - t) / 864e5) };
}

export function countdownHTML(b, { big = false } = {}) {
  const c = countdown(b.releaseDate);
  if (c === undefined) return `<div class="countdown tba ${big ? 'big' : ''}"><span>Release date TBA</span></div>`;
  if (c === null) {
    return `<div class="countdown out ${big ? 'big' : ''}">
      <span class="out-label">Out now</span>
      <button class="btn btn-sm btn-light" style="padding:0 12px" data-action="status" data-id="${b.id}" data-v="tbr">Move to To read</button>
    </div>`;
  }
  const added = new Date((b.dateAdded || store_today()) + 'T00:00:00');
  const rel = new Date(b.releaseDate + 'T00:00:00');
  const span = Math.max(1, rel - added);
  const waited = Math.min(1, Math.max(0.02, (Date.now() - added) / span));
  const cell = (n, label) => `<div class="cd-cell ${n === 0 ? 'zero' : ''}"><b>${n}</b><span>${label}${n === 1 ? '' : 's'}</span></div>`;
  return `<div class="countdown ${big ? 'big' : ''}" aria-label="${c.total} days until release">
    <div class="cd-cells">${cell(c.y, 'year')}${cell(c.m, 'month')}${cell(c.d, 'day')}</div>
    <div class="cd-bar"><i style="width:${waited * 100}%"></i></div>
    <div class="cd-foot"><span>${c.total.toLocaleString()} day${c.total === 1 ? '' : 's'} to go</span><span>${fmtDate(b.releaseDate)}</span></div>
  </div>`;
}
const store_today = () => new Date().toISOString().slice(0, 10);
