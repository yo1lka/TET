import { esc, placeTip } from '../lib/util.js';
import { groupColor } from '../lib/palette.js';

const GROUP_LABEL = { hard: 'Hard surface', loose: 'Loose (gravel, dirt, sand)', trail: 'Trail / field', unknown: 'Unknown' };
const f0 = (n) => Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);

function colLabel(d, snap) {
  if (d === 'now') return { short: 'Now', long: `Now (latest version ${snap?.version || ''})` };
  const y = d.slice(0, 4);
  return snap?.first_record ? { short: `${y}*`, long: `First download ${snap.version}` } : { short: y, long: `1 January ${y}` };
}

function chart(S, mode, width) {
  const T = S.totals, groups = S.groups;
  const W = Math.max(360, Math.round(width)), H = 260, m = { l: 48, r: 8, t: 26, b: 28 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const share = mode === 'share';
  const max = share ? 1 : Math.ceil(Math.max(...T.map((t) => t.km)) / 500) * 500;
  const y = (v) => m.t + ih - v / max * ih;
  const step = iw / T.length, bw = Math.min(56, step * 0.62);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Route length of all analysed countries on 1 January of each year, by surface">`;
  const ticks = share ? [0, 0.25, 0.5, 0.75, 1] : Array.from({ length: max / 500 + 1 }, (_, i) => i * 500);
  for (const v of ticks) {
    s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/>` +
      `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--text-3)">${share ? `${v * 100}%` : f0(v)}</text>`;
  }
  T.forEach((t, i) => {
    const x = m.l + i * step + (step - bw) / 2;
    const tot = share ? (groups.reduce((a, g) => a + t.by_group[g], 0) || 1) : 1;
    let acc = 0;
    groups.forEach((g) => {
      const v = t.by_group[g] / tot; if (!v) return;
      const top = y(acc + v), h = Math.max(0, y(acc) - top - 2);   // 2px surface gap between segments
      s += `<rect x="${x}" y="${top}" width="${bw}" height="${h}" fill="${groupColor(g)}"${acc === 0 ? ' rx="2"' : ''}/>`;
      acc += v;
    });
    if (!share && t.km > acc + 0.5) {  // countries without surface data: plain bar segment on top
      const top = y(t.km);
      s += `<rect x="${x}" y="${top}" width="${bw}" height="${Math.max(0, y(acc) - top - 2)}" fill="var(--grid)"/>`;
    }
    const topY = share ? y(1) : y(t.km);
    s += `<text x="${x + bw / 2}" y="${topY - 6}" text-anchor="middle" font-size="11" fill="var(--text-2)">${pct(t.offroad_share)}</text>`;
    s += `<text x="${x + bw / 2}" y="${H - 9}" text-anchor="middle" font-size="11" fill="var(--text-3)">${esc(colLabel(t.date, t).short)}</text>`;
    s += `<rect class="hit" data-i="${i}" x="${m.l + i * step}" y="${m.t - 20}" width="${step}" height="${ih + 20}" fill="transparent"/>`;
  });
  s += `<text x="${m.l}" y="12" font-size="11" fill="var(--text-2)">${share ? 'Share of route length' : 'km of route'} · label = offroad share (loose + trail)</text>`;
  return s + '</svg>';
}

function tipHtml(S, i) {
  const t = S.totals[i], lbl = colLabel(t.date, t).long;
  return `<b>${esc(lbl)}</b> · ${f0(t.km)} km<br>` +
    S.groups.map((g) => `<span class="sw" style="background:${groupColor(g)}"></span>${GROUP_LABEL[g]}: ${f0(t.by_group[g])} km`).join('<br>') +
    `<br>Offroad share: ${pct(t.offroad_share)}<br><span style="color:var(--text-3)">${t.countries.length} countr${t.countries.length === 1 ? 'y' : 'ies'}: ${esc(t.countries.join(', '))}</span>`;
}

function miniBar(S, g) {
  if (!g) return '';
  const tot = S.groups.reduce((a, k) => a + g[k], 0) || 1;
  return `<span class="mbar">${S.groups.filter((k) => g[k] > 0).map((k) =>
    `<span style="width:${g[k] / tot * 100}%;background:${groupColor(k)}"></span>`).join('')}</span>`;
}

function table(S, names) {
  const cols = S.dates;
  const head = `<tr><th>Country</th>${cols.map((d, i) => `<th title="${esc(colLabel(d, S.totals[i]).long)}">${esc(colLabel(d, S.totals[i]).short)}</th>`).join('')}</tr>`;
  const cell = (s) => (s ? `<td title="version ${esc(s.version)}"><b>${f0(s.km)}</b> <span class="sh">${pct(s.offroad_share)}</span>${miniBar(S, s.by_group)}</td>` : '<td class="na">–</td>');
  const rows = Object.entries(S.countries).map(([cc, snaps]) =>
    `<tr><td><a href="track.html?c=${encodeURIComponent(cc)}">${esc(cc)}</a> <span class="nm">${esc(names[cc] || '')}</span></td>${cols.map((d) => cell(snaps[d])).join('')}</tr>`);
  const total = `<tr class="tot"><td>All</td>${S.totals.map((t) => `<td><b>${f0(t.km)}</b> <span class="sh">${pct(t.offroad_share)}</span>${miniBar(S, t.by_group)}</td>`).join('')}</tr>`;
  return `<div class="tbl"><table class="evo"><thead>${head}</thead><tbody>${rows.join('')}${Object.keys(S.countries).length > 1 ? total : ''}</tbody></table></div>`;
}

export function renderEvolution(o) {
  const el = document.getElementById('evolution');
  const S = o?.snapshots;
  if (!el || !S || !S.totals.length) return;
  const names = Object.fromEntries(o.countries.map((c) => [c.code, c.name]));
  let mode = 'km';
  el.innerHTML = `<div class="evo-head"><div class="slegend">${S.groups.map((g) => `<span><span class="sw" style="background:${groupColor(g)}"></span>${GROUP_LABEL[g]}</span>`).join('')}</div>
      <div class="seg" role="group" aria-label="Bar scale"><button data-m="km" aria-pressed="true">Km</button><button data-m="share" aria-pressed="false">Share</button></div></div>
    <div class="evo-chart" id="evoChart"></div>` + table(S, names) +
    `<p class="muted">${esc(S.note)} * = no version on 1 January of that year yet; the column shows the first download.</p>`;
  const box = el.querySelector('#evoChart');
  const draw = () => { box.innerHTML = chart(S, mode, box.clientWidth - 16) + '<div class="tip"></div>'; };
  draw();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(draw, 150); });
  el.querySelector('.seg').onclick = (e) => {
    const b = e.target.closest('button[data-m]'); if (!b) return;
    mode = b.dataset.m;
    el.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  };
  box.onmousemove = (e) => {
    const tip = box.querySelector('.tip'), r = e.target.closest('.hit');
    if (!r) { tip.style.display = 'none'; return; }
    tip.innerHTML = tipHtml(S, +r.dataset.i);
    placeTip(tip, box, e.clientX, e.clientY);
  };
  box.onmouseleave = () => { box.querySelector('.tip').style.display = 'none'; };
}
