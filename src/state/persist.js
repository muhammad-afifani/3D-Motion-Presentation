/**
 * persist.js — persistensi ringan (localStorage) untuk pengaturan presenter (M8a).
 *
 * Disimpan: batas NOx/CO + satuannya, basis O₂/volume, opsi Scene 11 yang disembunyikan, Quality & Bloom, scene awal,
 * pemilih regulasi (equipment, kelas kapasitas, bahan bakar), panel rumus terbuka/terlipat.
 * TIDAK disimpan: faktor kalibrasi (selalu mulai dari default; nilai custom hanya berlaku selama sesi) dan site data
 * (nilai ukur lapangan tidak boleh muncul lagi tanpa sengaja di sesi berikutnya).
 *
 * Semua akses storage di dalam try/catch: bila localStorage diblokir/penuh/rusak, aplikasi tetap benar
 * dengan nilai default (hanya tidak ingat apa pun). Nilai yang dibaca divalidasi ulang lewat patch store.
 * "Scene terakhir" hanya nilai awal saat halaman dibuka; R atau Reset saved settings → kembali ke Scene 1.
 */
import { limitsPatch, basisPatch, limitsInitialState, basisInitialState, closingInitialState, displayPatch } from './store.js';
import { POLICY } from '../model/presets.js';
import { EQUIPMENT, regulationsInitialState } from './regulations.js';

export const PERSIST_KEY = 'etel:v1';
export const PERSIST_FIELDS = Object.freeze(['limNOx', 'limCO', 'limUnit', 'emRefO2', 'emTrefC', 'closingVisible', 'quality', 'bloomMode', 'regEquip', 'regClass', 'regFuel', 'formulaOpen']);
export const FIRST_SCENE = 1;

/** Akses storage yang aman: null bila tidak tersedia / melempar (mis. mode privat, cookie diblokir). */
export function safeStorage(get = () => globalThis.localStorage) {
  try {
    const s = get();
    if (!s || typeof s.getItem !== 'function') return null;
    s.getItem(PERSIST_KEY); // probe: beberapa browser baru melempar saat dipakai
    return s;
  } catch {
    return null;
  }
}

/** Validasi objek opsi Scene 11: hanya id → false (disembunyikan). */
function cleanClosing(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out = {};
  for (const [k, x] of Object.entries(v)) if (x === false && typeof k === 'string' && k.length <= 64) out[k] = false;
  return out;
}

/**
 * Baca & validasi data tersimpan. Tidak pernah throw.
 * @returns {{patch: Record<string, any>, startScene: number}}
 */
export function readSaved(storage, sceneNumbers = [FIRST_SCENE]) {
  const empty = { patch: {}, startScene: FIRST_SCENE };
  if (!storage) return empty;
  let raw;
  try { raw = storage.getItem(PERSIST_KEY); } catch { return empty; }
  if (!raw) return empty;
  let j;
  try { j = JSON.parse(raw); } catch { return empty; }
  if (!j || typeof j !== 'object' || j.v !== 1) return empty;
  const d = j.data && typeof j.data === 'object' ? j.data : {};
  const patch = {
    ...limitsPatch({ nox: d.limNOx ?? '', co: d.limCO ?? '' }),
    ...basisPatch({ refO2: d.emRefO2, TrefC: d.emTrefC }),
    closingVisible: cleanClosing(d.closingVisible),
    ...displayPatch({ quality: d.quality, bloomMode: d.bloomMode }),
  };
  if (POLICY.limUnits.includes(d.limUnit)) patch.limUnit = d.limUnit;
  // pemilih regulasi: kelas divalidasi ulang terhadap regulations.json saat dipakai (regSelection)
  if (Object.hasOwn(EQUIPMENT, d.regEquip)) patch.regEquip = d.regEquip;
  if (typeof d.regClass === 'string' && d.regClass.length <= 64) patch.regClass = d.regClass;
  if (d.regFuel === 'oil' || d.regFuel === 'gas') patch.regFuel = d.regFuel;
  if (typeof d.formulaOpen === 'boolean') patch.formulaOpen = d.formulaOpen; // panel rumus (bagian A); selain boolean → default terlipat
  const startScene = sceneNumbers.includes(j.scene) ? j.scene : FIRST_SCENE;
  return { patch, startScene };
}

/** Tulis data (tanpa throw). @returns {boolean} berhasil */
export function writeSaved(storage, state, scene) {
  if (!storage) return false;
  const data = Object.fromEntries(PERSIST_FIELDS.map((k) => [k, state[k] ?? null]));
  try { storage.setItem(PERSIST_KEY, JSON.stringify({ v: 1, data, scene })); return true; } catch { return false; }
}

/** Nilai default bidang yang dipersistenkan (dipakai Reset saved settings). */
export const persistDefaults = () => ({ ...limitsInitialState(), limUnit: POLICY.limUnits[0], ...basisInitialState(), closingVisible: closingInitialState().closingVisible, quality: 'auto', bloomMode: 'auto', regEquip: regulationsInitialState().regEquip, regClass: null, regFuel: regulationsInitialState().regFuel, formulaOpen: false });

/**
 * Sambungkan store ke storage. Panggil sekali saat boot (setelah store dibuat).
 * @param {{get:()=>any, set:(p:any)=>void, subscribe:(fn:any)=>()=>void}} store
 * @param {{storage?: Storage|null, sceneNumbers?: number[]}} [opts]
 */
export function createPersistence(store, { storage = safeStorage(), sceneNumbers = [FIRST_SCENE] } = {}) {
  const saved = readSaved(storage, sceneNumbers);
  if (Object.keys(saved.patch).length) store.set(saved.patch);
  let scene = saved.startScene;
  const save = () => writeSaved(storage, store.get(), scene);
  const unsub = store.subscribe((s, prev, changed) => { if (changed.some((k) => PERSIST_FIELDS.includes(k))) save(); });
  return {
    /** Scene awal (nilai tersimpan, atau 1). */
    startScene: saved.startScene,
    /** true bila storage bisa dipakai. */
    available: !!storage,
    /** Catat scene aktif (nilai awal pada kunjungan berikutnya). */
    setScene(n) { if (sceneNumbers.includes(n)) { scene = n; save(); } },
    /** Tombol R: scene awal berikutnya kembali ke Scene 1 (tampilan saat ini tidak berpindah). */
    resetStartScene() { scene = FIRST_SCENE; save(); },
    /** Reset saved settings: hapus data, bidang tersimpan ke default, scene awal ke 1. */
    clear() {
      scene = FIRST_SCENE;
      store.set(persistDefaults());
      try { storage?.removeItem(PERSIST_KEY); } catch { /* storage diblokir: cukup reset di memori */ }
    },
    dispose() { unsub(); },
  };
}
