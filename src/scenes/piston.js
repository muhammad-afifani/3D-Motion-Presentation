/**
 * Scene 1 — Piston: dari engkol ke diagram P-V.
 * Alur: kontrol → store.set → (Worker) cylinderSim → derive(state, sim) → frame →
 *       { rig 3D, P-V, P-θ, HUD, legenda, rumus }.
 */
import * as THREE from 'three';
import { html } from './sceneBase.js';
import { resetPatch, engineSwitchPatch, togglePlayPatch, toggleFreezePatch, scrubPatch, tickPatch } from '../state/store.js';
import { derive, SIM_KEYS } from '../state/derive.js';
import { createSimClient } from '../state/simClient.js';
import { ENGINES, RPM_VISUAL } from '../model/presets.js';
import { createRenderer } from '../gfx/renderer.js';
import { createPistonRig } from '../gfx/pistonRig.js';
import { createPVChart } from '../charts/pvChart.js';
import { createLineChart } from '../charts/lineChart.js';
import { createTempLegend } from '../charts/legend.js';
import { slider, segmented, button } from '../ui/controls.js';
import { createHud } from '../ui/hud.js';
import { fmt, pct, toBar, toLiter, toMm } from '../ui/format.js';
import { STR, signedDeg, plusDeg } from '../ui/strings.js';

const S = STR.scene1, C = STR.common, U = STR.common.units;

export const meta = { id: 'piston', number: 1, title: S.title, message: S.message };

/** Anchor rig 3D yang diberi label (teks di STR.scene1.labels3d; 'top' = injektor/busi). */
const LABEL_KEYS = ['crank', 'rod', 'piston', 'valveIn', 'valveEx', 'gas', 'top'];

