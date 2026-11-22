import { $, css, esc, fmt } from '../lib/util.js';
import { DIRECTIONS, DIR_LABEL, TYPE_LABEL, dirColor, surfColor, yearColors } from '../lib/palette.js';
import { store, geom, surfaceGeom, currentVersion } from '../core/store.js';
import { actions } from '../core/actions.js';
import { initLayers } from './mapLayers.js';

let map;
const layers = {};
const SURF_W = 4; // surface view: added lines are solid at SURF_W, removed lines dashed at 80% of it

export function initMap() {
  map = L.map('map', { preferCanvas: true, zoomSnap: 0.25 });
  initLayers(map);
  fitCountry();
  for (const k of ['old', 'bands', 'route', 'removed', 'added', 'wpt', 'hl']) layers[k] = L.layerGroup().addTo(map);
  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => { const d = L.DomUtil.create('div', 'legend'); d.id = 'legend'; return d; };
  legend.addTo(map);
}

export const invalidateSize = () => map.invalidateSize();

export function fitCountry() {
  const b = store.H.summary.bbox;
  if (b) map.fitBounds([[b[0], b[1]], [b[2], b[3]]]); else map.setView([52, 5.5], 7);
}

function cased(latlngs, color, weight, opts = {}) {
  const g = L.featureGroup();
  L.polyline(latlngs, { color: css('--surface'), weight: weight + 3, opacity: 0.9, interactive: false }).addTo(g);
  L.polyline(latlngs, { color, weight, opacity: 1, ...opts }).addTo(g);
  return g;
}
const toLatLng = (coords) => coords.map(([lo, la]) => [la, lo]);

function onChangeClick(vv, c, jump) {
  return () => {
    if (jump) actions.showChange(store.valid.indexOf(vv), c.id, true);
    else { store.state.cluster = c.id; actions.highlight(); flashCluster(c); }
  };
}

export async function drawMap(fit) {
  const { state, valid, S } = store;
  const v = currentVersion();
  Object.values(layers).forEach((l) => l.clearLayers());
  const routeVer = state.mode === 'version' ? v : valid[valid.length - 1];
  const g = await geom(routeVer.geom);
  if (currentVersion() !== v) return false;
  const rsv = routeSurfaceVersion();
  const sg = rsv ? await surfaceGeom(rsv.geom) : null;
  if (currentVersion() !== v) return false;
  if (sg) {
    const label = (c) => store.S?.categories.find((k) => k.id === c)?.label || c;
    for (const r of sg.runs) {
      L.polyline(r.latlngs, { color: surfColor(r.c), weight: 3.5, opacity: 0.95 })
        .bindTooltip(`<b>${esc(label(r.c))}</b><br>${esc(r.s)} · route of ${rsv.date}`, { sticky: true }).addTo(layers.route);
    }
  } else {
    for (const t of g.tracks) {
      L.polyline(t.latlngs, { color: css('--route'), weight: 2, opacity: 0.8 }).bindTooltip(esc(t.name), { sticky: true }).addTo(layers.route);
    }
  }
  if ($('optOld').checked) {
    const g0 = await geom(valid[0].geom);
    for (const t of g0.tracks) L.polyline(t.latlngs, { color: css('--route-old'), weight: 5, opacity: 0.7, interactive: false }).addTo(layers.old);
  }
  const bySurf = S && $('optSurf').checked;
  if (state.mode === 'version') {
    for (const c of v.changes) (bySurf && S.changes[c.id] ? drawClusterSurface : drawCluster)(c, v);
    if ($('optWpt').checked && v.waypoint_changes) drawWaypoints(v.waypoint_changes);
  } else if (state.mode === 'dir') {
    drawDirections();
  } else if (bySurf) {
    for (const vv of valid) for (const c of vv.changes) {
      S.changes[c.id]?.lines.forEach((ln) => { if (ln.kind === 'added') drawSurfaceSegments(ln, c, vv, layers.added, true); });
    }
  } else {
    const { col } = yearColors(valid);
    for (const vv of valid) for (const c of vv.changes) for (const ln of c.lines) {
      if (ln.kind !== 'added') continue;
      cased(toLatLng(ln.coords), col(+vv.date.slice(0, 4)), 3)
        .bindTooltip(`${vv.date} · ${TYPE_LABEL[c.type]} · ${esc(c.sections.join(', '))}<br>+${fmt(c.added_km)} / −${fmt(c.removed_km)} km`, { sticky: true })
        .on('click', onChangeClick(vv, c, true))
        .addTo(layers.added);
    }
  }
  renderLegend(v);
  if (state.cluster && state.mode === 'version') {
    const c = v.changes.find((cc) => cc.id === state.cluster);
    if (c) { if (fit) zoomCluster(c); else flashCluster(c); }
  }
  return true;
}

