import { $, fmt } from '../lib/util.js';
import { KIND_LABEL } from '../lib/palette.js';
import { store } from '../core/store.js';
import { actions } from '../core/actions.js';

let xOf = null;

export function renderChart() {
  const { valid } = store;
  const box = $('chart');
  box.querySelector('svg')?.remove();
  const W = Math.max(320, box.clientWidth - 16), H1 = 120, H2 = 110, GAP = 18, M = { l: 52, r: 12, t: 10, b: 22 };
  const Ht = M.t + H1 + GAP + H2 + M.b;
  const t0 = Date.parse(valid[0].date), t1 = Date.parse(valid[valid.length - 1].date);
  const x = (d) => M.l + (Date.parse(d) - t0) / Math.max(1, t1 - t0) * (W - M.l - M.r);
  const kmMax = Math.max(...valid.map((v) => v.total_km)) * 1.05;
  const y1 = (km) => M.t + H1 - km / kmMax * H1;
  const chMax = Math.max(1, ...valid.map((v) => Math.max(v.added_km, v.removed_km))) * 1.1;
  const mid = M.t + H1 + GAP + H2 / 2;
  const y2 = (km) => mid - Math.sign(km) * Math.sqrt(Math.abs(km) / chMax) * (H2 / 2);
  const niceTicks = (max, n) => {
    const step = Math.pow(10, Math.floor(Math.log10(max / n)));
    const m = [1, 2, 5, 10].find((k) => max / (k * step) <= n) * step;
    const out = []; for (let v = 0; v <= max; v += m) out.push(v); return out;
  };

  let s = `<svg viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Route length over time and km changed per version">`;
  s += '<g class="grid axis">';
  for (const v of niceTicks(kmMax, 4)) s += `<line x1="${M.l}" x2="${W - M.r}" y1="${y1(v)}" y2="${y1(v)}"/><text x="${M.l - 6}" y="${y1(v) + 4}" text-anchor="end">${fmt(v, 0)}</text>`;
  for (const v of [0, ...[100, 1000, 10000].filter((t) => t < chMax)]) {
    s += `<line x1="${M.l}" x2="${W - M.r}" y1="${y2(v)}" y2="${y2(v)}"/><text x="${M.l - 6}" y="${y2(v) + 4}" text-anchor="end">${v ? '+' + fmt(v, 0) : '0'}</text>`;
    if (v) s += `<line x1="${M.l}" x2="${W - M.r}" y1="${y2(-v)}" y2="${y2(-v)}"/><text x="${M.l - 6}" y="${y2(-v) + 4}" text-anchor="end">−${fmt(v, 0)}</text>`;
  }
  const yr0 = new Date(t0).getUTCFullYear(), yrN = new Date(t1).getUTCFullYear();
  for (let yr = yr0 + 1; yr <= yrN; yr++) {
    const xx = x(`${yr}-01-01`);
    s += `<line x1="${xx}" x2="${xx}" y1="${M.t}" y2="${Ht - M.b}"/><text x="${xx}" y="${Ht - 6}" text-anchor="middle">${yr}</text>`;
  }
  s += `<text x="${M.l}" y="${M.t}" dx="4" dy="10" style="fill:var(--text-2)">km of route</text>`;
  s += `<text x="${M.l}" y="${M.t + H1 + GAP}" dx="4" dy="2" style="fill:var(--text-2)">km added (up) / removed (down), √ scale</text>`;
  s += '</g>';
  let d = '';
  valid.forEach((v, i) => { d += i ? `H${x(v.date)}V${y1(v.total_km)}` : `M${x(v.date)},${y1(v.total_km)}`; });
  s += `<path d="${d}H${W - M.r}" fill="none" stroke="var(--route)" stroke-width="2"/>`;
  const bw = 4;
  valid.forEach((v) => {
    const xx = x(v.date) - bw / 2;
    if (v.added_km > 0) s += `<rect x="${xx}" y="${y2(v.added_km)}" width="${bw}" height="${Math.max(1, mid - 1 - y2(v.added_km))}" rx="1.5" fill="var(--added)"/>`;
    if (v.removed_km > 0) s += `<rect x="${xx}" y="${mid + 1}" width="${bw}" height="${Math.max(1, y2(-v.removed_km) - mid - 1)}" rx="1.5" fill="var(--removed)"/>`;
  });
  s += `<line x1="${M.l}" x2="${W - M.r}" y1="${mid}" y2="${mid}" stroke="var(--text-3)" stroke-width="1"/>`;
  s += `<line id="cSel" y1="${M.t}" y2="${Ht - M.b}" stroke="var(--accent)" stroke-width="2" opacity=".6"/>`;
  s += `<line id="cHover" y1="${M.t}" y2="${Ht - M.b}" stroke="var(--text-3)" stroke-dasharray="3 3" visibility="hidden"/>`;
  s += `<circle id="cDot" r="4" fill="var(--route)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>`;
  s += `<rect id="cHit" x="${M.l}" y="0" width="${W - M.l - M.r}" height="${Ht}" fill="transparent" style="cursor:pointer"/>`;
  s += '</svg>';
  box.insertAdjacentHTML('beforeend', s);

  const svg = box.querySelector('svg'), tip = $('ctip'), hover = svg.querySelector('#cHover'), dot = svg.querySelector('#cDot');
  const nearest = (px) => {
    let best = 0, bd = Infinity;
    valid.forEach((v, i) => { const dd = Math.abs(x(v.date) - px); if (dd < bd) { bd = dd; best = i; } });
    return best;
  };
  const toLocal = (ev) => { const r = svg.getBoundingClientRect(); return (ev.clientX - r.left) * (W / r.width); };
  const hit = svg.querySelector('#cHit');
  hit.addEventListener('mousemove', (ev) => {
    const v = valid[nearest(toLocal(ev))], hx = x(v.date);
    hover.setAttribute('x1', hx); hover.setAttribute('x2', hx); hover.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', hx); dot.setAttribute('cy', y1(v.total_km)); dot.setAttribute('visibility', 'visible');
    tip.innerHTML = `<b>${v.date}</b> · ${KIND_LABEL[v.kind] || v.kind}<br>${fmt(v.total_km)} km route (${v.delta_km >= 0 ? '+' : '−'}${fmt(Math.abs(v.delta_km))})<br>` +
      `<span class="sw" style="background:var(--added)"></span>${fmt(v.added_km)} km added &nbsp; <span class="sw" style="background:var(--removed)"></span>${fmt(v.removed_km)} km removed<br>${v.changes.length} change${v.changes.length === 1 ? '' : 's'}`;
    tip.style.display = 'block';
    const r = svg.getBoundingClientRect(), br = box.getBoundingClientRect();
    tip.style.left = `${Math.min(hx * r.width / W + (r.left - br.left) + 12, br.width - tip.offsetWidth - 4)}px`;
    tip.style.top = '8px';
  });
  hit.addEventListener('mouseleave', () => {
    tip.style.display = 'none'; hover.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden');
  });
  hit.addEventListener('click', (ev) => { store.state.mode = 'version'; actions.select(nearest(toLocal(ev))); });
  xOf = x;
  markChart();
}

export function markChart() {
  const svg = $('chart').querySelector('svg'); const { state, valid } = store;
  if (!svg || !xOf || state.vi < 0) return;
  const xx = xOf(valid[state.vi].date), l = svg.querySelector('#cSel');
  l.setAttribute('x1', xx); l.setAttribute('x2', xx);
  l.setAttribute('visibility', state.mode === 'version' ? 'visible' : 'hidden');
}
