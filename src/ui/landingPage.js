/**
 * landingPage.js — landing (Scene 0, M11 Step 01): teks dari content/learn.json (dua bahasa), empat kartu, tombol
 * "Continue at Scene N", tautan halaman, pita warna spesies, kalimat kejujuran, dan hero 3D.
 * Urutan muat: teks dulu; hero 3D menyusul (setelah frame pertama) dan tidak memblokir. Tanpa learn.json → landing
 * minimal English (judul, Explore, Present, References). Tidak ada angka model di landing: hero memakai frame
 * deriveTurbine pada preset hanya untuk warna (skala suhu, legenda K tanpa penanda nilai); gerak berbasis waktu.
 * Hero: latar viewport tema aktif (--vp-*), tone viewport (bloom, blending), kualitas adaptif global (bloom, pixel
 * ratio, jumlah partikel). prefers-reduced-motion → diam; tanpa WebGL → gradien statis. Dispose saat ditutup.
 */
import { STR } from './strings.js';
import { tr } from '../state/lang.js';
import { learnTotals } from '../state/content.js';
import { SPECIES_VAR } from '../gfx/species.js';
import { createRenderer, webglAvailable } from '../gfx/renderer.js';
import { createHeroRig } from '../gfx/heroRig.js';
import { createTempLegend } from '../charts/legend.js';
import { deriveTurbine } from '../state/deriveTurbine.js';
import { defaultState, gtInitialState } from '../state/store.js';
import { GT_STAGES } from '../model/presets.js';

