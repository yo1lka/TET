import { $, esc, fmt } from '../lib/util.js';
import { KIND_LABEL, TYPE_LABEL } from '../lib/palette.js';
import { store } from '../core/store.js';
import { actions } from '../core/actions.js';
import { surfaceNote } from './surfaceCard.js';

export function renderVersionSelect() {
  $('verSel').innerHTML = store.valid.map((v, i) => `<option value="${i}">${v.date}${v.changes.length ? ` · ${v.changes.length} change${v.changes.length === 1 ? '' : 's'}` : ''}</option>`).join('');
}

export function renderTimeline() {
  const { H, valid, state } = store;
  const html = [];
  for (const v of [...H.versions].reverse()) {
    if (v.status !== 'ok') {
      html.push(`<div class="ver invalid"><div class="row"><span class="date">${v.date}</span><span class="tag">skipped</span></div><div class="meta">${esc(v.error)}${v.status === 'invalid' ? ' (broken download)' : ''}</div></div>`);
      continue;
    }
    const secs = [];
    if (v.sections_added?.length) secs.push(`new sections: ${v.sections_added.join(', ')}`);
    if (v.sections_removed?.length) secs.push(`dropped sections: ${v.sections_removed.join(', ')}`);
    const w = v.waypoint_changes;
    const wtxt = w && (w.added.length || w.removed.length || w.moved.length)
      ? `Waypoints: +${w.added.length} / −${w.removed.length}${w.moved.length ? ` / ${w.moved.length} moved` : ''}` : '';
    html.push(`<div class="ver" data-i="${valid.indexOf(v)}">
      <div class="row"><span class="date">${v.date}</span><span class="tag">${KIND_LABEL[v.kind] || v.kind}</span>
      <span class="km">${fmt(v.total_km, 0)} km${v.kind === 'initial' ? '' : ` · ${v.delta_km >= 0 ? '+' : '−'}${fmt(Math.abs(v.delta_km))}`}</span></div>
      ${v.changes.length ? `<div class="meta">+${fmt(v.added_km)} km added · −${fmt(v.removed_km)} km removed · ${v.changes.length} change${v.changes.length === 1 ? '' : 's'}</div>` : ''}
      ${secs.length ? `<div class="meta">${esc(secs.join(' · '))}</div>` : ''}
      <div class="clusters" hidden></div>
      ${wtxt ? `<div class="wpts">${wtxt}</div>` : ''}
    </div>`);
  }
  $('tlist').innerHTML = html.join('');
  $('tlist').addEventListener('click', (ev) => {
    if (ev.target.closest('.detail')) return;
    const cl = ev.target.closest('.cl');
    if (cl) { actions.showChange(state.vi, cl.dataset.id, true); ev.stopPropagation(); return; }
    const ver = ev.target.closest('.ver[data-i]');
    if (ver) { state.mode = 'version'; actions.select(+ver.dataset.i); }
  });
}

export function highlightTimeline() {
  const { state, valid } = store;
  document.querySelectorAll('.ver.sel').forEach((e) => { e.classList.remove('sel'); const c = e.querySelector('.clusters'); c.hidden = true; c.innerHTML = ''; });
  if (state.mode !== 'version') return;
  const v = valid[state.vi];
  const el = document.querySelector(`.ver[data-i="${state.vi}"]`); if (!el) return;
  el.classList.add('sel');
  const box = el.querySelector('.clusters');
  if (v.changes.length) {
    box.innerHTML = v.changes.map((c) => `<div class="cl${c.id === state.cluster ? ' sel' : ''}" data-id="${c.id}" title="Zoom to this change">
      <span class="t">${TYPE_LABEL[c.type]}</span><span class="s">${esc(c.sections.join(', '))}</span>
      <span class="n">${c.added_km ? `<span class="sw" style="background:var(--added)"></span>+${fmt(c.added_km)}` : ''} ${c.removed_km ? `<span class="sw" style="background:var(--removed)"></span>−${fmt(c.removed_km)}` : ''}</span>${surfaceNote(c.id)}${reasonNote(c.id)}</div>${c.id === state.cluster ? changeDetail(c.id) : ''}`).join('');
    box.hidden = false;
  }
  const list = $('timeline'), r = el.getBoundingClientRect(), lr = list.getBoundingClientRect();
  if (r.top < lr.top + 50 || r.top > lr.bottom - 40) list.scrollTop += r.top - lr.top - 60;
}

let explOf = null;
const explanationOf = (id) => {
  if (!explOf) explOf = new Map((store.A?.changes || []).filter((c) => c.explanation).map((c) => [c.id, c]));
  return explOf.get(id);
};

