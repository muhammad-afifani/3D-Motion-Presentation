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
import { FLAME_MODES, FLAME_RANGES } from '../model/presets.js';
import { createRenderer } from '../gfx/renderer.js';
import { createChamberCloseup, createCanCombustor } from '../gfx/combustorRig.js';
import { displayState } from '../gfx/quality.js';
import { createFlameChart } from '../charts/flameChart.js';
import { createBarChart } from '../charts/barChart.js';
import { slider, segmented, button } from '../ui/controls.js';
import { animSpeedSlider } from '../ui/animSpeed.js';
import { createHud } from '../ui/hud.js';
import { fmt, pct } from '../ui/format.js';
import { STR, signedDeg } from '../ui/strings.js';

const S = STR.scene3, C = STR.common, U = STR.common.units, H = STR.scene3.hud;

/** title / message dibaca saat dipakai (bukan saat modul dimuat) agar ikut bahasa aktif. */
export const meta = { id: 'combustion', number: 3, get title() { return S.title; }, get message() { return S.message; } };

const F_KEYS = ['fMode', 'fPhi', 'fPhiLocal'];
const KEYS_MODE = { 1: 'diesel', 2: 'gas', 3: 'turbine' };
const CAM = {
  piston: { pos: [0.075, -0.002, 0.13], target: [-0.01, -0.011, 0] },
  turbine: { pos: [0.45, 0.32, 0.95], target: [0.32, 0, 0] },
};

/** HUD per mode (label & tooltip dari STR.scene3.hud). */
function hudItems(mode) {
  const items = [{ id: 'tf', help: 'hud.flameT', label: H.tflame.label, unit: U.K, value: (f) => fmt(f.Tflame, 0), tip: H.tflame.tip(mode === 'diesel') }];
  if (mode === 'diesel') items.push({ id: 'dT', help: 'hud.localDeltaT', label: H.dT.label, unit: U.K, value: (f) => `+${fmt(f.dTlocal, 0)}`, tip: H.dT.tip });
  items.push(
    { id: 'phi', help: 'ctl.equivalence', label: S.phiLabel[mode], unit: '', value: (f) => fmt(f.phi, 2), tip: mode === 'turbine' ? H.phiTip.turbine : H.phiTip.other },
    { id: 'tin', help: 'ctl.intakeT', label: H.tin.label, unit: U.K, value: (f) => fmt(f.Tin, 0), tip: mode === 'turbine' ? H.tin.tipTurbine : H.tin.tipPiston },
  );
  if (mode === 'turbine') items.push({ id: 'q', help: 'hud.qin', label: H.q.label, unit: U.kJkg, value: (f) => fmt(f.qin / 1e3, 0), tip: H.q.tip });
  else items.push({ id: 'hr', help: 'hud.heatRelease', label: H.hr.label, unit: U.pct, value: (f) => pct(f.intensity, 0), tip: H.hr.tip });
  return items;
}

