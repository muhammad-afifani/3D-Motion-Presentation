/**
 * pointer.js — alat presentasi: laser pointer (titik merah menyala mengikuti kursor) dan spotlight
 * (layar diredupkan kecuali lingkaran di sekitar kursor). Tombol K / Shift+K, Esc mematikan. Murni tampilan;
 * pointer-events none (tidak menghalangi klik), tidak ikut snapshot PNG.
 */
export const POINTER_MODES = Object.freeze(['off', 'laser', 'spotlight']);

/** Mode berikutnya untuk tombol K (laser) / Shift+K (spotlight): tombol yang sama mematikan lagi. */
export function nextPointerMode(mode, { shift = false, escape = false } = {}) {
  if (escape) return 'off';
  const want = shift ? 'spotlight' : 'laser';
  return mode === want ? 'off' : want;
}

/** @param {HTMLElement} parent */
export function createPointerTools(parent = document.body) {
  const el = document.createElement('div');
  el.className = 'ptr';
  el.dataset.snapSkip = '';
  el.hidden = true;
  el.innerHTML = '<div class="ptr__dot"></div>';
  parent.appendChild(el);
  let mode = 'off';
  const onMove = (e) => { el.style.setProperty('--px', `${e.clientX}px`); el.style.setProperty('--py', `${e.clientY}px`); };
  window.addEventListener('pointermove', onMove, { passive: true });
  function set(m) {
    mode = m;
    el.hidden = m === 'off';
    el.classList.toggle('ptr--laser', m === 'laser');
    el.classList.toggle('ptr--spot', m === 'spotlight');
    document.body.classList.toggle('is-laser', m === 'laser');
    return m;
  }
  return {
    get mode() { return mode; },
    set,
    /** @returns {string} mode baru */
    toggle(opts) { return set(nextPointerMode(mode, opts)); },
    dispose() { window.removeEventListener('pointermove', onMove); el.remove(); document.body.classList.remove('is-laser'); },
  };
}
