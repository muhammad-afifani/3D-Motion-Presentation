/**
 * Scene 6 — Part-load: generator (single-shaft) vs compressor drive (twin-shaft).
 * Alur: kontrol → store.set → deriveLoad(state) → frame → { dua turbineRig, NOx & CO vs load, Flame T | η, HUD }.
 * Kurva & titik dari loadSweep (thermo.js). Tidak ada perhitungan model di file ini.
 */
import * as THREE from 'three';
import { html } from './sceneBase.js';
import { togglePlayPatch, toggleFreezePatch, tickPatch, loadInitialState, limitsPatch, limitsInitialState, calibResetPatch } from '../state/store.js';
import { deriveLoad } from '../state/deriveLoad.js';
import { createEngineCalibrator, dlnCalibration } from '../state/calibration.js';
import { LOAD_RANGE, GT_STAGES, NOX_CALIB_DEFAULTS } from '../model/presets.js';
import { createRenderer } from '../gfx/renderer.js';
import { createGasTurbineRig } from '../gfx/turbineRig.js';
import { SPECIES_COLORS } from '../gfx/species.js';
import { createMultiLineChart } from '../charts/multiLineChart.js';
import { decadeTicks, decadeFmt } from '../charts/xyChart.js';
import { niceCeil } from '../charts/chartBase.js';
import { createTempLegend } from '../charts/legend.js';
import { slider, segmented, button } from '../ui/controls.js';
import { animSpeedSlider } from '../ui/animSpeed.js';
import { createHud } from '../ui/hud.js';
import { createLimitsInput } from '../ui/limitsInput.js';
import { createCalibrationPanel } from '../ui/calibrationPanel.js';
import { fmt, pct } from '../ui/format.js';
import { STR } from '../ui/strings.js';

const S = STR.scene6, C = STR.common, U = STR.common.units, H = STR.scene6.hud;

export const meta = { id: 'partload', number: 6, title: S.title, message: S.message };

const CFGS = ['single', 'twin'];
const DASH = { single: [], twin: [7, 5] };
const WINDOW_FILL = { single: 'rgba(230,235,243,0.10)', twin: 'rgba(79,179,255,0.12)' };
const RIG_POS = { single: [0.75, 1.05, 0], twin: [-0.95, -1.2, 0] };
const KEYS_STRATEGY = { 1: 'igv', 2: 'fuelOnly' };

/** Item HUD per konfigurasi (diekspor untuk tes). Basis lengkap di bawah setiap ppm. */
export function hudItems(f, cfg) {
  const b = f.basis;
  const flag = b.isDefault ? undefined : C.basis.flag;
  const twin = cfg === 'twin';
  const P = (x) => x[cfg];
  const items = [
    { id: 'eta', label: H.eta.label, unit: U.pct, value: (x) => pct(P(x).point.eta, 1), tip: H.eta.tip },
    { id: 't3', label: H.T3.label, unit: U.K, value: (x) => fmt(P(x).point.T3, 0), tip: H.T3.tip },
    { id: 'tf', label: H.flame.label, unit: U.K, value: (x) => fmt(P(x).point.Tflame, 0), tip: H.flame.tip },
    { id: 'nox', label: H.nox.label, unit: H.nox.unit, sub: C.basis.full(b.refO2, b.TrefC), flag, value: (x) => fmt(P(x).point.nox, P(x).point.nox < 10 ? 2 : 1), tip: H.nox.tip },
    { id: 'co', label: H.co.label, unit: H.co.unit, sub: C.basis.fullCO(b.refO2, b.TrefC), flag, value: (x) => fmt(P(x).point.co, 1), tip: H.co.tip },
    twin
      ? { id: 'n', label: H.speed.label, unit: '', value: (x) => H.speed.twin(x.twin.N.gg), tip: H.speed.tipTwin }
      : { id: 'n', label: H.speed.label, unit: '', value: (x) => H.speed.single(x.single.N.rpm), tip: H.speed.tipSingle },
  ];
  if (!twin) items.push({ id: 'igv', label: H.igv.label, unit: '', sub: f.single.strategy === 'fuelOnly' ? H.igv.fixed : undefined, value: (x) => H.igv.value(x.single.igv.open), tip: H.igv.tip });
  items.push({ id: 'win', label: H.window.label, unit: '', value: (x) => (P(x).window ? S.windowText(P(x).window.ranges) : H.window.none), tip: H.window.tip });
  // faktor kalibrasi tampil di HUD bila ≠ 1
  if (f[cfg].calib !== 1) items.push({ id: 'cal', label: H.calib.label, unit: '', sub: H.calib.sub(f[cfg].calib === f[cfg].calibDefault), value: (x) => H.calib.value(P(x).calib), tip: H.calib.tip });
  return items;
}

