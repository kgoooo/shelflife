import { subscribe } from './store.js';
import { icons } from './ui.js';
import { wireCharts } from './charts.js';
import { homeView } from './views/home.js';
import { libraryView } from './views/library.js';
import { bookPage } from './views/book.js';
import { addView, mountAdd } from './views/add.js';
import { discoverView, mountDiscover } from './views/discover.js';
import { statsView } from './views/stats.js';
import { settingsView } from './views/settings.js';
import { seriesView } from './views/series.js';
import { backfillCovers } from './covers.js';
import { handleAction, handleChange, handleInput, handleSubmit } from './actions.js';

const view = document.getElementById('view');
const NAV = [
  { href: '#/', id: 'home', label: 'Home', icon: icons.home },
  { href: '#/library', id: 'library', label: 'Library', icon: icons.library },
  { href: '#/add', id: 'add', label: 'Add', icon: icons.plus, cls: 'rail-add' },
  { href: '#/discover', id: 'discover', label: 'Discover', icon: icons.discover },
  { href: '#/stats', id: 'stats', label: 'Stats', icon: icons.stats },
];

document.getElementById('settings-link').innerHTML = icons.settings;

export const route = () => (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent);

function renderNav(section) {
  document.getElementById('nav').innerHTML = NAV.map((n) =>
    `<a href="${n.href}" class="${n.cls || ''} ${n.id === section ? 'active' : ''}" ${n.id === section ? 'aria-current="page"' : ''}>${n.icon}<span>${n.label}</span></a>`
  ).join('') + '<div class="rail-spacer"></div>';
}

let lastKey = '';
export function render() {
  const [section = 'home', a, b] = route();
  const key = location.hash;
  const sameRoute = key === lastKey;
  // Keep scroll positions when re-rendering the same screen after an edit.
  const pane = view.querySelector('.lib-detail');
  const paneScroll = pane?.scrollTop || 0;
  const winScroll = window.scrollY;

  renderNav(section === 'book' || section === 'series' ? 'library' : section);
  let html = '';
  let mount;
  switch (section) {
    case 'library': html = libraryView(a || 'reading', b); break;
    case 'book': html = bookPage(a); break;
    case 'add': html = addView(); mount = mountAdd; break;
    case 'discover': html = discoverView(); mount = mountDiscover; break;
    case 'stats': html = statsView(a); break;
    case 'settings': html = settingsView(); break;
    case 'series': html = seriesView(a, b); break;
    default: html = homeView();
  }
  // The add screen keeps its own live search box; don't wipe it on data changes.
  if (!(sameRoute && section === 'add' && view.dataset.section === 'add')) {
    view.innerHTML = html;
    view.dataset.section = section;
    mount?.(view);
  } else {
    mountAdd(view, { refresh: true });
  }
  wireCharts(view);
  const activeTab = view.querySelector('.tabs .on');
  if (activeTab) activeTab.parentElement.scrollLeft = activeTab.offsetLeft - 8;

  if (sameRoute) {
    window.scrollTo(0, winScroll);
    const p = view.querySelector('.lib-detail');
    if (p) p.scrollTop = paneScroll;
  } else {
    const wideDetail = section === 'library' && b && matchMedia('(min-width: 760px)').matches;
    if (!wideDetail) window.scrollTo(0, 0);
  }
  lastKey = key;
}

view.addEventListener('click', (e) => handleAction(e));
document.body.addEventListener('click', (e) => { if (e.target.closest('#sheet')) handleAction(e); });
view.addEventListener('change', (e) => handleChange(e));
document.body.addEventListener('change', (e) => { if (e.target.closest('#sheet')) handleChange(e); });

view.addEventListener('input', (e) => handleInput(e));
document.addEventListener('submit', (e) => handleSubmit(e));

window.addEventListener('hashchange', render);
subscribe(render);
render();
setTimeout(backfillCovers, 1500);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
