/**
 * presenterView.js — tampilan presenter (DOM murni): catatan scene aktif, timer, pratinjau scene berikutnya
 * (teks), tombol Prev/Next. Dipakai jendela presenter (presenter.js) dan panel pengganti di halaman (main.js).
 * Tidak menghitung model; teks dari strings.js dan content/presenter.json (di-escape).
 * Chrome (judul, tombol, label) English; catatan presenter dari presenter.json tetap Indonesia dan diberi lang="id".
 */
import { STR } from './strings.js';
import { escapeHtml as esc, clock } from './format.js';
import { createContentBanner } from './contentBanner.js';
import { createTimer, timerView } from '../state/presenterTimer.js';
import { presenterNotes } from '../state/content.js';
import { nextSceneNumber, SCENE_NUMBERS } from '../state/scenes.js';
import { createRelabeler } from './relabel.js';

const T = STR.presenter;
const sceneTitle = (n) => STR[`scene${n}`]?.title ?? '';

/** HTML pratinjau scene berikutnya (diekspor untuk tes): nomor, judul, pesan kunci, catatan pertama. */
export function nextPreviewHtml(data, n) {
  const nx = n === 0 ? SCENE_NUMBERS[0] : nextSceneNumber(n); // 0 = landing (Start) → scene pertama
  if (nx == null) return `<p class="pres-dim">${T.end}</p>`;
  const c = presenterNotes(data, nx);
  return `<div class="pres-next__title">${T.nextLine(nx, sceneTitle(nx))}</div>`
    + (c ? `<p class="pres-next__key" lang="id">${esc(c.keyMessage)}</p><p class="pres-dim" lang="id">${esc(c.notes[0])}</p>` : '');
}

/**
 * @param {HTMLElement} container
 * @param {{content:any, onNav:(dir:number)=>void, onClose?:()=>void, onReconnect?:()=>void, inPage?:boolean, now?:()=>number}} o
 */
