/**
 * Scene 4 — NOx: kenapa suhu begitu menentukan.
 * Alur: kontrol → store.set → (Worker, debounce 80 ms) cylinderSim + retardSweep → deriveNox(state, sim, sweep)
 *       → frame → { noxRig (gelembung zona terbakar + partikel NO), NOx–η, Arrhenius, HUD, legenda }.
 */
import * as THREE from 'three';
import { html } from './sceneBase.js';
import { togglePlayPatch, toggleFreezePatch, scrubPatch, tickWindowPatch, noxDefaults, calibResetPatch } from '../state/store.js';
import { deriveNox, noxSimParams, noxSimKey, noxSweepParams, noxSweepKey, noxKeyNumbers, NOX_SIM_KEYS } from '../state/deriveNox.js';
import { createSimClient } from '../state/simClient.js';
import { createEngineCalibrator, dlnCalibration } from '../state/calibration.js';
import { createCalibrationPanel } from '../ui/calibrationPanel.js';
import { NOX_TIMING, NOX_WINDOW, NOX_CALIB_DEFAULTS } from '../model/presets.js';
import { createRenderer } from '../gfx/renderer.js';
import { createNoxRig } from '../gfx/noxRig.js';
import { SPECIES_VAR } from '../gfx/species.js';
import { createXYChart, decadeTicks, decadeFmt } from '../charts/xyChart.js';
import { niceCeil } from '../charts/chartBase.js';
import { createTempLegend } from '../charts/legend.js';
import { slider, segmented, button } from '../ui/controls.js';
import { animSpeedSlider } from '../ui/animSpeed.js';
import { createHud } from '../ui/hud.js';
import { fmt, pct } from '../ui/format.js';
import { createHelpButton } from '../ui/helpButton.js';
import { STR, signedDeg, plusDeg } from '../ui/strings.js';
import { CV } from '../charts/chartBase.js';

const S = STR.scene4, C = STR.common, U = STR.common.units, H = STR.scene4.hud;

export const meta = { id: 'nox', number: 4, title: S.title, message: S.message };

const KEYS_ENGINE = { 1: 'diesel', 2: 'gas' };
const LABEL_KEYS = ['burned', 'no', 'piston', 'top'];
const rgbCss = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
const CHART_PAD = { l: 60, r: 18, t: 74, b: 40 };

/** Item HUD Scene 4 (diekspor untuk tes). Basis emisi lengkap di bawah setiap ppm / mg/Nm³. */
export function hudItems(f) {
  const diesel = f.engine === 'diesel';
  const basis = C.basis.full(f.NOx.refO2, f.NOx.TrefC);
  const flag = f.NOx.basisDefault ? undefined : C.basis.flag;
  const items = [
    { id: 'timing', help: 'hud.timing', label: H.timing.label(diesel), unit: U.atdc, value: (x) => plusDeg(x.theta0), tip: H.timing.tip },
    { id: 'tb', help: 'hud.burnedT', label: H.tbPeak.label, unit: U.K, value: (x) => fmt(x.TbPeak, 0), tip: H.tbPeak.tip },
    { id: 'noxg', help: 'hud.noxG', label: H.noxG.label, unit: U.gkWh, value: (x) => fmt(x.NOx.gkWh, 2), tip: H.noxG.tip },
    { id: 'noxppm', help: 'hud.noxPpm', label: H.noxPpm.label, unit: H.noxPpm.unit, sub: basis, flag, value: (x) => fmt(x.NOx.ppm, 0), tip: H.noxPpm.tip },
    { id: 'noxmg', help: 'hud.noxMg', label: H.noxMg.label, unit: H.noxMg.unit, sub: basis, flag, value: (x) => fmt(x.NOx.mgNm3, 0), tip: H.noxMg.tip },
    { id: 'eta', help: 'hud.etaBrake', label: H.eta.label, unit: U.pct, value: (x) => pct(x.eta.brake, 1), tip: H.eta.tip },
    { id: 'co2', help: 'hud.co2', label: H.co2.label, unit: U.gkWh, value: (x) => fmt(x.CO2.gkWh, 0), tip: H.co2.tip },
  ];
  // faktor kalibrasi tampil di HUD bila ≠ 1 (CLAUDE.md → Aturan model)
  if (f.calib !== 1) items.push({ id: 'calib', help: 'hud.noxCalib', label: H.calib.label, unit: '', sub: H.calib.sub(f.calib === f.calibDefault), value: (x) => H.calib.value(x.calib), tip: H.calib.tip });
  return items;
}

