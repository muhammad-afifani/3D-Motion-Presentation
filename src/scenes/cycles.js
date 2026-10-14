/**
 * Scene 2 — Siklus ideal vs real.
 * Alur: kontrol → store.set → (Worker: cylinderSim mesin pembanding, lossWaterfall) →
 *       deriveCycles(state, hasil) → frame → { rig 3D / skema Brayton, P-v, T-s, waterfall, HUD }.
 */
import { html } from './sceneBase.js';
import {
  togglePlayPatch, toggleFreezePatch, scrubPatch, tickPatch,
  cycleDefaults, cycleKindPatch, cycleModePatch, cycleRRange,
} from '../state/store.js';
import {
  deriveCycles, keyNumbers, realSimParams, realSimKey, waterfallParams, waterfallKey,
} from '../state/deriveCycles.js';
import { createSimClient } from '../state/simClient.js';
import { CYCLES, RPM_VISUAL } from '../model/presets.js';
import { createRenderer } from '../gfx/renderer.js';
import { createPistonRig } from '../gfx/pistonRig.js';
import { createCycleChart } from '../charts/cycleChart.js';
import { createWaterfall } from '../charts/waterfall.js';
import { createBraytonSchematic } from '../charts/braytonSchematic.js';
import { createTempLegend } from '../charts/legend.js';
import { slider, segmented, button } from '../ui/controls.js';
import { createHud } from '../ui/hud.js';
import { fmt, pct } from '../ui/format.js';
import { STR, signedDeg } from '../ui/strings.js';

const S = STR.scene2, C = STR.common, U = STR.common.units, H = STR.scene2.hud, HT = STR.scene2.hud.tips;

export const meta = { id: 'cycles', number: 2, title: S.title, message: S.message };

const KEYS_KIND = { 1: 'otto', 2: 'diesel', 3: 'dual', 4: 'brayton' };
const CYC_KEYS = ['cKind', 'cMode', 'cR', 'cRc', 'cRp', 'cRpB', 'cT3'];
const pp = (x) => `${fmt(x * 100, 1)}`;

