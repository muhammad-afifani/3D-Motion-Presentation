/**
 * Scene 3 — Pembakaran, φ, dan suhu nyala.
 * Alur: kontrol → store.set → (Worker: cylinderSim pada φ slider) → deriveFlame(state, sim) → frame →
 *       { combustorRig (nyala shader + bloom), grafik T_ad(φ), bar perbandingan, HUD }.
 */
import { html } from './sceneBase.js';
import {
  togglePlayPatch, toggleFreezePatch, scrubPatch, tickPatch, tickWindowPatch, flameDefaults, bloomCyclePatch,
} from '../state/store.js';
import { deriveFlame, flameSimParams, flameSimKey, focusWindow } from '../state/deriveFlame.js';
import { createSimClient } from '../state/simClient.js';
import { FLAME_MODES, FLAME_RANGES, RPM_VISUAL } from '../model/presets.js';
import { createRenderer } from '../gfx/renderer.js';
import { createChamberCloseup, createCanCombustor } from '../gfx/combustorRig.js';
import { createPerfGuard } from '../gfx/perfGuard.js';
import { createFlameChart } from '../charts/flameChart.js';
import { createBarChart } from '../charts/barChart.js';
import { slider, segmented, button } from '../ui/controls.js';
import { createHud } from '../ui/hud.js';
import { fmt, pct } from '../ui/format.js';

export const meta = {
  id: 'combustion',
  number: 3,
  title: 'Pembakaran, φ, dan suhu nyala',
  message: 'Suhu nyala ditentukan campuran. Diesel punya zona panas lokal; gas lean-burn homogen dan lebih dingin.',
};

const F_KEYS = ['fMode', 'fPhi', 'fPhiLocal'];
const KEYS_MODE = { 1: 'diesel', 2: 'gas', 3: 'turbine' };
const BLOOM_LABEL = { auto: 'Auto', on: 'Nyala', off: 'Mati' };
const PHI_LABEL = { diesel: 'φ global (rata-rata)', gas: 'φ campuran (homogen)', turbine: 'φ zona premix' };
const signedDeg = (v) => `${v < 0 ? '−' : ''}${fmt(Math.abs(v), 1)}°`;
const CAM = {
  piston: { pos: [0.075, -0.002, 0.13], target: [-0.01, -0.011, 0] },
  turbine: { pos: [0.45, 0.32, 0.95], target: [0.32, 0, 0] },
};

function hudItems(mode) {
  const items = [
    { id: 'tf', label: 'Suhu nyala adiabatik saat terbakar', unit: 'K', value: (f) => fmt(f.Tflame, 0),
      tip: `flameTemperature(φ${mode === 'diesel' ? ' lokal' : ''}, T_in, bahan bakar).\nSuhu nyala adiabatik saat campuran terbakar, BUKAN suhu puncak zona terbakar (itu di Scene 4).\nIndikatif ±100 K.` },
  ];
  if (mode === 'diesel') {
    items.push({ id: 'dT', label: 'ΔT zona lokal vs φ global', unit: 'K', value: (f) => `+${fmt(f.dTlocal, 0)}`,
      tip: 'flameTemperature(φ lokal) − flameTemperature(φ global) pada T_in yang sama.\nCampuran tak homogen: kantong hampir stoikiometrik walau rata-rata miskin.' });
  }
  items.push(
    { id: 'phi', label: PHI_LABEL[mode], unit: '', value: (f) => fmt(f.phi, 2),
      tip: mode === 'turbine' ? 'φ di zona premix combustor (DLN), bukan φ keseluruhan turbin.' : 'φ = (bahan bakar/udara) ÷ stoikiometrik.' },
    { id: 'tin', label: 'T campuran masuk', unit: 'K', value: (f) => fmt(f.Tin, 0),
      tip: mode === 'turbine' ? 'Model: T₂ keluar kompresor (braytonReal).' : 'Model: suhu gas saat θ₀ (akhir kompresi, sebelum terbakar) dari cylinderSim.' },
  );
  if (mode === 'turbine') {
    items.push({ id: 'q', label: 'q_in per kg udara zona premix', unit: 'kJ/kg', value: (f) => fmt(f.qin / 1e3, 0),
      tip: 'qinPerKgAir(φ zona premix, gas) = φ·LHV/AFR_st.\nUkuran nyala ∝ q_in (dinormalisasi ke φ = 1,2).' });
  } else {
    items.push({ id: 'hr', label: 'Laju pelepasan panas (relatif)', unit: '%', value: (f) => pct(f.intensity, 0),
      tip: 'Qtot·dx_b/dθ dari cylinderSim, dinormalisasi ke φ = 1,2.\nUkuran & kecerahan nyala mengikuti nilai ini.' });
  }
  return items;
}

