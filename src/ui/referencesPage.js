/**
 * referencesPage.js — halaman References: semua sumber di balik model, dikelompokkan per jenis, dengan penanda locator.
 * Alamat: #/references (bisa dibuka langsung; selaras dengan deep link Step 06). Tombol di bilah atas dan tombol "?".
 * Data: content/references.json lewat content loader (editable saat runtime, fallback bawaan).
 * Hanya sumber di file itu yang tampil; locatorVerified hanya dibaca, tidak pernah diubah dari sini.
 */
import { STR } from './strings.js';
import { groupReferences, REFERENCES_HASH, isReferencesHash, referenceIdFromHash } from '../state/basisView.js';
import { loadContent, fallbackContent } from '../state/content.js';
import { BASIS_GROUPS } from '../model/basis.js';
import { markNote } from '../state/notes.js';
import { tl } from '../state/langStore.js';

const R = STR.basis.refs;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** Id kelompok Basis (BASIS_GROUPS) yang memuat salah satu fungsi pengutip. */
const groupsOf = (names) => Object.keys(BASIS_GROUPS).filter((g) => names.some((n) => BASIS_GROUPS[g].includes(n)));

/**
 * @param {HTMLElement} [parent]
 * @param {{win?: Window, homeHash?: () => string}} [opts] win = jendela untuk hash/riwayat (uji); homeHash = alamat saat
 *   halaman ditutup (Step 06: kembali ke #/scene/N); tanpa homeHash → alamat tanpa hash
 */
export function createReferencesPage(parent = document.body, { win = window, homeHash = null } = {}) {
  const el = h('div', 'refs');
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', R.title);
  const box = h('div', 'refs__box');
  el.appendChild(box);
  parent.appendChild(el);

  let data = fallbackContent('references'), alive = true, opener = null, onlyIntro = false;

  function render() {
    el.setAttribute('aria-label', R.title);
    box.replaceChildren();
    const head = h('div', 'refs__head');
    head.appendChild(h('h2', '', R.title));
    const close = h('button', 'btn btn--sm', R.close);
    close.type = 'button';
    close.addEventListener('click', () => api.setOpen(false));
    head.appendChild(close);
    box.appendChild(head);
    box.appendChild(h('p', 'refs__intro', R.intro));
    // M11: saring sumber pengantar (level 'intro', lencana "Start here")
    const filter = h('div', 'refs__filter');
    filter.setAttribute('role', 'group');
    filter.setAttribute('aria-label', R.show);
    filter.append(h('span', 'bcard__label', `${R.show}:`));
    for (const [val, label] of [[false, R.showAll], [true, R.showIntro]]) {
      const b = h('button', 'btn btn--sm refs__show', label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(onlyIntro === val));
      b.classList.toggle('is-on', onlyIntro === val);
      b.addEventListener('click', () => { onlyIntro = val; render(); box.querySelector('.refs__show.is-on')?.focus(); });
      filter.append(b);
    }
    box.appendChild(filter);
    const groups = groupReferences(data).map((g) => ({ ...g, items: onlyIntro ? g.items.filter((r) => r.level === 'intro') : g.items })).filter((g) => g.items.length);
    const all = groups.flatMap((g) => g.items);
    const unchecked = all.filter((r) => !r.locatorVerified).length;
    if (unchecked) box.appendChild(markNote(h('div', 'refs__banner', R.banner(unchecked, all.length))));
    for (const g of groups) {
      const sec = h('section', 'refs__group');
      sec.appendChild(h('h3', '', `${R.types[g.type]} (${g.items.length})`));
      const ul = h('ul', 'refs__list');
      for (const r of g.items) {
        const li = h('li', 'refs__item');
        li.id = `ref-${r.id}`;
        const cite = h('div', 'refs__cite', r.cite);
        if (r.level === 'intro') { const b = h('span', 'bcard__chip bcard__chip--ok refs__start', R.startHere); b.dataset.tip = R.startHereTip; cite.append(' ', b); }
        li.appendChild(cite);
        if (r.url) {
          const a = h('a', 'refs__url', r.url);
          a.href = r.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = R.open;
          const row = h('div', 'refs__link');
          row.append(a);
          if (r.accessed) row.append(h('span', 'refs__id', ` · ${R.accessed(r.accessed)}`));
          li.appendChild(row);
        }
        li.appendChild(h('div', 'refs__use', `${R.use}: ${tl(r.use)}`));
        const loc = h('div', 'refs__loc');
        loc.append(document.createTextNode(r.locator ? R.locator(r.locator) : R.noLocator), ' ',
          r.locatorVerified ? h('span', 'bcard__chip bcard__chip--ok', R.checked) : markNote(h('span', 'bcard__chip bcard__chip--warn', R.unchecked)),
          ' ', h('code', 'refs__id', r.id));
        li.appendChild(loc);
        const gs = groupsOf(r.citedBy);
        li.appendChild(h('div', 'refs__cited', gs.length ? `${R.citedBy}: ${gs.map((x) => STR.basis.groups[x]).join(' · ')}` : R.notCited));
        ul.appendChild(li);
      }
      sec.appendChild(ul);
      box.appendChild(sec);
    }
  }

  function setOpen(on, { fromHash = false } = {}) {
    if (on === !el.hidden) return;
    el.hidden = !on;
    if (on) {
      opener = document.activeElement;
      render();
      box.scrollTop = 0;
      /** @type {HTMLElement|null} */ (box.querySelector('button'))?.focus();
      if (!fromHash && !isReferencesHash(win.location.hash)) win.history.replaceState(null, '', REFERENCES_HASH);
    } else {
      if (!fromHash && isReferencesHash(win.location.hash)) win.history.replaceState(null, '', homeHash?.() ?? `${win.location.pathname}${win.location.search}`);
      /** @type {HTMLElement|null} */ (opener)?.focus?.();
    }
  }

  const api = {
    el,
    get open() { return !el.hidden; },
    setOpen,
    toggle() { setOpen(el.hidden); },
    /** Bahasa berubah: judul dan teks dirender ulang bila terbuka. */
    refresh() { el.setAttribute('aria-label', R.title); if (!el.hidden) { render(); focusRef(); } },
    dispose() { alive = false; win.removeEventListener('hashchange', onHash); win.removeEventListener('keydown', onKey, true); el.remove(); },
  };
  /** #/references/<id>: buka halaman, gulir ke sumber itu dan sorot (tautan dari kartu Formation). */
  function focusRef() {
    const id = referenceIdFromHash(win.location.hash);
    for (const n of box.querySelectorAll('.refs__item.is-target')) n.classList.remove('is-target');
    if (!id) return;
    const item = box.querySelector(`#ref-${CSS.escape(id)}`);
    if (item) { item.classList.add('is-target'); item.scrollIntoView({ block: 'center' }); }
  }
  const onHash = () => { const on = isReferencesHash(win.location.hash); setOpen(on, { fromHash: true }); if (on) focusRef(); };
  const onKey = (e) => { if (e.key === 'Escape' && !el.hidden) { setOpen(false); e.stopImmediatePropagation(); } };
  el.addEventListener('click', (e) => { if (e.target === el) setOpen(false); });
  win.addEventListener('hashchange', onHash);
  win.addEventListener('keydown', onKey, true);

  loadContent('references').then((r) => { if (!alive) return; data = r.data; if (!el.hidden) { render(); focusRef(); } });
  if (isReferencesHash(win.location.hash)) { setOpen(true, { fromHash: true }); focusRef(); } // alamat langsung #/references[/<id>]
  return api;
}
