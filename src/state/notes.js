/**
 * notes.js — opsi "Hide working notes" (Settings ⚙). Kunci localStorage 'etel:hideNotes' ('hide' | 'show'; semua akses
 * try/catch). Tanpa pilihan tersimpan: catatan tampil di Explore dan tersembunyi di Present; setelah pengguna memilih,
 * pilihan itu berlaku di kedua mode ("Use the default" menghapusnya). Murni tampilan: tidak masuk store model.
 *
 * Penyembunyi tunggal: class `hide-notes` di <body> + aturan CSS `body.hide-notes [data-note] { display: none }`.
 * Hanya elemen yang diberi markNote() (catatan kerja: banner draf, tanda Draft, "to verify" / "locator not verified",
 * "from Learn", catatan draf Formation) yang bisa hilang. Label kejujuran model (indicative, tag Basis, basis O₂ dan
 * volume, banner "Transcribed from the published tables…") TIDAK PERNAH diberi markNote (dijaga tests/notes.test.js).
 */
export const NOTES_KEY = 'etel:hideNotes';
export const NOTES_CHOICES = Object.freeze(['hide', 'show']);

/** @returns {Storage|null} */
export function notesStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** @param {Storage|null} storage @returns {'hide'|'show'|null} pilihan tersimpan */
export function readNotesChoice(storage) {
  try {
    const v = storage?.getItem(NOTES_KEY);
    if (NOTES_CHOICES.includes(v)) return /** @type {'hide'|'show'} */ (v);
  } catch { /* storage diblokir */ }
  return null;
}

/** @param {Storage|null} storage @param {'hide'|'show'|null} choice null = hapus (kembali ke bawaan) @returns {boolean} tersimpan */
export function writeNotesChoice(storage, choice) {
  try {
    if (choice == null) { storage?.removeItem(NOTES_KEY); return !!storage; }
    if (!NOTES_CHOICES.includes(choice)) return false;
    storage?.setItem(NOTES_KEY, choice);
    return !!storage;
  } catch { return false; }
}

/** Catatan tersembunyi? Pilihan tersimpan menang; tanpa pilihan: hanya di Present. @param {'hide'|'show'|null} choice @param {'explore'|'present'} mode */
export const effectiveHide = (choice, mode) => (choice ? choice === 'hide' : mode === 'present');

/** @param {Storage|null} [storage] */
export function createNotesStore(storage = notesStorage()) {
  let choice = readNotesChoice(storage);
  const subs = new Set();
  const emit = () => { for (const fn of [...subs]) fn(choice); };
  return {
    get choice() { return choice; },
    /** @param {'explore'|'present'} mode */
    hide(mode) { return effectiveHide(choice, mode); },
    /** @param {'hide'|'show'|null} c @returns {boolean} tersimpan */
    set(c) {
      const v = NOTES_CHOICES.includes(c) ? c : null;
      if (v === choice) return true;
      choice = v;
      const ok = writeNotesChoice(storage, v);
      emit();
      return ok;
    },
    /** @param {(c:'hide'|'show'|null)=>void} fn @returns {() => void} */
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

export const notesStore = createNotesStore();

/** Tandai satu elemen sebagai catatan kerja (disembunyikan oleh body.hide-notes). @template {HTMLElement} T @param {T} el @returns {T} */
export function markNote(el) { el.dataset.note = ''; return el; }
