import { $, esc } from './lib/util.js';
import { store, loadCountry } from './core/store.js';
import { actions } from './core/actions.js';
import { readHash, writeHash } from './core/hash.js';
import { renderTiles } from './components/tiles.js';
import { renderChart, markChart } from './components/versionChart.js';
import { renderCompositionCard } from './components/compositionCard.js';
import { renderAggregateCard } from './components/aggregateCard.js';
import { renderSurfaceCard, highlightSurfaceList } from './components/surfaceCard.js';
import { initMap, drawMap, flashCluster, invalidateSize, zoomCluster } from './components/mapView.js';
import { renderTimeline, renderVersionSelect, highlightTimeline } from './components/timeline.js';
import { bindControls, syncControls } from './components/controls.js';
import { renderSiteNav } from './components/siteNav.js';

function highlight() {
  markChart();
  highlightSurfaceList();
  highlightTimeline();
  writeHash();
}

Object.assign(actions, {
  highlight,
  async refresh(fit) {
    syncControls();
    highlight();
    await drawMap(fit);
  },
  select(i) {
    store.state.vi = Math.max(0, Math.min(store.valid.length - 1, i));
    store.state.cluster = null;
    return actions.refresh(false);
  },
  async showChange(vi, id, zoom) {
    const { state, valid } = store;
    const sameView = state.mode === 'version' && state.vi === vi;
    Object.assign(state, { mode: 'version', vi, cluster: id });
    const c = valid[vi].changes.find((cc) => cc.id === id);
    if (sameView) highlight(); else await actions.refresh(false);
    if (c) { if (zoom) zoomCluster(c); else flashCluster(c); }
  },
});

async function init() {
  const { CC } = store;
  renderSiteNav(CC, store.index);

  const { H, valid } = store;
  document.title = `TET ${store.name} history`;
  $('title').textContent = `TET ${store.name} route history`;
  $('subtitle').textContent = `${H.summary.first} → ${H.summary.last} · ${H.versions.length} downloads of ${H.source}`;
  $('status').hidden = true; $('app').hidden = false;
  $('foot').innerHTML = `Updated ${esc(H.generated.slice(0, 10))}. A stretch counts as changed when it is more than ${H.params.MATCH_TOLERANCE_M} m from the other version and at least ${H.params.MIN_RUN_M} m long. Map data © OpenStreetMap contributors.`;

  renderTiles();
  renderCompositionCard();
  renderAggregateCard();
  renderSurfaceCard();
  renderChart();
  initMap();
  renderVersionSelect();
  renderTimeline();
  invalidateSize(); // the timeline column sets the final map height
  bindControls();
  readHash();
  if (store.state.vi < 0) store.state.vi = valid.length - 1;
  await actions.refresh(true);

  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderChart, 150); });
  addEventListener('hashchange', () => { if (readHash()) actions.refresh(true); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    actions.refresh(false); renderChart(); renderCompositionCard(); renderAggregateCard(); renderSurfaceCard();
  });
}

loadCountry()
  .then((ok) => {
    if (!ok) {
      renderSiteNav(store.CC, store.index);
      $('status').innerHTML = `<b>${esc(store.CC)}</b> has not been analysed yet. See the <a href="./">overview</a> for the countries that have.`;
      return null;
    }
    return init();
  })
  .catch((e) => { $('status').textContent = `Failed to load: ${e.message}. Please reload the page.`; console.error(e); });