/** @param {import('./sceneBase.js').SceneContext} ctx */
export function createScene(ctx) {
  const { store } = ctx;
  const disposers = [];
  let sim = null;
  let gfx = null, rig = null;
  let pv, pth, legend, hud;
  let pthCurve = null;
  let showLabels = true;
  let lastR = store.get().r;
  let el;

  const simClient = createSimClient((s) => { sim = s; });

  function buildDom() {
    el = html(`
      <section class="scene scene--piston">
        <div class="scene__view">
          <div class="view3d"></div>
          <div class="overlay overlay--formula num" aria-live="off">
            <div class="f-line">${S.formula.s}</div>
            <div class="f-line">${S.formula.V}</div>
            <div class="f-vals">
              <span>${S.formula.theta}<b data-k="theta"></b></span>
              <span>${S.formula.x}<b data-k="x"></b></span>
              <span class="v-V">${S.formula.Vnow}<b data-k="V"></b></span>
            </div>
            <div class="f-vals f-vals--dim">
              <span>${S.formula.B}<b data-k="B"></b></span><span>${S.formula.a}<b data-k="a"></b></span><span>${S.formula.l}<b data-k="l"></b></span>
              <span class="v-vc">${S.formula.Vc}<b data-k="Vc"></b></span>
            </div>
          </div>
          <div class="overlay overlay--readout num">
            <div class="ro-phase" data-k="phase"></div>
            <div class="ro-grid">
              <span>${S.readout.P}</span><b data-k="P"></b>
              <span>${S.readout.T}</span><b data-k="T"></b>
              <span>${S.readout.xb}</span><b data-k="xb"></b>
            </div>
            <div class="gauge"><div class="gauge__bar"></div></div>
          </div>
          <div class="overlay overlay--legend"></div>
          <div class="overlay overlay--labels"></div>
          <div class="overlay overlay--status num"></div>
          <div class="view3d__fallback" hidden>${C.webglFallback}</div>
        </div>
        <aside class="scene__charts">
          <div class="chart-slot chart-slot--main"></div>
          <div class="chart-slot chart-slot--sub"></div>
        </aside>
        <div class="scene__controls"></div>
        <div class="scene__hud"></div>
      </section>`);
    el.querySelector('.gauge').dataset.tip = S.tips.gauge;
    ctx.root.appendChild(el);
  }

  const q = (sel) => el.querySelector(sel);
  const textCache = new Map();
  function setText(node, s) { if (textCache.get(node) !== s) { node.textContent = s; textCache.set(node, s); } }

  // ── kontrol ──
  let ctl = {};
  function buildControls() {
    const box = q('.scene__controls');
    const s = store.get();
    const R = ENGINES[s.engine].ranges;
    ctl.engine = segmented({
      label: S.engine,
      options: [{ value: 'diesel', label: S.engines.diesel, key: '1' }, { value: 'gas', label: S.engines.gas, key: '2' }],
      value: s.engine,
      onChange: (v) => switchEngine(v),
    });
    ctl.r = slider({ label: S.r, ...R.r, value: s.r, digits: 1, tip: S.tips.r, onInput: (v) => store.set({ r: v }) });
    ctl.phi = slider({ label: S.phi, ...R.phi, value: s.phi, digits: 2, tip: S.tips.phi, onInput: (v) => store.set({ phi: v }) });
    ctl.theta0 = slider({ label: S.theta0, ...R.theta0, value: s.theta0, format: signedDeg, tip: S.tips.theta0, onInput: (v) => store.set({ theta0: v }) });
    ctl.rpm = slider({ label: C.animSpeed, ...RPM_VISUAL, value: s.rpmVisual, digits: 0, unit: U.rpmVisual, tip: C.tips.animSpeed, onInput: (v) => store.set({ rpmVisual: v }) });
    ctl.theta = slider({ label: C.crankAngle, min: -360, max: 360, step: 0.5, value: s.theta, format: signedDeg, tip: C.tips.crankAngle, onInput: (v) => store.set(scrubPatch(store.get(), v)) });
    ctl.play = button({ label: C.pause, key: C.keySpace, tip: C.tips.play, onClick: () => store.set(togglePlayPatch(store.get())) });
    ctl.freeze = button({ label: C.freeze, key: 'F', tip: C.tips.freeze, onClick: () => store.set(toggleFreezePatch(store.get())) });
    ctl.reset = button({ label: C.reset, key: 'R', tip: S.tips.reset, onClick: resetParams });
    ctl.labels = button({ label: C.labels, key: 'L', tip: S.tips.labels, onClick: toggleLabels });
    ctl.labels.setOn(true);

    const g1 = html('<div class="ctl-group"></div>');
    g1.append(ctl.engine.el, ctl.r.el, ctl.phi.el, ctl.theta0.el);
    const g2 = html('<div class="ctl-group"></div>');
    g2.append(ctl.theta.el, ctl.rpm.el);
    const g3 = html('<div class="ctl-group ctl-group--buttons"></div>');
    g3.append(ctl.play.el, ctl.freeze.el, ctl.reset.el, ctl.labels.el);
    box.append(g1, g2, g3);
  }

  function syncControls(s, changed) {
    if (changed.includes('engine')) {
      const R = ENGINES[s.engine].ranges;
      ctl.engine.set(s.engine);
      ctl.r.setRange(R.r); ctl.phi.setRange(R.phi); ctl.theta0.setRange(R.theta0);
    }
    ctl.r.set(s.r); ctl.phi.set(s.phi); ctl.theta0.set(s.theta0); ctl.rpm.set(s.rpmVisual);
    if (changed.includes('playing') || changed.includes('frozen')) {
      ctl.play.setLabel(s.playing ? C.pause : C.play);
      ctl.play.setOn(!s.playing);
      ctl.play.setDisabled(s.frozen);
      ctl.freeze.setLabel(s.frozen ? C.unfreeze : C.freeze);
      ctl.freeze.setOn(s.frozen);
      ctl.theta.setLocked(s.frozen);
    }
  }

  function switchEngine(engine) {
    const s = store.get();
    if (engine !== s.engine) store.set(engineSwitchPatch(s, engine));
  }
  function resetParams() { store.set(resetPatch(store.get())); }
  function toggleLabels() {
    showLabels = !showLabels;
    ctl.labels.setOn(showLabels);
    q('.overlay--labels').hidden = !showLabels;
  }

  // ── HUD ──
  function buildHud() {
    const H = S.hud;
    hud = createHud(q('.scene__hud'), [
      { id: 'pmax', label: H.pmax.label, unit: U.bar, value: (f) => fmt(toBar(f.summary.Pmax), 1), tip: H.pmax.tip },
      { id: 'thpmax', label: H.thpmax.label, unit: U.atdc, value: (f) => plusDeg(f.summary.thetaPmax), tip: H.thpmax.tip },
      { id: 'imep', label: H.imep.label, unit: U.bar, value: (f) => fmt(toBar(f.summary.imepG), 1), tip: H.imep.tip },
      { id: 'etai', label: H.etai.label, unit: U.pct, value: (f) => pct(f.eta.ind, 1), tip: H.etai.tip },
      { id: 'etab', label: H.etab.label, unit: U.pct, value: (f) => pct(f.eta.brake, 1), tip: H.etab.tip },
      { id: 'bsfc', label: H.bsfc.label, unit: U.gkWh, value: (f) => fmt(f.summary.bsfc, 0), tip: H.bsfc.tip },
    ], { level: C.level.semiEmpirical, note: H.note });
  }

  // ── grafik ──
  function buildCharts() {
    pv = createPVChart(q('.chart-slot--main'));
    pth = createLineChart(q('.chart-slot--sub'), { title: S.ptheta.title, modelLevel: 'semiEmpirical', xLabel: S.ptheta.xLabel, yLabel: S.ptheta.yLabel });
    legend = createTempLegend(q('.overlay--legend'));
  }

  function updatePTheta(f) {
    if (f.curve !== pthCurve) {
      pthCurve = f.curve;
      const c = f.curve, g = f.geom;
      const y = Float64Array.from(c.P, toBar);
      const PmaxBar = toBar(f.summary.Pmax);
      pth.setData({
        x: c.theta, y,
        xDomain: [-360, 360],
        xTicks: [-360, -270, -180, -90, 0, 90, 180, 270, 360],
        xFmt: (v) => `${v < 0 ? '−' : ''}${Math.abs(v)}`,
        yMax: Math.ceil((PmaxBar * 1.15) / 20) * 20,
        bands: [
          { x0: -360, x1: g.ivc, label: C.phase.intake, color: 'rgba(90,169,255,0.07)' },
          { x0: g.ivc, x1: 0, label: C.phase.kompresi, color: 'rgba(255,255,255,0.025)' },
          { x0: g.theta0, x1: g.theta0 + g.dur, label: '', color: 'rgba(255,154,60,0.13)' },
          { x0: 0, x1: g.evo, label: C.phase.ekspansi, color: 'rgba(255,255,255,0.025)' },
          { x0: g.evo, x1: 360, label: C.phase.exhaust, color: 'rgba(255,138,76,0.07)' },
        ],
        vlines: [[-360, S.ptheta.tdc], [-180, S.ptheta.bdc], [0, S.ptheta.tdc], [180, S.ptheta.bdc], [360, S.ptheta.tdc]].map(([x, label]) => ({ x, label })),
        markers: [{ x: f.summary.thetaPmax, y: PmaxBar, label: S.ptheta.pmax(PmaxBar) }],
      });
      pth.setCaption(`<span class="sw" style="background:rgba(255,154,60,0.35)"></span>${S.ptheta.caption(g.theta0, g.theta0 + g.dur)}`);
    }
    pth.setCursor(f.theta, toBar(f.P), `rgb(${f.gasRGB.map((v) => Math.round(v * 255)).join(',')})`);
  }

  // ── overlay rumus & bacaan ──
  let flashUntil = 0;
  function updateOverlays(f, s) {
    const g = f.geom;
    const nodes = el.querySelectorAll('[data-k]');
    for (const n of nodes) {
      const k = n.dataset.k;
      let v = '';
      switch (k) {
        case 'theta': v = signedDeg(f.theta); break;
        case 'x': v = `${fmt(toMm(f.pistonPos), 1)} ${U.mm}`; break;
        case 'V': v = `${fmt(toLiter(f.V), 3)} ${U.L}`; break;
        case 'B': v = `${fmt(toMm(g.bore), 0)} ${U.mm}`; break;
        case 'a': v = `${fmt(toMm(g.a), 0)} ${U.mm}`; break;
        case 'l': v = `${fmt(toMm(g.conrod), 0)} ${U.mm}`; break;
        case 'Vc': v = S.formula.VcVal(toLiter(g.Vc), g.r); break;
        case 'phase': v = C.phase[f.phase] ?? f.phase; break;
        case 'P': v = `${fmt(toBar(f.P), 1)} ${U.bar}`; break;
        case 'T': v = `${fmt(f.T, 0)} ${U.K}`; break;
        case 'xb': v = `${fmt(f.xb * 100, 0)} ${U.pct}`; break;
        default: continue;
      }
      setText(n, v);
    }
    q('.gauge__bar').style.transform = `scaleX(${Math.min(1, f.P / f.summary.Pmax).toFixed(4)})`;
    // variabel yang menyala: Vc & r menyala sebentar saat r diubah
    const now = performance.now();
    if (g.r !== lastR) { lastR = g.r; flashUntil = now + 1500; }
    el.classList.toggle('flash-vc', now < flashUntil);
    el.classList.toggle('is-moving', s.playing && !s.frozen);

    const status = [];
    status.push(C.slowMo(f.slowMo, f.rpmVisual, f.N));
    if (s.frozen) status.push(`<span class="pill pill--freeze">${C.frozen(f.theta)}</span>`);
    else if (!s.playing) status.push(`<span class="pill">${C.paused}</span>`);
    const st = q('.overlay--status');
    const h = status.join(' ');
    if (st.innerHTML !== h) st.innerHTML = h;
  }

  // ── label 3D (leader) ──
  const labelEls = {};
  const v3 = new THREE.Vector3();
  function updateLabels(f) {
    if (!rig || !showLabels) return;
    const box = q('.overlay--labels');
    const w = box.clientWidth, h = box.clientHeight;
    for (const k of LABEL_KEYS) {
      const a = rig.anchors[k];
      if (!a) continue;
      let n = labelEls[k];
      if (!n) { n = labelEls[k] = document.createElement('div'); n.className = 'label3d'; box.appendChild(n); }
      const txt = k === 'top' ? (f.fuel === 'diesel' ? S.labels3d.injector : S.labels3d.sparkPlug) : S.labels3d[k];
      setText(n, txt);
      a.getWorldPosition(v3).project(gfx.camera);
      const vis = v3.z < 1;
      n.style.display = vis ? '' : 'none';
      n.style.transform = `translate(${Math.round((v3.x * 0.5 + 0.5) * w)}px, ${Math.round((-v3.y * 0.5 + 0.5) * h)}px)`;
    }
  }

  return {
    meta,
    mount() {
      buildDom();
      buildControls();
      buildHud();
      buildCharts();
      try {
        gfx = createRenderer(q('.view3d'), { camPos: [1.2, 0.8, 1.95], target: [-0.14, 0.4, 0] });
        rig = createPistonRig();
        gfx.scene.add(rig.group);
        const floor = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), new THREE.ShadowMaterial({ opacity: 0.35 }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.2;
        floor.receiveShadow = true;
        gfx.scene.add(floor);
        disposers.push(() => { floor.geometry.dispose(); floor.material.dispose(); });
      } catch (err) {
        console.warn('[piston] 3D dinonaktifkan:', err);
        gfx = null; rig = null;
        q('.view3d__fallback').hidden = false;
      }
      sim = simClient.runNow(store.get());
      disposers.push(store.subscribe((s, prev, changed) => {
        if (changed.some((k) => SIM_KEYS.includes(k))) simClient.request(s);
        syncControls(s, changed);
      }));
      syncControls(store.get(), ['engine', 'playing', 'frozen']);
    },
    /** @param {number} dt detik */
    update(dt) {
      const s0 = store.get();
      store.set(tickPatch(store.get(), dt));
      const s = store.get();
      if (!sim) return;
      const f = derive(s, sim);
      ctl.theta.set(f.theta);
      rig?.update(f);
      pv.update(f);
      updatePTheta(f);
      legend.update(f);
      hud.update(f);
      updateOverlays(f, s);
      if (gfx) { gfx.render(); updateLabels(f); }
    },
    onKey(e) {
      if (e.key.toLowerCase() === 'l') { toggleLabels(); return true; }
      return false;
    },
    dispose() {
      for (const d of disposers.splice(0)) d();
      simClient.dispose();
      if (rig) { gfx.scene.remove(rig.group); rig.dispose(); }
      gfx?.dispose();
      pv?.dispose(); pth?.dispose(); legend?.dispose(); hud?.dispose();
      el?.remove();
    },
  };
}
