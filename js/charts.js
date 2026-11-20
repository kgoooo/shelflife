import { esc } from './ui.js';

// Vertical bar chart. data: [{label, value, tip}]
export function barChart(data, { height = 170, color = '', unit = '' } = {}) {
  const W = 340, H = height, padL = 26, padB = 22, padT = 14;
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const plotW = W - padL, plotH = H - padB - padT;
  const step = plotW / data.length;
  const bw = Math.max(4, Math.min(22, step - 6));
  const ticks = [0, nice / 2, nice];
  let g = '';
  ticks.forEach((t) => {
    const y = padT + plotH - (t / nice) * plotH;
    g += `<line class="${t === 0 ? 'axis' : 'grid'}" x1="${padL}" x2="${W}" y1="${y}" y2="${y}"/>`;
    g += `<text x="${padL - 6}" y="${y + 3.5}" text-anchor="end">${fmt(t)}</text>`;
  });
  data.forEach((d, i) => {
    const h = (d.value / nice) * plotH;
    const x = padL + i * step + (step - bw) / 2;
    const y = padT + plotH - h;
    const r = Math.min(4, bw / 2, h);
    const path = h > 0
      ? `M${x},${padT + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${padT + plotH} Z`
      : '';
    g += `<g data-tip="${esc(d.tip ?? `${d.label}: ${d.value}${unit}`)}" data-x="${x + bw / 2}" data-y="${y}">
      <rect class="hit" x="${padL + i * step}" y="${padT}" width="${step}" height="${plotH + padB}"/>
      ${path ? `<path class="bar ${color}" d="${path}"/>` : ''}
      <text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>
    </g>`;
  });
  return `<div class="chart" data-chart><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">${g}</svg><div class="chart-tip"></div></div>`;
}

// Horizontal bars as HTML (labels stay crisp at every fold width). items: [{label, value}]
export function hBars(items, { color = '', max } = {}) {
  if (!items.length) return '<p class="faint small">Nothing tagged yet.</p>';
  const m = max ?? Math.max(...items.map((i) => i.value));
  return `<div class="hbars">${items.map((i) => `
    <div class="hbar" title="${esc(i.label)}: ${i.value}">
      <span class="lbl">${esc(i.label)}</span>
      <span class="track"><span class="fill ${color}" style="width:${(i.value / m) * 100}%; display:block"></span></span>
      <span class="num">${i.value}</span>
    </div>`).join('')}</div>`;
}

export function goalRing(done, goal) {
  const pct = Math.min(1, done / Math.max(1, goal));
  const r = 40, c = 2 * Math.PI * r;
  return `<svg viewBox="0 0 92 92" role="img" aria-label="${done} of ${goal} books">
    <circle cx="46" cy="46" r="${r}" fill="none" stroke="rgba(236,231,220,.1)" stroke-width="6"/>
    <circle cx="46" cy="46" r="${r}" fill="none" stroke="var(--light)" stroke-width="6" stroke-linecap="round"
      stroke-dasharray="${c * pct} ${c}" transform="rotate(-90 46 46)"/>
    <text x="46" y="50" text-anchor="middle" fill="var(--text)" font-family="Archivo" font-weight="750" font-size="20">${Math.round(pct * 100)}%</text>
  </svg>`;
}

// Hover/tap tooltips for every [data-chart] inside root.
export function wireCharts(root) {
  root.querySelectorAll('[data-chart]').forEach((chart) => {
    const tip = chart.querySelector('.chart-tip');
    const svgEl = chart.querySelector('svg');
    const show = (g) => {
      const vb = svgEl.viewBox.baseVal;
      const scale = svgEl.clientWidth / vb.width;
      tip.textContent = g.dataset.tip;
      tip.style.left = `${g.dataset.x * scale}px`;
      tip.style.top = `${g.dataset.y * scale}px`;
      tip.classList.add('show');
    };
    chart.addEventListener('pointerover', (e) => { const g = e.target.closest('g[data-tip]'); if (g) show(g); });
    chart.addEventListener('pointerleave', () => tip.classList.remove('show'));
  });
}

function niceMax(v) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return v;
}
const fmt = (n) => n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(Math.round(n));
