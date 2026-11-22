import { $, esc, fmt, placeTip, signed } from '../lib/util.js';
import { SURFACE_GROUPS, groupColor, groupKm, stackBar, surfColor, surfaceLegend } from '../lib/palette.js';
import { store } from '../core/store.js';

const pctOf = (x, t) => t ? x / t * 100 : 0;
const pp = (a, b) => `${signed(b - a)} pp`;

function headline(f, n) {
  const off = (c) => groupKm(c.by_group, 'offroad'), trail = (c) => groupKm(c.by_group, 'trail');
  const known = (c) => c.km - groupKm(c.by_group, 'unknown');
  const offF = pctOf(off(f), known(f)), offN = pctOf(off(n), known(n));
  const trF = pctOf(trail(f), known(f)), trN = pctOf(trail(n), known(n));
  return `<div class="cmp-head">
    <div><div class="sub">Offroad share (loose + trail)</div><div class="big">${fmt(offF, 0)}% → ${fmt(offN, 0)}%</div><div class="sub">${pp(offF, offN)} · ${fmt(off(f), 0)} → ${fmt(off(n), 0)} km</div></div>
    <div><div class="sub">Fully offroad trail</div><div class="big">${fmt(trF, 0)}% → ${fmt(trN, 0)}%</div><div class="sub">${pp(trF, trN)} · ${fmt(trail(f), 0)} → ${fmt(trail(n), 0)} km</div></div>
  </div>`;
}

function bars(S, f, n) {
  const maxKm = Math.max(f.km, n.km);
  const bar = (c, lbl) => `<div class="cmp-row"><span class="lbl">${lbl}<br><span style="color:var(--text-3)">${c.date}</span></span>` +
    `<span class="bar"><span style="width:${c.km / maxKm * 100}%;min-width:0">${stackBar(S.categories, c.by_category, 'big')}</span><span class="km">${fmt(c.km, 0)} km</span></span></div>`;
  const cats = S.categories.filter((k) => (f.by_category[k.id] || 0) + (n.by_category[k.id] || 0) > 0);
  return { html: '<h3>Surface along the route (bar length = route length)</h3>' + bar(f, 'First version') + bar(n, 'Now') + surfaceLegend(cats), cats };
}

function table(S, f, n, cats) {
  const line = (lbl, a, b, cls = '') => {
    const pa = pctOf(a, f.km), pb = pctOf(b, n.km);
    return `<tr class="${cls}"><td>${lbl}</td><td>${fmt(a, 0)}</td><td>${fmt(pa, 0)}%</td><td>${fmt(b, 0)}</td><td>${fmt(pb, 0)}%</td>` +
      `<td>${signed(b - a)}</td><td class="${pb >= pa ? 'up' : 'dn'}">${pp(pa, pb)}</td></tr>`;
  };
  let T = '<table class="stbl"><thead><tr><th>Surface</th><th>Then km</th><th>Then %</th><th>Now km</th><th>Now %</th><th>Change km</th><th>Share</th></tr></thead><tbody>';
  for (const g of S.groups) {
    const inG = cats.filter((k) => k.group === g.id); if (!inG.length) continue;
    T += line(`<span class="sw" style="background:${groupColor(g.id)}"></span>${esc(g.label)}`, groupKm(f.by_group, g.id), groupKm(n.by_group, g.id), 'grp');
    for (const k of inG) T += line(`<span class="sw" style="background:${surfColor(k.id)};margin-left:14px"></span>${esc(k.label)}`, f.by_category[k.id] || 0, n.by_category[k.id] || 0);
  }
  T += line('Total', f.km, n.km, 'grp') + '</tbody></table>';
  return T + `<div class="note">% is of each version's own length. "Share" is the change in percentage points.${S.osm_mode === 'snapshot' ? ' Both versions are matched to the same OSM snapshot, so this shows where the route goes, not changes to the roads themselves.' : ''}</div>`;
}

function overTime(S, pts) {
  const W = 560, H = 230, m = { l: 40, r: 8, t: 8, b: 26 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const ymax = Math.ceil(Math.max(...pts.map((p) => p.km)) / 500) * 500;
  const bw = iw / pts.length, y = (v) => m.t + ih - v / ymax * ih;
  const label = (g) => esc(S.groups.find((x) => x.id === g)?.label || g);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Route length by surface group per version">`;
  for (let v = 0; v <= ymax; v += 500) svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--text-3)">${v}</text>`;
  pts.forEach((p, i) => {
    let acc = 0;
    const x = m.l + i * bw + 1, w = Math.max(1, bw - 2);
    for (const g of SURFACE_GROUPS) {
      const v = groupKm(p.by_group, g); if (!v) continue;
      svg += `<rect x="${x}" y="${y(acc + v)}" width="${w}" height="${Math.max(0, y(acc) - y(acc + v) - 1)}" fill="${groupColor(g)}"/>`;
      acc += v;
    }
    svg += `<rect class="hit" data-i="${i}" x="${m.l + i * bw}" y="${m.t}" width="${bw}" height="${ih}" fill="transparent"/>`;
  });
  let lastX = -Infinity; // year labels at the first version of each year, skipped when too close
  for (const yr of new Set(pts.map((p) => p.date.slice(0, 4)))) {
    const lx = m.l + pts.findIndex((p) => p.date.startsWith(yr)) * bw + 1;
    if (lx - lastX < 30 || lx > W - 26) continue;
    svg += `<text x="${lx}" y="${H - 8}" font-size="10" fill="var(--text-3)">${yr}</text>`;
    lastX = lx;
  }
  svg += '</svg>';
  $('compRight').innerHTML = '<h3>Route length by surface group, every version (km)</h3>' +
    `<div class="slegend">${SURFACE_GROUPS.map((g) => `<span><span class="sw" style="background:${groupColor(g)}"></span>${label(g)}</span>`).join('')}</div>` +
    `<div id="compChart" style="position:relative">${svg}<div class="tip"></div></div>`;
  const box = $('compChart'), tip = box.querySelector('.tip');
  box.onmousemove = (e) => {
    const r = e.target.closest('.hit'); if (!r) { tip.style.display = 'none'; return; }
    const p = pts[+r.dataset.i], kn = p.km - groupKm(p.by_group, 'unknown');
    tip.innerHTML = `<b>${p.date}</b> · ${fmt(p.km, 0)} km<br>` +
      SURFACE_GROUPS.map((g) => `<span class="sw" style="background:${groupColor(g)}"></span>${label(g)}: ${fmt(groupKm(p.by_group, g), 0)} km`).join('<br>') +
      `<br>Offroad share: ${fmt(pctOf(groupKm(p.by_group, 'offroad'), kn), 0)}%`;
    placeTip(tip, box, e.clientX, e.clientY);
  };
  box.onmouseleave = () => { tip.style.display = 'none'; };
}

export function renderCompositionCard() {
  const { A, S } = store;
  if (!A?.composition || !S) return;
  const { first: f, current: n, over_time: pts } = A.composition;
  $('compSrc').textContent = S.osm_mode === 'snapshot' ? `· surfaces from one OSM snapshot (${S.osm_date}) for both` : '';
  const b = bars(S, f, n);
  $('compLeft').innerHTML = headline(f, n) + b.html + table(S, f, n, b.cats);
  overTime(S, pts);
  $('compCard').hidden = false;
}
