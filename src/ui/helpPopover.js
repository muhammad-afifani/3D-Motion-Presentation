/**
 * helpPopover.js — kartu bantuan kecil (Bagian C), satu untuk seluruh aplikasi. Dibuka oleh tombol ⓘ (ui/helpButton.js):
 * "what" (tebal, menjadi nama dialog lewat aria-labelledby), "how", tautan opsional "Read more" (Glossary / Lesson) dan
 * tanda "Draft" selama help.json reviewed:false. Latar kaca seperti kotak overlay lain; posisi otomatis (di bawah ⓘ,
 * di atas bila tidak muat, dijepit ke tepi layar). Esc menutup (fase capture, hanya bila terbuka) dan mengembalikan
 * fokus ke ⓘ; klik di luar menutup; membuka kartu lain menutup yang ini. Tersembunyi di Present (ditutup main.js) dan
 * tidak ikut PNG (data-snap-skip). Tidak menghitung apa pun: isi dari content/help.json, label dari STR.bi.help.
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';
import { langStore } from '../state/langStore.js';
import { helpReady } from '../state/helpStore.js';
import { contentOf } from '../state/contentStore.js';
import { setSceneOrigin } from '../state/backToScene.js';
import { markNote } from '../state/notes.js';

const G = STR.bi.help;
const GAP = 8, EDGE = 8;

/** @type {{onGlossary?:(termId:string)=>void}} */
const handlers = {};
/** main.js: membuka Glossary pada satu istilah (overlay di atas scene). */
export function setHelpHandlers(h) { Object.assign(handlers, h); }

let card = null, anchor = null, anchorId = null, host = null, raf = 0, listening = false, seq = 0, token = 0;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function ensureCard() {
  if (card) return card;
  card = h('div', 'help-card');
  card.id = 'help-card';
  card.setAttribute('role', 'dialog');
  card.tabIndex = -1;
  card.hidden = true;
  card.dataset.snapSkip = '';
  document.body.append(card);
  return card;
}

function place() {
  if (!card || card.hidden || !anchor) return;
  const r = anchor.getBoundingClientRect();
  const w = card.offsetWidth, hh = card.offsetHeight;
  let x = r.left + r.width / 2 - w / 2;
  x = Math.max(EDGE, Math.min(window.innerWidth - w - EDGE, x));
  let y = r.bottom + GAP;
  if (y + hh > window.innerHeight - EDGE) y = r.top - hh - GAP;
  y = Math.max(EDGE, Math.min(window.innerHeight - hh - EDGE, y));
  card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function termName(id) {
  const t = contentOf('glossary').data?.terms?.find((x) => x.id === id);
  return t?.term ?? id;
}

function render(item, reviewed) {
  const lang = langStore.lang;
  card.lang = lang;
  card.replaceChildren();
  const whatId = `help-what-${++seq}`;
  card.setAttribute('aria-labelledby', whatId);
  if (!item) { const p = h('p', 'help-card__what', tr(G.missing, lang)); p.id = whatId; card.append(p); return; }
  const what = h('p', 'help-card__what', tr(item.what, lang));
  what.id = whatId;
  card.append(what, h('p', 'help-card__how', tr(item.how, lang)));
  const terms = item.glossary ?? [];
  if (terms.length || item.lesson) {
    const more = h('div', 'help-card__more');
    more.append(h('span', 'help-card__more-label', `${tr(G.more, lang)}:`));
    for (const id of terms) {
      const b = h('button', 'help-card__link', `${tr(G.glossary, lang)} · ${termName(id)}`);
      b.type = 'button';
      b.dataset.term = id;
      b.addEventListener('click', () => { closeHelp(); handlers.onGlossary?.(id); });
      more.append(b);
    }
    if (item.lesson) {
      const a = h('a', 'help-card__link', tr(G.lesson, lang));
      a.href = `#/learn/${item.lesson}`;
      a.dataset.lesson = item.lesson;
      a.addEventListener('click', () => { setSceneOrigin(window.location.hash, item.lesson); closeHelp(false); });
      more.append(a);
    }
    card.append(more);
  }
  if (!reviewed) {
    const d = markNote(h('span', 'help-card__draft', tr(G.draft, lang)));
    d.dataset.tip = tr(G.draftTip, lang);
    card.append(d);
  }
}

function onKey(e) {
  if (e.key !== 'Escape' || !isOpen()) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  closeHelp();
}
function onDown(e) {
  if (!isOpen()) return;
  const t = e.target;
  if (t instanceof Node && (card.contains(t) || anchor?.contains(t))) return;
  closeHelp(false);
}
function watch() {
  if (!isOpen()) { raf = 0; return; }
  if (!anchor?.isConnected || anchor.checkVisibility?.() === false) { closeHelp(false); return; } // elemen hilang (scene/HUD dipasang ulang) atau disembunyikan
  place();
  raf = requestAnimationFrame(watch);
}
function listen(on) {
  if (on === listening) return;
  listening = on;
  const f = on ? 'addEventListener' : 'removeEventListener';
  window[f]('keydown', onKey, true);
  document[f]('pointerdown', onDown, true);
}
langStore.subscribe(() => { if (isOpen()) helpReady().then((r) => { if (isOpen()) { render(r?.data?.items?.[anchorId] ?? null, r?.data?.reviewed === true); place(); } }); });

export const isOpen = () => !!card && !card.hidden;
export const openFor = () => (isOpen() ? anchorId : null);

/**
 * Buka kartu untuk satu ⓘ. @param {HTMLElement} btn @param {string} id @param {HTMLElement} [describes] elemen yang dijelaskan
 */
export async function openHelp(btn, id, describes) {
  if (isOpen()) closeHelp(false);
  const my = ++token;
  ensureCard();
  anchor = btn; anchorId = id; host = describes ?? btn.parentElement;
  const r = await helpReady();
  if (my !== token || anchor !== btn) return; // ditutup atau diganti selagi memuat
  render(r?.data?.items?.[id] ?? null, r?.data?.reviewed === true);
  card.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  btn.setAttribute('aria-controls', card.id);
  host?.setAttribute('aria-describedby', card.id);
  listen(true);
  place();
  card.focus({ preventScroll: true });
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(watch);
}

/** Tutup kartu. @param {boolean} [restoreFocus] kembalikan fokus ke ⓘ (Esc) */
export function closeHelp(restoreFocus = true) {
  token++;
  const b = anchor, hst = host;
  anchor = null; anchorId = null; host = null;
  cancelAnimationFrame(raf); raf = 0;
  listen(false);
  if (card) { card.hidden = true; card.replaceChildren(); }
  if (b) { b.setAttribute('aria-expanded', 'false'); b.removeAttribute('aria-controls'); }
  hst?.removeAttribute('aria-describedby');
  if (restoreFocus && b?.isConnected) b.focus({ preventScroll: true });
}

/** Toggle untuk tombol yang sama. */
export function toggleHelp(btn, id, describes) {
  if (isOpen() && anchor === btn) closeHelp(true); else openHelp(btn, id, describes);
}