function reasonNote(id) {
  const E = store.A?.explanations, c = explanationOf(id);
  if (E && c) {
    const lbl = (k) => E.explanations[k]?.label || k;
    const others = c.explanations.filter((k) => k !== c.explanation).map(lbl);
    return `<span class="rs"><span class="tag" title="${esc(others.length ? `Also fits: ${others.join(', ')}` : E.explanations[c.explanation]?.description || '')}">` +
      `${esc(lbl(c.explanation))}${others.length ? ` +${others.length}` : ''}</span></span>`;
  }
  const r = store.R?.changes[id];
  return r && r.reason !== 'none' ? `<span class="rs"><span class="tag">${esc(store.R.labels[r.reason])}</span></span>` : '';
}

const ago = (m) => m.days_before_change == null ? ''
  : m.days_before_change >= 0 ? `${m.days_before_change} days before` : `${-m.days_before_change} days after`;

function evidenceSection({ def, data }, id) {
  const ch = data.changes?.[id];
  if (!ch) return '';
  if (!ch.matched?.length) {
    return ch.window ? `<h4>${esc(def.section || def.label)}</h4><div class="q">None matched${ch.municipalities?.length ? ` in ${esc(ch.municipalities.join(', '))}` : ''} between ${esc(ch.window[0])} and ${esc(ch.window[1])}.</div>` : '';
  }
  return `<h4>${esc(def.section || def.label)}${ch.matched_total > ch.matched.length ? ` (${ch.matched_total})` : ''}</h4><ul>` + ch.matched.slice(0, 5).map((m) => {
    const title = esc(m.title || `${def.item || 'Item'}, ${m.date}`);
    const meta = [ago(m), (m.why || []).join(', ')].filter(Boolean).join('; ');
    return `<li>${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${title}</a>` : title}${m.title ? ` · ${esc(m.date)}` : ''}` +
      (meta ? ` <span class="q">(${esc(meta)})</span>` : '') +
      (m.terms?.length ? `<br><span class="q">Mentions: ${esc(m.terms.join(', '))}</span>` : '') +
      (m.excerpt ? `<br><span class="q">“${esc(m.excerpt)}”</span>` : '') + '</li>';
  }).join('') + '</ul>';
}

function osmLink(key) {
  const t = { w: 'way', n: 'node' }[key[0]];
  return `<a href="https://www.openstreetmap.org/${t}/${key.slice(1)}/history" target="_blank" rel="noopener">${t} ${key.slice(1)}</a>`;
}

function tagDiff(b, a) {
  const keys = [...new Set([...Object.keys(b || {}), ...Object.keys(a || {})])].filter((k) => k !== 'name' && (b || {})[k] !== (a || {})[k]);
  return keys.map((k) => `${esc(k)}: ${esc((b || {})[k] ?? '–')} → ${esc((a || {})[k] ?? '–')}`).join(', ');
}

function changeDetail(id) {
  const { R } = store;
  const r = R?.changes[id];
  const ev = store.evidence.map((e) => evidenceSection(e, id)).join('');
  const E = store.A?.explanations, c = explanationOf(id);
  if (!r && !ev && !c) return '';
  let h = '<div class="detail">';
  if (E && c) {
    h += '<h4>Possible explanations</h4><ul>' + c.explanations.map((k) =>
      `<li><b>${esc(E.explanations[k]?.label || k)}</b>${k === c.explanation ? ' (main)' : ''} · <span class="q">${esc(E.explanations[k]?.description || '')}</span></li>`).join('') + '</ul>';
  }
  if (r) {
    const evs = r.evidence.filter((e) => e.type !== 'already_restricted' || r.reason === 'already_restricted')
      .sort((x, y) => R.priority.indexOf(x.type) - R.priority.indexOf(y.type)).slice(0, 8);
    h += `<h4>OSM evidence (${esc(r.before_date)} → ${esc(r.window_end || r.date)})</h4>`;
    h += evs.length ? '<ul>' + evs.map((e) => {
      const cs = e.changeset_info;
      return `<li><b>${esc(R.labels[e.type])}</b>${e.km ? ` · ${fmt(e.km, 2)} km` : ''} · ${osmLink(e.osm)}` +
        `${e.before || e.after ? ` · ${tagDiff(e.before, e.after) || ''}` : ''}` +
        `${e.timestamp ? ` · edited ${esc(e.timestamp.slice(0, 10))}` : ''}` +
        (cs && cs.comment ? `<br><span class="q">“${esc(cs.comment)}”${cs.source ? ` (source: ${esc(cs.source)})` : ''}</span>` : '') + '</li>';
    }).join('') + '</ul>' : '<div class="q">No relevant OSM change found along the removed stretch.</div>';
  }
  return h + ev + '</div>';
}