function drawCluster(c, v) {
  const tip = `<b>${TYPE_LABEL[c.type]}</b> · ${esc(c.sections.join(', '))}<br>+${fmt(c.added_km)} km / −${fmt(c.removed_km)} km`;
  const bands = !!routeSurfaceVersion();   // route coloured by surface: show changes as wide translucent bands
  for (const ln of c.lines) {
    const isAdd = ln.kind === 'added';
    if (bands) {
      L.polyline(toLatLng(ln.coords), { color: css(isAdd ? '--added' : '--removed'), weight: 14, opacity: 0.3, lineCap: 'round' })
        .bindTooltip(tip, { sticky: true }).on('click', onChangeClick(v, c, false)).addTo(layers.bands);
      continue;
    }
    cased(toLatLng(ln.coords), css(isAdd ? '--added' : '--removed'), isAdd ? 4 : 3.5)
      .bindTooltip(tip, { sticky: true })
      .on('click', onChangeClick(v, c, false))
      .addTo(isAdd ? layers.added : layers.removed);
  }
}

function drawClusterSurface(c, v) {
  const which = $('surfWhich').value;
  for (const ln of store.S.changes[c.id].lines) {
    if (which === 'both' || which === ln.kind) drawSurfaceSegments(ln, c, v, ln.kind === 'added' ? layers.added : layers.removed, false);
  }
}

function drawSurfaceSegments(ln, c, v, layer, jump) {
  const isAdd = ln.kind === 'added';
  for (const sg of ln.segments) {
    if (sg.coords.length < 2) continue;
    const cat = store.S.categories.find((k) => k.id === sg.cat);
    const tip = `<b>${isAdd ? 'Added' : 'Removed'}</b> ${v.date} · ${esc(c.sections.join(', '))}<br>` +
      `${esc(cat ? cat.label : sg.cat)}${sg.surface ? ` (surface=${esc(sg.surface)})` : ''}<br>highway=${esc(sg.highway)}`;
    cased(toLatLng(sg.coords), surfColor(sg.cat), isAdd ? SURF_W : SURF_W * 0.8, isAdd ? {} : { dashArray: '7 5', lineCap: 'butt' })
      .bindTooltip(tip, { sticky: true })
      .on('click', onChangeClick(v, c, jump))
      .addTo(layer);
  }
}

function drawDirections() {
  const info = new Map(store.A.changes.map((c) => [c.id, c]));
  const sh = (x) => x == null ? '?' : `${fmt(x * 100, 0)}%`;
  for (const vv of store.valid) for (const c of vv.changes) {
    const a = info.get(c.id); if (!a || a.type === 'removed') continue;
    const key = a.type === 'added' ? 'new' : a.direction;
    const tip = a.type === 'added'
      ? `<b>New route</b> ${vv.date} · ${esc(c.sections.join(', '))}<br>+${fmt(c.added_km)} km, ${sh(a.unpaved_share_new)} offroad`
      : `<b>${DIR_LABEL[a.direction]}</b> ${vv.date} · ${esc(c.sections.join(', '))}<br>${fmt(c.removed_km)} km (${sh(a.unpaved_share_old)} offroad) → ${fmt(c.added_km)} km (${sh(a.unpaved_share_new)} offroad)`;
    for (const ln of c.lines) {
      if (ln.kind !== 'added') continue;
      cased(toLatLng(ln.coords), dirColor(key), 3.5).bindTooltip(tip, { sticky: true }).on('click', onChangeClick(vv, c, true)).addTo(layers.added);
    }
  }
}