/** @param {import('./sceneBase.js').SceneContext} ctx */
export function createScene(ctx) {
  const { store } = ctx;
  const disposers = [];
  let el, gfx = null, chamber = null, can = null, chart, bars, hud = null, hudKey = '';
  let sim = null, simKeyNow = null, camMode = '';
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
            <div class="fl-big"><span>${S.overlay.tflameLabel}</span> <b data-k="tf"></b></div>
            <div class="f-vals"><span data-k="mix"></span></div>
            <div class="f-vals f-vals--dim"><span data-k="phase"></span></div>
          </div>
          <div class="overlay overlay--notes"></div>
          <div class="overlay overlay--status num"></div>
          <div class="cyc-level" role="button" tabindex="0" data-basis="flame">${STR.basis.tag} · ${C.level.semiEmpirical}</div>
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
    ctl.mode = segmented({ help: 'ctl.mixMode',
      label: S.chamber,
      options: Object.keys(FLAME_MODES).map((value, i) => ({ value, label: S.modes[value], key: String(i + 1) })),
      value: s.fMode, onChange: (v) => setMode(v),
    });
    ctl.phi = slider({ help: 'ctl.equivalence', label: S.phiLabel[s.fMode], ...FLAME_RANGES.phi, value: s.fPhi, digits: 2, onInput: (v) => store.set({ fPhi: v }) });
    ctl.phiLocal = slider({ help: 'ctl.localPhi', label: S.phiLocal, ...FLAME_RANGES.phiLocal, value: s.fPhiLocal, digits: 2, tip: S.tips.phiLocal, onInput: (v) => store.set({ fPhiLocal: v }) });
    ctl.tin = slider({ help: 'ctl.intakeT', label: S.tin, ...FLAME_RANGES.Tin, value: 300, digits: 0, unit: U.K, tip: S.tips.tin, onInput: (v) => store.set({ fTin: v }) });
    ctl.tinModel = button({ help: 'ctl.intakeModel', label: S.tinModel, tip: S.tips.tinModel, onClick: () => store.set({ fTin: null }) });
    ctl.focus = button({ help: 'ctl.focus', label: S.focus, tip: S.tips.focus, onClick: () => store.set({ fFocus: !store.get().fFocus }) });
    ctl.theta = slider({ help: 'ctl.crankAngle', label: C.crankAngle, min: -360, max: 360, step: 0.5, value: s.theta, format: signedDeg, tip: C.tips.crankAngle, onInput: (v) => store.set(scrubPatch(store.get(), v)) });
    ctl.rpm = animSpeedSlider(store);
    ctl.play = button({ help: 'ctl.play', label: C.pause, key: C.keySpace, tip: C.tips.play, onClick: () => store.set(togglePlayPatch(store.get())) });
    ctl.freeze = button({ help: 'ctl.freeze', label: C.freeze, key: 'F', tip: C.tips.freeze, onClick: () => store.set(toggleFreezePatch(store.get())) });
    ctl.bloom = button({ help: 'ctl.bloom', label: S.bloom.auto, key: 'B', tip: S.tips.bloom, onClick: cycleBloom });
    ctl.reset = button({ help: 'ctl.reset', label: C.reset, key: 'R', tip: S.tips.reset, onClick: () => setMode(store.get().fMode, true) });

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
  /** Bloom global (Auto → On → Off), sama dengan tombol B di semua scene. */
  const cycleBloom = () => store.set(bloomCyclePatch(store.get()));

  function syncControls(s, changed) {
    const piston = s.fMode !== 'turbine';
    if (changed.includes('fMode')) {
      ctl.mode.set(s.fMode);
      ctl.phi.el.querySelector('label').textContent = S.phiLabel[s.fMode];
      ctl.phiLocal.el.hidden = s.fMode !== 'diesel';
      for (const c of [ctl.theta, ctl.rpm, ctl.focus]) c.el.hidden = !piston;
      hudKey = '';
    }
    ctl.phi.set(s.fPhi); ctl.phiLocal.set(s.fPhiLocal); ctl.rpm.set(s.animSpeed);
    ctl.focus.setOn(s.fFocus);
    ctl.bloom.setLabel(S.bloom[s.bloomMode]);
    ctl.bloom.setOn(s.bloomMode !== 'off');
    if (changed.includes('playing') || changed.includes('frozen')) {
      ctl.play.setLabel(s.playing ? C.pause : C.play);
      ctl.play.setOn(!s.playing);
      ctl.play.setDisabled(s.frozen);
      ctl.freeze.setLabel(s.frozen ? C.unfreeze : C.freeze);
      ctl.freeze.setOn(s.frozen);
      ctl.theta.setLocked(s.frozen);
    }
  }

  function updateHud(f) {
    if (f.mode !== hudKey) {
      hud?.dispose();
      hudKey = f.mode;
      hud = createHud(q('.fl-hud'), hudItems(f.mode), {
        level: C.level.semiEmpirical, basis: 'flame',
        note: H.note,
      });
    }
    hud.update(f);
  }

  function updateOverlay(f, s) {
    const O = S.overlay;
    for (const n of el.querySelectorAll('[data-k]')) {
      const k = n.dataset.k;
      if (k === 'tf') setText(n, `${fmt(f.Tflame, 0)} ${U.K}`);
      else if (k === 'mix') setText(n, f.mode === 'diesel' ? O.mixDiesel(f.phi, f.phiLocal, f.dTlocal) : f.mode === 'gas' ? O.mixGas(f.phi) : O.mixTurbine(f.phi, f.Tin));
      else if (k === 'phase') setText(n, f.rig ? O.phasePiston(f.theta, C.phase[f.rig.phase] ?? f.rig.phase, f.intensity * 100) : O.phaseTurbine(f.qin / 1e3));
    }
    const notes = [];
    if (f.mode === 'turbine') notes.push(S.notes.premix(f.T3, f.phiOverall));
    if (f.TinManual) notes.push(S.notes.tinManual(f.TinModel));
    setHTML(q('.overlay--notes'), notes.map((t) => `<div class="note-chip note-chip--info">ⓘ ${t}</div>`).join(''));
    const on = displayState().bloom;
    const st = [`<span class="pill">${S.status.bloom(on, !on && s.bloomMode === 'auto')}</span>`];
    if (s.frozen) st.push(`<span class="pill pill--freeze">${C.frozen(s.theta)}</span>`);
    else if (!s.playing) st.push(`<span class="pill">${C.paused}</span>`);
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
      chart = createFlameChart(q('.fl-chart'), { basis: 'flame' });
      bars = createBarChart(q('.fl-bars'), { basis: 'flame', title: S.bars.title, unit: U.K, xLabel: S.bars.xLabel, labelWidth: 210 });
      try {
        gfx = createRenderer(q('.view3d'), { camPos: CAM.piston.pos, target: CAM.piston.target });
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
      ctl.tin.el.querySelector('output').textContent = S.tinValue(f.Tin, f.TinManual);
      chart.update(f);
      bars.update(f.bars.map((b) => ({ label: S.bars.labels[b.mode], sub: S.bars.sub(b.phi, b.Tin), value: b.T, color: b.color, active: b.active })),
        { min: 1000, caption: S.bars.caption });
      updateHud(f);
      updateOverlay(f, s);
      if (gfx) {
        if (camMode !== (piston ? 'piston' : 'turbine')) { camMode = piston ? 'piston' : 'turbine'; setCamera(f.mode); }
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