const B = STR.bi.landing, SP = STR.landing.species;
const SPECIES = ['NOx', 'CO', 'CO2', 'CH4', 'PM'];
/** Ikon kartu: garis sederhana (currentColor), tanpa aset luar. */
const ICONS = {
  learn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5 12 3l9 3.5-9 3.5z"/><path d="M6.5 8v5.2c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3V8"/><path d="M21 6.5V12"/></svg>',
  explore: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/><path d="M8 11h6M11 8v6"/></svg>',
  present: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/><path d="m10 8 4 2-4 2z"/></svg>',
  about: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.5"/></svg>',
};
const LINK_ROUTES = ['#/references', '#/glossary', '#/regulations', '#/assumptions'];

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
const reducedMotion = () => { try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/**
 * @param {HTMLElement} root
 * @param {{learn:any|null, lang:'en'|'id', continueScene:() => number|null, onPresent:() => void}} o
 */
export function createLanding(root, o) {
  const L = o.learn?.landing ?? null;
  const t = (pair) => tr(pair, o.lang);
  const el = h('section', 'landing');
  el.setAttribute('aria-label', L ? t(L.title) : STR.landing.fallbackTitle);

  // ── hero: teks (kiri) + panggung 3D (kanan) ──
  const hero = h('div', 'landing__hero');
  const intro = h('div', 'landing__intro');
  if (L) intro.append(h('p', 'landing__kicker', t(L.kicker)));
  intro.append(h('h2', 'landing__title', L ? t(L.title) : STR.landing.fallbackTitle));
  if (L) intro.append(h('p', 'landing__tagline', t(L.tagline)));
  else intro.append(h('p', 'landing__tagline', tr(B.fallbackNote, o.lang)));
  const actions = h('div', 'landing__actions');
  const cont = o.continueScene();
  if (L && cont != null) {
    const a = h('a', 'btn landing__continue', t(L.continue).replace('{n}', String(cont)));
    a.href = `#/scene/${cont}`;
    actions.append(a);
  }
  if (actions.childNodes.length) intro.append(actions);
  const species = h('ul', 'landing__species');
  species.setAttribute('aria-label', tr(B.speciesLabel, o.lang));
  for (const k of SPECIES) {
    const li = h('li', '');
    const sw = h('span', 'sw');
    sw.style.background = SPECIES_VAR[k];
    li.append(sw, SP[k]);
    species.append(li);
  }
  intro.append(species);

  const stage = h('div', 'landing__stage');
  stage.setAttribute('role', 'img');
  stage.setAttribute('aria-label', tr(B.heroLabel, o.lang));
  const view = h('div', 'view3d');
  const legendBox = h('div', 'overlay overlay--legend landing__legend');
  legendBox.hidden = true;
  stage.append(view, legendBox);
  hero.append(intro, stage);
  el.append(hero);

  // ── kartu ──
  const cards = h('div', 'landing__cards');
  cards.setAttribute('aria-label', tr(B.cardsLabel, o.lang));
  const card = (id, title, text, route, meta) => {
    const c = route === 'present' ? h('button', 'lcard') : h('a', 'lcard');
    if (route === 'present') { c.type = 'button'; c.addEventListener('click', () => o.onPresent()); } else c.href = route;
    c.dataset.card = id;
    const ic = h('span', 'lcard__icon');
    ic.innerHTML = ICONS[id] ?? ICONS.explore;
    c.append(ic, h('span', 'lcard__title', title), h('span', 'lcard__text', text));
    if (meta) c.append(h('span', 'lcard__meta num', meta));
    cards.append(c);
  };
  if (L) {
    const tot = learnTotals(o.learn);
    for (const c of L.cards) card(c.id, t(c.title), t(c.text), c.route, c.id === 'learn' ? tr(B.totals, o.lang, tot.levels, tot.lessons, tot.minutes) : '');
  } else {
    card('explore', tr(B.fallbackExplore, o.lang), '', '#/scene/1');
    card('present', tr(B.fallbackPresent, o.lang), '', 'present');
    card('about', tr(B.fallbackReferences, o.lang), '', '#/references');
  }
  el.append(cards);

  // ── tautan + kejujuran ──
  if (L) {
    const labels = t(L.links).split(' · ');
    const nav = h('nav', 'landing__links');
    nav.setAttribute('aria-label', tr(B.linksLabel, o.lang));
    LINK_ROUTES.forEach((r, i) => {
      if (i) nav.append(h('span', 'landing__dot', '·'));
      const a = h('a', '', labels[i] ?? r.slice(2));
      a.href = r;
      nav.append(a);
    });
    el.append(nav, h('p', 'landing__honesty', t(L.honesty)));
  }
  root.append(el);

  // ── hero 3D (menyusul, tidak memblokir teks) ──
  let gfx = null, rig = null, legend = null, time = 0, timer = 0, raf = 0, disposed = false, lastStatic = -1, fitKey = '';
  /** Bingkai kamera ke bola pembatas rig (jarak dari fov terkecil) setiap kali ukuran panggung berubah. */
  function fit() {
    const w = view.clientWidth, hh = view.clientHeight;
    const key = `${w}x${hh}`;
    if (!gfx || !rig || !w || !hh || key === fitKey) return;
    fitKey = key;
    const cam = gfx.camera, b = rig.bounds;
    cam.aspect = w / hh;
    const vf = (cam.fov * Math.PI) / 360, hf = Math.atan(Math.tan(vf) * cam.aspect);
    const dist = Math.max(b.rXZ / Math.sin(hf), b.halfY / Math.sin(vf)) * 1.1; // sedikit ruang untuk legenda K di pojok
    gfx.controls.maxDistance = dist * 2; // batas bawaan renderer (6) memotong jarak pada panggung lebar
    const dir = cam.position.clone().sub(gfx.controls.target).normalize();
    gfx.controls.target.copy(b.center);
    cam.position.copy(b.center).addScaledVector(dir, dist);
    cam.updateProjectionMatrix();
    gfx.controls.update();
  }
  const still = reducedMotion();
  function initHero() {
    if (disposed) return;
    if (!webglAvailable()) { stage.classList.add('is-static'); return; }
    try {
      gfx = createRenderer(view, { camPos: [3.1, 1.45, 3.7], target: [0.18, -0.02, 0] });
      Object.assign(gfx.controls, { enableZoom: false, enablePan: false, enableRotate: false, autoRotate: !still, autoRotateSpeed: 0.55 });
      const frame = deriveTurbine({ ...defaultState('diesel'), ...gtInitialState(), theta: 0 });
      rig = createHeroRig({ frame, stages: { compressor: GT_STAGES.compressor, turbine: GT_STAGES.turbine } });
      gfx.scene.add(rig.group);
      rig.update(0, 0);
      fit();
      legend = createTempLegend(legendBox, { title: tr(B.legendTitle, o.lang), tickStep: 1000, marker: false, compact: true });
      legend.update({ tempScale: frame.tempScale });
      (legendBox.querySelector('.temp-legend') ?? legendBox).append(h('div', 'landing__legend-note', tr(B.legendNote, o.lang)));
      legendBox.hidden = false;
      gfx.render();
      stage.classList.add('is-ready');
    } catch {
      disposeHero();
      stage.classList.add('is-static');
    }
  }
  function disposeHero() {
    if (rig && gfx) gfx.scene.remove(rig.group);
    rig?.dispose(); rig = null;
    gfx?.dispose(); gfx = null;
    legend?.dispose(); legend = null;
  }
  raf = requestAnimationFrame(() => { timer = setTimeout(initHero, 30); });

  return {
    el,
    /** Dipanggil loop utama selama landing terbuka (berhenti otomatis saat tab tersembunyi). */
    update(dt) {
      if (!gfx || !rig) return;
      if (still) {
        // reduced motion: satu frame diam (render ulang jarang, untuk ukuran / kualitas)
        const k = Math.floor(performance.now() / 1000);
        if (k === lastStatic) return;
        lastStatic = k;
        fit();
        gfx.render();
        return;
      }
      time += dt;
      fit();
      rig.update(time, dt);
      gfx.render();
    },
    heroInfo() {
      const c = view.querySelector('canvas');
      return { ready: !!gfx, static: stage.classList.contains('is-static'), bloom: gfx?.bloomOn ?? false, particles: rig?.particles ?? 0, canvas: !!c, still };
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf); clearTimeout(timer);
      disposeHero();
      el.remove();
    },
  };
}
