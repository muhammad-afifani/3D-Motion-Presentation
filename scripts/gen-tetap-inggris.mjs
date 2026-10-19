// Menyusun bagian "Tetap Inggris" docs/PADANAN_ISTILAH.md dari docs/tetap_inggris.json (satu sumber data).
// Pakai: node scripts/gen-tetap-inggris.mjs          (menulis berkas)
//        node scripts/gen-tetap-inggris.mjs --check  (gagal bila berkas tidak sama; dipakai tests/i18n.test.js lewat renderKeepEnglish)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('..', import.meta.url);
export const START = '<!-- tetap-inggris:mulai (dibuat oleh scripts/gen-tetap-inggris.mjs dari docs/tetap_inggris.json; jangan diedit tangan) -->';
export const END = '<!-- tetap-inggris:selesai -->';
const PADANAN_LABEL = { sesuai: 'sesuai', menyimpang: '**MENYIMPANG**', 'tidak-diatur': 'tidak diatur tabel ini' };

/** @param {{groups:any[]}} data @returns {string} blok Markdown antara penanda (tanpa penanda) */
export function renderKeepEnglish(data) {
  const code = (xs) => xs.map((x) => `\`${x}\``).join(', ');
  const out = [];
  for (const g of data.groups) {
    out.push(`### ${g.title}`, '', `- Alasan: ${g.reason}`, `- Terhadap tabel PADANAN di bawah: ${PADANAN_LABEL[g.padanan]}${g.padananNote ? `. ${g.padananNote}` : ''}`);
    if (g.texts?.length) out.push(`- Teks utuh (sisi id sengaja sama dengan en): ${code(g.texts)}`);
    if (g.paths?.length) out.push(`- Fungsi teks: ${code(g.paths)}`);
    if (g.inline?.length) out.push(`- Dipakai di dalam kalimat (hanya dicatat): ${code(g.inline)}`);
    out.push('');
  }
  return out.join('\n').trimEnd();
}

export function applyToDoc(doc, data) {
  const a = doc.indexOf(START), b = doc.indexOf(END);
  if (a < 0 || b < a) throw new Error('penanda tetap-inggris tidak ditemukan di PADANAN_ISTILAH.md');
  return `${doc.slice(0, a)}${START}\n\n${renderKeepEnglish(data)}\n\n${doc.slice(b)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const data = JSON.parse(readFileSync(new URL('docs/tetap_inggris.json', ROOT), 'utf8'));
  const path = new URL('docs/PADANAN_ISTILAH.md', ROOT);
  const doc = readFileSync(path, 'utf8'), next = applyToDoc(doc, data);
  if (process.argv.includes('--check')) { if (doc !== next) { console.error('PADANAN_ISTILAH.md tidak sinkron dengan docs/tetap_inggris.json'); process.exit(1); } } else writeFileSync(path, next);
}
