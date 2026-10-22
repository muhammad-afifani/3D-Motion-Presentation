/**
 * unitsStore.js — pengaturan satuan tampilan (Settings ⚙ → Units). Lapisan TAMPILAN saja: model, store, dan frame tetap
 * memakai satuan dasar (thermo.js UNIT_DEFS); hanya ui/ yang membaca store ini, dan tidak pernah state/derive*.js atau
 * state/regulations.js (perbandingan ke batas tidak boleh bergantung pada satuan; dijaga tests/units.test.js).
 *
 * Bentuk pilihan: satu preset ('si' | 'us') + override per besaran. Memilih preset menghapus semua override ("satu pilihan
 * untuk semua"); memilih satuan satu besaran yang sama dengan preset menghapus override besaran itu. 'custom' = ada override.
 * Nilai 'auto' (daya, konsentrasi) = satuan bawaan masing-masing scene seperti sebelum fitur ini.
 *
 * Persistensi: localStorage 'etel:units' (JSON, semua akses try/catch). Jendela presenter ikut lewat event `storage`
 * (reload()), mekanisme yang sama dengan bahasa dan tema.
 *
 * Bendera UNITS_UI: seksi Units di Settings dan pengaruh pilihan satuan hanya aktif bila bendera menyala. Bawaan MATI di
 * build normal; untuk uji manual tanpa mengubah kode: buka alamat dengan `?units=1` (disimpan di localStorage
 * 'etel:unitsUi', jadi tahan muat ulang dan terbaca jendela presenter) atau jalankan di console
 * `localStorage.setItem('etel:unitsUi','1')`. `?units=0` atau `localStorage.removeItem('etel:unitsUi')` mematikannya lagi.
 * Selama bendera mati, unit() selalu mengembalikan satuan SI bawaan, apa pun isi 'etel:units'.
 */
import { UNIT_DEFS } from '../model/thermo.js';

export const UNITS_KEY = 'etel:units';
export const UNITS_UI_KEY = 'etel:unitsUi';
export const PRESET_IDS = Object.freeze(['si', 'us']);

/**
 * Besaran yang bisa dipilih. `options` berisi id satuan (kunci UNIT_DEFS; 'auto' dan konsentrasi di luar tabel itu),
 * `si` dan `us` = satuan preset. Urutan = urutan baris di Settings.
 * @type {readonly {id:string, options:readonly string[], si:string, us:string}[]}
 */
export const QUANTITIES = Object.freeze([
  { id: 'pressure', options: ['bar', 'kPa', 'MPa', 'psia'], si: 'bar', us: 'psia' },
  { id: 'temperature', options: ['K', 'C', 'F'], si: 'K', us: 'F' },
  { id: 'power', options: ['auto', 'kW', 'MW', 'hp'], si: 'auto', us: 'hp' },
  { id: 'specificEnergy', options: ['kJkg', 'Btulb'], si: 'kJkg', us: 'Btulb' },
  { id: 'heatRate', options: ['kJkWh', 'BtukWh'], si: 'kJkWh', us: 'BtukWh' },
  { id: 'specificFuel', options: ['gkWh', 'lbhph'], si: 'gkWh', us: 'lbhph' },
  { id: 'specificEmission', options: ['gkWh', 'lbMWh', 'ghph'], si: 'gkWh', us: 'lbMWh' },
  { id: 'specificHeat', options: ['kJkgK', 'BtulbR'], si: 'kJkgK', us: 'BtulbR' },
  { id: 'specificVolume', options: ['m3kg', 'ft3lb'], si: 'm3kg', us: 'ft3lb' },
  { id: 'length', options: ['mm', 'in'], si: 'mm', us: 'in' },
  { id: 'volume', options: ['L', 'cm3', 'in3'], si: 'L', us: 'in3' },
  { id: 'volumeFlow', options: ['m3s', 'm3h', 'cfm'], si: 'm3s', us: 'cfm' },
  { id: 'massFlow', options: ['kgs', 'kgh', 'lbs', 'lbh'], si: 'kgs', us: 'lbs' },
  { id: 'molarMass', options: ['kgkmol', 'lblbmol'], si: 'kgkmol', us: 'lblbmol' },
  { id: 'concentration', options: ['auto', 'ppmvd', 'mgNm3'], si: 'auto', us: 'auto' },
]);
const BY_ID = Object.freeze(Object.fromEntries(QUANTITIES.map((q) => [q.id, q])));
export const isQuantity = (id) => id in BY_ID;
/** Id satuan sah untuk besaran ini? */
export const isUnitOf = (qty, unit) => !!BY_ID[qty] && BY_ID[qty].options.includes(unit);
/** Satuan semua besaran untuk satu preset. @param {'si'|'us'} preset */
export const presetUnits = (preset) => Object.fromEntries(QUANTITIES.map((q) => [q.id, preset === 'us' ? q.us : q.si]));
/** Besaran yang punya tabel konversi di UNIT_DEFS (selain konsentrasi); dipakai uji konsistensi. */
export const convertibleQuantities = () => QUANTITIES.filter((q) => q.id in UNIT_DEFS).map((q) => q.id);

