/**
 * Lencana validasi model: menjalankan selfTest() thermo.js saat start.
 * Hijau "Model OK · n/n" bila semua lulus, merah bila ada yang gagal (nama tes di tooltip).
 */
import { selfTest } from '../model/thermo.js';

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
  el.textContent = ok ? `Model OK · ${res.passed}/${total}` : `Model GAGAL · ${res.failed}/${total}`;
  const failed = res.results.filter((r) => !r.ok).map((r) => `✗ ${r.name}`);
  el.title = ok ? `selfTest() thermo.js: ${res.passed} tes lulus` : failed.join('\n');
  el.setAttribute('role', 'status');
  return res;
}
