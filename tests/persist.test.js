// Persistensi ringan (M8a): localStorage dalam try/catch, aplikasi tetap benar tanpanya; kalibrasi tidak disimpan.
import { describe, it, expect } from 'vitest';
import { safeStorage, readSaved, writeSaved, createPersistence, PERSIST_KEY, PERSIST_FIELDS, persistDefaults } from '../src/state/persist.js';
import { createStore, limitsInitialState, basisInitialState, calibInitialState, closingInitialState, policyInitialState, isDefaultCalib } from '../src/state/store.js';

const SCENES = Array.from({ length: 11 }, (_, i) => i + 1);
const fakeStorage = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const blocked = () => ({ getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); }, removeItem() { throw new Error('SecurityError'); } });
const newStore = () => createStore({ ...limitsInitialState(), ...basisInitialState(), ...calibInitialState(), ...closingInitialState(), ...policyInitialState() });

describe('safeStorage', () => {
  it('null bila getter melempar (localStorage diblokir) atau getItem melempar', () => {
    expect(safeStorage(() => { throw new Error('SecurityError'); })).toBeNull();
    expect(safeStorage(() => blocked())).toBeNull();
    expect(safeStorage(() => undefined)).toBeNull();
    const s = fakeStorage();
    expect(safeStorage(() => s)).toBe(s);
  });
  it('lingkungan tanpa localStorage (node) → null, tanpa throw', () => {
    expect(() => safeStorage()).not.toThrow();
  });
});

describe('localStorage diblokir: aplikasi tetap benar', () => {
  it('createPersistence dengan storage null: default, tanpa throw, clear/setScene aman', () => {
    const store = newStore();
    const p = createPersistence(store, { storage: safeStorage(() => blocked()), sceneNumbers: SCENES });
    expect(p.available).toBe(false);
    expect(p.startScene).toBe(1);
    expect(() => { store.set({ limNOx: 25 }); p.setScene(6); p.resetStartScene(); }).not.toThrow();
    expect(store.get().limNOx).toBe(25);           // berlaku selama sesi
    expect(() => p.clear()).not.toThrow();
    expect(store.get().limNOx).toBeNull();
  });
  it('storage yang melempar saat setItem (kuota penuh) tidak menggagalkan store.set', () => {
    const s = { ...fakeStorage(), setItem() { throw new Error('QuotaExceededError'); } };
    const store = newStore();
    createPersistence(store, { storage: s, sceneNumbers: SCENES });
    expect(() => store.set({ limCO: 40 })).not.toThrow();
    expect(writeSaved(s, store.get(), 3)).toBe(false);
  });
});

describe('simpan → muat ulang', () => {
  it('batas, satuan, basis, opsi Scene 11, scene awal tersimpan; kalibrasi TIDAK', () => {
    const s = fakeStorage();
    const a = newStore();
    const pa = createPersistence(a, { storage: s, sceneNumbers: SCENES });
    a.set({ limNOx: 25, limCO: 50, limUnit: 'mg', emRefO2: 3, emTrefC: 25, closingVisible: { cems: false } });
    a.set({ calEngine: { diesel: 0.3, gas: 0.2 } });
    pa.setScene(6);
    const saved = JSON.parse(s.getItem(PERSIST_KEY));
    expect(Object.keys(saved.data).sort()).toEqual([...PERSIST_FIELDS].sort());
    expect(JSON.stringify(saved)).not.toMatch(/cal/i);

    const b = newStore();
    const pb = createPersistence(b, { storage: s, sceneNumbers: SCENES });
    const st = b.get();
    expect([st.limNOx, st.limCO, st.limUnit, st.emRefO2, st.emTrefC]).toEqual([25, 50, 'mg', 3, 25]);
    expect(st.closingVisible).toEqual({ cems: false });
    expect(pb.startScene).toBe(6);
    expect(isDefaultCalib(st)).toBe(true);          // kalibrasi selalu mulai dari default
  });
  it('R (resetStartScene) → scene awal berikutnya Scene 1; nilai lain tetap', () => {
    const s = fakeStorage();
    const a = newStore();
    const pa = createPersistence(a, { storage: s, sceneNumbers: SCENES });
    a.set({ limNOx: 30 });
    pa.setScene(8);
    pa.resetStartScene();
    const b = newStore();
    expect(createPersistence(b, { storage: s, sceneNumbers: SCENES }).startScene).toBe(1);
    expect(b.get().limNOx).toBe(30);
  });
  it('Reset saved settings: data dihapus, bidang ke default, scene awal 1', () => {
    const s = fakeStorage();
    const a = newStore();
    const pa = createPersistence(a, { storage: s, sceneNumbers: SCENES });
    a.set({ limNOx: 30, emRefO2: 3, closingVisible: { cems: false } });
    pa.setScene(9);
    pa.clear();
    expect(s.getItem(PERSIST_KEY)).toBeNull();
    const st = a.get();
    for (const [k, v] of Object.entries(persistDefaults())) expect(st[k]).toEqual(v);
    expect(createPersistence(newStore(), { storage: s, sceneNumbers: SCENES }).startScene).toBe(1);
  });
});

describe('data rusak / tidak valid diabaikan', () => {
  const load = (raw) => { const s = fakeStorage(); s.setItem(PERSIST_KEY, raw); return readSaved(s, SCENES); };
  it('JSON rusak, versi lain, bukan objek → kosong, scene 1', () => {
    for (const raw of ['{rusak', '{"v":2,"data":{"limNOx":5}}', '"teks"', 'null']) {
      const r = load(raw);
      expect(r.patch).toEqual({});
      expect(r.startScene).toBe(1);
    }
  });
  it('nilai di luar rentang dibersihkan lewat patch store', () => {
    const r = load(JSON.stringify({ v: 1, scene: 99, data: { limNOx: -5, limCO: 'abc', limUnit: 'kg', emRefO2: 50, emTrefC: 10, closingVisible: { a: true, b: false, c: 'x' } } }));
    expect(r.patch.limNOx).toBeNull();
    expect(r.patch.limCO).toBeNull();
    expect(r.patch.limUnit).toBeUndefined();
    expect(r.patch.emRefO2).toBe(20);               // di-clamp ke 3–20 %
    expect(r.patch.emTrefC).toBeUndefined();        // hanya 0 / 25 °C
    expect(r.patch.closingVisible).toEqual({ b: false });
    expect(r.startScene).toBe(1);
  });
});
