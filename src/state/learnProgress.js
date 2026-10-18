/**
 * learnProgress.js — progres pelajaran Learn (M11 Step 02): array id pelajaran yang selesai di localStorage
 * 'etel:learnDone'. Semua akses storage dibungkus try/catch: storage kosong, rusak, atau melempar → semua belum
 * selesai, tanpa galat; tulis gagal → progres tetap berlaku selama sesi (di memori). Tanpa skor jawaban soal.
 */
export const LEARN_DONE_KEY = 'etel:learnDone';

/** @returns {Storage|null} */
export function progressStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** @param {Storage|null} storage @returns {string[]} id unik (string) */
export function readDone(storage) {
  try {
    const raw = storage?.getItem(LEARN_DONE_KEY);
    if (!raw) return [];
    const j = JSON.parse(raw);
    return Array.isArray(j) ? [...new Set(j.filter((x) => typeof x === 'string' && x.length > 0 && x.length <= 64))] : [];
  } catch { return []; }
}

/** @param {Storage|null} storage @param {Iterable<string>} ids @returns {boolean} tersimpan */
export function writeDone(storage, ids) {
  try { storage?.setItem(LEARN_DONE_KEY, JSON.stringify([...ids])); return !!storage; } catch { return false; }
}

/** @param {Storage|null} storage @returns {boolean} */
export function clearDone(storage) {
  try { storage?.removeItem(LEARN_DONE_KEY); return !!storage; } catch { return false; }
}

/**
 * Penyimpan progres (state di memori + storage). @param {Storage|null} [storage]
 */
export function createLearnProgress(storage = progressStorage()) {
  let done = new Set(readDone(storage));
  const subs = new Set();
  const emit = () => { for (const fn of [...subs]) fn(); };
  return {
    has: (id) => done.has(id),
    /** Hanya id yang dikenal (daftar pelajaran saat ini) yang dihitung. @param {Iterable<string>} known */
    count(known) { let n = 0; for (const id of known) if (done.has(id)) n++; return n; },
    get ids() { return [...done]; },
    /** @param {string} id @param {boolean} on */
    mark(id, on) {
      if (on === done.has(id)) return;
      done = new Set(done);
      if (on) done.add(id); else done.delete(id);
      writeDone(storage, done);
      emit();
    },
    reset() { done = new Set(); clearDone(storage); emit(); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
