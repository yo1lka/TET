import { css, esc, fmt, isDark, sum } from './util.js';

export const KIND_LABEL = { initial: 'first version', route: 'route change', minor: 'minor re-save', waypoints: 'waypoints only', metadata: 'no route change' };
export const TYPE_LABEL = { rerouted: 'Rerouted', added: 'Added', removed: 'Removed' };
export const DIR_LABEL = { to_offroad: 'Towards offroad', same_mix: 'Same surface mix', to_paved: 'Towards asphalt', unknown: 'Surface unknown' };
export const DIRECTIONS = ['to_offroad', 'same_mix', 'to_paved', 'unknown'];
export const CHAR_LABEL = { offroad: 'Offroad', mixed: 'Mixed', paved: 'Paved', unknown: 'Unknown' };

const SEQ_LIGHT = ['#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const SEQ_DARK = ['#1c5cab', '#256abf', '#2a78d6', '#5598e7', '#86b6ef', '#b7d3f6'];

export function yearColors(valid) {
  const y0 = +valid[0].date.slice(0, 4), yN = +valid[valid.length - 1].date.slice(0, 4);
  const ramp = isDark() ? SEQ_DARK : SEQ_LIGHT;
  const years = []; for (let y = y0; y <= yN; y++) years.push(y);
  const col = (y) => ramp[Math.round((y - y0) / Math.max(1, yN - y0) * (ramp.length - 1))];
  return { years, col };
}

export const dirColor = (d) => ({
  to_offroad: isDark() ? '#eb6834' : '#d4561f', to_paved: css('--added'), same_mix: isDark() ? '#8e8d86' : '#7a7974',
  unknown: isDark() ? '#4a4a46' : '#cfcdc6', new: isDark() ? '#9085e9' : '#6250d6',
})[d];

const SURF_LIGHT = { asphalt: '#184f95', stones: '#6da7ec', gravel: '#f3b18c', dirt: '#eb6834', sand: '#b8461b', unpaved: '#f6d2bd', field: '#b48ae0', singletrack: '#6a2fa8', unknown: '#a3a19a', no_osm: '#d9d7d0' };
const SURF_DARK = { asphalt: '#3987e5', stones: '#9ec5f4', gravel: '#f5c2a3', dirt: '#eb6834', sand: '#c4552a', unpaved: '#6e4632', field: '#cdb3ee', singletrack: '#9b6bd6', unknown: '#77766f', no_osm: '#4a4a46' };
export const surfColor = (cat) => (isDark() ? SURF_DARK : SURF_LIGHT)[cat] || '#888';

const GROUP_CAT = { hard: 'asphalt', loose: 'dirt', trail: 'singletrack', unknown: 'unknown' };
export const SURFACE_GROUPS = ['hard', 'loose', 'trail', 'unknown'];
export const groupColor = (g) => surfColor(GROUP_CAT[g] || 'unknown');

export const groupKm = (d, g) => !d ? 0
  : g === 'offroad' ? (d.loose || 0) + (d.trail || 0) + (d.unpaved || 0)
  : g === 'hard' ? (d.hard || 0) + (d.paved || 0)
  : d[g] || 0;

export function stackBar(categories, d, cls = '') {
  const tot = sum(d);
  if (!tot) return `<div class="sbar ${cls}"></div>`;
  return `<div class="sbar ${cls}">` + categories.filter((k) => d[k.id] > 0).map((k) =>
    `<span style="width:${d[k.id] / tot * 100}%;background:${surfColor(k.id)}" title="${esc(k.label)}: ${fmt(d[k.id])} km (${fmt(d[k.id] / tot * 100, 0)}%)"></span>`).join('') + '</div>';
}

export const surfaceLegend = (cats) =>
  `<div class="slegend">${cats.map((k) => `<span><span class="sw" style="background:${surfColor(k.id)}"></span>${esc(k.label)}</span>`).join('')}</div>`;
