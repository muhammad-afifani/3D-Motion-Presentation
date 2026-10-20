/**
 * Scene 10 — Perangkat pengendali emisi. Kartu dari content/controls.json (teks presenter, bukan hasil model).
 * Alur: loadContent('controls') → render kartu; filter mesin (store.ctrlFilter) menyorot kartu yang berlaku.
 */
import { html } from './sceneBase.js';
import { loadContent, fallbackContent, CARD_FIELDS } from '../state/content.js';
import { segmented } from '../ui/controls.js';
import { createContentBanner } from '../ui/contentBanner.js';
import { escapeHtml as esc } from '../ui/format.js';
import { STR } from '../ui/strings.js';

const S = STR.scene10;

/** title / message dibaca saat dipakai (bukan saat modul dimuat) agar ikut bahasa aktif. */
export const meta = { id: 'controls', number: 10, get title() { return S.title; }, get message() { return S.message; } };

const FILTERS = ['all', 'diesel', 'gas', 'turbine'];
const KEYS_FILTER = { 1: 'all', 2: 'diesel', 3: 'gas', 4: 'turbine' };

/** Kartu disorot bila filter 'all' atau mesin termasuk appliesTo (diekspor untuk tes). */
export const isHighlighted = (card, filter) => filter === 'all' || card.appliesTo.includes(filter);

/** HTML satu kartu (teks konten di-escape; label dari strings.js). */
export function cardHtml(c) {
  const list = (x) => (Array.isArray(x) ? `<ul>${x.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : `<p>${esc(x)}</p>`);
  const fields = CARD_FIELDS.map((k) => `<div class="card-f card-f--${k}"><div class="card-f__label">${S.fields[k]}</div>${list(c[k])}</div>`).join('');
  const chips = c.appliesTo.map((m) => `<span class="chip">${S.machines[m]}</span>`).join('');
  const links = c.relatedScenes.map((n) => `<button type="button" class="btn btn--sm" data-scene="${n}" data-tip="${S.tips.goScene}">${S.goScene(n)}</button>`).join('');
  return `<article class="ctrl-card" data-id="${esc(c.id)}"><h3>${esc(c.name)}</h3><div class="card-chips"><span class="card-f__label">${S.appliesTo}</span>${chips}</div>${fields}<div class="card-links">${links}</div></article>`;
}

/** @param {import('./sceneBase.js').SceneContext} ctx */
export function createScene(ctx) {
  const { store } = ctx;
  const disposers = [];
  let el, banner, filterCtl, data = fallbackContent('controls'), source = 'fallback', alive = true;

  const q = (sel) => el.querySelector(sel);

  function render() {
    const grid = q('.ctrl-grid');
    grid.innerHTML = data.cards.map(cardHtml).join('');
    for (const b of grid.querySelectorAll('[data-scene]')) b.addEventListener('click', () => ctx.goToScene?.(Number(b.dataset.scene)));
    q('[data-k="source"]').textContent = source === 'file' ? S.source.file : S.source.fallback;
    highlight(store.get().ctrlFilter);
  }
  function highlight(filter) {
    for (const card of el.querySelectorAll('.ctrl-card')) {
      const c = data.cards.find((x) => x.id === card.dataset.id);
      card.classList.toggle('is-dim', !isHighlighted(c, filter));
      card.classList.toggle('is-hit', filter !== 'all' && isHighlighted(c, filter));
    }
  }

  return {
    meta,
    mount() {
      el = html(`
        <section class="scene scene--content">
          <div class="scene__controls"></div>
          <div class="content-main">
            <div class="ctrl-grid"></div>
          </div>
          <div class="content-foot"><span>${S.note}</span><span class="content-src" data-k="source"></span></div>
        </section>`);
      ctx.root.appendChild(el);
      banner = createContentBanner(q('.content-main'));
      q('.content-main').prepend(banner.el);
      filterCtl = segmented({ label: S.filter, tip: S.tips.filter, options: FILTERS.map((f, i) => ({ value: f, label: S.filters[f], key: String(i + 1) })), value: store.get().ctrlFilter, onChange: (v) => store.set({ ctrlFilter: v }) });
      q('.scene__controls').append(filterCtl.el);
      render();
      loadContent('controls').then((r) => {
        if (!alive) return;
        data = r.data; source = r.source;
        banner.show(r);
        render();
      });
      disposers.push(store.subscribe((s, prev, changed) => {
        if (changed.includes('ctrlFilter')) { filterCtl.set(s.ctrlFilter); highlight(s.ctrlFilter); }
      }));
    },
    update() {},
    onKey(e) {
      const f = KEYS_FILTER[e.key];
      if (f) { store.set({ ctrlFilter: f }); return true; }
      return false;
    },
    dispose() {
      alive = false;
      for (const d of disposers.splice(0)) d();
      banner?.dispose();
      el?.remove();
    },
  };
}
