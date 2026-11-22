import { $, fmt, sum } from '../lib/util.js';
import { store } from '../core/store.js';

export function renderTiles() {
  const s = store.H.summary;
  const t = [
    ['Route now', `${fmt(s.current_km, 0)} km`, `${fmt(s.first_km, 0)} km in ${s.first.slice(0, 4)}`],
    ['Versions with route changes', s.route_versions, `of ${store.valid.length} readable downloads`],
    ['Route added over time', `${fmt(s.added_km, 0)} km`, 'new or replacement stretches'],
    ['Route removed over time', `${fmt(s.removed_km, 0)} km`, 'dropped or replaced stretches'],
    ['Changes', sum(s.clusters), `${s.clusters.rerouted || 0} rerouted · ${s.clusters.added || 0} added · ${s.clusters.removed || 0} removed`],
  ];
  $('tiles').innerHTML = t.map(([k, v, d]) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
}
