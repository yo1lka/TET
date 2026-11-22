import { $, esc, fmt, sum } from '../lib/util.js';
import { groupKm, stackBar, surfColor, surfaceLegend } from '../lib/palette.js';
import { store } from '../core/store.js';
import { actions } from '../core/actions.js';

export function surfaceNote(id) {
  const sc = store.S?.changes[id]; if (!sc) return '';
  const r = sc.removed_group || {}, a = sc.added_group || {};
  const part = (g, lbl) => (groupKm(r, g) || groupKm(a, g)) ? `${lbl} −${fmt(groupKm(r, g))} → +${fmt(groupKm(a, g))}` : '';
  const txt = [part('trail', 'trail'), part('loose', 'loose'), part('hard', 'hard')].filter(Boolean).join(' · ');
  return txt ? `<span class="sf">${txt} km</span>` : '';
}

export function renderSurfaceCard() {
  const { S, valid } = store;
  if (!S) return;
  if (S.osm_mode === 'snapshot') $('surfSrc').textContent = `· OpenStreetMap snapshot of ${S.osm_date}, used for every version`;
  const sm = S.summary, rg = sm.removed_group, ag = sm.added_group;
  const totR = sum(sm.removed), totA = sum(sm.added);
  const pct = (x, t) => t ? fmt(x / t * 100, 0) + '%' : '–';
  const cats = S.categories.filter((k) => (sm.removed[k.id] || 0) + (sm.added[k.id] || 0) > 0);
  const bar = (k, c) => stackBar(S.categories, k, c);
  const row = (lbl, r, a, cls = '') => `<tr class="${cls}"><td>${lbl}</td><td>${fmt(r)}</td><td>${fmt(a)}</td><td>${a - r >= 0 ? '+' : '−'}${fmt(Math.abs(a - r))}</td></tr>`;

  let tbl = '<table class="stbl"><thead><tr><th>Surface</th><th>Removed km</th><th>Added km</th><th>Net</th></tr></thead><tbody>';
  for (const g of S.groups) {
    const inG = cats.filter((k) => k.group === g.id); if (!inG.length) continue;
    tbl += row(esc(g.label), groupKm(rg, g.id), groupKm(ag, g.id), 'grp');
    for (const k of inG) tbl += row(`<span class="sw" style="background:${surfColor(k.id)}"></span>${esc(k.label)}`, sm.removed[k.id] || 0, sm.added[k.id] || 0);
  }
  tbl += '</tbody></table>';
  const hwKeys = [...new Set([...Object.keys(sm.removed_by_highway), ...Object.keys(sm.added_by_highway)])]
    .sort((x, y) => (sm.added_by_highway[y] || 0) + (sm.removed_by_highway[y] || 0) - (sm.added_by_highway[x] || 0) - (sm.removed_by_highway[x] || 0)).slice(0, 8);
  let hw = '<table class="stbl"><thead><tr><th>OSM highway type</th><th>Removed km</th><th>Added km</th><th>Net</th></tr></thead><tbody>';
  for (const k of hwKeys) hw += row(esc(k === 'none' ? '(no highway)' : k), sm.removed_by_highway[k] || 0, sm.added_by_highway[k] || 0);
  hw += '</tbody></table>';

  $('surfSummary').innerHTML =
    `<p class="lead">Over all versions, <b>${pct(groupKm(rg, 'offroad'), totR)}</b> of the removed route was offroad (${fmt(groupKm(rg, 'offroad'), 0)} km), ` +
    `of which <b>${pct(groupKm(rg, 'trail'), totR)}</b> fully offroad trail (${fmt(groupKm(rg, 'trail'), 0)} km). ` +
    `Of the route added, <b>${pct(groupKm(ag, 'offroad'), totA)}</b> was offroad (${fmt(groupKm(ag, 'offroad'), 0)} km), ` +
    `of which <b>${pct(groupKm(ag, 'trail'), totA)}</b> trail (${fmt(groupKm(ag, 'trail'), 0)} km).</p>` +
    `<div class="srow"><span class="lbl">Removed</span>${bar(sm.removed, 'big')}<span class="km">${fmt(totR, 0)} km</span></div>` +
    `<div class="srow"><span class="lbl">Added</span>${bar(sm.added, 'big')}<span class="km">${fmt(totA, 0)} km</span></div>` +
    surfaceLegend(cats) + tbl + hw +
    `<div class="note">${fmt(sm.inferred_km.removed + sm.inferred_km.added, 0)} km had no surface tag in OSM. Their surface was inferred from the track grade or road class.` +
    (S.osm_mode === 'snapshot' ? ` Surfaces come from one OSM snapshot (${esc(S.osm_date)}) for every version. For a removed stretch this is the road as it is now, not as it was when the TET dropped it.` : '') + '</div>';

  const rows = ['<div class="vr head"><span>Version</span><span>Removed</span><span>Added</span></div>'];
  for (const v of [...valid].reverse()) {
    const sv = S.versions[v.date]; if (!sv) continue;
    rows.push(`<div class="vr" data-i="${valid.indexOf(v)}" title="Show this version on the map"><span class="d">${v.date}</span>` +
      `<span class="cell">${bar(sv.removed)}<span class="km">${fmt(sum(sv.removed))}</span></span>` +
      `<span class="cell">${bar(sv.added)}<span class="km">${fmt(sum(sv.added))}</span></span></div>`);
  }
  $('surfVersions').innerHTML = rows.join('');
  $('surfVersions').onclick = (e) => {
    const r = e.target.closest('.vr[data-i]'); if (!r) return;
    store.state.mode = 'version'; $('optSurf').checked = true; actions.select(+r.dataset.i);
    $('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  $('surfCard').hidden = false;
}

export function highlightSurfaceList() {
  document.querySelectorAll('.sver .vr.sel').forEach((e) => e.classList.remove('sel'));
  if (store.state.mode === 'version') document.querySelector(`.sver .vr[data-i="${store.state.vi}"]`)?.classList.add('sel');
}