/** @param {import('./sceneBase.js').SceneContext} ctx */
export function createScene(ctx) {
  const { store } = ctx;
  const disposers = [];
  let el, gfx = null, rig = null, legend, hud = null, hudKey = '';
  let tradeChart, arrChart;
  let sim = null, sweep = null, sweepKey = null, cal = null, calib = null;
  let tradeKey = null, arrKey = null;
  let showLabels = true;
  let lastEngine = '';
  const ctl = {};
  const labelEls = {};
  const v3 = new THREE.Vector3();

  const simClient = createSimClient((r) => { sim = r; }, { paramsOf: noxSimParams, keyOf: noxSimKey });
  const sweepClient = createSimClient((r, key) => { sweep = r; sweepKey = key; }, { job: 'retardSweep', debounceMs: 0, paramsOf: noxSweepParams, keyOf: noxSweepKey });

  const q = (sel) => el.querySelector(sel);
  const cache = new Map();
  const setText = (n, t) => { if (cache.get(n) !== t) { n.textContent = t; cache.set(n, t); } };
  const setHTML = (n, t) => { if (cache.get(n) !== t) { n.innerHTML = t; cache.set(n, t); } };

  function buildDom() {
    el = html(`
      <section class="scene scene--nox">
        <div class="scene__view">
          <div class="view3d"></div>
          <div class="overlay overlay--formula num">
            <div class="f-line">${S.formula.zeldovich}</div>
            <div class="f-line">${S.formula.o2}</div>
            <div class="f-vals f-vals--dim"><span data-k="fnote"></span></div>
          </div>
          <div class="overlay overlay--readout num">
            <div class="ro-phase" data-k="phase"></div>
            <div class="ro-grid">
              <span>${C.crankAngle}</span><b data-k="theta"></b>
              <span>${S.readout.Tgas}</span><b data-k="tgas"></b>
              <span class="ro-tb">${S.readout.Tb}</span><b data-k="tb"></b>
              <span>${S.readout.noFrac}</span><b data-k="noFrac"></b>
            </div>
          </div>
          <div class="overlay overlay--legend">
            <div class="nox-species"><span class="sw" style="background:${SPECIES_VAR.NOx}"></span>${S.speciesNo}</div>
          </div>
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
    el.querySelector('.ro-tb').dataset.tip = S.readout.tbTip;
    ctx.root.appendChild(el);
  }

  // ── kontrol ──
  function buildControls() {
    const s = store.get();
    ctl.engine = segmented({ help: 'ctl.engine',
      label: S.engine, tip: S.tips.engine,
      options: [{ value: 'diesel', label: S.engines.diesel, key: '1' }, { value: 'gas', label: S.engines.gas, key: '2' }],
      value: s.nEngine, onChange: (v) => setEngine(v),
    });
    ctl.timing = slider({ help: 'ctl.timing', label: S.timing[s.nEngine], ...NOX_TIMING[s.nEngine], value: s.nTheta0, format: signedDeg, tip: S.tips.timing, onInput: (v) => store.set({ nTheta0: v }) });
    ctl.theta = slider({ help: 'ctl.crankAngle', label: S.window, min: NOX_WINDOW.lo, max: NOX_WINDOW.hi, step: 0.5, value: Math.min(NOX_WINDOW.hi, Math.max(NOX_WINDOW.lo, s.theta)), format: signedDeg, tip: S.tips.window, onInput: (v) => store.set(scrubPatch(store.get(), v)) });
    ctl.rpm = animSpeedSlider(store);
    ctl.play = button({ help: 'ctl.play', label: C.pause, key: C.keySpace, tip: C.tips.play, onClick: () => store.set(togglePlayPatch(store.get())) });
    ctl.freeze = button({ help: 'ctl.freeze', label: C.freeze, key: 'F', tip: C.tips.freeze, onClick: () => store.set(toggleFreezePatch(store.get())) });
    ctl.reset = button({ help: 'ctl.reset', label: C.reset, key: 'R', tip: S.tips.reset, onClick: () => resetTiming() });
    ctl.labels = button({ help: 'ctl.labels', label: C.labels, key: 'L', tip: S.tips.labels, onClick: toggleLabels });
    ctl.labels.setOn(true);
    ctl.calib = button({ help: 'ctl.calibration', label: S.calib.button, key: S.calib.key, tip: S.calib.tip, onClick: () => toggleCalib() });
    const g1 = html('<div class="ctl-group"></div>');
    g1.append(ctl.engine.el, ctl.timing.el);
    const g2 = html('<div class="ctl-group"></div>');
    g2.append(ctl.theta.el, ctl.rpm.el);
    const g3 = html('<div class="ctl-group ctl-group--buttons"></div>');
    g3.append(ctl.calib.el, ctl.play.el, ctl.freeze.el, ctl.reset.el, ctl.labels.el);
    q('.scene__controls').append(g1, g2, g3);
  }

  function setEngine(engine) {
    if (engine !== store.get().nEngine) store.set(noxDefaults(engine));
  }
  function resetTiming() { store.set(noxDefaults(store.get().nEngine)); }
  function toggleCalib(on = !cal.open) {
    cal.setOpen(on);
    ctl.calib.setOn(on);
  }
  function calibView(s) {
    return {
      calEngine: s.calEngine, calDln: s.calDln, defaults: NOX_CALIB_DEFAULTS, literature: NOX_CALIB_DEFAULTS.literature,
      basisText: C.basis.full(s.emRefO2, s.emTrefC),
    };
  }
  function buildCalibration() {
    calib = createEngineCalibrator(store, (kind, r) => cal.setStatus(kind, r.converged ? S.calib.doneEngine(r.NOx_gkWh, r.iterations) : S.calib.notConverged));
    cal = createCalibrationPanel(q('.scene__view'), {
      onApplyEngine: (kind, target) => { if (calib.apply(kind, target)) cal.setStatus(kind, S.calib.computing); },
      onApplyDln: (cfg, target) => {
        const r = dlnCalibration(store.get(), cfg, target, store.get().emRefO2);
        if (!r) return;
        store.set(r.patch);
        cal.setStatus(`dln-${cfg}`, S.calib.doneDln(r.result.NOx_ppm, r.result.Tflame));
      },
      onReset: () => {
        store.set(calibResetPatch());
        for (const k of ['diesel', 'gas', 'dln-single', 'dln-twin']) cal.setStatus(k, '');
        ctx.toast?.(S.calib.resetDone);
      },
      onClose: () => toggleCalib(false),
    });
    cal.update(calibView(store.get()));
  }
  function toggleLabels() {
    showLabels = !showLabels;
    ctl.labels.setOn(showLabels);
    q('.overlay--labels').hidden = !showLabels;
  }

  function syncControls(s, changed) {
    if (changed.includes('nEngine')) {
      ctl.engine.set(s.nEngine);
      ctl.timing.setRange(NOX_TIMING[s.nEngine]);
      ctl.timing.el.querySelector('.ctl__label').textContent = S.timing[s.nEngine];
    }
    ctl.timing.set(s.nTheta0);
    ctl.rpm.set(s.animSpeed);
    if (changed.includes('playing') || changed.includes('frozen')) {
      ctl.play.setLabel(s.playing ? C.pause : C.play);
      ctl.play.setOn(!s.playing);
      ctl.play.setDisabled(s.frozen);
      ctl.freeze.setLabel(s.frozen ? C.unfreeze : C.freeze);
      ctl.freeze.setOn(s.frozen);
      ctl.theta.setLocked(s.frozen);
    }
  }

  // ── HUD ──
  function updateHud(f) {
    const key = `${f.engine}|${f.NOx.refO2}|${f.NOx.TrefC}|${f.calib}|${f.calDln.single}|${f.calDln.twin}`;
    if (key !== hudKey) {
      hud?.dispose();
      hudKey = key;
      hud = createHud(q('.scene__hud'), hudItems(f), { level: C.level.semiEmpirical, basis: 'engineNox', note: H.note(f.calib, f.calDln) });
    }
    hud.update(f);
  }

  // ── grafik ──
  function updateTradeoff(f) {
    const t = f.tradeoff;
    const key = t ? `${f.engine}|${t.nox.join(',')}` : null;
    if (key !== tradeKey) {
      tradeKey = key;
      if (t) {
        const etaPct = t.eta.map((v) => v * 100);
        const lo = Math.min(...etaPct), hi = Math.max(...etaPct);
        const padX = Math.max(0.3, (hi - lo) * 0.12);
        tradeChart.setData({
          x: etaPct, y: t.nox,
          xDomain: [Math.floor((lo - padX) * 2) / 2, Math.ceil((hi + padX) * 2) / 2],
          yDomain: [0, niceCeil(Math.max(...t.nox) * 1.12)],
          xFmt: (v) => fmt(v, Number.isInteger(v) ? 0 : 1),
          pointLabels: t.theta0.map((th, i) => ({ i, th })).filter((p) => p.th % 4 === 0).map((p) => ({ i: p.i, label: S.tradeoff.point(p.th) })),
          markers: t.preset ? [{ x: t.preset.eta * 100, y: t.preset.nox, label: S.tradeoff.preset }] : [],
        });
      }
    }
    if (t) {
      tradeChart.setPoints([{ x: f.current.eta * 100, y: f.current.nox, fill: SPECIES_VAR.NOx, label: S.tradeoff.now(f.current.nox, f.current.eta), guide: true }]);
      tradeChart.setCaption(f.vsPreset ? S.tradeoff.caption(f.vsPreset.nox, f.vsPreset.co2) : '');
    } else {
      tradeChart.setCaption(S.tradeoff.captionWait);
    }
  }

  function updateArrhenius(f) {
    const A = f.arrhenius;
    const key = `${A.peak.T}`;
    if (key !== arrKey) {
      arrKey = key;
      const c = A.curve;
      const yMin = Math.min(...c.rel), yMax = Math.max(...c.rel);
      arrChart.setData({
        x: c.T, y: c.rel,
        xDomain: [c.T[0], c.T[c.T.length - 1]],
        yDomain: [yMin, yMax],
        yTicks: decadeTicks(yMin, yMax).filter((v, i, a) => a.length < 8 || i % 2 === 0),
        yFmt: decadeFmt,
        xFmt: (v) => fmt(v, 0),
        bands: [
          { x0: A.dlnBand[0], x1: A.dlnBand[1], label: S.arrhenius.bandDln, color: CV.bandDln },
          { x0: A.engineBand[0], x1: A.engineBand[1], label: S.arrhenius.bandEngine, color: CV.bandEngine, labelPos: 'bottom' },
        ],
        markers: [{ x: A.peak.T, y: A.peak.rel, label: S.arrhenius.peak }],
      });
      arrChart.setCaption(S.arrhenius.caption(A.ratioRef, A.curve.Tref, A.ratioPeak, A.peak.T));
    }
    arrChart.setPoints(A.live ? [{ x: A.live.T, y: A.live.rel, fill: rgbCss(f.burned.rgb), guide: true }] : []);
  }

  // ── overlay ──
  function updateOverlays(f, s) {
    for (const n of el.querySelectorAll('[data-k]')) {
      const k = n.dataset.k;
      let v;
      switch (k) {
        case 'fnote': v = S.formula.note(f.NOx.refO2); break;
        case 'phase': v = C.phase[f.phase] ?? f.phase; break;
        case 'theta': v = signedDeg(f.theta); break;
        case 'tgas': v = `${fmt(f.T, 0)} ${U.K}`; break;
        case 'tb': v = f.burned.visible ? `${fmt(f.burned.T, 0)} ${U.K}` : S.readout.none; break;
        case 'noFrac': v = `${fmt(f.no.frac * 100, 0)} ${U.pct}`; break;
        default: continue;
      }
      setText(n, v);
    }
    const st = [C.slowMo(f.slowMo, f.rpmVisual, f.N)];
    if (s.frozen) st.push(`<span class="pill pill--freeze">${C.frozen(f.theta)}</span>`);
    else if (!s.playing) st.push(`<span class="pill">${C.paused}</span>`);
    setHTML(q('.overlay--status'), st.join(' '));
    legend.update({ T: f.burned.visible ? f.burned.T : f.T, tempScale: f.tempScale });
  }

  function updateLabels(f) {
    if (!rig || !showLabels) return;
    const box = q('.overlay--labels');
    const w = box.clientWidth, h = box.clientHeight;
    for (const k of LABEL_KEYS) {
      const a = rig.anchors[k];
      if (!a) continue;
      let n = labelEls[k];
      if (!n) { n = labelEls[k] = document.createElement('div'); n.className = 'label3d'; box.appendChild(n); }
      const txt = k === 'top' ? S.labels3d.top[f.fuel === 'diesel' ? 'diesel' : 'gas'] : S.labels3d[k];
      setText(n, txt);
      const vis = (k !== 'burned' || f.burned.visible) && (k !== 'no' || f.no.frac > 0.01);
      a.getWorldPosition(v3).project(gfx.camera);
      n.style.display = vis && v3.z < 1 ? '' : 'none';
      n.style.transform = `translate(${Math.round((v3.x * 0.5 + 0.5) * w)}px, ${Math.round((-v3.y * 0.5 + 0.5) * h)}px)`;
    }
  }

  return {
    meta,
    mount() {
      buildDom();
      buildControls();
      tradeChart = createXYChart(q('.chart-slot--main'), { title: S.tradeoff.title, modelLevel: 'semiEmpirical', basis: 'noxCo', xLabel: S.tradeoff.xLabel, yLabel: S.tradeoff.yLabel, color: SPECIES_VAR.NOx, pad: CHART_PAD });
      arrChart = createXYChart(q('.chart-slot--sub'), { title: S.arrhenius.title, modelLevel: 'semiEmpirical', basis: 'zeldovich', xLabel: S.arrhenius.xLabel, yLabel: S.arrhenius.yLabel(noxKeyNumbers().Tref), logY: true, color: CV.fg, pad: CHART_PAD });
      legend = createTempLegend(q('.overlay--legend'), { title: S.tempLegend });
      buildCalibration();
      q('.overlay--legend').append(q('.nox-species'));
      q('.nox-species').append(' ', createHelpButton('ui.speciesLegend', { describes: q('.nox-species') }).el);
      try {
        gfx = createRenderer(q('.view3d'), { camPos: [0.5, 0.8, 0.86], target: [-0.02, 0.69, 0] });
        rig = createNoxRig();
        gfx.scene.add(rig.group);
      } catch (err) {
        console.warn('[nox] 3D dinonaktifkan:', err);
        gfx = null; rig = null;
        q('.view3d__fallback').hidden = false;
      }
      const s0 = store.get();
      sim = simClient.runNow(s0);
      sweepClient.request(s0);
      const kn = noxKeyNumbers();
      ctx.setMessage?.(S.messageWithNumbers(kn.ratio100, kn.Tref));
      disposers.push(store.subscribe((s, prev, changed) => {
        if (changed.some((k) => NOX_SIM_KEYS.includes(k))) simClient.request(s);
        if (changed.includes('nEngine') || changed.includes('calEngine')) sweepClient.request(s);
        if (['calEngine', 'calDln', 'emRefO2', 'emTrefC'].some((k) => changed.includes(k))) cal.update(calibView(s));
        syncControls(s, changed);
      }));
      syncControls(s0, ['nEngine', 'playing', 'frozen']);
    },
    /** @param {number} dt detik */
    update(dt) {
      const th0 = store.get().theta;
      store.set(tickWindowPatch(store.get(), dt, NOX_WINDOW.lo, NOX_WINDOW.hi));
      const s = store.get();
      if (!sim) return;
      const f = deriveNox(s, sim, sweepKey === noxSweepKey(s) ? sweep : null);
      const running = s.playing && !s.frozen;
      const dTheta = running && s.theta >= th0 ? s.theta - th0 : 0;
      ctl.theta.set(Math.min(NOX_WINDOW.hi, Math.max(NOX_WINDOW.lo, f.theta)));
      updateHud(f);
      updateTradeoff(f);
      updateArrhenius(f);
      updateOverlays(f, s);
      if (gfx) {
        if (f.engine !== lastEngine) { lastEngine = f.engine; rig.clearParticles(); }
        rig.update(f, running ? dt : 0, dTheta);
        gfx.render();
        updateLabels(f);
      }
    },
    onKey(e) {
      const k = e.key.toLowerCase();
      if (KEYS_ENGINE[k]) { setEngine(KEYS_ENGINE[k]); return true; }
      if (k === 'r') { resetTiming(); ctx.toast?.(STR.app.toast.reset); return true; }
      if (k === 'l') { toggleLabels(); return true; }
      if (k === 'c') { toggleCalib(); return true; }
      return false;
    },
    dispose() {
      for (const d of disposers.splice(0)) d();
      simClient.dispose();
      sweepClient.dispose();
      calib?.dispose();
      cal?.dispose();
      if (rig) { gfx.scene.remove(rig.group); rig.dispose(); }
      gfx?.dispose();
      tradeChart?.dispose(); arrChart?.dispose(); legend?.dispose(); hud?.dispose();
      el?.remove();
    },
  };
}