export function createPresenterView(container, o) {
  const el = document.createElement('section');
  el.className = `pres${o.inPage ? ' pres--inpage' : ''}`;
  el.innerHTML = `
    <header class="pres__head">
      <div><div class="pres__eyebrow" data-k="title"></div><div class="pres__current num" data-v="current"></div></div>
      <div class="pres__head-r"><span class="pill" data-v="status" hidden></span>
        ${o.onReconnect ? '<button type="button" class="btn btn--sm" data-reconnect data-k="reconnect"></button>' : ''}
        ${o.onClose ? '<button type="button" class="btn btn--sm" data-close><span data-k="close"></span> <kbd data-k="key"></kbd></button>' : ''}</div>
    </header>
    ${o.inPage ? '<p class="pres-dim" data-k="inPageNote"></p>' : ''}
    <div class="pres__banner"></div>
    <div class="pres__grid">
      <div class="pres__main">
        <h3 data-k="keyMessage"></h3><p class="pres__key" data-v="key" lang="id"></p>
        <h3 data-k="notes"></h3><div class="pres__notes" data-v="notes" lang="id"></div>
      </div>
      <div class="pres__side">
        <h3 data-k="timer"></h3>
        <div class="pres-timer num">
          <div><span class="pres-dim" data-k="total"></span><b data-v="total">00:00</b></div>
          <div><span class="pres-dim" data-k="scene"></span><b data-v="scene">00:00</b><span class="pres-dim" data-v="target"></span></div>
        </div>
        <div class="pres__btns">
          <button type="button" class="btn" data-toggle></button>
          <button type="button" class="btn" data-reset data-k="reset"></button>
        </div>
        <h3 data-k="next"></h3><div class="pres-next" data-v="next"></div>
        <div class="pres__btns">
          <button type="button" class="btn" data-prev>◀ <span data-k="prev"></span></button>
          <button type="button" class="btn" data-next><span data-k="nextBtn"></span> ▶</button>
        </div>
        <p class="pres-dim" data-k="keysHint"></p>
      </div>
    </div>`;
  container.appendChild(el);
  const q = (s) => el.querySelector(s);
  const V = (k) => q(`[data-v="${k}"]`);
  const banner = createContentBanner(q('.pres__banner'));
  const timer = createTimer(o.now);
  let data = o.content, scene = null, start = false, statusText = null, run = { playing: true, frozen: false };
  const setText = (n, t) => { if (n.textContent !== t) n.textContent = t; };
  // teks tetap (judul, tombol, label) lewat relabeler agar ikut bahasa tanpa memuat ulang; catatan presenter tetap Indonesia
  const rl = createRelabeler();
  rl.attr(el, 'aria-label', () => T.title);
  for (const n of el.querySelectorAll('[data-k]')) { const k = /** @type {HTMLElement} */ (n).dataset.k; rl.text(n, () => T[k]); }
  const paintStatus = () => { const st = V('status'); if (!st.hidden) setText(st, run.frozen ? T.status.frozen : run.playing ? T.status.playing : T.status.paused); };
  const statusNow = () => (typeof statusText === 'function' ? statusText() : statusText);
  const paintCurrent = () => { if (scene != null) renderScene(); else setText(V('current'), statusNow() ?? T.waiting); };

  function renderScene() {
    if (scene == null) return;
    if (start) {
      // M11: landing terbuka di jendela utama → keadaan "Start" tanpa catatan
      setText(V('current'), T.startPage);
      setText(V('key'), '');
      V('notes').innerHTML = `<p class="pres-dim">${esc(T.startNotes)}</p>`;
      V('next').innerHTML = nextPreviewHtml(data, 0);
      tick();
      return;
    }
    setText(V('current'), T.current(scene, SCENE_NUMBERS.length, sceneTitle(scene)));
    const c = presenterNotes(data, scene);
    setText(V('key'), c?.keyMessage ?? '');
    V('notes').innerHTML = c ? `<ul>${c.notes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : `<p class="pres-dim">${T.noNotes}</p>`;
    V('next').innerHTML = nextPreviewHtml(data, scene);
    tick();
  }
  function tick() {
    const c = scene == null ? null : presenterNotes(data, scene);
    const v = timerView(timer, c?.targetMin);
    setText(V('total'), clock(v.total));
    setText(V('scene'), clock(v.scene));
    setText(V('target'), v.targetMs == null ? ` · ${T.noTarget}` : ` · ${v.over ? T.over(clock(-v.remaining)) : T.target(clock(v.targetMs))}`);
    V('scene').classList.toggle('is-over', v.over);
    setText(q('[data-toggle]'), timer.running ? T.pause : T.start);
  }
  const toggle = () => { timer.toggle(); tick(); };
  q('[data-toggle]').addEventListener('click', toggle);
  q('[data-reset]').addEventListener('click', () => { timer.reset(); tick(); });
  q('[data-prev]').addEventListener('click', () => o.onNav(-1));
  q('[data-next]').addEventListener('click', () => o.onNav(1));
  q('[data-close]')?.addEventListener('click', () => o.onClose());
  q('[data-reconnect]')?.addEventListener('click', () => o.onReconnect());
  paintCurrent();
  tick();
  const iv = setInterval(tick, 500);

  return {
    el, timer,
    get scene() { return scene; },
    /** Scene aktif + status animasi dari jendela utama. */
    setScene(n, { playing = true, frozen = false, start: isStart = false } = {}) {
      timer.markScene(n);
      const changed = n !== scene || !!isStart !== start;
      scene = n;
      start = !!isStart;
      run = { playing, frozen };
      V('status').hidden = false;
      paintStatus();
      if (changed) renderScene();
    },
    /** Ganti isi presenter.json (hasil loadContent); banner hanya bila JSON rusak / skema salah. */
    setContent(r) { data = r.data; banner.show(r); renderScene(); },
    /** Teks status di tempat "scene" saat belum ada scene; fungsi = diambil ulang saat bahasa berubah. */
    setStatusText(t) { statusText = t; paintCurrent(); },
    /** Teks ikut bahasa baru (jendela presenter dan panel di halaman). Catatan presenter tidak berubah (Indonesia). */
    relabel() { rl.run(); paintStatus(); paintCurrent(); tick(); },
    toggleTimer: toggle,
    tick,
    dispose() { clearInterval(iv); banner.dispose(); el.remove(); },
  };
}