/** @param {import('./sceneBase.js').SceneContext} ctx */
export function createScene(ctx) {
  const { store } = ctx;
  const disposers = [];
  let el, gfx = null, chamber = null, can = null, chart, bars, hud = null, hudKey = '';
  let sim = null, simKeyNow = null, camMode = '', lastNow = 0;
  const guard = createPerfGuard();
  const ctl = {};
  const simClient = createSimClient((r, key) => { sim = r; simKeyNow = key; }, { paramsOf: flameSimParams, keyOf: flameSimKey });

  const q = (sel) => el.querySelector(sel);
  const textCache = new Map();
  const setText = (node, s) => { if (textCache.get(node) !== s) { node.textContent = s; textCache.set(node, s); } };
  const setHTML = (node, s) => { if (textCache.get(node) !== s) { node.innerHTML = s; textCache.set(node, s); } };

  function buildDom() {
    el = html(`
      <section class="scene scene--flame">
        <div class="fl-view">
          <div class="view3d"></div>
          <div class="overlay overlay--formula num">
            <div class="fl-big"><span data-k="tlabel"></span> <b data-k="tf"></b></div>
            <div class="f-vals"><span data-k="mix"></span></div>
            <div class="f-vals f-vals--dim"><span data-k="phase"></span></div>
          </div>
          <div class="overlay overlay--notes"></div>
          <div class="overlay overlay--status num"></div>
          <div class="cyc-level">Semi-empiris</div>
        </div>
        <div class="fl-chart chart-slot"></div>
        <div class="scene__controls"></div>
        <div class="fl-bars chart-slot"></div>
        <div class="fl-hud"></div>
      </section>`);
    ctx.root.appendChild(el);
  }

  function buildControls() {
    const s = store.get();
    ctl.mode = segmented({
      label: 'Ruang bakar',
      options: Object.entries(FLAME_MODES).map(([value, m], i) => ({ value, label: m.label, key: String(i + 1) })),
      value: s.fMode, onChange: (v) => setMode(v),
    });
    ctl.phi = slider({ label: PHI_LABEL[s.fMode], ...FLAME_RANGES.phi, value: s.fPhi, digits: 2, onInput: (v) => store.set({ fPhi: v }) });
    ctl.phiLocal = slider({ label: 'φ lokal zona nyala', ...FLAME_RANGES.phiLocal, value: s.fPhiLocal, digits: 2, tip: 'Diesel: semprotan bahan bakar membentuk kantong hampir stoikiometrik di sekitar plume (phiLocal).', onInput: (v) => store.set({ fPhiLocal: v }) });
    ctl.tin = slider({ label: 'T campuran masuk', ...FLAME_RANGES.Tin, value: 300, digits: 0, unit: 'K', tip: 'Geser = skenario "bagaimana jika". Default dari model.', onInput: (v) => store.set({ fTin: v }) });
    ctl.tinModel = button({ label: 'T_in dari model', tip: 'Kembalikan suhu masuk ke nilai model (piston: T saat θ₀; turbin: T₂)', onClick: () => store.set({ fTin: null }) });
    ctl.focus = button({ label: 'Fokus jendela pembakaran', tip: 'Animasi θ hanya di sekitar θ₀ … akhir pembakaran', onClick: () => store.set({ fFocus: !store.get().fFocus }) });
    ctl.theta = slider({ label: 'Sudut engkol θ', min: -360, max: 360, step: 0.5, value: s.theta, format: signedDeg, onInput: (v) => store.set(scrubPatch(store.get(), v)) });
    ctl.rpm = slider({ label: 'Kecepatan animasi', ...RPM_VISUAL, value: s.rpmVisual, digits: 0, unit: 'rpm visual', onInput: (v) => store.set({ rpmVisual: v }) });
    ctl.play = button({ label: 'Jeda', key: 'Spasi', onClick: () => store.set(togglePlayPatch(store.get())) });
    ctl.freeze = button({ label: 'Beku', key: 'F', onClick: () => store.set(toggleFreezePatch(store.get())) });
    ctl.bloom = button({ label: 'Bloom: Auto', key: 'B', tip: 'Auto: dimatikan otomatis bila fps < 30 selama 2 detik. Klik: Auto → Nyala → Mati.', onClick: cycleBloom });
    ctl.reset = button({ label: 'Reset', key: 'R', onClick: () => setMode(store.get().fMode, true) });

    const g1 = html('<div class="ctl-group"></div>');
    g1.append(ctl.mode.el, ctl.phi.el, ctl.phiLocal.el, ctl.tin.el, ctl.tinModel.el);
    const g2 = html('<div class="ctl-group"></div>');
    g2.append(ctl.theta.el, ctl.rpm.el, ctl.focus.el);
    const g3 = html('<div class="ctl-group ctl-group--buttons"></div>');
    g3.append(ctl.play.el, ctl.freeze.el, ctl.bloom.el, ctl.reset.el);
    q('.scene__controls').append(g1, g2, g3);
  }

  function setMode(mode, force = false) {
    if (mode !== store.get().fMode || force) store.set(flameDefaults(mode));
  }
  function cycleBloom() {
    const p = bloomCyclePatch(store.get());
    if (p.fBloom === 'auto') guard.reset();
    store.set(p);
  }

  function syncControls(s, changed) {
    const piston = s.fMode !== 'turbine';
    if (changed.includes('fMode')) {
      ctl.mode.set(s.fMode);
      ctl.phi.el.querySelector('label').textContent = PHI_LABEL[s.fMode];
      ctl.phiLocal.el.hidden = s.fMode !== 'diesel';
      for (const c of [ctl.theta, ctl.rpm, ctl.focus]) c.el.hidden = !piston;
      hudKey = '';
    }
    ctl.phi.set(s.fPhi); ctl.phiLocal.set(s.fPhiLocal); ctl.rpm.set(s.rpmVisual);
    ctl.focus.setOn(s.fFocus);
    ctl.bloom.setLabel(`Bloom: ${BLOOM_LABEL[s.fBloom]}`);
    ctl.bloom.setOn(s.fBloom !== 'off');
    if (changed.includes('playing') || changed.includes('frozen')) {
      ctl.play.setLabel(s.playing ? 'Jeda' : 'Putar');
      ctl.play.setOn(!s.playing);
      ctl.play.setDisabled(s.frozen);
      ctl.freeze.setLabel(s.frozen ? 'Lepas beku' : 'Beku');
      ctl.freeze.setOn(s.frozen);
      ctl.theta.setLocked(s.frozen);
    }
  }

  function updateHud(f) {
    if (f.mode !== hudKey) {
      hud?.dispose();
      hudKey = f.mode;
      hud = createHud(q('.fl-hud'), hudItems(f.mode), {
        level: 'Semi-empiris',
        note: 'flameTemperature: tabel T_ad CH₄ + koreksi solar; efek preheat 0,5–0,8 × ΔT_in (disosiasi). Indikatif ±100 K.',
      });
    }
    hud.update(f);
  }

  function updateOverlay(f, s, bloomState) {
    for (const n of el.querySelectorAll('[data-k]')) {
      const k = n.dataset.k;
      if (k === 'tlabel') setText(n, 'Suhu nyala adiabatik saat terbakar:');
      else if (k === 'tf') setText(n, `${fmt(f.Tflame, 0)} K`);
      else if (k === 'mix') {
        setText(n, f.mode === 'diesel'
          ? `Campuran TAK homogen: rata-rata φ ${fmt(f.phi, 2)}, zona nyala φ ${fmt(f.phiLocal, 2)} (ΔT +${fmt(f.dTlocal, 0)} K)`
          : f.mode === 'gas' ? `Campuran homogen: seluruh muatan φ ${fmt(f.phi, 2)} → nyala lebih dingin`
            : `Premix miskin: φ zona premix ${fmt(f.phi, 2)}, T_in = T₂ ${fmt(f.Tin, 0)} K`);
      } else if (k === 'phase') {
        setText(n, f.rig ? `θ = ${signedDeg(f.theta)} · ${f.rig.phase} · laju pelepasan panas ${pct(f.intensity, 0)}% (relatif)` : `q_in zona premix ${fmt(f.qin / 1e3, 0)} kJ/kg udara · nyala ∝ q_in`);
      }
    }
    const notes = [];
    if (f.mode === 'turbine') notes.push(`φ zona premix, bukan φ keseluruhan (T₃ ${fmt(f.T3, 0)} K ≈ ${fmt(f.phiOverall, 2)})`);
    if (f.TinManual) notes.push(`T_in manual (model: ${fmt(f.TinModel, 0)} K)`);
    setHTML(q('.overlay--notes'), notes.map((t) => `<div class="note-chip note-chip--info">ⓘ ${t}</div>`).join(''));
    const st = [];
    st.push(`<span class="pill">Bloom ${bloomState.bloom ? 'nyala' : 'mati'}${bloomState.tripped && s.fBloom === 'auto' ? ' (otomatis, fps rendah)' : ''}</span>`);
    if (s.frozen) st.push(`<span class="pill pill--freeze">BEKU · θ = ${signedDeg(s.theta)}</span>`);
    else if (!s.playing) st.push('<span class="pill">JEDA</span>');
    setHTML(q('.overlay--status'), st.join(' '));
  }

  function setCamera(mode) {
    const c = mode === 'turbine' ? CAM.turbine : CAM.piston;
    gfx.camera.position.set(...c.pos);
    gfx.controls.target.set(...c.target);
    gfx.controls.minDistance = 0.1;
    gfx.controls.update();
  }

  return {
    meta,
    mount() {
      buildDom();
      buildControls();
      chart = createFlameChart(q('.fl-chart'));
      bars = createBarChart(q('.fl-bars'), { title: 'Suhu nyala adiabatik di zona reaksi (perbandingan)', unit: 'K', xLabel: 'T nyala adiabatik [K]', labelWidth: 210 });
      try {
        gfx = createRenderer(q('.view3d'), { camPos: CAM.piston.pos, target: CAM.piston.target, bloom: true });
        chamber = createChamberCloseup({ bore: 0.2 });
        can = createCanCombustor({ radius: 0.12, length: 0.6, swirler: 'axial', vanes: 12 });
        gfx.scene.add(chamber.group, can.group);
      } catch (err) {
        console.warn('[combustion] 3D dinonaktifkan:', err);
        gfx = null;
      }
      const s0 = store.get();
      if (FLAME_MODES[s0.fMode].engine) simClient.runNow(s0);
      disposers.push(store.subscribe((s, prev, changed) => {
        if (changed.some((k) => F_KEYS.includes(k)) && FLAME_MODES[s.fMode].engine) simClient.request(s);
        syncControls(s, changed);
      }));
      syncControls(s0, ['fMode', 'playing', 'frozen']);
    },
    update(dt) {
      const s0 = store.get();
      const piston = s0.fMode !== 'turbine';
      const win = piston && s0.fFocus ? focusWindow(s0.fMode) : null;
      store.set(win ? tickWindowPatch(s0, dt, win.lo, win.hi) : tickPatch(s0, dt));
      const s = store.get();
      const simOk = piston && sim && simKeyNow === flameSimKey(s) ? sim : null;
      const f = deriveFlame(s, { sim: simOk });
      ctl.theta.set(s.theta);
      ctl.tin.set(Math.round(f.Tin));
      ctl.tin.el.querySelector('output').textContent = `${fmt(f.Tin, 0)} K ${f.TinManual ? '(manual)' : '(model)'}`;
      chart.update(f);
      bars.update(f.bars.map((b) => ({ label: b.label, sub: `φ ${fmt(b.phi, 2)} · T_in ${fmt(b.Tin, 0)} K`, value: b.T, color: b.color, active: b.active })),
        { min: 1000, caption: 'Masing-masing pada T_in model-nya; mode aktif mengikuti slider. Warna bar = flameColor(φ).' });
      updateHud(f);
      // fps nyata: dt loop utama dibatasi 0,1 s untuk animasi, jadi pakai selisih waktu frame sebenarnya
      const now = performance.now();
      const rawDt = lastNow ? (now - lastNow) / 1000 : dt;
      lastNow = now;
      const bloomState = guard.sample(rawDt, s.fBloom);
      if (bloomState.justTripped) ctx.toast(`Bloom dimatikan otomatis (fps ${fmt(bloomState.fps, 0)} < 30). Tekan B untuk mengatur.`);
      updateOverlay(f, s, bloomState);
      if (gfx) {
        if (camMode !== (piston ? 'piston' : 'turbine')) { camMode = piston ? 'piston' : 'turbine'; setCamera(f.mode); }
        gfx.setBloom(bloomState.bloom);
        const time = performance.now() / 1000; // hanya untuk kedip visual shader
        chamber.group.visible = piston;
        can.group.visible = !piston;
        if (piston) {
          const dth = f.theta - f.rig.theta0;
          chamber.update({
            fuel: f.fuel === 'diesel' ? 'diesel' : 'gas', pistonPos: f.rig.pistonPos, hc: f.rig.geom.hc,
            intensity: f.intensity, color: f.color, core: f.coreColor, outer: f.outerColor, xb: f.rig.xb,
            spark: f.mode === 'gas' && dth >= -0.5 && dth <= 3, time,
          });
        } else {
          can.update({ intensity: f.intensity, color: f.color, core: f.coreColor, time });
        }
        gfx.render();
      }
    },
    onKey(e) {
      const k = e.key.toLowerCase();
      if (KEYS_MODE[k]) { setMode(KEYS_MODE[k]); return true; }
      if (k === 'b') { cycleBloom(); return true; }
      if (k === 'r') { setMode(store.get().fMode, true); return true; }
      return false;
    },
    dispose() {
      for (const d of disposers.splice(0)) d();
      simClient.dispose();
      if (gfx) { gfx.scene.remove(chamber.group, can.group); chamber.dispose(); can.dispose(); gfx.dispose(); }
      chart?.dispose(); bars?.dispose(); hud?.dispose();
      el?.remove();
    },
  };
}