/** @returns {Storage|null} */
export function unitsStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/**
 * Bendera UNITS_UI. `?units=1` / `?units=0` di alamat menyalakan / mematikan dan disimpan; selain itu kunci 'etel:unitsUi'.
 * @param {Storage|null} storage @param {string} [search] location.search
 */
export function resolveUnitsUi(storage, search = globalThis.location?.search ?? '') {
  let q = null;
  try { q = new URLSearchParams(search).get('units'); } catch { /* alamat aneh: abaikan */ }
  try {
    if (q === '1') { storage?.setItem(UNITS_UI_KEY, '1'); return true; }
    if (q === '0') { storage?.removeItem(UNITS_UI_KEY); return false; }
    return storage?.getItem(UNITS_UI_KEY) === '1';
  } catch { return q === '1'; }
}

/** Baca pilihan tersimpan; isian tidak sah dibuang. @param {Storage|null} storage @returns {{preset:'si'|'us', overrides:Record<string,string>}} */
export function readUnitsChoice(storage) {
  const out = { preset: /** @type {'si'|'us'} */ ('si'), overrides: /** @type {Record<string,string>} */ ({}) };
  try {
    const raw = storage?.getItem(UNITS_KEY);
    if (!raw) return out;
    const j = JSON.parse(raw);
    if (j && PRESET_IDS.includes(j.preset)) out.preset = j.preset;
    const base = presetUnits(out.preset);
    if (j && j.overrides && typeof j.overrides === 'object') {
      for (const [q, u] of Object.entries(j.overrides)) if (isUnitOf(q, u) && u !== base[q]) out.overrides[q] = u;
    }
  } catch { /* storage diblokir atau JSON rusak: pakai bawaan */ }
  return out;
}

/** @param {Storage|null} storage @param {{preset:string, overrides:Record<string,string>}} c @returns {boolean} tersimpan */
export function writeUnitsChoice(storage, c) {
  try {
    if (c.preset === 'si' && !Object.keys(c.overrides).length) { storage?.removeItem(UNITS_KEY); return !!storage; }
    storage?.setItem(UNITS_KEY, JSON.stringify({ v: 1, preset: c.preset, overrides: c.overrides }));
    return !!storage;
  } catch { return false; }
}

/** @param {Storage|null} [storage] @param {{enabled?:boolean}} [o] enabled = bendera UNITS_UI (bawaan: resolveUnitsUi) */
export function createUnitsStore(storage = unitsStorage(), o = {}) {
  const enabled = o.enabled ?? resolveUnitsUi(storage);
  let choice = readUnitsChoice(storage);
  const subs = new Set();
  const emit = () => { for (const fn of [...subs]) fn(); };
  const save = () => writeUnitsChoice(storage, choice);
  const same = (a, b) => a.preset === b.preset && JSON.stringify(a.overrides) === JSON.stringify(b.overrides);
  return {
    /** Bendera UNITS_UI menyala? */
    get enabled() { return enabled; },
    get preset() { return choice.preset; },
    get overrides() { return { ...choice.overrides }; },
    /** Ada override per besaran (Settings menandai "Custom")? */
    get custom() { return Object.keys(choice.overrides).length > 0; },
    /** Satuan efektif besaran (id satuan atau 'auto'). Bendera mati → SI bawaan. @param {string} qty */
    unit(qty) {
      const q = BY_ID[qty];
      if (!q) throw new Error(`besaran tidak dikenal: ${qty}`);
      if (!enabled) return q.si;
      return choice.overrides[qty] ?? (choice.preset === 'us' ? q.us : q.si);
    },
    /** Pilih preset: semua besaran mengikuti preset, override dihapus. @param {'si'|'us'} p @returns {boolean} tersimpan */
    setPreset(p) {
      if (!PRESET_IDS.includes(p)) return false;
      if (choice.preset === p && !Object.keys(choice.overrides).length) return true;
      choice = { preset: p, overrides: {} };
      const ok = save(); emit(); return ok;
    },
    /** Pilih satuan satu besaran (override). Sama dengan satuan preset → override dihapus. @returns {boolean} tersimpan */
    setUnit(qty, unit) {
      if (!isUnitOf(qty, unit)) return false;
      const base = presetUnits(choice.preset)[qty];
      const overrides = { ...choice.overrides };
      if (unit === base) delete overrides[qty]; else overrides[qty] = unit;
      if (JSON.stringify(overrides) === JSON.stringify(choice.overrides)) return true;
      choice = { preset: choice.preset, overrides };
      const ok = save(); emit(); return ok;
    },
    /** "Back to preset": hapus override, preset tetap. */
    clearOverrides() {
      if (!Object.keys(choice.overrides).length) return true;
      choice = { preset: choice.preset, overrides: {} };
      const ok = save(); emit(); return ok;
    },
    /** Baca ulang dari storage (event `storage` dari jendela lain, mis. jendela presenter). @returns {boolean} berubah */
    reload() {
      const c = readUnitsChoice(storage);
      if (same(c, choice)) return false;
      choice = c; emit(); return true;
    },
    /** @param {()=>void} fn @returns {() => void} */
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

/** Salinan global yang dipakai aplikasi. */
export const unitsStore = createUnitsStore();
