
export const $ = (id) => document.getElementById(id);
export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const fmt = (n, d = 1) => Number(n).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + b, 0);
export const signed = (x, d = 0) => `${x >= 0 ? '+' : '−'}${fmt(Math.abs(x), d)}`;

export const isDark = () => {
  const t = document.documentElement.dataset.theme;
  if (t) return t === 'dark';
  return matchMedia('(prefers-color-scheme: dark)').matches;
};

export function decodePolyline(str) {
  const out = []; let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = (result & 1) ? ~(result >> 1) : (result >> 1);
      if (k === 0) lat += d; else lon += d;
    }
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}

export async function fetchJson(url, { optional = false } = {}) {
  try {
    const r = await fetch(url);
    if (!r.ok) { if (optional) return null; throw new Error(`${url}: HTTP ${r.status}`); }
    return await r.json();
  } catch (e) {
    if (optional) return null;
    throw e;
  }
}

export function placeTip(tip, container, clientX, clientY, dy = 12) {
  const box = container.getBoundingClientRect();
  tip.style.display = 'block';
  tip.style.left = `${Math.min(clientX - box.left + 12, box.width - tip.offsetWidth - 4)}px`;
  tip.style.top = `${clientY - box.top + dy}px`;
}
