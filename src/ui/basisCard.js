/**
 * basisCard.js — kartu Basis: model level, asal rumus, sumber, asumsi untuk satu grafik/HUD (atau satu fungsi).
 * Dibuka oleh elemen apa pun dengan atribut data-basis="<id kelompok>" atau "namaFungsi,namaFungsi" (klik, Enter, Spasi).
 * Data: state/basisView.js (basis.js + content/references.json). Hanya id yang ada di references.json tampil sebagai sumber;
 * sisanya "source to verify". Teks dari strings.js (STR.basis); nama fungsi hanya tampil di sini dan di panel H.
 */
import { STR } from './strings.js';
import { cardData } from '../state/basisView.js';
import { loadContent, fallbackContent } from '../state/content.js';

const B = STR.basis, K = STR.basis.card;

/** @param {string} tag @param {string} [cls] @param {string} [text] */
function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/**
 * @param {HTMLElement} [parent]
 * @param {{onOpenRefs?: () => void}} [opts]
 */
export function createBasisCard(parent = document.body, { onOpenRefs } = {}) {
  const el = h('div', 'bcard');
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', K.title);
  const box = h('div', 'bcard__box');
  el.appendChild(box);
  parent.appendChild(el);

  let refs = fallbackContent('references');
  let last = null, opener = null, alive = true;
  loadContent('references').then((r) => { if (!alive) return; refs = r.data; if (!el.hidden && last) render(last); });

  function render(spec) {
    const d = cardData(spec, refs);
    box.replaceChildren();
    const head = h('div', 'bcard__head');
    head.appendChild(h('h2', '', d.id ? (B.groups[d.id] ?? K.title) : K.custom));
    const close = h('button', 'btn btn--sm', K.close);
    close.type = 'button';
    close.addEventListener('click', () => api.close());
    head.appendChild(close);
    box.appendChild(head);
    const chips = h('div', 'bcard__levels');
    chips.appendChild(h('span', 'bcard__label', K.level));
    for (const lv of d.levels) chips.appendChild(h('span', 'bcard__chip', lv));
    box.appendChild(chips);

    for (const e of d.entries) {
      const sec = h('section', 'bcard__entry');
      const title = h('div', 'bcard__name');
      title.append(h('code', '', e.name), h('span', 'bcard__chip', e.level));
      sec.appendChild(title);
      const dv = h('p', 'bcard__deriv');
      dv.append(h('b', '', `${K.derivation}: `), document.createTextNode(e.derivation));
      sec.appendChild(dv);

      const src = h('div', 'bcard__sources');
      src.appendChild(h('b', '', `${K.sources}: `));
      if (!e.refs.length) src.appendChild(document.createTextNode(K.noSource));
      else {
        const ul = h('ul');
        for (const r of e.refs) {
          const li = h('li');
          if (!r.known) li.append(h('span', 'bcard__warn', K.unknownRef(r.id)));
          else {
            li.append(document.createTextNode(r.cite));
            if (r.locator) li.append(document.createTextNode(` ${K.locator(r.locator)}`));
            li.append(' ', h('span', r.locatorVerified ? 'bcard__chip bcard__chip--ok' : 'bcard__chip bcard__chip--warn', r.locatorVerified ? K.locatorChecked : K.locatorUnchecked));
          }
          ul.appendChild(li);
        }
        src.appendChild(ul);
      }
      sec.appendChild(src);
      for (const t of e.toVerify) {
        const p = h('p', 'bcard__verify');
        p.append(h('span', 'bcard__chip bcard__chip--warn', K.toVerify), ' ', document.createTextNode(t));
        sec.appendChild(p);
      }
      if (e.knownIssue) {
        const p = h('p', 'bcard__verify');
        p.append(h('span', 'bcard__chip bcard__chip--warn', K.knownIssue), ' ', document.createTextNode(e.knownIssue));
        sec.appendChild(p);
      }
      if (e.assumptions.length) {
        sec.appendChild(h('b', 'bcard__label', `${K.assumptions}:`));
        const ul = h('ul', 'bcard__assume');
        for (const a of e.assumptions) ul.appendChild(h('li', '', a));
        sec.appendChild(ul);
      }
      box.appendChild(sec);
    }
    const foot = h('div', 'bcard__foot');
    foot.appendChild(h('span', 'bcard__note', K.note));
    if (onOpenRefs) {
      const b = h('button', 'btn btn--sm', K.allRefs);
      b.type = 'button';
      b.addEventListener('click', () => { api.close(); onOpenRefs(); });
      foot.appendChild(b);
    }
    box.appendChild(foot);
  }

  const api = {
    el,
    get open() { return !el.hidden; },
    /** @param {string|string[]} spec id kelompok atau daftar nama fungsi */
    show(spec, from = null) {
      last = spec; opener = from;
      render(spec);
      el.hidden = false;
      box.scrollTop = 0;
      /** @type {HTMLElement|null} */ (box.querySelector('button'))?.focus();
    },
    close() {
      if (el.hidden) return;
      el.hidden = true;
      /** @type {HTMLElement|null} */ (opener)?.focus?.();
      opener = null;
    },
    dispose() { alive = false; off(); el.remove(); },
  };

  const target = (e) => /** @type {HTMLElement|null} */ (e.target instanceof Element ? e.target.closest('[data-basis]') : null);
  const onClick = (e) => {
    if (e.target === el) { api.close(); return; } // klik latar
    const t = target(e);
    if (t && !el.contains(t)) { e.preventDefault(); api.show(t.dataset.basis ?? '', t); }
  };
  const onKey = (e) => {
    // dibuat sebelum panel lain (main.js): Esc menutup kartu lebih dulu, lalu panel di bawahnya
    if (e.key === 'Escape' && !el.hidden) { api.close(); e.stopImmediatePropagation(); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      // elemen role="button" (bukan <button>, yang sudah memicu klik sendiri) yang sedang fokus
      const t = target(e);
      if (t && t === document.activeElement && !(t instanceof HTMLButtonElement) && !el.contains(t)) { e.preventDefault(); e.stopImmediatePropagation(); api.show(t.dataset.basis ?? '', t); }
    }
  };
  document.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey, true);
  const off = () => { document.removeEventListener('click', onClick); window.removeEventListener('keydown', onKey, true); };
  return api;
}
