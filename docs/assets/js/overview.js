import { esc, fetchJson } from './lib/util.js';
import { renderSiteNav } from './components/siteNav.js';
import { renderEvolution } from './components/evolution.js';

const f0 = (n) => (n == null ? '–' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 }));
const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);
const signed = (x) => (x == null ? '–' : `${x >= 0 ? '+' : '−'}${f0(Math.abs(x))}`);
const COLS = 11;

function row(r, total = false) {
  const name = total ? `<b>All ${r.countries} countr${r.countries === 1 ? 'y' : 'ies'}</b>`
    : `<a href="track.html?c=${encodeURIComponent(r.code)}">${esc(r.code)}</a> <span class="nm">${esc(r.name || '')}</span>`;
  const net = r.road_to_offroad_km == null ? null : r.road_to_offroad_km - r.offroad_to_road_km;
  return `<tr class="${total ? 'tot' : ''}"><td>${name}</td>
    <td>${total ? '' : `${esc(r.first)} → ${esc(r.last)}`}</td><td>${total ? '' : r.route_versions}</td>
    <td>${f0(r.first_km)} → ${f0(r.current_km)}</td>
    <td>${f0(r.new_km)}</td><td>${f0(r.dropped_km)}</td><td>${f0(r.rerouted_old_km)} → ${f0(r.rerouted_new_km)}</td>
    <td>${pct(r.offroad_share_first)} → ${pct(r.offroad_share_now)}</td>
    <td>${f0(r.offroad_to_road_km)}</td><td>${f0(r.road_to_offroad_km)}</td><td>${signed(net)}</td></tr>`;
}

async function renderGrid() {
  const reg = await fetchJson('data/countries.json', { optional: true });
  const el = document.getElementById('cgrid');
  if (!reg || !el) return;
  el.innerHTML = reg.countries.filter((c) => c.has_track || c.analysed).map((c) => c.analysed
    ? `<a class="cc on" href="track.html?c=${encodeURIComponent(c.code)}"><b>${esc(c.code)}</b> ${esc(c.name)}</a>`
    : `<span class="cc" title="Not analysed yet"><b>${esc(c.code)}</b> ${esc(c.name)}</span>`).join('');
}

async function main() {
  renderSiteNav('overview');
  renderGrid();
  const rowsEl = document.getElementById('rows');
  try {
    const o = await fetchJson('data/overview.json', { optional: true });
    if (o) {
      rowsEl.innerHTML = o.countries.map((r) => row(r)).join('') + (o.countries.length > 1 ? row(o.totals, true) : '');
      document.getElementById('gen').textContent = `Data generated ${o.generated}. ${o.notes} Countries not listed have not been analysed yet.`;
      renderEvolution(o);
      return;
    }
    const idx = await fetchJson('data/index.json');
    rowsEl.innerHTML = Object.values(idx.countries).map((s) => row({ ...s, code: s.country })).join('');
  } catch (e) {
    rowsEl.innerHTML = `<tr><td colspan="${COLS}">Could not load the data (${esc(e.message)}). Please reload the page.</td></tr>`;
  }
}
main();
