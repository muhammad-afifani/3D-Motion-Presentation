/**
 * relabel.js — teks komponen yang dibuat sekali (nav, header, jendela presenter) ikut bahasa tanpa memuat ulang (Paket D).
 * Komponen mendaftarkan getter teks/atribut lewat satu relabeler; `run()` memanggil semuanya lagi setelah STR berganti
 * bahasa (main.js / presenter.js). Hanya menyentuh DOM bila teks berubah; tidak dipakai di jalur per-frame.
 */

export function createRelabeler() {
  /** @type {(() => void)[]} */
  const jobs = [];
  const add = (fn) => { fn(); jobs.push(fn); };
  return {
    /** textContent = get() */
    text(el, get) { add(() => { const t = get(); if (el.textContent !== t) el.textContent = t; }); },
    /** Node teks (mis. di dalam <p> yang juga berisi tombol). */
    node(node, get) { add(() => { const t = get(); if (node.data !== t) node.data = t; }); },
    /** setAttribute(name, get()); null / undefined menghapus atribut. */
    attr(el, name, get) {
      add(() => { const v = get(); if (v == null) el.removeAttribute(name); else if (el.getAttribute(name) !== String(v)) el.setAttribute(name, String(v)); });
    },
    /** dataset[key] = get() */
    data(el, key, get) { add(() => { const v = get(); if (el.dataset[key] !== v) el.dataset[key] = v; }); },
    /** Pekerjaan bebas (mis. innerHTML dari keadaan terkini). */
    job: add,
    run() { for (const fn of jobs) fn(); },
  };
}
