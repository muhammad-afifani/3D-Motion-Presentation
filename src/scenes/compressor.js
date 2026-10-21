/**
 * Scene 7 — Kompresor gas dan hukum affinitas.
 * Alur: kontrol → store.set → deriveComp(state) → frame → { compressorRig, head–flow, power–speed, affinity, HUD }.
 * Angka dari gasCompressor / suctionFlow / speedForHead / affinity / compressorTrain (thermo.js); tanpa perhitungan di sini.
 */
import * as THREE from 'three';
import { html } from './sceneBase.js';
import { togglePlayPatch, toggleFreezePatch, tickPatch, compInitialState, compPressurePatch } from '../state/store.js';
import { deriveComp } from '../state/deriveComp.js';
import { GAS_COMPRESSOR } from '../model/presets.js';
import { createRenderer } from '../gfx/renderer.js';
import { createCompressorRig } from '../gfx/compressorRig.js';
import { fitCameraToBox } from '../gfx/fitCamera.js';
import { openPanelRect } from '../ui/formulaToggle.js';
import { createMultiLineChart } from '../charts/multiLineChart.js';
import { niceCeil } from '../charts/chartBase.js';
import { createTempLegend } from '../charts/legend.js';
import { slider, button } from '../ui/controls.js';
import { animSpeedSlider } from '../ui/animSpeed.js';
import { createHud } from '../ui/hud.js';
import { fmt } from '../ui/format.js';
import { STR } from '../ui/strings.js';
import { CV } from '../charts/chartBase.js';

const S = STR.scene7, C = STR.common, U = STR.common.units, H = STR.scene7.hud, SU = STR.scene7.units;

/** title / message dibaca saat dipakai (bukan saat modul dimuat) agar ikut bahasa aktif. */
export const meta = { id: 'compressor', number: 7, get title() { return S.title; }, get message() { return S.message; } };

const LABEL_KEYS = ['impeller', 'volute', 'inlet', 'discharge', 'coupling'];
const WHATIF = CV.cold;

/** Item HUD baris kompresor (diekspor untuk tes). */
export function compHudItems() {
  return [
    { id: 'rp', help: 'hud.pressureRatio', label: H.rp.label, unit: '', model: H.rp.model, value: (f) => fmt(f.comp.rp, 2), tip: H.rp.tip },
    { id: 'head', help: 'hud.head', label: H.head.label, unit: SU.kJkg, model: H.head.model, value: (f) => fmt(f.comp.head / 1e3, 1), tip: H.head.tip },
    { id: 'pw', help: 'hud.compPower', label: H.power.label, unit: U.MW, model: H.power.model, value: (f) => fmt(f.comp.power / 1e6, 2), tip: H.power.tip },
    { id: 'tdis', help: 'hud.dischargeT', label: H.tdis.label, unit: U.K, model: H.tdis.model, value: (f) => fmt(f.comp.Tdis, 0), tip: H.tdis.tip },
    { id: 'q', help: 'hud.suctionFlow', label: H.flow.label, unit: SU.m3s, model: H.flow.model, value: (f) => fmt(f.comp.Q, 3), tip: H.flow.tip },
    { id: 'n', help: 'hud.speedRequired', label: H.nreq.label, unit: SU.pct, model: H.nreq.model, value: (f) => fmt(f.Nreq * 100, 1), tip: H.nreq.tip },
  ];
}

/** Item HUD baris compressor drive (diekspor untuk tes). Basis lengkap di samping ppm. */
export function driveHudItems(f) {
  const b = f.basis;
  const flagB = b.isDefault ? undefined : C.basis.flag;
  return [
    { id: 'pt', help: 'hud.ptAvailable', label: H.pt.label, unit: U.MW, model: H.pt.model, value: (x) => fmt(x.train.ptPower / 1e6, 2), tip: H.pt.tip },
    { id: 'load', help: 'hud.turbineLoad', label: H.load.label, unit: SU.pct, model: H.load.model, flag: f.train.inRange ? undefined : H.outOfRange, value: (x) => fmt(x.train.loadRaw * 100, 1), tip: H.load.tip },
    { id: 'ngg', help: 'hud.nGG', label: H.ngg.label, unit: '', model: H.ngg.model, value: (x) => H.ngg.value(x.train.Ngg), tip: H.ngg.tip },
    { id: 'tf', help: 'hud.flameT', label: H.flame.label, unit: U.K, model: H.flame.model, value: (x) => fmt(x.train.Tflame, 0), tip: H.flame.tip },
    { id: 'nox', help: 'hud.noxPpm', label: H.nox.label, unit: H.nox.unit, sub: C.basis.tile(b.refO2, b.TrefC), flag: flagB, value: (x) => fmt(x.train.nox, x.train.nox < 10 ? 2 : 1), tip: H.nox.tip },
    { id: 'co', help: 'hud.coPpm', label: H.co.label, unit: H.co.unit, sub: C.basis.tileCO(b.refO2, b.TrefC), flag: flagB, value: (x) => fmt(x.train.co, 1), tip: H.co.tip },
  ];
}

