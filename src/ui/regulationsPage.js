/**
 * regulationsPage.js — halaman Regulations: tabel limit lengkap per grup, kelas kapasitas, dan bahan bakar
 * dari content/regulations.json (alamat #/regulations, tombol bilah atas, tombol G).
 * Angka hanya dibaca dari file; catatan pengecualian tampil sebagai teks dan tidak mengubah limit apa pun.
 * Banner "Transcribed from the published tables…" per grup selama verified:false.
 */
import { STR } from './strings.js';
import { fmt } from './format.js';
import { regulationsContent, onRegulations } from '../state/regulationsStore.js';
import { contentErrorText } from './contentBanner.js';
import { REG_UNITS } from '../state/content.js';

const R = STR.regulation, P = STR.regulation.page;
export const REGULATIONS_HASH = '#/regulations';
export const isRegulationsHash = (hash) => /^#\/regulations\/?(\?.*)?$/.test(hash ?? '');

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/**
 * @param {HTMLElement} [parent]
 * @param {{win?: Window}} [opts]
 */
export function createRegulationsPage(parent = document.body, { win = window } = {}) {
  const el = h('div', 'refs refs--regs');
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', P.title);
  const box = h('div', 'refs__box');
  el.appendChild(box);
  parent.appendChild(el);
  let opener = null;

  function render() {
    const r = regulationsContent(), d = r.data;
    box.replaceChildren();
    const head = h('div', 'refs__head');
    head.appendChild(h('h2', '', P.title));
    const close = h('button', 'btn btn--sm', P.close);
    close.type = 'button';
    close.addEventListener('click', () => setOpen(false));
    head.appendChild(close);
    box.appendChild(head);
    box.appendChild(h('p', 'refs__intro', P.intro));
    const err = contentErrorText(r);
    if (err) box.appendChild(h('div', 'refs__banner', `${R.errorTitle}: ${err}`));
    if (d?.status) box.appendChild(h('p', 'refs__intro', P.status(d.status)));
    for (const g of d?.groups ?? []) {
      const src = d.sources?.find((s) => s.id === g.source);
      const sec = h('section', 'refs__group regs__group');
      sec.appendChild(h('h3', '', P.group(g.equipment, src?.short ?? g.source)));
      if (!g.verified) sec.appendChild(h('div', 'refs__banner', `⚠ ${R.banner}`));
      const b = g.basis;
      sec.appendChild(h('p', 'regs__basis', R.basis(b.refO2Pct, b.TrefC, b.NOxAs)));
      if (g.basisNote) sec.appendChild(h('p', 'refs__use', `${P.basisNote}: ${g.basisNote}`));
      for (const c of g.capacityClasses) {
        for (const fuel of ['oil', 'gas']) {
          const rows = g.rows.filter((x) => x.class === c.id && x.fuel === fuel);
          if (!rows.length) continue;
          sec.appendChild(h('h4', 'regs__cls', P.classFuel(c.label, R.fuels[fuel])));
          const t = h('table', 'reg__table num');
          t.innerHTML = `<thead><tr>${P.head.map((x) => `<th>${x}</th>`).join('')}</tr></thead>`;
          const tb = h('tbody');
          for (const x of rows) {
            const tr = h('tr');
            tr.append(h('td', 'reg__param', x.param), h('td', '', fmt(x.limit, 0)), h('td', '', x.unit === REG_UNITS[0] ? R.siteUnits.mg : x.unit), h('td', '', x.method));
            tb.appendChild(tr);
          }
          t.appendChild(tb);
          sec.appendChild(t);
        }
      }
      if (g.notes?.length) {
        sec.appendChild(h('b', 'bcard__label', P.notes));
        const ul = h('ul', 'bcard__assume');
        for (const n of g.notes) ul.appendChild(h('li', '', n));
        sec.appendChild(ul);
      }
      if (src) {
        const p = h('p', 'refs__use');
        const a = h('a', '', src.title);
        a.href = src.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        p.append(`${P.source}: `, a, ' ', h('span', g.verified ? 'bcard__chip bcard__chip--ok' : 'bcard__chip bcard__chip--warn', g.verified ? P.verified : P.unverified));
        sec.appendChild(p);
      }
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
      if (!fromHash && !isRegulationsHash(win.location.hash)) win.history.replaceState(null, '', REGULATIONS_HASH);
    } else {
      if (!fromHash && isRegulationsHash(win.location.hash)) win.history.replaceState(null, '', `${win.location.pathname}${win.location.search}`);
      /** @type {HTMLElement|null} */ (opener)?.focus?.();
    }
  }

  const onHash = () => setOpen(isRegulationsHash(win.location.hash), { fromHash: true });
  const onKey = (e) => { if (e.key === 'Escape' && !el.hidden) { setOpen(false); e.stopImmediatePropagation(); } };
  el.addEventListener('click', (e) => { if (e.target === el) setOpen(false); });
  win.addEventListener('hashchange', onHash);
  win.addEventListener('keydown', onKey, true);
  const unsub = onRegulations(() => { if (!el.hidden) render(); });
  if (isRegulationsHash(win.location.hash)) setOpen(true, { fromHash: true });

  return {
    el,
    get open() { return !el.hidden; },
    setOpen,
    toggle() { setOpen(el.hidden); },
    dispose() { unsub(); win.removeEventListener('hashchange', onHash); win.removeEventListener('keydown', onKey, true); el.remove(); },
  };
}