function drawWaypoints(w) {
  const mk = (p, kind) => L.circleMarker([p.lat, p.lon], {
    radius: 5, weight: 2, color: css('--surface'), fillColor: css(kind === 'removed' ? '--removed' : '--added'), fillOpacity: 1,
  }).bindTooltip(`${kind === 'added' ? 'New' : kind === 'removed' ? 'Removed' : 'Moved'} waypoint: ${esc(p.name)}${p.sym ? ` (${esc(p.sym)})` : ''}${p.moved_m ? ` · moved ${p.moved_m} m` : ''}`).addTo(layers.wpt);
  w.added.forEach((p) => mk(p, 'added'));
  w.removed.forEach((p) => mk(p, 'removed'));
  w.moved.forEach((p) => mk(p, 'moved'));
}

export function zoomCluster(c) {
  const b = c.bbox;
  map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: [60, 60], maxZoom: 15 });
  flashCluster(c);
}

export function flashCluster(c) {
  layers.hl.clearLayers();
  const b = c.bbox, pad = 0.004;
  L.rectangle([[b[0] - pad, b[1] - pad], [b[2] + pad, b[3] + pad]], {
    color: css('--text'), weight: 1.5, dashArray: '4 4', fill: false, interactive: false,
  }).addTo(layers.hl);
}

export function routeSurfaceVersion() {
  const { state, valid } = store;
  if (!store.S || !state.routeSurf || state.routeSurf === 'off') return null;
  const shown = state.mode === 'version' ? state.vi : valid.length - 1;
  if (state.routeSurf === 'first') return valid[0];
  if (state.routeSurf === 'prev') return shown > 0 ? valid[shown - 1] : null;
  return valid[shown];
}

function renderLegend(v) {
  const el = $('legend'); if (!el) return;
  const { state, valid, S } = store;
  const line = (color, label, extra = '') => `<span class="ln" style="border-color:${color};${extra}"></span>${label}`;
  const rsv = routeSurfaceVersion();
  const routeSurf = rsv ? `<div class="lsec"><b>Route of ${rsv.date}</b> by surface` +
    `${rsv === valid[0] ? ' (first version)' : state.routeSurf === 'prev' ? ' (previous version)' : ''}<br>` +
    S.categories.map((k) => line(surfColor(k.id), esc(k.label), 'border-top-width:4px')).join('<br>') + '</div>' : '';
  renderLegendBody(v, el, line);
  if (routeSurf) el.insertAdjacentHTML('beforeend', routeSurf);
}

function renderLegendBody(v, el, line) {
  const { state, valid, S } = store;
  const firstRoute = $('optOld').checked ? '<br>' + line('var(--route-old)', `First route (${valid[0].date})`, 'border-top-width:5px') : '';
  if (state.mode === 'dir') {
    el.innerHTML = '<b>Reroutes by surface direction</b><br>' + DIRECTIONS.map((d) => line(dirColor(d), DIR_LABEL[d])).join('<br>') +
      '<br>' + line(dirColor('new'), 'New route (not a reroute)') + '<br>' + line('var(--route)', 'Current route', 'border-top-width:2px');
  } else if (S && $('optSurf').checked) {
    el.innerHTML = `<b>${state.mode === 'version' ? `${v.date}: changes` : 'All added stretches'}</b>, by OSM surface<br>` +
      S.categories.map((k) => line(surfColor(k.id), esc(k.label))).join('<br>') +
      (state.mode === 'version' ? '<br>' + line('var(--text-2)', 'Added (solid)', 'border-top-width:4px') +
        '<br>' + line('var(--text-2)', 'Removed (dashed)', 'border-top-width:3px;border-top-style:dashed') : '');
  } else if (state.mode === 'version') {
    const rs = !!routeSurfaceVersion();
    el.innerHTML = `<b>${v.date}</b> vs previous version<br>` +
      line('var(--added)', rs ? 'Added route (band)' : 'Added route', rs ? 'border-top-width:8px;opacity:.45' : '') + '<br>' +
      line('var(--removed)', rs ? 'Removed route (band)' : 'Removed route', rs ? 'border-top-width:8px;opacity:.45' : '') +
      (rs ? '' : '<br>' + line('var(--route)', 'Route in this version', 'border-top-width:2px')) + firstRoute;
  } else {
    const { years, col } = yearColors(valid);
    el.innerHTML = `<b>All added stretches</b>, by year<div class="ramp">${years.map((y) => `<span style="background:${col(y)}"></span>`).join('')}</div>` +
      `<div class="rl"><span>${years[0]}</span><span>${years[years.length - 1]}</span></div>` +
      line('var(--route)', 'Current route', 'border-top-width:2px') + firstRoute;
  }
}
