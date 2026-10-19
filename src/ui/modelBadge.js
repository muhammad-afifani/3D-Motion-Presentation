/**
 * Lencana validasi model: menjalankan selfTest() thermo.js saat start.
 * Hijau "Model OK · n/n" bila semua lulus, merah bila ada yang gagal (nama tes di tooltip).
 */
import { selfTest } from '../model/thermo.js';
import { STR } from './strings.js';

const last = new WeakMap();

/** Teks lencana dari hasil uji terakhir (dipanggil lagi saat bahasa berubah). @param {HTMLElement} el */
export function relabelModelBadge(el) {
  const res = last.get(el);
  if (!res) return;
  const total = res.passed + res.failed, ok = res.failed === 0;
  el.textContent = ok ? STR.app.badge.ok(res.passed, total) : STR.app.badge.fail(res.failed, total);
  const failed = res.results.filter((r) => !r.ok).map((r) => `✗ ${r.name}`);
  el.title = ok ? STR.app.badge.okTip(res.passed) : failed.join('\n');
}

/** @param {HTMLElement} el */
export function mountModelBadge(el) {
  let res;
  try {
    res = selfTest();
  } catch (err) {
    res = { passed: 0, failed: 1, results: [{ name: String(err), ok: false }] };
  }
  const total = res.passed + res.failed;
  const ok = res.failed === 0;
  el.classList.add('badge', ok ? 'badge--ok' : 'badge--fail');
  last.set(el, res);
  relabelModelBadge(el);
  el.setAttribute('role', 'status');
  return res;
}
