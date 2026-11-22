import { $, esc, fmt, isDark, signed } from '../lib/util.js';
import { CHAR_LABEL, DIRECTIONS, DIR_LABEL, dirColor } from '../lib/palette.js';
import { store } from '../core/store.js';

const fact = (k, v, m) => `<div class="fact"><span class="k">${k}</span><span class="v">${v}${m ? ` <span class="m">${m}</span>` : ''}</span></div>`;
const pctU = (u, p, t) => (u + p) ? `${fmt(u / (u + p) * 100, 0)}% offroad${t != null ? `, ${fmt(t / (u + p) * 100, 0)}% trail` : ''}` : '';

function totals(s) {
  return '<h3>Totals over all versions</h3><div class="facts">' +
    fact('New route', `<b>${fmt(s.new_km, 0)} km</b> in ${s.new_count} additions`, s.has_surfaces ? pctU(s.new_unpaved_km, s.new_paved_km, s.new_trail_km) : '') +
    fact('Dropped route', `<b>${fmt(s.dropped_km, 0)} km</b> in ${s.dropped_count} removals`, s.has_surfaces ? pctU(s.dropped_unpaved_km, s.dropped_paved_km, s.dropped_trail_km) : '') +
    fact('Rerouted', `<b>${s.rerouted_count}</b> reroutes: <b>${fmt(s.rerouted_old_km, 0)} km</b> replaced by <b>${fmt(s.rerouted_new_km, 0)} km</b>`,
      s.has_surfaces ? `${pctU(s.reroute_unpaved_km_old, s.reroute_paved_km_old, s.reroute_trail_km_old)} before → ${pctU(s.reroute_unpaved_km_new, s.reroute_paved_km_new, s.reroute_trail_km_new)} after` : '') +
    '</div>';
}

function directions(s, P) {
  const { S } = store;
  if (!s.has_surfaces) return '<div class="note">Road surface data is not available for this country yet.</div>';
  const d = s.reroute_directions, tot = Object.values(d).reduce((a, b) => a + b.km_old, 0) || 1;
  return '<h3>Reroutes by surface direction (width = km of old route replaced)</h3><div class="dbar">' +
    DIRECTIONS.filter((k) => d[k].count).map((k) =>
      `<span style="width:${d[k].km_old / tot * 100}%;background:${dirColor(k)}" title="${DIR_LABEL[k]}: ${d[k].count} reroutes, ${fmt(d[k].km_old)} km → ${fmt(d[k].km_new)} km">${d[k].km_old / tot > 0.08 ? d[k].count : ''}</span>`).join('') + '</div>' +
    '<table class="stbl"><thead><tr><th>Direction</th><th>Reroutes</th><th>Old km</th><th>New km</th></tr></thead><tbody>' +
    DIRECTIONS.map((k) => `<tr><td><span class="sw" style="background:${dirColor(k)}"></span>${DIR_LABEL[k]}</td><td>${d[k].count}</td><td>${fmt(d[k].km_old)}</td><td>${fmt(d[k].km_new)}</td></tr>`).join('') +
    '</tbody></table>' +
    `<div class="note">A reroute goes towards offroad (or asphalt) when the offroad share (loose surface plus trail) of the new route is at least ${fmt(P.DIRECTION_DELTA * 100, 0)} percentage points higher (or lower) than the old one. Surfaces come from ${S?.osm_mode === 'snapshot' ? `one OSM snapshot (${esc(S.osm_date)})` : 'OSM on the date of the change'}. Stretches where less than ${fmt(P.MIN_KNOWN * 100, 0)}% of the surface is known count as unknown. Large reworks can merge into one change with much more new than old km. That extra km is counted under reroutes, not new route.</div>`;
}

