import { esc, fetchJson } from '../lib/util.js';

export async function renderSiteNav(current, index = null) {
  const el = document.getElementById('sitenav');
  if (!el) return;
  const idx = index || await fetchJson('data/index.json', { optional: true });
  const countries = Object.values(idx?.countries || {})
    .map((c) => ({ code: c.country, name: c.name || c.country }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const link = (href, label, title, on) =>
    `<a href="${href}"${on ? ' aria-current="page"' : ''}${title ? ` title="${esc(title)}"` : ''}>${label}</a>`;
  el.innerHTML = `<a class="brand" href="./">TET route history</a>` +
    `<div class="links">${link('./', 'Overview', 'All countries', current === 'overview')}<span class="div" aria-hidden="true"></span>` +
    countries.map((c) => link(`track.html?c=${encodeURIComponent(c.code)}`,
      `<b>${esc(c.code)}</b> ${esc(c.name)}`, `${c.name}: timeline, map and reasons for each change`, current === c.code)).join('') +
    '</div>';
}
