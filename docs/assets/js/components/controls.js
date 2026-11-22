import { $ } from '../lib/util.js';
import { store } from '../core/store.js';
import { actions } from '../core/actions.js';
import { fitCountry } from './mapView.js';
import { bindLayerControls } from './mapLayers.js';

export function bindControls() {
  const { state, S, A } = store;
  const setMode = (mode, fit) => { state.mode = mode; if (mode !== 'version') state.cluster = null; actions.refresh(false); if (fit) fitCountry(); };
  $('mVersion').onclick = () => setMode('version');
  $('mAll').onclick = () => setMode('all', true);
  $('mDir').hidden = !(A && A.summary.has_surfaces);
  $('mDir').onclick = () => setMode('dir', true);
  $('prev').onclick = () => actions.select(state.vi - 1);
  $('next').onclick = () => actions.select(state.vi + 1);
  $('verSel').onchange = (e) => actions.select(+e.target.value);
  for (const id of ['optOld', 'optWpt', 'optSurf', 'surfWhich']) $(id).onchange = () => actions.refresh(false);
  $('optSurf').disabled = !S;
  bindLayerControls();
  $('rsurf').hidden = !S;
  $('rsurf').onclick = (e) => {
    const b = e.target.closest('button[data-rs]'); if (!b || b.disabled) return;
    state.routeSurf = b.dataset.rs; actions.refresh(false);
  };
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if ((e.key === 'p' || e.key === 'P') && S) {   // flip the coloured route between this version and the previous one
      state.routeSurf = state.routeSurf === 'this' ? 'prev' : 'this'; actions.refresh(false); return;
    }
    if (state.mode !== 'version') return;
    if (e.key === 'ArrowLeft') actions.select(state.vi - 1);
    if (e.key === 'ArrowRight') actions.select(state.vi + 1);
  });
}

export function syncControls() {
  const { state, valid, S } = store;
  $('mVersion').setAttribute('aria-pressed', state.mode === 'version');
  $('mAll').setAttribute('aria-pressed', state.mode === 'all');
  $('mDir').setAttribute('aria-pressed', state.mode === 'dir');
  $('verSel').value = String(state.vi);
  $('verSel').disabled = state.mode !== 'version';
  $('prev').disabled = state.mode !== 'version' || state.vi <= 0;
  $('next').disabled = state.mode !== 'version' || state.vi >= valid.length - 1;
  $('surfWhich').hidden = !(S && $('optSurf').checked) || state.mode !== 'version';
  const shown = state.mode === 'version' ? state.vi : valid.length - 1;
  for (const b of document.querySelectorAll('#rsurf button[data-rs]')) {
    b.setAttribute('aria-pressed', String((state.routeSurf || 'off') === b.dataset.rs));
    b.disabled = b.dataset.rs === 'prev' && shown <= 0;
  }
}