function flow(F) {
  const ro = F.road_offroad, sides = ['road', 'offroad', 'unknown'];
  const SL = { road: 'Road (hard)', offroad: 'Offroad (loose + trail)', unknown: 'Unknown' };
  const rowSum = (r) => sides.reduce((t, b) => t + ro[r][b], 0);
  return `<h3>Reroute flow: what the old surface was replaced with (km of old route)</h3>
    <div class="cmp-head">
      <div><div class="sub">Offroad rerouted away</div><div class="big">${fmt(rowSum('offroad'), 0)} km</div><div class="sub">${fmt(ro.offroad.road, 0)} km to road · ${fmt(ro.offroad.offroad, 0)} km to other offroad</div></div>
      <div><div class="sub">Road rerouted</div><div class="big">${fmt(rowSum('road'), 0)} km</div><div class="sub">${fmt(ro.road.offroad, 0)} km to offroad · ${fmt(ro.road.road, 0)} km to other road</div></div>
    </div>
    <table class="stbl"><thead><tr><th>Old ↓ / replaced by →</th>${sides.map((b) => `<th>${SL[b]}</th>`).join('')}<th>Total</th></tr></thead><tbody>` +
    sides.map((a) => `<tr><td>${SL[a]}</td>${sides.map((b) => `<td>${fmt(ro[a][b], 0)}</td>`).join('')}<td>${fmt(rowSum(a), 0)}</td></tr>`).join('') +
    `</tbody></table>
    <table class="stbl"><thead><tr><th>Year</th><th>Offroad → road</th><th>Offroad → offroad</th><th>Road → offroad</th><th>Net to offroad</th></tr></thead><tbody>` +
    Object.entries(F.by_year).map(([y, m]) => `<tr><td>${y}</td><td>${fmt(m.offroad.road, 0)}</td><td>${fmt(m.offroad.offroad, 0)}</td><td>${fmt(m.road.offroad, 0)}</td>` +
      `<td>${signed(m.road.offroad - m.offroad.road)}</td></tr>`).join('') +
    `</tbody></table><div class="note">For each reroute, the old km of each surface are shared out over the surface mix of the new stretch, because which new metre replaced which old metre is unknown. Rows are km of old route (${fmt(F.old_km_total, 0)} km in all). The new stretches are longer in total (${fmt(F.new_km_total, 0)} km), and that extra length is not in this table.</div>`;
}

function matrix(M, P) {
  const chars = ['offroad', 'mixed', 'paved', 'unknown'];
  const maxKm = Math.max(1, ...chars.flatMap((o) => chars.map((n) => M[o][n].km_removed)));
  return `<h3>Reroutes: what the old stretch was → what replaced it (count · old km)</h3>
    <table class="stbl mx"><thead><tr><th>Old ↓ / New →</th>${chars.map((n) => `<th>${CHAR_LABEL[n]}</th>`).join('')}<th>Total</th></tr></thead><tbody>` +
    chars.map((o) => {
      const row = chars.map((n) => M[o][n]);
      const t = row.reduce((a, m) => ({ c: a.c + m.count, k: a.k + m.km_removed }), { c: 0, k: 0 });
      return `<tr><td>${CHAR_LABEL[o]}</td>${row.map((m) => `<td class="c" style="--w:${m.km_removed / maxKm}" title="${m.count} reroutes, ${fmt(m.km_removed)} km → ${fmt(m.km_added)} km">${m.count ? `${m.count} · ${fmt(m.km_removed, 0)}` : '–'}</td>`).join('')}<td>${t.c} · ${fmt(t.k, 0)}</td></tr>`;
    }).join('') + '</tbody></table>' +
    `<div class="note">Offroad means at least ${fmt(P.OFFROAD_SHARE * 100, 0)}% loose surface or trail. Paved means at most ${fmt(P.PAVED_SHARE * 100, 0)}%. Anything in between is mixed.</div>`;
}

