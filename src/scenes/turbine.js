/**
 * Scene 5 — Turbin gas: Brayton dari dekat.
 * Alur: kontrol → store.set → deriveTurbine(state) → frame → { turbineRig, T-s, P-v, HUD, legenda }.
 * Generator = braytonReal (single-shaft); Compressor drive = twinShaft() (sama dengan Scene 6).
 */
import * as THREE from 'three';
import { html } from './sceneBase.js';
import { togglePlayPatch, toggleFreezePatch, tickPatch, gtDefaults } from '../state/store.js';
import { deriveTurbine, gtKeyNumbers } from '../state/deriveTurbine.js';
import { GAS_TURBINES, GT_RANGES, GT_STAGES } from '../model/presets.js';
import { createRenderer } from '../gfx/renderer.js';
import { createGasTurbineRig } from '../gfx/turbineRig.js';
import { createCycleChart } from '../charts/cycleChart.js';
import { createTempLegend } from '../charts/legend.js';
import { slider, segmented, button } from '../ui/controls.js';
import { animSpeedSlider } from '../ui/animSpeed.js';
import { createHud } from '../ui/hud.js';
import { fmt, pct, fq, fqRate } from '../ui/format.js';
import { STR, unitSym, ratePerSym } from '../ui/strings.js';

const S = STR.scene5, C = STR.common, U = STR.common.units, H = STR.scene5.hud;

/** title / message dibaca saat dipakai (bukan saat modul dimuat) agar ikut bahasa aktif. */
export const meta = { id: 'turbine', number: 5, get title() { return S.title; }, get message() { return S.message; } };

const KEYS_CFG = { 1: 'generator', 2: 'compressorDrive' };
const CAM = { generator: { pos: [-0.2, 1.7, 5.6], target: [-0.9, 0.05, 0] }, compressorDrive: { pos: [1.1, 1.7, 5.9], target: [0.8, 0.05, 0] } };

function hudItems(cfg, perDegRef) {
  const twin = cfg !== 'generator';
  return [
    { id: 'eta', help: 'hud.etaThermal', label: H.eta.label, unit: U.pct, value: (f) => pct(f.eta, 1), tip: H.eta.tip },
    { id: 'hr', help: 'hud.heatRate', label: H.heatRate.label, unit: unitSym('heatRate'), value: (f) => fq(f.heatRate, 'heatRate', { digits: 0 }), tip: H.heatRate.tip },
    { id: 'pw', help: 'hud.power', label: H.power.label(GAS_TURBINES[cfg].mdot), unit: unitSym('power', 'MW'), value: (f) => fq(f.power, 'power', { digits: 2, native: 'MW' }), tip: H.power.tip(GAS_TURBINES[cfg].mdot) },
    { id: 'bwr', help: 'hud.bwr', label: H.bwr.label, unit: U.pct, value: (f) => pct(f.bwr, 0), tip: H.bwr.tip },
    { id: 'tex', help: 'hud.exhaustT', label: H.texh.label(twin), unit: unitSym('temperature'), value: (f) => fq(f.Texh, 'temperature', { digits: 0 }), tip: H.texh.tip },
    { id: 'der', help: 'hud.derating', label: `${H.derate.label}${perDegRef ? H.refSuffix() : ''}`, unit: ratePerSym('%', 'temperature', { kAsC: true }), model: H.derateModel[cfg], value: (f) => fqRate(f.perDegC, 'temperature', { digits: 2, scale: 100, kAsC: true }), tip: H.derate.tip(perDegRef) },
    { id: 'iso', help: 'hud.powerIso', label: H.powerIso.label, unit: U.pct, model: H.derateModel[cfg], value: (f) => `${f.derate >= 1 ? '+' : '−'}${fmt(Math.abs(f.derate - 1) * 100, 1)}`, tip: H.powerIso.tip },
    { id: 'n', help: 'hud.speed', label: H.speed.label, unit: '', value: (f) => (f.twin ? S.speedTwin(f.N.gg, f.N.pt) : S.speedGen(f.N.rpm)), tip: twin ? H.speed.tipTwin : H.speed.tipGen },
  ];
}

