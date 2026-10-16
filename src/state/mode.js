/**
 * mode.js — mode aplikasi (M9 Step 06): 'explore' (default, navigasi terlihat) atau 'present' (tampilan bersih seperti
 * sebelumnya). Pilihan terakhir dan status navigasi dilipat disimpan di localStorage. Semua akses storage lewat
 * try/catch: storage kosong, diblokir, atau rusak → default tanpa galat.
 */
export const MODES = Object.freeze(['explore', 'present']);
export const MODE_KEY = 'etel:mode';
export const NAV_KEY = 'etel:nav';
/** Lebar jendela (px) di bawahnya navigasi mulai dalam bentuk rail (dilipat) bila belum ada pilihan tersimpan. */
export const NAV_COLLAPSE_BELOW = 1600;

/** Storage aman: null bila tidak tersedia atau melempar. */
export function modeStorage(get = () => globalThis.localStorage) {
  try {
    const s = get();
    if (!s || typeof s.getItem !== 'function') return null;
    s.getItem(MODE_KEY);
    return s;
  } catch {
    return null;
  }
}

const read = (storage, key) => { try { return storage?.getItem(key) ?? null; } catch { return null; } };
const write = (storage, key, v) => { try { storage?.setItem(key, v); return true; } catch { return false; } };

/** Mode tersimpan (default 'explore'). */
export function readMode(storage) {
  const v = read(storage, MODE_KEY);
  return MODES.includes(v) ? v : 'explore';
}
export const saveMode = (storage, mode) => (MODES.includes(mode) ? write(storage, MODE_KEY, mode) : false);
export const otherMode = (mode) => (mode === 'present' ? 'explore' : 'present');

/** Navigasi dilipat? Pilihan tersimpan diutamakan; tanpa pilihan → dilipat bila jendela < NAV_COLLAPSE_BELOW. */
export function readNavCollapsed(storage, width = Infinity) {
  const v = read(storage, NAV_KEY);
  if (v === 'collapsed') return true;
  if (v === 'expanded') return false;
  return width < NAV_COLLAPSE_BELOW;
}
export const saveNavCollapsed = (storage, collapsed) => write(storage, NAV_KEY, collapsed ? 'collapsed' : 'expanded');

/**
 * Aturan panah ←/→ untuk ganti scene: di Present selalu; di Explore hanya bila fokus ada di navigasi.
 * @param {'explore'|'present'} mode @param {boolean} focusInNav
 */
export const arrowsChangeScene = (mode, focusInNav) => mode === 'present' || focusInNav;