function reasons(s, A) {
  const { R } = store;
  const rr = s.removal_reasons, keys = Object.keys(rr);
  return `<h3>Why route was removed: strongest OSM evidence per change</h3><table class="stbl"><thead><tr><th>Evidence</th><th>Changes</th><th>Km removed</th>${s.has_decisions ? '<th>With traffic decision</th>' : ''}</tr></thead><tbody>` +
    keys.map((k) => `<tr><td>${esc(A.reason_labels[k] || k)}</td><td>${rr[k].count}</td><td>${fmt(rr[k].km_removed)}</td>${s.has_decisions ? `<td>${rr[k].with_decision}</td>` : ''}</tr>`).join('') +
    `</tbody></table><div class="note">Each change is counted once, under its strongest piece of evidence. Evidence is an OSM edit along the removed stretch between the previous version and the change${R?.osm_mode === 'snapshot+history' ? ` (or up to ${R.params.WINDOW_AFTER_DAYS} days after it, because OSM often lags the sign; edits found through each road's OSM history)` : ''}. Traffic decisions are official decisions of the same municipality, published from two years before to four months after the change, that match on location or street name. This shows what happened around the time of the change. It does not prove the cause.</div>`;
}

const FAMILY_LIGHT = { access: '#6250d6', decision: '#0d366b', riders: '#1a7f5a', road: '#b8461b', design: '#2a78d6', context: '#8e8d86', none: '#d9d7d0' };
const FAMILY_DARK = { access: '#9085e9', decision: '#86b6ef', riders: '#3fb68b', road: '#eb6834', design: '#3987e5', context: '#a8a79f', none: '#4a4a46' };
export const familyColor = (f) => (isDark() ? FAMILY_DARK : FAMILY_LIGHT)[f];

function explanations(E) {
  const fams = Object.keys(E.families);
  const explained = E.changes - (E.primary.none?.count || 0);
  const totKm = E.km_removed || 1;
  let h = `<p class="lead">${E.changes} changes removed ${fmt(E.km_removed, 0)} km of route. <b>${explained}</b> of them have at least one explanation, and <b>${E.primary.none?.count || 0}</b> (${fmt(E.primary.none?.km_removed || 0, 0)} km) have none.</p>
    <div class="dbar">` +
    fams.filter((f) => E.by_family[f]).map((f) => {
      const b = E.by_family[f];
      return `<span style="width:${b.km_removed / totKm * 100}%;background:${familyColor(f)}" title="${esc(E.families[f])}: ${b.count} changes, ${fmt(b.km_removed, 0)} km">${b.km_removed / totKm > 0.07 ? b.count : ''}</span>`;
    }).join('') + '</div>' +
    `<div class="slegend">${fams.filter((f) => E.by_family[f]).map((f) => `<span><span class="sw" style="background:${familyColor(f)}"></span>${esc(E.families[f])}</span>`).join('')}</div>`;
  h += '<table class="stbl expl"><thead><tr><th>Explanation</th><th title="Changes counted once, under their first matching explanation">Main reason</th><th>km</th><th title="Every change this explanation fits">Fits</th></tr></thead><tbody>';
  for (const f of fams) {
    const ids = E.priority.filter((k) => E.explanations[k].family === f && (E.primary[k] || E.any[k]));
    if (!ids.length) continue;
    const fb = E.by_family[f] || { count: 0, km_removed: 0 };
    h += `<tr class="grp"><td><span class="sw" style="background:${familyColor(f)}"></span>${esc(E.families[f])}</td><td>${fb.count}</td><td>${fmt(fb.km_removed, 0)}</td><td></td></tr>`;
    for (const k of ids) {
      const x = E.explanations[k], p = E.primary[k] || { count: 0, km_removed: 0 };
      h += `<tr><td class="ex"><span class="lbl">${esc(x.label)}</span><span class="desc">${esc(x.description)}</span></td>` +
        `<td>${p.count || '–'}</td><td>${p.count ? fmt(p.km_removed, 0) : '–'}</td><td>${E.any[k]?.count || '–'}</td></tr>`;
    }
  }
  h += '</tbody></table>';
  return h + `<div class="note">A change often fits several explanations. "Main reason" counts each change once, under the first one that fits in the order listed: official decisions and OSM closures first, then road changes, route design and road context. "Fits" counts every change the explanation applies to. These are explanations that match the data, not proven causes. OSM evidence comes from each road's edit history between the previous version and the change${store.R?.osm_mode === 'snapshot+history' ? ` (or up to ${store.R.params.WINDOW_AFTER_DAYS} days after it)` : ''}.${store.evidence.length ? ` Country sources: ${store.evidence.map((e) => `${esc(e.def.label)} (${esc(e.def.source || e.def.file)})`).join('; ')}.` : ''}</div>`;
}

function perYear(s, A) {
  return `<h3>Per year</h3><table class="stbl"><thead><tr><th>Year</th><th>New km</th><th>Dropped km</th><th>Reroutes</th><th>Old → new km</th>${s.has_surfaces ? '<th title="towards offroad">→ off</th><th title="same mix">=</th><th title="towards asphalt">→ asph</th>' : ''}</tr></thead><tbody>` +
    Object.entries(A.by_year).map(([y, b]) => `<tr><td>${y}</td><td>${fmt(b.added.km_added, 0)}</td><td>${fmt(b.removed.km_removed, 0)}</td><td>${b.rerouted.count}</td><td>${fmt(b.rerouted.km_removed, 0)} → ${fmt(b.rerouted.km_added, 0)}</td>` +
      (s.has_surfaces ? `<td>${b.to_offroad.count}</td><td>${b.same_mix.count}</td><td>${b.to_paved.count}</td>` : '') + '</tr>').join('') + '</tbody></table>';
}

export function renderAggregateCard() {
  const { A } = store;
  if (!A) return;
  const s = A.summary, P = A.params;
  let left = totals(s) + directions(s, P);
  if (A.reroute_flow && s.has_surfaces) left += flow(A.reroute_flow);
  let right = s.has_surfaces ? matrix(A.reroute_matrix, P) : '';
  if (A.explanations) { $('why').innerHTML = explanations(A.explanations); $('whyCard').hidden = false; }
  else if (s.has_reasons || s.has_decisions) right += reasons(s, A);
  right += perYear(s, A);
  $('aggLeft').innerHTML = left;
  $('aggRight').innerHTML = right;
  $('aggCard').hidden = false;
}
