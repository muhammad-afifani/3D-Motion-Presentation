/**
 * settingsPanel.js — panel Settings kecil (ikon gir ⚙ di header kanan, popover bukan halaman). Saat ini satu seksi
 * "Display" dengan sakelar "Hide working notes" (state/notes.js, kunci etel:hideNotes). Seksi disusun dari daftar SECTIONS
 * ({ id, title, build }) agar pengaturan lain (mis. satuan) tinggal ditambahkan. Sakelar bahasa dan tema tetap di header.
 * Perilaku: non-modal, Esc (fase capture, hanya bila terbuka) dan klik di luar menutup, fokus masuk ke panel dan kembali
 * ke ikon setelah Esc, aria-expanded / aria-controls / aria-labelledby, membuka panel menutup kartu bantuan. Tersembunyi di
 * Present (CSS; main.js menutupnya) dan tidak ikut PNG (data-snap-skip). Teks dua bahasa lewat tr() dan langStore.
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';
import { langStore } from '../state/langStore.js';
import { notesStore } from '../state/notes.js';
import { closeHelp } from './helpPopover.js';

const G = STR.bi.settings;
const GAP = 8, EDGE = 8;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/**
 * Seksi panel. build(container, ctx) mengisi container dan mengembalikan fungsi paint() yang dipanggil saat bahasa atau
 * pilihan berubah. Seksi baru (satuan, dll.) cukup ditambahkan ke daftar ini.
 * @type {{id:string, title:{en:string,id:string}, build:(box:HTMLElement, ctx:{getMode:()=>'explore'|'present'})=>()=>void}[]}
 */
export const SECTIONS = [
  {
    id: 'display',
    title: G.display,
    build(box, ctx) {
      const row = h('div', 'set-row');
      const sw = h('button', 'set-switch');
      sw.type = 'button';
      sw.setAttribute('role', 'switch');
      const label = h('span', 'set-row__label');
      label.id = 'set-hide-notes-label';
      sw.setAttribute('aria-labelledby', label.id);
      sw.append(h('span', 'set-switch__knob'));
      row.append(sw, label);
      const desc = h('p', 'set-row__desc');
      const note = h('p', 'set-row__note');
      const reset = h('button', 'btn btn--sm set-row__reset');
      reset.type = 'button';
      box.append(row, desc, note, reset);
      sw.addEventListener('click', () => notesStore.set(notesStore.hide(ctx.getMode()) ? 'show' : 'hide'));
      reset.addEventListener('click', () => notesStore.set(null));
      return () => {
        const lang = langStore.lang;
        label.textContent = tr(G.hideNotes, lang);
        desc.textContent = tr(G.hideNotesDesc, lang);
        note.textContent = tr(G.defaultNote, lang);
        reset.textContent = tr(G.useDefault, lang);
        reset.hidden = notesStore.choice == null;
        const on = notesStore.hide(ctx.getMode());
        sw.setAttribute('aria-checked', String(on));
        sw.classList.toggle('is-on', on);
      };
    },
  },
];

/** @param {{getMode:()=>'explore'|'present'}} o @returns {{el:HTMLButtonElement, close:(restoreFocus?:boolean)=>void, readonly open:boolean, dispose:()=>void}} */
export function createSettingsPanel({ getMode }) {
  const btn = h('button', 'settings-btn');
  btn.type = 'button';
  btn.dataset.snapSkip = '';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  const glyph = h('span', 'settings-btn__glyph');
  glyph.setAttribute('aria-hidden', 'true');
  btn.append(glyph);

  const card = h('div', 'settings-card');
  card.id = 'settings-card';
  card.hidden = true;
  card.tabIndex = -1;
  card.dataset.snapSkip = '';
  card.setAttribute('role', 'dialog');
  const title = h('h2', 'settings-card__title');
  title.id = 'settings-title';
  card.setAttribute('aria-labelledby', title.id);
  const body = h('div', 'settings-card__body');
  const hint = h('p', 'set-row__note settings-card__hint');
  card.append(title, body, hint);
  document.body.append(card);
  btn.setAttribute('aria-controls', card.id);

  const paints = [];
  for (const s of SECTIONS) {
    const sec = h('section', 'settings-card__sec');
    sec.dataset.section = s.id;
    const hd = h('h3', 'settings-card__sec-title');
    sec.append(hd);
    const paint = s.build(sec, { getMode });
    body.append(sec);
    paints.push(() => { hd.textContent = tr(s.title, langStore.lang); paint(); });
  }
  const paintAll = () => {
    const lang = langStore.lang;
    card.lang = lang;
    title.textContent = tr(G.title, lang);
    hint.textContent = tr(G.presentHint, lang);
    btn.setAttribute('aria-label', tr(G.tip, lang));
    btn.dataset.tip = tr(G.tip, lang);
    glyph.textContent = tr(G.icon, lang);
    for (const p of paints) p();
  };
  paintAll();
  const unsubLang = langStore.subscribe(paintAll);
  const unsubNotes = notesStore.subscribe(paintAll);

  const place = () => {
    if (card.hidden) return;
    const r = btn.getBoundingClientRect();
    const w = card.offsetWidth, hh = card.offsetHeight;
    const x = Math.max(EDGE, Math.min(window.innerWidth - w - EDGE, r.right - w));
    const y = Math.max(EDGE, Math.min(window.innerHeight - hh - EDGE, r.bottom + GAP));
    card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };
  const isOpen = () => !card.hidden;
  function onKey(e) {
    if (e.key !== 'Escape' || !isOpen()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    close(true);
  }
  function onDown(e) {
    if (!isOpen()) return;
    const t = e.target;
    if (t instanceof Node && (card.contains(t) || btn.contains(t))) return;
    close(false);
  }
  const onResize = () => place();
  function open() {
    closeHelp(false);
    paintAll();
    card.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onResize);
    place();
    card.focus({ preventScroll: true });
  }
  function close(restoreFocus = false) {
    if (!isOpen()) return;
    card.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    window.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('resize', onResize);
    if (restoreFocus) btn.focus({ preventScroll: true });
  }
  btn.addEventListener('click', () => { if (isOpen()) close(true); else open(); });

  return {
    el: btn,
    close,
    get open() { return isOpen(); },
    dispose() { close(); unsubLang(); unsubNotes(); card.remove(); btn.remove(); },
  };
}
