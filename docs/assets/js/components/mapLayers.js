import { $, esc } from '../lib/util.js';
import { store } from '../core/store.js';

const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const PDOK_ATTR = '© <a href="https://www.pdok.nl/">PDOK</a> / Kadaster';

export const BASEMAPS = {
  osm: { group: 'General', label: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, muted: true, attribution: OSM_ATTR },
  esri: { group: 'General', label: 'Esri light grey', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', maxZoom: 16, muted: true,
    attribution: 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors' },
  cyclosm: { group: 'General', label: 'CyclOSM (tracks & surfaces)', url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', maxZoom: 19,
    attribution: `<a href="https://www.cyclosm.org">CyclOSM</a> | ${OSM_ATTR}` },
  otm: { group: 'Terrain', label: 'OpenTopoMap (contour lines)', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', maxZoom: 17,
    attribution: `${OSM_ATTR}, SRTM | © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)` },
  esriTopo: { group: 'Terrain', label: 'Esri topographic', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 19,
    attribution: 'Tiles © Esri — Esri, HERE, Garmin, USGS, © OpenStreetMap contributors' },
  esriImg: { group: 'Imagery', label: 'Satellite (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 19,
    attribution: 'Tiles © Esri — Esri, Maxar, Earthstar Geographics' },
  pdokAerial: { group: 'Imagery', countries: ['NL'], label: 'Aerial photo NL (PDOK)', url: 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg', maxZoom: 19,
    attribution: `Luchtfoto ${PDOK_ATTR}` },
  pdokBrt: { group: 'Netherlands', countries: ['NL'], label: 'Dutch topo map (PDOK BRT)', url: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png', maxZoom: 19,
    attribution: `BRT Achtergrondkaart ${PDOK_ATTR}` },
};

export const OVERLAYS = {
  hillshade: { label: 'Hillshade (relief)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', maxZoom: 16, opacity: 0.45,
    attribution: 'Hillshade © Esri' },
  ahn: { countries: ['NL'], label: 'Elevation NL (AHN height model)', url: 'https://service.pdok.nl/rws/ahn/wms/v1_0', wms: 'dtm_05m', opacity: 0.55,
    attribution: `AHN © Rijkswaterstaat / ${PDOK_ATTR}` },
  landcover: { countries: ['NL'], label: 'Land cover NL: forest, heath, farmland (TOP10NL, zoom in)', url: 'https://service.pdok.nl/brt/top10nl/wms/v1_0', wms: 'terrein', minZoom: 13, opacity: 0.55,
    attribution: `TOP10NL ${PDOK_ATTR}` },
  natura2000: { label: 'Natura 2000 protected areas (EU)', url: 'https://bio.discomap.eea.europa.eu/arcgis/services/ProtectedSites/Natura2000Sites/MapServer/WMSServer',
    wms: '1,2', opacity: 0.45, attribution: 'Natura 2000 © <a href="https://www.eea.europa.eu/">EEA</a>' },
};

const KEY = 'tet-map';
const prefs = (() => {
  const d = { base: 'osm', muted: null, overlays: [], opacity: 1 };
  try { return { ...d, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return d; }
})();
const forCountry = (l) => !l.countries || l.countries.includes(store.CC);
const available = (defs) => Object.fromEntries(Object.entries(defs).filter(([, l]) => forCountry(l)));
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {  } };

let map, base;
const overlayLayers = {};
const tried = new Set();

export function initLayers(m) {
  map = m;
  const base0 = available(BASEMAPS)[prefs.base] ? prefs.base : 'osm';
  const overlays0 = prefs.overlays.filter((k) => available(OVERLAYS)[k]);
  map.createPane('overlays').style.zIndex = 250; // above the basemap (200), below the route lines (400); not muted
  setBasemap(base0, true);
  overlays0.forEach((k) => setOverlay(k, true, true));
}

function applyMuted() {
  const muted = prefs.muted ?? BASEMAPS[prefs.base].muted ?? false;
  map.getContainer().classList.toggle('muted', muted);
  const cb = $('optMuted'); if (cb) cb.checked = muted;
}

export function setBasemap(key, auto = false) {
  if (base) base.remove();
  const b = BASEMAPS[key];
  if (!auto && key !== prefs.base) prefs.muted = null; // a new basemap starts with its own default look
  prefs.base = key;
  if (!auto) save();
  const sel = $('basemap'); if (sel) sel.value = key;
  let ok = 0, failed = 0;
  base = L.tileLayer(b.url, {
    maxZoom: 19, maxNativeZoom: b.maxZoom, subdomains: 'abc', attribution: b.attribution,
    referrerPolicy: 'strict-origin-when-cross-origin', crossOrigin: false,
  })
    .on('tileload', () => { ok++; })
    .on('tileerror', (e) => {
      failed++;
      if (e.target !== base || ok > 0 || failed < 4) return; // only the active layer, only if nothing loaded
      tried.add(key);
      const next = Object.keys(BASEMAPS).find((k) => k !== key && !tried.has(k));
      if (next) { console.warn(`Basemap "${key}" failed to load; switching to "${next}".`); setBasemap(next, true); }
    })
    .addTo(map);
  base.bringToBack();
  applyMuted();
}

export function setOverlay(key, on, init = false) {
  const o = OVERLAYS[key];
  if (overlayLayers[key]) { overlayLayers[key].remove(); delete overlayLayers[key]; }
  if (on) {
    const opts = { pane: 'overlays', opacity: Math.min(1, o.opacity * prefs.opacity), attribution: o.attribution, minZoom: o.minZoom || 0, maxZoom: 19 };
    overlayLayers[key] = (o.wms
      ? L.tileLayer.wms(o.url, { ...opts, layers: o.wms, format: 'image/png', transparent: true, version: '1.3.0' })
      : L.tileLayer(o.url, { ...opts, maxNativeZoom: o.maxZoom })).addTo(map);
  }
  if (init) return;
  prefs.overlays = [...new Set([...prefs.overlays.filter((k) => !available(OVERLAYS)[k]), ...Object.keys(overlayLayers)])];
  save();
}

export function bindLayerControls() {
  const bases = available(BASEMAPS);
  const groups = [...new Set(Object.values(bases).map((b) => b.group))];
  $('basemap').innerHTML = groups.map((g) => `<optgroup label="${esc(g)}">` +
    Object.entries(bases).filter(([, b]) => b.group === g).map(([k, b]) => `<option value="${k}">${esc(b.label)}</option>`).join('') + '</optgroup>').join('');
  $('basemap').value = prefs.base;
  $('basemap').onchange = (e) => setBasemap(e.target.value);

  $('layerList').innerHTML = Object.entries(available(OVERLAYS)).map(([k, o]) =>
    `<label><input type="checkbox" data-overlay="${k}"${overlayLayers[k] ? ' checked' : ''}> ${esc(o.label)}</label>`).join('');
  $('layerList').onchange = (e) => { const k = e.target.dataset.overlay; if (k) setOverlay(k, e.target.checked); };
  $('optMuted').checked = map.getContainer().classList.contains('muted');
  $('optMuted').onchange = (e) => { prefs.muted = e.target.checked; save(); applyMuted(); };
  $('overlayOpacity').value = String(prefs.opacity);
  $('overlayOpacity').oninput = (e) => {
    prefs.opacity = +e.target.value; save();
    for (const [k, l] of Object.entries(overlayLayers)) l.setOpacity(Math.min(1, OVERLAYS[k].opacity * prefs.opacity));
  };
}
