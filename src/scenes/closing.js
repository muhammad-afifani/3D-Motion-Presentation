/**
 * Scene 11 — Penutup. Ringkasan 3 poin + opsi arah diskusi dari content/closing.json (tanpa klaim baru).
 * Opsi bisa disembunyikan sesuai audiens (store.closingVisible); tombol Edit options menampilkan checkbox.
 */
import { html } from './sceneBase.js';
import { loadContent, fallbackContent } from '../state/content.js';
import { closingTogglePatch, isOptionVisible } from '../state/store.js';
import { button } from '../ui/controls.js';
import { createContentBanner } from '../ui/contentBanner.js';
import { escapeHtml as esc } from '../ui/format.js';
import { STR } from '../ui/strings.js';

const S = STR.scene11;

export const meta = { id: 'closing', number: 11, title: S.title, message: S.message };


/** Opsi yang tampil di daftar presentasi (diekspor untuk tes). */
export const visibleOptions = (data, s) => data.options.filter((o) => isOptionVisible(s, o.id));

/** @param {import('./sceneBase.js').SceneContext} ctx */
export function createScene(ctx) {
  const { store } = ctx;
  const disposers = [];
  let el, banner, editBtn, data = fallbackContent('closing'), source = 'fallback', alive = true;

  const q = (sel) => el.querySelector(sel);

  function render() {
    const s = store.get();
    q('.close-points').innerHTML = data.points.map((p) => `<li>${esc(p)}</li>`).join('');
    const vis = visibleOptions(data, s);
    q('.close-options').innerHTML = vis.length ? vis.map((o) => `<li>${esc(o.text)}</li>`).join('') : `<li class="close-none">${S.none}</li>`;
    const ed = q('.close-edit');
    ed.hidden = !s.closingEdit;
    ed.innerHTML = data.options.map((o) => `<label class="close-check"><input type="checkbox" data-opt="${esc(o.id)}" ${isOptionVisible(s, o.id) ? 'checked' : ''} /> <span>${S.show}</span> <span class="close-check__txt">${esc(o.text)}</span></label>`).join('');
    for (const cb of ed.querySelectorAll('[data-opt]')) cb.addEventListener('change', () => store.set(closingTogglePatch(store.get(), cb.dataset.opt)));
    editBtn.setLabel(s.closingEdit ? S.done : S.edit);
    editBtn.setOn(s.closingEdit);
    q('[data-k="source"]').textContent = source === 'file' ? S.source.file : S.source.fallback;
  }

  return {
    meta,
    mount() {
      el = html(`
        <section class="scene scene--content scene--closing">
          <div class="scene__controls"></div>
          <div class="content-main close-main">
            <section class="close-block"><h2>${S.pointsTitle}</h2><ol class="close-points"></ol></section>
            <section class="close-block"><h2>${S.optionsTitle}</h2><ul class="close-options"></ul><div class="close-edit" hidden></div></section>
          </div>
          <div class="content-foot"><span>${S.note}</span><span class="content-src" data-k="source"></span></div>
        </section>`);
      ctx.root.appendChild(el);
      banner = createContentBanner(q('.content-main'));
      q('.content-main').prepend(banner.el);
      editBtn = button({ label: S.edit, key: 'E', tip: S.tips.edit, onClick: () => store.set({ closingEdit: !store.get().closingEdit }) });
      q('.scene__controls').append(editBtn.el);
      render();
      loadContent('closing').then((r) => {
        if (!alive) return;
        data = r.data; source = r.source;
        banner.show(r);
        render();
      });
      disposers.push(store.subscribe((s, prev, changed) => {
        if (changed.includes('closingVisible') || changed.includes('closingEdit')) render();
      }));
    },
    update() {},
    onKey(e) {
      if (e.key.toLowerCase() === 'e') { store.set({ closingEdit: !store.get().closingEdit }); return true; }
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