/** @param {import('./sceneBase.js').SceneContext} ctx */
export function createScene(ctx) {
  const { store } = ctx;
  const disposers = [];
  let el, gfx = null, rigs = {}, ts, pv, legend, hud = null, hudKey = '', camCfg = '';
  const ctl = {};
  const labelEls = {};
  const v3 = new THREE.Vector3();

  const q = (sel) => el.querySelector(sel);
  const cache = new Map();
  const setText = (n, t) => { if (cache.get(n) !== t) { n.textContent = t; cache.set(n, t); } };
  const setHTML = (n, t) => { if (cache.get(n) !== t) { n.innerHTML = t; cache.set(n, t); } };

  function buildDom() {
    el = html(`
      <section class="scene scene--gt">
        <div class="gt-view">
          <div class="view3d"></div>
          <div class="overlay overlay--formula num">
            <div class="f-line"><b data-k="bwr"></b></div>
            <div class="f-vals"><span data-k="amb"></span></div>
            <div class="f-vals f-vals--dim"><span data-k="t45"></span></div>
          </div>
          <div class="overlay overlay--legend"></div>
          <div class="overlay overlay--labels"></div>
          <div class="overlay overlay--status num"></div>
          <div class="cyc-level" role="button" tabindex="0" data-basis="realCycles">${STR.basis.tag} · ${C.level.real}</div>
          <div class="view3d__fallback" hidden>${C.webglFallback}</div>
        </div>
        <div class="gt-ts chart-slot"></div>
        <div class="gt-pv chart-slot"></div>
        <div class="scene__controls"></div>
        <div class="gt-hud"></div>
      </section>`);
    ctx.root.appendChild(el);
  }

  function buildControls() {
    const s = store.get();
    ctl.cfg = segmented({ help: 'ctl.turbineConfig', label: S.config, tip: S.tips.config, options: [{ value: 'generator', label: S.configs.generator, key: '1' }, { value: 'compressorDrive', label: S.configs.compressorDrive, key: '2' }], value: s.gCfg, onChange: (v) => setCfg(v) });
    ctl.rp = slider({ help: 'ctl.pressureRatio', label: S.rp, ...GT_RANGES.rp, value: s.gRp, digits: 1, tip: S.tips.rp, onInput: (v) => store.set({ gRp: v }) });
    ctl.T3 = slider({ help: 'ctl.turbineInletT', label: S.T3, ...GT_RANGES.T3, value: s.gT3, digits: 0, qty: 'temperature', from: 'K', tip: S.tips.T3, onInput: (v) => store.set({ gT3: v }) });
    ctl.etaC = slider({ help: 'ctl.etaC', label: S.etaC, ...GT_RANGES.etaC, value: s.gEtaC, digits: 3, tip: S.tips.etaC, onInput: (v) => store.set({ gEtaC: v }) });
    ctl.etaT = slider({ help: 'ctl.etaT', label: S.etaT, ...GT_RANGES.etaT, value: s.gEtaT, digits: 3, tip: S.tips.etaT, onInput: (v) => store.set({ gEtaT: v }) });
    ctl.etaGG = slider({ help: 'ctl.etaGG', label: S.etaGG, ...GT_RANGES.etaT, value: s.gEtaGG, digits: 3, tip: S.tips.etaGG, onInput: (v) => store.set({ gEtaGG: v }) });
    ctl.etaPT = slider({ help: 'ctl.etaPT', label: S.etaPT, ...GT_RANGES.etaT, value: s.gEtaPT, digits: 3, tip: S.tips.etaPT, onInput: (v) => store.set({ gEtaPT: v }) });
    ctl.Tamb = slider({ help: 'ctl.ambientT', label: S.Tamb, ...GT_RANGES.Tamb, value: s.gTamb, digits: 0, qty: 'temperature', from: 'C', kAsC: true, tip: S.tips.Tamb, onInput: (v) => store.set({ gTamb: v }) });
    ctl.rpm = animSpeedSlider(store);
    ctl.play = button({ help: 'ctl.play', label: C.pause, key: C.keySpace, tip: C.tips.play, onClick: () => store.set(togglePlayPatch(store.get())) });
    ctl.freeze = button({ help: 'ctl.freeze', label: C.freeze, key: 'F', tip: C.tips.freeze, onClick: () => store.set(toggleFreezePatch(store.get())) });
    ctl.reset = button({ help: 'ctl.reset', label: C.reset, key: 'R', tip: S.tips.reset, onClick: () => setCfg(store.get().gCfg, true) });
    const g1 = html('<div class="ctl-group"></div>');
    g1.append(ctl.cfg.el, ctl.rp.el, ctl.T3.el, ctl.etaC.el, ctl.etaT.el, ctl.etaGG.el, ctl.etaPT.el, ctl.Tamb.el);
    const g2 = html('<div class="ctl-group ctl-group--buttons"></div>');
    g2.append(ctl.rpm.el, ctl.play.el, ctl.freeze.el, ctl.reset.el);
    q('.scene__controls').append(g1, g2);
  }

  /** Ganti konfigurasi: parameter ke titik desain konfigurasi tsb; ambient tetap kecuali reset. */
  function setCfg(cfg, force = false) {
    const s = store.get();
    if (cfg !== s.gCfg || force) store.set({ ...gtDefaults(cfg), ...(force ? { gTamb: 15 } : {}) });
  }

  function syncControls(s, changed) {
    const twin = s.gCfg !== 'generator';
    if (changed.includes('gCfg')) {
      ctl.cfg.set(s.gCfg);
      ctl.etaT.el.hidden = twin;
      ctl.etaGG.el.hidden = !twin; ctl.etaPT.el.hidden = !twin;
      hudKey = '';
    }
    ctl.rp.set(s.gRp); ctl.T3.set(s.gT3); ctl.etaC.set(s.gEtaC); ctl.etaT.set(s.gEtaT); ctl.etaGG.set(s.gEtaGG); ctl.etaPT.set(s.gEtaPT); ctl.Tamb.set(s.gTamb); ctl.rpm.set(s.animSpeed);
    if (changed.includes('playing') || changed.includes('frozen')) {
      ctl.play.setLabel(s.playing ? C.pause : C.play);
      ctl.play.setOn(!s.playing);
      ctl.play.setDisabled(s.frozen);
      ctl.freeze.setLabel(s.frozen ? C.unfreeze : C.freeze);
      ctl.freeze.setOn(s.frozen);
    }
  }

  function updateHud(f) {
    const key = `${f.cfg}|${f.perDegRef}`;
    if (key !== hudKey) {
      hud?.dispose();
      hudKey = key;
      hud = createHud(q('.gt-hud'), hudItems(f.cfg, f.perDegRef), { level: C.level.real, basis: 'realCycles', note: H.note });
    }
    hud.update(f);
  }

  function updateOverlay(f, s) {
    for (const n of el.querySelectorAll('[data-k]')) {
      const k = n.dataset.k;
      if (k === 'bwr') setText(n, S.overlay.bwr(f.bwr));
      else if (k === 'amb') setText(n, S.overlay.ambient(f.Tamb, f.derate));
      else if (k === 't45') setText(n, f.twin ? S.overlay.t45(f.T45) : '');
    }
    const st = [];
    if (s.frozen) st.push(`<span class="pill pill--freeze">${C.frozen(s.theta)}</span>`);
    else if (!s.playing) st.push(`<span class="pill">${C.paused}</span>`);
    setHTML(q('.overlay--status'), st.join(' '));
    legend.update({ T: f.point.T, tempScale: f.tempScale });
  }

  /** Label komponen 3D (anchor rig → posisi layar). */
  function updateLabels(rig, f) {
    const box = q('.overlay--labels');
    const w = box.clientWidth, h = box.clientHeight;
    const L = S.labels3d;
    const names = { compressor: L.compressor, combustor: L.combustor, turbine: f.twin ? L.ggTurbine : L.turbine, powerTurbine: L.powerTurbine, load: f.twin ? L.gasCompressor : L.generator };
    for (const k of Object.keys(labelEls)) labelEls[k].style.display = 'none';
    for (const [k, name] of Object.entries(names)) {
      const a = rig.anchors[k];
      if (!a) continue;
      let n = labelEls[k];
      if (!n) { n = labelEls[k] = document.createElement('div'); n.className = 'label3d'; box.appendChild(n); }
      setText(n, name);
      a.getWorldPosition(v3).project(gfx.camera);
      n.style.display = v3.z < 1 ? '' : 'none';
      n.style.transform = `translate(${Math.round((v3.x * 0.5 + 0.5) * w)}px, ${Math.round((-v3.y * 0.5 + 0.5) * h)}px)`;
    }
  }

  return {
    meta,
    mount() {
      buildDom();
      buildControls();
      ts = createCycleChart(q('.gt-ts'), 'ts', { onHover: (i) => pv.highlight(i), basis: 'realCycles' });
      pv = createCycleChart(q('.gt-pv'), 'pv', { onHover: (i) => ts.highlight(i), basis: 'realCycles' });
      legend = createTempLegend(q('.overlay--legend'));
      try {
        gfx = createRenderer(q('.view3d'), { camPos: CAM.generator.pos, target: CAM.generator.target });
        gfx.controls.maxDistance = 12;
        rigs.generator = createGasTurbineRig({ config: 'single', compressorStages: GT_STAGES.compressor, turbineStages: GT_STAGES.turbine });
        rigs.compressorDrive = createGasTurbineRig({ config: 'twin', compressorStages: GT_STAGES.compressor, turbineStages: GT_STAGES.ggTurbine, ptStages: GT_STAGES.powerTurbine });
        gfx.scene.add(rigs.generator.group, rigs.compressorDrive.group);
      } catch (err) {
        console.warn('[turbine] 3D dinonaktifkan:', err);
        gfx = null;
        q('.view3d__fallback').hidden = false;
      }
      const kn = gtKeyNumbers();
      ctx.setMessage?.(S.messageWithNumbers(kn.bwr, kn.perDegC));
      disposers.push(store.subscribe((s, prev, changed) => syncControls(s, changed)));
      syncControls(store.get(), ['gCfg', 'playing', 'frozen']);
    },
    update(dt) {
      store.set(tickPatch(store.get(), dt));
      const s = store.get();
      const f = deriveTurbine(s);
      ts.update(f);
      pv.update(f);
      updateHud(f);
      updateOverlay(f, s);
      if (gfx) {
        if (camCfg !== f.cfg) {
          camCfg = f.cfg;
          const c = CAM[f.cfg];
          gfx.camera.position.set(...c.pos);
          gfx.controls.target.set(...c.target);
          gfx.controls.update();
        }
        const rig = rigs[f.cfg];
        rigs.generator.group.visible = !f.twin;
        rigs.compressorDrive.group.visible = f.twin;
        rig.update({ ...f, time: performance.now() / 1000 });
        gfx.render();
        updateLabels(rig, f);
      }
    },
    onKey(e) {
      const k = e.key.toLowerCase();
      if (KEYS_CFG[k]) { setCfg(KEYS_CFG[k]); return true; }
      if (k === 'r') { setCfg(store.get().gCfg, true); return true; }
      return false;
    },
    dispose() {
      for (const d of disposers.splice(0)) d();
      if (gfx) { for (const r of Object.values(rigs)) { gfx.scene.remove(r.group); r.dispose(); } gfx.dispose(); }
      ts?.dispose(); pv?.dispose(); legend?.dispose(); hud?.dispose();
      el?.remove();
    },
  };
}
