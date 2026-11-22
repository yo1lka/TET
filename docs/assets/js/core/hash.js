import { store } from './store.js';

export function writeHash() {
  const { state, valid } = store;
  const p = new URLSearchParams();
  if (state.mode !== 'version') p.set('view', state.mode);
  else { p.set('v', valid[state.vi].date); if (state.cluster) p.set('change', state.cluster); }
  if (state.routeSurf && state.routeSurf !== 'off') p.set('surf', state.routeSurf);
  const h = '#' + p.toString();
  if (location.hash !== h) history.replaceState(null, '', h);
}

export function readHash() {
  const { state, valid, A } = store;
  const p = new URLSearchParams(location.hash.slice(1));
  const before = JSON.stringify(state);
  if (p.get('view') === 'all') state.mode = 'all';
  if (p.get('view') === 'dir' && A) state.mode = 'dir';
  const d = p.get('v');
  if (d) {
    const i = valid.findIndex((v) => v.date === d || v.commit === d);
    if (i >= 0) { state.vi = i; state.mode = 'version'; }
  }
  state.cluster = p.get('change');
  state.routeSurf = ['this', 'prev', 'first'].includes(p.get('surf')) ? p.get('surf') : 'off';
  return JSON.stringify(state) !== before;
}