/** Pesan kunci (diekspor untuk tes): arah & besar pergeseran hasil model, tanpa klaim unit nyata. */
export function keyMessage(f) {
  if (f.shift.atDesign) return S.messageDesign(f.Nreq, f.train.loadRaw, f.train.Tflame);
  return S.messageShift(f.Nreq, f.shift.dN, f.train.loadRaw, f.shift.dLoad, f.shift.dTflame);
}

/** @param {import('./sceneBase.js').SceneContext} ctx */
export function createScene(ctx) {
  const { store } = ctx;
  const disposers = [];
  let rigBox = null, fitKey = '';
  let el, gfx = null, rig = null, legend, hq, pn, hudComp = null, hudDrive = null, driveKey = '', hqKey = '', pnKey = '', lastMsg = '';
  const ctl = {};
  const labelEls = {};
  const v3 = new THREE.Vector3();

  const q = (sel) => el.querySelector(sel);
  const cache = new Map();
  const setText = (n, t) => { if (cache.get(n) !== t) { n.textContent = t; cache.set(n, t); } };
  const setHTML = (n, t) => { if (cache.get(n) !== t) { n.innerHTML = t; cache.set(n, t); } };

  function buildDom() {
    el = html(`
      <section class="scene scene--load scene--comp">
        <div class="pl-view">
          <div class="view3d"></div>
          <div class="overlay overlay--formula overlay--aff num">
            <div class="f-line"><b>${S.affinity.title}</b> <span class="aff-level">${S.affinity.level}</span></div>
            <div class="f-line">${S.affinity.formula}</div>
            <div class="f-vals"><span data-k="at"></span></div>
            <div class="f-vals"><span data-k="flow"></span></div>
            <div class="f-vals"><span data-k="head"></span></div>
            <div class="f-vals"><span data-k="power"></span></div>
          </div>
          <div class="overlay overlay--note"></div>
          <div class="overlay overlay--legend"></div>
          <div class="overlay overlay--labels"></div>
          <div class="overlay overlay--status num"></div>
          <div class="view3d__fallback" hidden>${C.webglFallback}</div>
        </div>
        <div class="pl-emis chart-slot"></div>
        <div class="pl-aux chart-slot"></div>
        <div class="scene__controls"></div>
        <div class="pl-hud">
          <div class="pl-hud__row"><div class="pl-hud__title" data-k="demo"></div><div class="pl-hud__body" data-hud="comp"></div></div>
          <div class="pl-hud__row"><div class="pl-hud__title">${S.driveRow}</div><div class="pl-hud__body" data-hud="drive"></div></div>
          <div class="hud__note"><span class="level" role="button" tabindex="0" data-basis="compressor" data-tip="${STR.basis.tagTip}">${STR.basis.tag} · ${C.level.real}</span><span data-k="designLine"></span></div>
        </div>
      </section>`);
    q('.overlay--note').textContent = S.note;
    ctx.root.appendChild(el);
  }

  function buildControls() {
    const s = store.get();
    const R = GAS_COMPRESSOR.ranges;
    ctl.Psuc = slider({ help: 'ctl.suctionP', label: S.Psuc, ...R.Psuc, value: s.cPsuc, digits: 1, unit: SU.bar, tip: S.tips.Psuc, onInput: (v) => store.set(compPressurePatch(store.get(), { Psuc: v })) });
    ctl.Pdis = slider({ help: 'ctl.dischargeP', label: S.Pdis, ...R.Pdis, value: s.cPdis, digits: 0, unit: SU.bar, tip: S.tips.Pdis, onInput: (v) => store.set(compPressurePatch(store.get(), { Pdis: v })) });
    ctl.MW = slider({ help: 'ctl.gasMW', label: S.MW, ...R.MW, value: s.cMW, digits: 1, unit: SU.MW, tip: S.tips.MW, onInput: (v) => store.set({ cMW: v }) });
    ctl.mdot = slider({ help: 'ctl.massFlow', label: S.mdot, ...R.mdot, value: s.cMdot, digits: 1, unit: SU.kgs, tip: S.tips.mdot, onInput: (v) => store.set({ cMdot: v }) });
    ctl.speed = slider({ help: 'ctl.speedWhatIf', label: S.speed, ...R.speed, value: s.cSpeed, digits: 0, unit: SU.pct, tip: S.tips.speed, onInput: (v) => store.set({ cSpeed: v }) });
    ctl.rpm = animSpeedSlider(store);
    ctl.play = button({ help: 'ctl.play', label: C.pause, key: C.keySpace, tip: C.tips.play, onClick: () => store.set(togglePlayPatch(store.get())) });
    ctl.freeze = button({ help: 'ctl.freeze', label: C.freeze, key: 'F', tip: C.tips.freeze, onClick: () => store.set(toggleFreezePatch(store.get())) });
    ctl.reset = button({ help: 'ctl.reset', label: C.reset, key: 'R', tip: S.tips.reset, onClick: () => resetParams() });
    const g1 = html('<div class="ctl-group"></div>');
    g1.append(ctl.Psuc.el, ctl.Pdis.el, ctl.MW.el, ctl.mdot.el, ctl.speed.el);
    const g2 = html('<div class="ctl-group ctl-group--buttons"></div>');
    g2.append(ctl.rpm.el, ctl.play.el, ctl.freeze.el, ctl.reset.el);
    q('.scene__controls').append(g1, g2);
  }

  function resetParams() { store.set(compInitialState()); ctx.toast?.(STR.app.toast.reset); }

  function syncControls(s, changed) {
    ctl.Psuc.set(s.cPsuc); ctl.Pdis.set(s.cPdis); ctl.MW.set(s.cMW); ctl.mdot.set(s.cMdot); ctl.speed.set(s.cSpeed); ctl.rpm.set(s.animSpeed);
    if (changed.includes('playing') || changed.includes('frozen')) {
      ctl.play.setLabel(s.playing ? C.pause : C.play);
      ctl.play.setOn(!s.playing);
      ctl.play.setDisabled(s.frozen);
      ctl.freeze.setLabel(s.frozen ? C.unfreeze : C.freeze);
      ctl.freeze.setOn(s.frozen);
    }
  }

  function updateHud(f) {
    if (!hudComp) hudComp = createHud(q('[data-hud="comp"]'), compHudItems());
    hudComp.update(f);
    const key = `${f.basis.refO2}|${f.basis.TrefC}|${f.train.inRange}`;
    if (key !== driveKey) { hudDrive?.dispose(); driveKey = key; hudDrive = createHud(q('[data-hud="drive"]'), driveHudItems(f)); }
    hudDrive.update(f);
    setText(q('[data-k="demo"]'), S.demoCase(f.comp.mdot));
    setText(q('[data-k="designLine"]'), H.designLine(f.design.load));
  }

  function updateCharts(f) {
    const c = f.curve;
    const kq = `${c.Q[0]}|${c.H[0]}|${c.N.length}`;
    if (kq !== hqKey) {
      hqKey = kq;
      const xMax = niceCeil(Math.max(...c.Q, f.comp.Qd) * 1.08);
      const yMax = niceCeil(Math.max(...c.H, f.comp.Hd / 1e3) * 1.08);
      hq.setData({ series: [{ x: c.Q, y: c.H, color: CV.fg }], xDomain: [0, xMax], yDomain: [0, yMax], xFmt: (v) => fmt(v, v < 10 ? 1 : 0) });
      hq.setCaption(S.charts.hq.caption);
      pnKey = '';
    }
    hq.setPoints([
      { x: f.comp.Qd, y: f.comp.Hd / 1e3, fill: 'transparent', ring: CV.main, guide: false },
      { x: f.whatIf.Q, y: f.whatIf.H / 1e3, fill: WHATIF },
      { x: f.comp.Q, y: f.comp.head / 1e3, fill: CV.ring, ring: CV.ring },
    ]);
    const kp = `${kq}|${f.train.ptPower}`;
    if (kp !== pnKey) {
      pnKey = kp;
      const yMax = niceCeil(Math.max(...c.P, f.train.ptPower / 1e6) * 1.1);
      pn.setData({
        series: [{ x: c.N, y: c.P, color: CV.fg }],
        xDomain: [c.N[0], c.N[c.N.length - 1]], yDomain: [0, yMax], xFmt: (v) => fmt(v, 0),
        hlines: [{ y: f.train.ptPower / 1e6, color: CV.main, label: S.charts.pn.ptLine }],
      });
      pn.setCaption(S.charts.pn.caption);
    }
    pn.setPoints([
      { x: f.whatIf.N * 100, y: f.whatIf.P / 1e6, fill: WHATIF },
      { x: f.Nreq * 100, y: f.comp.power / 1e6, fill: CV.ring },
    ]);
  }

  function updateOverlay(f, s) {
    const A = S.affinity, r = f.whatIf.ratio;
    for (const n of el.querySelectorAll('.overlay--aff [data-k]')) {
      const k = n.dataset.k;
      if (k === 'at') setText(n, A.at(f.whatIf.N, f.Nreq, r));
      else if (k === 'flow') setText(n, A.flow(f.whatIf.Q, r));
      else if (k === 'head') setText(n, A.head(f.whatIf.H, r));
      else if (k === 'power') setText(n, A.power(f.whatIf.P, r));
    }
    const st = [];
    if (s.frozen) st.push(`<span class="pill pill--freeze">${C.frozen(s.theta)}</span>`);
    else if (!s.playing) st.push(`<span class="pill">${C.paused}</span>`);
    setHTML(q('.overlay--status'), st.join(' '));
    legend.update({ T: f.comp.Tdis, tempScale: f.tempScale });
    const msg = keyMessage(f);
    if (msg !== lastMsg) { lastMsg = msg; ctx.setMessage?.(msg); }
  }

  /**
   * Bingkai seluruh rakitan (impeller, volute, pipa suction & discharge) dari Box3 rig, dengan margin dan sebagian
   * tinggi kartu rumus (diukur seperti saat terbuka, jadi bingkai sama walau panel terlipat) disisihkan; dihitung ulang saat ukuran tampilan berubah (arah orbit pengguna dipertahankan).
   */
  function fitView(force = false) {
    const view = q('.view3d'), w = view.clientWidth, h = view.clientHeight;
    const key = `${w}x${h}`;
    if (!gfx || !rigBox || !w || !h || (!force && key === fitKey)) return;
    fitKey = key;
    const aff = openPanelRect(q('.overlay--aff')), top = Math.min(0.4, Math.max(0, (aff.bottom - view.getBoundingClientRect().top) / h));
    gfx.camera.aspect = w / h;
    const direction = gfx.camera.position.clone().sub(gfx.controls.target);
    const { distance, target } = fitCameraToBox(gfx.camera, rigBox, { width: w, height: h, margin: 0.03, insets: { top }, direction });
    gfx.controls.target.copy(target);
    gfx.controls.minDistance = distance * 0.3;
    gfx.controls.maxDistance = distance * 2.5; // batas jarak default renderer (6) memotong kamera pada rakitan besar
    gfx.controls.update();
  }

  function updateLabels() {
    const box = q('.overlay--labels');
    const w = box.clientWidth, h = box.clientHeight;
    for (const k of LABEL_KEYS) {
      const a = rig.anchors[k];
      if (!a) continue;
      let n = labelEls[k];
      if (!n) { n = labelEls[k] = document.createElement('div'); n.className = 'label3d'; box.appendChild(n); }
      setText(n, S.labels3d[k]);
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
      hq = createMultiLineChart(q('.pl-emis'), { title: S.charts.hq.title, modelLevel: 'real', basis: 'compressor', xLabel: S.charts.hq.xLabel, yLabel: S.charts.hq.yLabel, indicative: false });
      pn = createMultiLineChart(q('.pl-aux'), { title: S.charts.pn.title, modelLevel: 'ideal', basis: 'compressor', xLabel: S.charts.pn.xLabel, yLabel: S.charts.pn.yLabel, indicative: false });
      legend = createTempLegend(q('.overlay--legend'), { title: S.tempLegend, tickStep: 50 });
      try {
        gfx = createRenderer(q('.view3d'), { camPos: [1.6, 0.9, 3.4], target: [0.1, 0.25, 0] });
        rig = createCompressorRig();
        gfx.scene.add(rig.group);
        rigBox = rig.bounds();
      } catch (err) {
        console.warn('[compressor] 3D dinonaktifkan:', err);
        gfx = null; rig = null;
        q('.view3d__fallback').hidden = false;
      }
      disposers.push(store.subscribe((s, prev, changed) => syncControls(s, changed)));
      syncControls(store.get(), ['playing', 'frozen']);
    },
    update(dt) {
      store.set(tickPatch(store.get(), dt));
      const s = store.get();
      const f = deriveComp(s);
      updateHud(f);
      updateCharts(f);
      updateOverlay(f, s);
      if (gfx) {
        fitView();
        rig.update(f, s.playing && !s.frozen ? dt : 0);
        gfx.render();
        updateLabels();
      }
    },
    onKey(e) {
      if (e.key.toLowerCase() === 'r') { resetParams(); return true; }
      return false;
    },
    dispose() {
      for (const d of disposers.splice(0)) d();
      if (rig) { gfx.scene.remove(rig.group); rig.dispose(); }
      gfx?.dispose();
      hq?.dispose(); pn?.dispose(); legend?.dispose(); hudComp?.dispose(); hudDrive?.dispose();
      el?.remove();
    },
  };
}
