/**
 * helpButton.js — tombol ⓘ bantuan (Bagian C) untuk HUD, kontrol, panel, navigasi, dan header. Tampilan 18 px dengan area
 * klik 24×24 px (padding transparan), gaya sama dengan ⓘ grafik (.chart__guide). Tooltip pendek: kalimat "what" bila help.json
 * sudah dimuat, selain itu kalimat generik. Klik / Enter / Spasi membuka kartu (ui/helpPopover.js). Tersembunyi di Present
 * (CSS) dan tidak ikut PNG (data-snap-skip). Label dua bahasa lewat tr() dan langStore.
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';
import { langStore } from '../state/langStore.js';
import { helpOf, helpItem, onHelp } from '../state/helpStore.js';
import { toggleHelp } from './helpPopover.js';

const G = STR.bi.help;
/** @type {Set<HTMLButtonElement>} */
const live = new Set();

function paint(btn) {
  const lang = langStore.lang;
  const it = helpItem(btn.dataset.help);
  btn.setAttribute('aria-label', tr(G.label, lang));
  btn.dataset.tip = it ? tr(it.what, lang) : tr(G.tip, lang);
  btn.querySelector('.help-btn__dot').textContent = tr(G.icon, lang);
}
function repaintAll() { for (const b of live) { if (b.isConnected) paint(b); else live.delete(b); } }
let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  langStore.subscribe(repaintAll);
  onHelp(repaintAll);
}

/**
 * @param {string} id id konsep di content/help.json (state/helpIds.js)
 * @param {{describes?:HTMLElement, cls?:string}} [o] describes = elemen yang dijelaskan (aria-describedby saat kartu terbuka)
 * @returns {{el:HTMLButtonElement}}
 */
export function createHelpButton(id, o = {}) {
  wire();
  helpOf(); // mulai memuat help.json (kecil) agar tooltip dan kartu siap
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `help-btn${o.cls ? ` ${o.cls}` : ''}`;
  el.dataset.help = id;
  el.dataset.snapSkip = '';
  el.setAttribute('aria-haspopup', 'dialog');
  el.setAttribute('aria-expanded', 'false');
  const dot = document.createElement('span');
  dot.className = 'help-btn__dot';
  dot.setAttribute('aria-hidden', 'true');
  el.append(dot);
  paint(el);
  live.add(el);
  if (live.size > 600) repaintAll(); // buang tombol yang sudah terlepas dari DOM
  el.addEventListener('click', (e) => { e.stopPropagation(); toggleHelp(el, id, o.describes); });
  // Enter / Spasi pada ⓘ tidak boleh sampai ke tombol cepat global (mis. Spasi = jeda)
  el.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation(); });
  return { el };
}
