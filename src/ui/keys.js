/**
 * keys.js — aturan tombol cepat global (H, ?, G, P, S, Q, B, K, F, R, Spasi, panah, …).
 * Tombol cepat TIDAK aktif saat fokus ada di kolom isian: <input> teks/angka, <textarea>, <select>, atau elemen
 * contenteditable. Slider (<input type="range">) tetap mengizinkan tombol cepat (panahnya sudah ditangani slider).
 */

/** @param {any} t event.target (atau document.activeElement) @returns {boolean} true = sedang mengetik, abaikan tombol cepat */
export function isTypingTarget(t) {
  if (!t || typeof t !== 'object') return false;
  if (t.isContentEditable) return true;
  const tag = String(t.tagName ?? '').toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') return String(t.type ?? '').toLowerCase() !== 'range';
  return false;
}

/** Tombol cepat satu huruf/simbol di main.js (selain navigasi panah dan Spasi). Dijaga tes agar tidak bentrok. */
export const GLOBAL_KEYS = Object.freeze(['f', 'r', '1', '2', '3', '4', 'h', '?', 'g', 'm', 'p', 's', 'q', 'b', 'k']);