/** Konfigurasi HUD per jenis + mode (label & tooltip dari STR.scene2.hud). */
function hudItems(kind, mode) {
  const piston = kind !== 'brayton';
  const F = S.formula[kind];
  if (piston && mode === 'ideal') {
    return [
      { id: 'eta', label: H.etaIdeal, unit: U.pct, value: (f) => pct(f.eta.ideal, 1), tip: HT.etaIdeal(F, kind) },
      ...(kind !== 'otto' ? [{ id: 'otto', label: H.ottoSameR, unit: U.pct, value: (f) => pct(f.eta.ottoSameR, 1), tip: HT.ottoSameR }] : []),
      { id: 'mep', label: H.mep, unit: U.bar, value: (f) => fmt(f.eta.mep / 1e5, 1), tip: HT.mep },
      { id: 'tmax', label: H.tmax, unit: U.K, value: (f) => fmt(f.eta.Tmax, 0), tip: HT.tmax },
      { id: 'pmax', label: H.pmax, unit: U.bar, value: (f) => fmt(f.eta.Pmax / 1e5, 1), tip: HT.pmax },
    ];
  }
  if (piston) {
    return [
      kind === 'dual'
        ? { id: 'eta', label: H.etaIdealDual, unit: U.pct, value: (f) => pct(f.eta.ideal, 1), tip: HT.etaIdealDual(F) }
        : { id: 'eta', label: H.etaIdealQin, unit: U.pct, value: (f) => pct(f.eta.ideal, 1), tip: HT.etaIdealQin(F) },
      { id: 'ind', label: H.etaInd, unit: U.pct, value: (f) => pct(f.eta.ind, 1), tip: HT.etaInd },
      { id: 'brake', label: H.etaBrake, unit: U.pct, value: (f) => pct(f.eta.brake, 1), tip: HT.etaBrake },
      { id: 'gap', label: H.gapBrake, unit: U.pp, value: (f) => pp(f.eta.gap), tip: HT.gapBrake },
      { id: 'pmax', label: H.pmaxReal, unit: U.bar, value: (f) => fmt(f.eta.Pmax / 1e5, 1), tip: HT.pmaxReal },
    ];
  }
  if (mode === 'ideal') {
    return [
      { id: 'eta', label: H.etaIdeal, unit: U.pct, value: (f) => pct(f.eta.ideal, 1), tip: HT.etaIdealBrayton(F) },
      { id: 'bwr', label: H.bwr, unit: U.pct, value: (f) => pct(f.eta.bwr, 0), tip: HT.bwrIdeal },
      { id: 'w', label: H.wnet, unit: U.kJkg, value: (f) => fmt(f.eta.wnet / 1e3, 0), tip: HT.wnet },
      { id: 't2', label: H.t2, unit: U.K, value: (f) => fmt(f.eta.T2, 0), tip: HT.t2 },
      { id: 't4', label: H.t4, unit: U.K, value: (f) => fmt(f.eta.T4, 0), tip: HT.t4 },
    ];
  }
  return [
    { id: 'eta', label: H.etaIdeal, unit: U.pct, value: (f) => pct(f.eta.ideal, 1), tip: HT.etaIdealBrayton(F) },
    { id: 'real', label: H.etaReal, unit: U.pct, value: (f) => pct(f.eta.real, 1), tip: HT.etaReal },
    { id: 'gap', label: H.gapReal, unit: U.pp, value: (f) => pp(f.eta.gap), tip: HT.gapReal },
    { id: 'bwr', label: H.bwr, unit: U.pct, value: (f) => pct(f.eta.bwr, 0), tip: HT.bwrReal },
    { id: 't4', label: H.t4, unit: U.K, value: (f) => fmt(f.eta.T4, 0), tip: HT.t4 },
  ];
}

/** Teks label titik berjalan (kunci dari deriveCycles). */
function pointLabel(f) {
  const k = f.point.labelKey;
  return k === 'proc' ? S.procs[f.procSet][f.point.proc] : S.point[k];
}

/** Catatan (kunci + parameter dari deriveCycles) → teks. */
const noteText = (n) => (typeof S.notes[n.key] === 'function' ? S.notes[n.key](n.rMax) : S.notes[n.key]);