/** Pesan kunci (diekspor untuk tes): dengan batas → jendela beban hasil model; tanpa batas → perbandingan kurva. */
export function keyMessage(f) {
  if (f.limits.set) {
    return S.messageWindow(f.limits.nox, f.limits.co, C.basis.short(f.basis.refO2, f.basis.TrefC),
      S.windowText(f.single.window.ranges), S.windowText(f.twin.window.ranges));
  }
  return S.messageCurves(f.facts);
}

/** @param {import('./sceneBase.js').SceneContext} ctx */
export function createScene(ctx) {
  const { store } = ctx;
  const disposers = [];
  let el, gfx = null, legend, emis, aux, lim, cal = null, calib = null;
  const rigs = {}, huds = {}, hudKeys = {};
  let emisKey = '', auxKey = '', lastMsg = '';
  const ctl = {};
  const labelEls = {};
  const anchors = {};
  const v3 = new THREE.Vector3();

  const q = (sel) => el.querySelector(sel);
  const cache = new Map();
  const setText = (n, t) => { if (cache.get(n) !== t) { n.textContent = t; cache.set(n, t); } };
  const setHTML = (n, t) => { if (cache.get(n) !== t) { n.innerHTML = t; cache.set(n, t); } };

  function buildDom() {
    el = html(`
      <section class="scene scene--load">
        <div class="pl-view">
          <div class="view3d"></div>
          <div class="overlay overlay--note"></div>
          <div class="overlay overlay--legend">
            <div class="nox-species"><span class="sw" style="background:${SPECIES_COLORS.NOx}"></span>${S.species.nox} · <span class="sw" style="background:${SPECIES_COLORS.CO}"></span>${S.species.co}</div>
          </div>
          <div class="overlay overlay--labels"></div>
          <div class="overlay overlay--status num"></div>
          <div class="view3d__fallback" hidden>${C.webglFallback}</div>
        </div>
        <div class="pl-emis chart-slot"></div>
        <div class="pl-aux chart-slot"></div>
        <div class="scene__controls"></div>
        <div class="pl-hud">
          <div class="pl-hud__row"><div class="pl-hud__title">${S.configs.single}</div><div class="pl-hud__body" data-hud="single"></div></div>
          <div class="pl-hud__row"><div class="pl-hud__title">${S.configs.twin}</div><div class="pl-hud__body" data-hud="twin"></div></div>
          <div class="hud__note"><span class="level">${C.level.semiEmpirical}</span>${S.hudNote}</div>
        </div>
      </section>`);
    q('.overlay--note').textContent = S.note;
    ctx.root.appendChild(el);
  }

  function buildControls() {
    const s = store.get();
    ctl.load = slider({ label: S.load, ...LOAD_RANGE, value: s.lLoad, digits: 0, unit: U.pct, tip: S.tips.load, onInput: (v) => store.set({ lLoad: v }) });
    ctl.strategy = segmented({ label: S.strategy, tip: S.tips.strategy, options: [{ value: 'igv', label: S.strategies.igv, key: '1' }, { value: 'fuelOnly', label: S.strategies.fuelOnly, key: '2' }], value: s.lStrategy, onChange: (v) => store.set({ lStrategy: v }) });
    ctl.aux = segmented({ label: S.aux, tip: S.tips.aux, options: [{ value: 'flame', label: S.auxes.flame }, { value: 'eta', label: S.auxes.eta }], value: s.lAux, onChange: (v) => store.set({ lAux: v }) });
    ctl.rpm = animSpeedSlider(store);
    ctl.calib = button({ label: S.calibButton, key: S.calibKey, tip: S.tips.calib, onClick: () => toggleCalib() });
    ctl.play = button({ label: C.pause, key: C.keySpace, tip: C.tips.play, onClick: () => store.set(togglePlayPatch(store.get())) });
    ctl.freeze = button({ label: C.freeze, key: 'F', tip: C.tips.freeze, onClick: () => store.set(toggleFreezePatch(store.get())) });
    ctl.reset = button({ label: C.reset, key: 'R', tip: S.tips.reset, onClick: () => resetParams() });
    const g1 = html('<div class="ctl-group"></div>');
    g1.append(ctl.load.el, ctl.strategy.el, ctl.aux.el, ctl.rpm.el);
    const g2 = html('<div class="ctl-group"></div>');
    q('.scene__controls').append(g1, g2);
    lim = createLimitsInput(g2, {
      onChange: (p) => store.set(limitsPatch(p)),
      onClear: () => store.set(limitsInitialState()),
    });
    const g3 = html('<div class="ctl-group ctl-group--buttons"></div>');
    g3.append(ctl.calib.el, ctl.play.el, ctl.freeze.el, ctl.reset.el);
    q('.scene__controls').append(g3);
  }

  function resetParams() { store.set(loadInitialState()); ctx.toast?.(STR.app.toast.reset); }

  function calibView(s) {
    return { calEngine: s.calEngine, calDln: s.calDln, defaults: NOX_CALIB_DEFAULTS, literature: NOX_CALIB_DEFAULTS.literature, basisText: C.basis.full(s.emRefO2, s.emTrefC) };
  }
  function buildCalibration() {
    calib = createEngineCalibrator(store, (kind, r) => cal.setStatus(kind, r.converged ? STR.scene4.calib.doneEngine(r.NOx_gkWh, r.iterations) : STR.scene4.calib.notConverged));
    cal = createCalibrationPanel(q('.pl-view'), {
      onApplyEngine: (kind, target) => { if (calib.apply(kind, target)) cal.setStatus(kind, STR.scene4.calib.computing); },
      onApplyDln: (cfg, target) => {
        const r = dlnCalibration(store.get(), cfg, target, store.get().emRefO2);
        if (!r) return;
        store.set(r.patch);
        cal.setStatus(`dln-${cfg}`, STR.scene4.calib.doneDln(r.result.NOx_ppm, r.result.Tflame));
      },
      onReset: () => {
        store.set(calibResetPatch());
        for (const k of ['diesel', 'gas', 'dln-single', 'dln-twin']) cal.setStatus(k, '');
        ctx.toast?.(STR.scene4.calib.resetDone);
      },
      onClose: () => toggleCalib(false),
    });
    cal.update(calibView(store.get()));
  }
  function toggleCalib(on = !cal.open) { cal.setOpen(on); ctl.calib.setOn(on); }

  function syncControls(s, changed) {
    ctl.load.set(s.lLoad); ctl.strategy.set(s.lStrategy); ctl.aux.set(s.lAux); ctl.rpm.set(s.animSpeed);
    lim.update({ nox: s.limNOx, co: s.limCO, basisText: C.basis.full(s.emRefO2, s.emTrefC) });
    if (changed.includes('playing') || changed.includes('frozen')) {
      ctl.play.setLabel(s.playing ? C.pause : C.play);
      ctl.play.setOn(!s.playing);
      ctl.play.setDisabled(s.frozen);
      ctl.freeze.setLabel(s.frozen ? C.unfreeze : C.freeze);
      ctl.freeze.setOn(s.frozen);
    }
  }

  // ── HUD ──
  function updateHud(f) {
    for (const cfg of CFGS) {
      const key = `${f.basis.refO2}|${f.basis.TrefC}|${f.single.strategy}|${f[cfg].calib}`;
      if (key !== hudKeys[cfg]) {
        huds[cfg]?.dispose();
        hudKeys[cfg] = key;
        huds[cfg] = createHud(q(`[data-hud="${cfg}"]`), hudItems(f, cfg));
      }
      huds[cfg].update(f);
    }
  }

  // ── grafik ──
  const windowBands = (f) => (f.limits.set ? CFGS.flatMap((cfg) => f[cfg].window.ranges.map(([hi, lo]) => ({ x0: hi + 0.5, x1: lo - 0.5, color: WINDOW_FILL[cfg] }))) : []);
  const xDomain = [LOAD_RANGE.max, LOAD_RANGE.min];

  function updateEmis(f) {
    const key = `${f.single.strategy}|${f.single.calib}|${f.twin.calib}|${f.basis.refO2}|${f.basis.TrefC}|${f.limits.nox}|${f.limits.co}`;
    if (key !== emisKey) {
      emisKey = key;
      const series = CFGS.flatMap((cfg) => [
        { x: f[cfg].curve.load, y: f[cfg].curve.nox, color: SPECIES_COLORS.NOx, dash: DASH[cfg] },
        { x: f[cfg].curve.load, y: f[cfg].curve.co, color: SPECIES_COLORS.CO, dash: DASH[cfg] },
      ]);
      const yMax = 10 ** Math.ceil(Math.log10(Math.max(...series.flatMap((x) => [...x.y]), f.limits.nox ?? 0, f.limits.co ?? 0)));
      const yDomain = [yMax / 1e4, yMax];
      const hlines = [];
      if (f.limits.nox != null) hlines.push({ y: f.limits.nox, color: SPECIES_COLORS.NOx, label: S.charts.limit.nox, align: 'left' });
      if (f.limits.co != null) hlines.push({ y: f.limits.co, color: SPECIES_COLORS.CO, label: S.charts.limit.co });
      emis.setData({ series, xDomain, yDomain, yTicks: decadeTicks(...yDomain), yFmt: decadeFmt, xFmt: (v) => fmt(v, 0), hlines, bands: windowBands(f) });
      emis.setCaption(S.charts.emisCaption(SPECIES_COLORS.NOx, SPECIES_COLORS.CO, C.basis.full(f.basis.refO2, f.basis.TrefC), C.basis.fullCO(f.basis.refO2, f.basis.TrefC), f.limits.set));
    }
    emis.setPoints(CFGS.flatMap((cfg) => [
      { x: f.load, y: f[cfg].point.nox, fill: SPECIES_COLORS.NOx, ring: cfg === 'twin' ? '#4fb3ff' : '#fff' },
      { x: f.load, y: f[cfg].point.co, fill: SPECIES_COLORS.CO, ring: cfg === 'twin' ? '#4fb3ff' : '#fff' },
    ]));
  }

  function updateAux(f) {
    const flame = f.aux !== 'eta';
    const key = `${f.aux}|${f.single.strategy}|${emisKey}`;
    if (key !== auxKey) {
      auxKey = key;
      const T = S.charts[flame ? 'flame' : 'eta'];
      aux.setTitle(T.title);
      aux.setYLabel(T.yLabel);
      const val = (cfg) => (flame ? f[cfg].curve.Tflame : f[cfg].curve.eta.map((v) => v * 100));
      const all = CFGS.flatMap((cfg) => [...val(cfg)]);
      const lo = Math.min(...all), hi = Math.max(...all), padY = (hi - lo) * 0.08 || 1;
      const yDomain = flame ? [Math.floor((lo - padY) / 50) * 50, niceCeil(hi + padY)] : [Math.floor(lo - padY), Math.ceil(hi + padY)];
      aux.setData({
        series: CFGS.map((cfg) => ({ x: f[cfg].curve.load, y: val(cfg), color: flame ? '#ffb15c' : '#e6ebf3', dash: DASH[cfg] })),
        xDomain, yDomain, xFmt: (v) => fmt(v, 0), bands: windowBands(f),
      });
      aux.setCaption(S.charts.auxCaption);
    }
    aux.setPoints(CFGS.map((cfg) => ({ x: f.load, y: flame ? f[cfg].point.Tflame : f[cfg].point.eta * 100, fill: flame ? '#ffb15c' : '#e6ebf3', ring: cfg === 'twin' ? '#4fb3ff' : '#fff' })));
  }

  function updateOverlay(f, s) {
    const st = [];
    if (s.frozen) st.push(`<span class="pill pill--freeze">${C.frozen(s.theta)}</span>`);
    else if (!s.playing) st.push(`<span class="pill">${C.paused}</span>`);
    setHTML(q('.overlay--status'), st.join(' '));
    legend.update({ T: f.single.point.T3, tempScale: f.tempScale });
    const msg = keyMessage(f);
    if (msg !== lastMsg) { lastMsg = msg; ctx.setMessage?.(msg); }
  }

  function updateLabels(f) {
    const box = q('.overlay--labels');
    const w = box.clientWidth, h = box.clientHeight;
    const items = { single: [anchors.single, S.labels3d.single], twin: [anchors.twin, S.labels3d.twin], igv: [rigs.single?.anchors.igv, S.labels3d.igv] };
    for (const [k, [a, txt]] of Object.entries(items)) {
      if (!a) continue;
      let n = labelEls[k];
      if (!n) { n = labelEls[k] = document.createElement('div'); n.className = `label3d${k === 'igv' ? '' : ' label3d--title'}`; box.appendChild(n); }
      setText(n, txt);
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
      emis = createMultiLineChart(q('.pl-emis'), { title: S.charts.emis.title, modelLevel: 'semiEmpirical', xLabel: S.charts.emis.xLabel, yLabel: S.charts.emis.yLabel, logY: true, pad: { l: 60, r: 18, t: 92, b: 40 } });
      aux = createMultiLineChart(q('.pl-aux'), { title: S.charts.flame.title, modelLevel: 'semiEmpirical', xLabel: S.charts.xLabel, yLabel: S.charts.flame.yLabel });
      legend = createTempLegend(q('.overlay--legend'));
      q('.overlay--legend').append(q('.nox-species'));
      buildCalibration();
      try {
        gfx = createRenderer(q('.view3d'), { camPos: [0.2, 0.6, 8.4], target: [0, -0.15, 0] });
        gfx.controls.maxDistance = 18;
        gfx.camera.position.set(0.2, 0.6, 8.4); // posisi ulang: batas jarak default renderer (6) sudah memotongnya
        gfx.controls.update();
        rigs.single = createGasTurbineRig({ config: 'single', compressorStages: GT_STAGES.compressor, turbineStages: GT_STAGES.turbine, igv: true });
        rigs.twin = createGasTurbineRig({ config: 'twin', compressorStages: GT_STAGES.compressor, turbineStages: GT_STAGES.ggTurbine, ptStages: GT_STAGES.powerTurbine });
        for (const cfg of CFGS) {
          rigs[cfg].group.position.set(...RIG_POS[cfg]);
          gfx.scene.add(rigs[cfg].group);
          anchors[cfg] = new THREE.Object3D();
          anchors[cfg].position.set(-1.2, 0.95, 0);
          rigs[cfg].group.add(anchors[cfg]);
        }
      } catch (err) {
        console.warn('[partload] 3D dinonaktifkan:', err);
        gfx = null;
        q('.view3d__fallback').hidden = false;
      }
      disposers.push(store.subscribe((s, prev, changed) => {
        syncControls(s, changed);
        if (['calEngine', 'calDln', 'emRefO2', 'emTrefC'].some((k) => changed.includes(k))) cal.update(calibView(s));
      }));
      syncControls(store.get(), ['playing', 'frozen']);
    },
    update(dt) {
      store.set(tickPatch(store.get(), dt));
      const s = store.get();
      const f = deriveLoad(s);
      updateHud(f);
      updateEmis(f);
      updateAux(f);
      updateOverlay(f, s);
      if (gfx) {
        const time = performance.now() / 1000;
        for (const cfg of CFGS) rigs[cfg].update({ ...f[cfg], time });
        gfx.render();
        updateLabels(f);
      }
    },
    onKey(e) {
      const k = e.key.toLowerCase();
      if (KEYS_STRATEGY[k]) { store.set({ lStrategy: KEYS_STRATEGY[k] }); return true; }
      if (k === 'r') { resetParams(); return true; }
      if (k === 'c') { toggleCalib(); return true; }
      return false;
    },
    dispose() {
      for (const d of disposers.splice(0)) d();
      calib?.dispose(); cal?.dispose();
      if (gfx) { for (const r of Object.values(rigs)) { gfx.scene.remove(r.group); r.dispose(); } gfx.dispose(); }
      emis?.dispose(); aux?.dispose(); legend?.dispose(); lim?.dispose();
      for (const h of Object.values(huds)) h.dispose();
      el?.remove();
    },
  };
}
