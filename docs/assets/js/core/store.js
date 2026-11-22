import { decodePolyline, fetchJson } from '../lib/util.js';

const params = new URLSearchParams(location.search);

export const store = {
  CC: (params.get('c') || 'NL').toUpperCase().replace(/[^A-Z]/g, ''),
  index: null,   // data/index.json
  H: null,       // history
  valid: [],     // readable versions, oldest first
  S: null,       // surfaces
  A: null,       // aggregate
  R: null,       // reasons
  manifest: null,
  name: null,    // country name
  evidence: [],
  state: { mode: 'version', vi: -1, cluster: null, routeSurf: 'off' },
};

export const currentVersion = () => store.valid[store.state.vi];

export async function loadCountry() {
  const base = `data/${store.CC}`;
  store.index = await fetchJson('data/index.json', { optional: true });
  store.H = await fetchJson(`${base}/history.json`, { optional: true });
  if (!store.H) return false;
  const m = await fetchJson(`${base}/manifest.json`, { optional: true });
  store.manifest = m;
  store.name = m?.name || store.index?.countries?.[store.CC]?.name || store.CC;
  const want = (k) => !m || m.files?.[k];   // without a manifest, try every core file
  const [S, A, R] = await Promise.all(['surfaces', 'aggregate', 'reasons']
    .map((f) => (want(f) ? fetchJson(`${base}/${f}.json`, { optional: true }) : null)));
  Object.assign(store, { S, A, R });
  const defs = m?.evidence || [];
  const data = await Promise.all(defs.map((d) => fetchJson(`${base}/${d.file}`, { optional: true })));
  store.evidence = defs.map((def, i) => ({ def, data: data[i] })).filter((e) => e.data);
  store.valid = store.H.versions.filter((v) => v.status === 'ok');
  return true;
}

const surfCache = new Map();
export function surfaceGeom(hash) {
  if (!surfCache.has(hash)) {
    surfCache.set(hash, fetchJson(`data/${store.CC}/surface_geom/${hash}.json`, { optional: true }).then((g) => {
      g?.runs.forEach((r) => { r.latlngs = decodePolyline(r.l); });
      return g;
    }));
  }
  return surfCache.get(hash);
}

const geomCache = new Map();
export function geom(hash) {
  if (!geomCache.has(hash)) {
    geomCache.set(hash, fetchJson(`data/${store.CC}/geom/${hash}.json`).then((g) => {
      g.tracks.forEach((t) => { t.latlngs = decodePolyline(t.line); });
      return g;
    }));
  }
  return geomCache.get(hash);
}