/** @param {import('./sceneBase.js').SceneContext} ctx */
export function createScene(ctx) {
  const { store } = ctx;
  const disposers = [];
  let el, gfx = null, rig = null, pv, ts, wf, schem, legend, hud = null, hudKey = '';
  let sim = null, simKeyNow = null, wfSteps = null, wfKeyNow = null, wfSrc = null, wfShown = null;
  const ctl = {};

  const simClient = createSimClient((r, key) => { sim = r; simKeyNow = key; }, { paramsOf: realSimParams, keyOf: realSimKey });
  const wfClient = createSimClient((r, key) => { wfSteps = r; wfKeyNow = key; }, { job: 'lossWaterfall', paramsOf: waterfallParams, keyOf: waterfallKey });

  const q = (sel) => el.querySelector(sel);
  const textCache = new Map();
  const setText = (node, s) => { if (textCache.get(node) !== s) { node.textContent = s; textCache.set(node, s); } };

  function buildDom() {
    el = html(`
      <section class="scene scene--cycles">
        <div class="cyc-view">
          <div class="view3d"></div>
          <div class="cyc-schem chart-slot" hidden></div>
          <div class="overlay overlay--formula num">
            <div class="f-line"><b data-k="formula"></b></div>
            <div class="f-vals"><span data-k="proc"></span></div>
            <div class="f-vals"><span>${S.readT}<b data-k="T"></b></span><span>${S.readP}<b data-k="P"></b></span></div>
          </div>
          <div class="overlay overlay--legend"></div>
          <div class="overlay overlay--notes"></div>
          <div class="overlay overlay--status num"></div>
          <div class="cyc-level" data-k="level"></div>
        </div>
        <div class="cyc-pv chart-slot"></div>
        <div class="cyc-ts chart-slot"></div>
        <div class="scene__controls"></div>
        <div class="cyc-wf chart-slot"></div>
        <div class="cyc-hud"></div>
      </section>`);
    ctx.root.appendChild(el);
  }

  function buildControls() {
    const s = store.get();
    ctl.kind = segmented({
      label: S.cycle,
      options: Object.keys(CYCLES).map((value, i) => ({ value, label: S.kinds[value], key: String(i + 1) })),
      value: s.cKind, onChange: (v) => setKind(v),
    });
    ctl.mode = segmented({
      label: S.model, tip: S.tips.mode, options: [{ value: 'ideal', label: S.ideal }, { value: 'real', label: S.real, key: 'I' }],
      value: s.cMode, onChange: (v) => setMode(v),
    });
    const rr = cycleRRange(s.cKind, s.cMode) ?? CYCLES.otto.ranges.r;
    ctl.r = slider({ label: S.r, ...rr, value: s.cR, digits: 1, onInput: (v) => store.set({ cR: v }) });
    ctl.rc = slider({ label: S.rc, ...CYCLES.diesel.ranges.rc, value: s.cRc, digits: 2, tip: S.tips.rc, onInput: (v) => store.set({ cRc: v }) });
    ctl.rp = slider({ label: S.rp, ...CYCLES.dual.ranges.rp, value: s.cRp, digits: 2, onInput: (v) => store.set({ cRp: v }) });
    ctl.rpB = slider({ label: S.rpB, ...CYCLES.brayton.ranges.rpB, value: s.cRpB, digits: 1, onInput: (v) => store.set({ cRpB: v }) });
    ctl.T3 = slider({ label: S.T3, ...CYCLES.brayton.ranges.T3, value: s.cT3, digits: 0, unit: U.K, onInput: (v) => store.set({ cT3: v }) });
    ctl.theta = slider({ label: S.theta, min: -360, max: 360, step: 0.5, value: s.theta, format: signedDeg, tip: S.tips.theta, onInput: (v) => store.set(scrubPatch(store.get(), v)) });
    ctl.rpm = slider({ label: C.animSpeed, ...RPM_VISUAL, value: s.rpmVisual, digits: 0, unit: U.rpmVisual, tip: C.tips.animSpeed, onInput: (v) => store.set({ rpmVisual: v }) });
    ctl.play = button({ label: C.pause, key: C.keySpace, tip: C.tips.play, onClick: () => store.set(togglePlayPatch(store.get())) });
    ctl.freeze = button({ label: C.freeze, key: 'F', tip: C.tips.freeze, onClick: () => store.set(toggleFreezePatch(store.get())) });
    ctl.reset = button({ label: C.reset, key: 'R', tip: S.tips.reset, onClick: resetCycle });
    ctl.replay = button({ label: S.replay, key: 'W', tip: S.tips.replay, onClick: () => wf.replay() });

    const g1 = html('<div class="ctl-group"></div>');
    g1.append(ctl.kind.el, ctl.mode.el, ctl.r.el, ctl.rc.el, ctl.rp.el, ctl.rpB.el, ctl.T3.el);
    const g2 = html('<div class="ctl-group"></div>');
    g2.append(ctl.theta.el, ctl.rpm.el);
    const g3 = html('<div class="ctl-group ctl-group--buttons"></div>');
    g3.append(ctl.play.el, ctl.freeze.el, ctl.reset.el, ctl.replay.el);
    q('.scene__controls').append(g1, g2, g3);
  }

  const setKind = (kind) => { if (kind !== store.get().cKind) store.set(cycleKindPatch(store.get(), kind)); };
  const setMode = (mode) => { if (mode !== store.get().cMode) store.set(cycleModePatch(store.get(), mode)); };
  const resetCycle = () => { const s = store.get(); store.set({ ...cycleDefaults(s.cKind), ...cycleModePatch({ ...s, ...cycleDefaults(s.cKind) }, s.cMode) }); };

  function syncControls(s, changed) {
    const piston = s.cKind !== 'brayton';
    if (changed.includes('cKind') || changed.includes('cMode')) {
      ctl.kind.set(s.cKind); ctl.mode.set(s.cMode);
      const rr = cycleRRange(s.cKind, s.cMode);
      if (rr) ctl.r.setRange(rr);
      ctl.r.el.hidden = !piston;
      ctl.rc.el.hidden = !(s.cKind === 'dual' || (s.cKind === 'diesel' && s.cMode === 'ideal'));
      ctl.rp.el.hidden = s.cKind !== 'dual';
      ctl.rpB.el.hidden = piston; ctl.T3.el.hidden = piston;
      if (s.cKind === 'dual') ctl.rc.setRange(CYCLES.dual.ranges.rc);
      else ctl.rc.setRange(CYCLES.diesel.ranges.rc);
      q('.view3d').hidden = !piston;
      q('.cyc-schem').hidden = piston;
      q('.overlay--legend').hidden = false;
      hudKey = '';
    }
    ctl.r.set(s.cR); ctl.rc.set(s.cRc); ctl.rp.set(s.cRp); ctl.rpB.set(s.cRpB); ctl.T3.set(s.cT3); ctl.rpm.set(s.rpmVisual);
    if (changed.includes('playing') || changed.includes('frozen')) {
      ctl.play.setLabel(s.playing ? C.pause : C.play);
      ctl.play.setOn(!s.playing);
      ctl.play.setDisabled(s.frozen);
      ctl.freeze.setLabel(s.frozen ? C.unfreeze : C.freeze);
      ctl.freeze.setOn(s.frozen);
      ctl.theta.setLocked(s.frozen);
    }
  }

  function requestJobs(s) {
    if (s.cKind === 'brayton') return;
    wfClient.request(s);
    if (s.cMode === 'real') simClient.request(s);
  }

  function updateHud(f) {
    const key = `${f.kind}|${f.mode}|${f.modelLevel}`;
    if (key !== hudKey) {
      hud?.dispose();
      hudKey = key;
      hud = createHud(q('.cyc-hud'), hudItems(f.kind, f.mode), {
        level: C.level[f.modelLevel],
        note: f.isPiston ? H.notePiston : H.noteBrayton,
      });
    }
    hud.update(f);
  }

  /** Label waterfall dari STR (thermo.js tidak diubah): piston per indeks langkah, Brayton per kunci. Di-memo per sumber. */
  function waterfallSteps(f) {
    if (f.waterfall !== wfSrc) {
      wfSrc = f.waterfall;
      wfShown = f.waterfall?.map((st, i) => ({ ...st, label: f.isPiston ? S.waterfall.steps[i] : S.waterfall.brayton[st.key] })) ?? null;
    }
    return wfShown;
  }

  function updateWaterfall(f) {
    const W = S.waterfall;
    if (f.isPiston) {
      wf.setData(waterfallSteps(f), { title: W.title(f.waterfallEngine, f.rEngine), level: f.waterfallLevel, caption: W.caption });
    } else {
      wf.setData(waterfallSteps(f), { title: W.braytonTitle, level: f.waterfallLevel, caption: W.braytonCaption });
    }
    wf.update();
  }

  function updateOverlay(f, s) {
    for (const n of el.querySelectorAll('[data-k]')) {
      const k = n.dataset.k;
      let v;
      if (k === 'formula') v = S.formula[f.kind];
      else if (k === 'proc') v = pointLabel(f);
      else if (k === 'T') v = f.point.visible ? `${fmt(f.point.T, 0)} ${U.K}` : '–';
      else if (k === 'P') v = f.point.visible ? `${fmt(f.point.P / 1e5, 2)} ${U.bar}` : '–';
      else if (k === 'level') v = C.level[f.modelLevel];
      else continue;
      setText(n, v);
    }
    const notes = q('.overlay--notes');
    const nh = f.notes.map((n) => `<div class="note-chip">⚠ ${noteText(n)}</div>`).join('');
    if (notes.innerHTML !== nh) notes.innerHTML = nh;
    const status = [];
    if (s.frozen) status.push(`<span class="pill pill--freeze">${C.frozen(s.theta)}</span>`);
    else if (!s.playing) status.push(`<span class="pill">${C.paused}</span>`);
    const st = q('.overlay--status');
    const h = status.join(' ');
    if (st.innerHTML !== h) st.innerHTML = h;
    legend.update({ T: f.point.visible ? f.point.T : f.states[0].T, tempScale: f.tempScale });
  }

  return {
    meta,
    mount() {
      buildDom();
      buildControls();
      pv = createCycleChart(q('.cyc-pv'), 'pv', { onHover: (i) => ts.highlight(i) });
      ts = createCycleChart(q('.cyc-ts'), 'ts', { onHover: (i) => pv.highlight(i) });
      wf = createWaterfall(q('.cyc-wf'));
      schem = createBraytonSchematic(q('.cyc-schem'));
      legend = createTempLegend(q('.overlay--legend'));
      try {
        gfx = createRenderer(q('.view3d'), { camPos: [1.25, 1.0, 2.1], target: [0, 0.55, 0], bloom: true });
        rig = createPistonRig();
        gfx.scene.add(rig.group);
      } catch (err) {
        console.warn('[cycles] 3D dinonaktifkan:', err);
        gfx = null; rig = null;
      }
      const kn = keyNumbers();
      ctx.setMessage?.(S.messageWithNumbers(kn.idealLo, kn.idealHi, kn.brakeLo, kn.brakeHi));
      const s0 = store.get();
      if (s0.cKind !== 'brayton') {
        wfClient.runNow(s0);
        if (s0.cMode === 'real') simClient.runNow(s0);
      }
      disposers.push(store.subscribe((s, prev, changed) => {
        if (changed.some((k) => CYC_KEYS.includes(k))) requestJobs(s);
        syncControls(s, changed);
      }));
      syncControls(s0, ['cKind', 'cMode', 'playing', 'frozen']);
    },
    update(dt) {
      store.set(tickPatch(store.get(), dt));
      const s = store.get();
      const piston = s.cKind !== 'brayton';
      const simOk = piston && s.cMode === 'real' && sim && simKeyNow === realSimKey(s) ? sim : null;
      const wfOk = piston && wfSteps && wfKeyNow === waterfallKey(s) ? wfSteps : null;
      const f = deriveCycles(s, { sim: simOk, waterfall: wfOk });
      ctl.theta.set(s.theta);
      pv.update(f);
      ts.update(f);
      updateWaterfall(f);
      updateHud(f);
      updateOverlay(f, s);
      if (piston && rig && f.rig) { rig.update(f.rig); gfx.render(); }
      if (!piston) schem.update(f);
    },
    onKey(e) {
      const k = e.key.toLowerCase();
      if (KEYS_KIND[k]) { setKind(KEYS_KIND[k]); return true; }
      if (k === 'i') { setMode(store.get().cMode === 'ideal' ? 'real' : 'ideal'); return true; }
      if (k === 'w') { wf.replay(); return true; }
      if (k === 'r') { resetCycle(); return true; }
      return false;
    },
    dispose() {
      for (const d of disposers.splice(0)) d();
      simClient.dispose(); wfClient.dispose();
      if (rig) { gfx.scene.remove(rig.group); rig.dispose(); }
      gfx?.dispose();
      pv?.dispose(); ts?.dispose(); wf?.dispose(); schem?.dispose(); legend?.dispose(); hud?.dispose();
      el?.remove();
    },
  };
}

