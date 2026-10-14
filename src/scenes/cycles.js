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

export const meta = {
  id: 'cycles',
  number: 2,
  title: 'Siklus ideal vs real',
  message: 'Pada r sama Otto ≥ Diesel; diesel unggul karena r-nya jauh lebih tinggi.',
};

/** Rumus η ideal per siklus (teks; nilainya dihitung thermo.js). */
const ETA_FORMULA = {
  otto: 'η = 1 − 1 / r^(k−1)',
  diesel: 'η = 1 − (1 / r^(k−1)) · (r_c^k − 1) / (k·(r_c − 1))',
  dual: 'η = 1 − (1 / r^(k−1)) · (r_p·r_c^k − 1) / ((r_p − 1) + k·r_p·(r_c − 1))',
  brayton: 'η = 1 − 1 / r_p^((k−1)/k)',
};
const KEYS_KIND = { 1: 'otto', 2: 'diesel', 3: 'dual', 4: 'brayton' };
const CYC_KEYS = ['cKind', 'cMode', 'cR', 'cRc', 'cRp', 'cRpB', 'cT3'];
const signedDeg = (v) => `${v < 0 ? '−' : ''}${fmt(Math.abs(v), 1)}°`;
const pp = (x) => `${fmt(x * 100, 1)}`;

/** Konfigurasi HUD per jenis + mode. */
function hudItems(kind, mode) {
  const piston = kind !== 'brayton';
  const fIdeal = ETA_FORMULA[kind];
  if (piston && mode === 'ideal') {
    return [
      { id: 'eta', label: 'η ideal', unit: '%', value: (f) => pct(f.eta.ideal, 1), tip: `${fIdeal}\nk = 1,4 (air-standard).\nSumber: ${kind}().eta` },
      ...(kind !== 'otto' ? [{ id: 'otto', label: 'η Otto (r sama)', unit: '%', value: (f) => pct(f.eta.ottoSameR, 1), tip: 'Pembanding: Otto ideal pada r yang sama.\nPada r sama Otto ≥ Diesel; diesel unggul karena r lebih tinggi.\nSumber: otto({r}).eta' }] : []),
      { id: 'mep', label: 'MEP', unit: 'bar', value: (f) => fmt(f.eta.mep / 1e5, 1), tip: 'Tekanan efektif rata-rata = w_net / (v1 − v2).\nSumber: cycle.mep' },
      { id: 'tmax', label: 'T maks', unit: 'K', value: (f) => fmt(f.eta.Tmax, 0), tip: 'Suhu state tertinggi siklus ideal.\nOtto: Tmax default 2200 K; Diesel/Dual: dari r_c, r_p.' },
      { id: 'pmax', label: 'P maks', unit: 'bar', value: (f) => fmt(f.eta.Pmax / 1e5, 1), tip: 'Tekanan state tertinggi (T1 = 300 K, P1 = 1 atm).' },
    ];
  }
  if (piston) {
    return [
      kind === 'dual'
        ? { id: 'eta', label: 'η ideal (r_p, r_c slider)', unit: '%', value: (f) => pct(f.eta.ideal, 1), tip: `${fIdeal}\nPembanding Dual memakai r_p dan r_c slider; q_in tidak disamakan dengan pembakaran real.` }
        : { id: 'eta', label: 'η ideal (q_in sama)', unit: '%', value: (f) => pct(f.eta.ideal, 1), tip: `${fIdeal}\nPembanding ideal memakai T1, P1 = IVC real dan q_in = Qtot/massa cylinderSim.` },
      { id: 'ind', label: 'η indikator', unit: '%', value: (f) => pct(f.eta.ind, 1), tip: 'η ind = W kotor / energi bahan bakar.\nSumber: cylinderSim().etaInd' },
      { id: 'brake', label: 'η rem', unit: '%', value: (f) => pct(f.eta.brake, 1), tip: 'η rem = P rem / (ṁ_bb·LHV); friksi Chen–Flynn (indikatif).\nSumber: cylinderSim().etaBrake' },
      { id: 'gap', label: 'Celah ideal → rem', unit: 'poin %', value: (f) => pp(f.eta.gap), tip: 'η ideal − η rem. Rinciannya di waterfall: k(T), pembakaran berwaktu, rugi panas, friksi.' },
      { id: 'pmax', label: 'P<sub>max</sub> real', unit: 'bar', value: (f) => fmt(f.eta.Pmax / 1e5, 1), tip: 'Sumber: cylinderSim().Pmax' },
    ];
  }
  if (mode === 'ideal') {
    return [
      { id: 'eta', label: 'η ideal', unit: '%', value: (f) => pct(f.eta.ideal, 1), tip: `${fIdeal}\nSumber: braytonIdeal().eta` },
      { id: 'bwr', label: 'Back-work ratio', unit: '%', value: (f) => pct(f.eta.bwr, 0), tip: 'Kerja kompresor / kerja turbin.\nSumber: braytonIdeal().backWorkRatio' },
      { id: 'w', label: 'w<sub>net</sub>', unit: 'kJ/kg', value: (f) => fmt(f.eta.wnet / 1e3, 0), tip: 'Kerja bersih per kg udara.' },
      { id: 't2', label: 'T<sub>2</sub> keluar kompresor', unit: 'K', value: (f) => fmt(f.eta.T2, 0) },
      { id: 't4', label: 'T<sub>4</sub> exhaust', unit: 'K', value: (f) => fmt(f.eta.T4, 0) },
    ];
  }
  return [
    { id: 'eta', label: 'η ideal', unit: '%', value: (f) => pct(f.eta.ideal, 1), tip: `${fIdeal}\nSumber: braytonIdeal().eta` },
    { id: 'real', label: 'η real', unit: '%', value: (f) => pct(f.eta.real, 1), tip: 'ηc 0,87, ηt 0,90, ΔP combustor 4%, mekanis 0,99.\nSumber: braytonReal().eta' },
    { id: 'gap', label: 'Celah ideal → real', unit: 'poin %', value: (f) => pp(f.eta.gap), tip: 'η ideal − η real (efisiensi komponen).' },
    { id: 'bwr', label: 'Back-work ratio', unit: '%', value: (f) => pct(f.eta.bwr, 0), tip: 'Kompresor memakan sebagian besar kerja turbin.\nSumber: braytonReal().backWorkRatio' },
    { id: 't4', label: 'T<sub>4</sub> exhaust', unit: 'K', value: (f) => fmt(f.eta.T4, 0), tip: 'Sumber: braytonReal().T4' },
  ];
}

/** @param {import('./sceneBase.js').SceneContext} ctx */
export function createScene(ctx) {
  const { store } = ctx;
  const disposers = [];
  let el, gfx = null, rig = null, pv, ts, wf, schem, legend, hud = null, hudKey = '';
  let sim = null, simKeyNow = null, wfSteps = null, wfKeyNow = null;
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
            <div class="f-vals"><span>T = <b data-k="T"></b></span><span>P = <b data-k="P"></b></span></div>
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
      label: 'Siklus',
      options: Object.entries(CYCLES).map(([value, c], i) => ({ value, label: c.label, key: String(i + 1) })),
      value: s.cKind, onChange: (v) => setKind(v),
    });
    ctl.mode = segmented({
      label: 'Model', options: [{ value: 'ideal', label: 'Ideal' }, { value: 'real', label: 'Real', key: 'I' }],
      value: s.cMode, onChange: (v) => setMode(v),
    });
    const rr = cycleRRange(s.cKind, s.cMode) ?? CYCLES.otto.ranges.r;
    ctl.r = slider({ label: 'Rasio kompresi r', ...rr, value: s.cR, digits: 1, onInput: (v) => store.set({ cR: v }) });
    ctl.rc = slider({ label: 'Cut-off r_c', ...CYCLES.diesel.ranges.rc, value: s.cRc, digits: 2, tip: 'r_c = v3/v2: lama injeksi pada tekanan tetap.', onInput: (v) => store.set({ cRc: v }) });
    ctl.rp = slider({ label: 'Rasio tekanan r_p (isokorik)', ...CYCLES.dual.ranges.rp, value: s.cRp, digits: 2, onInput: (v) => store.set({ cRp: v }) });
    ctl.rpB = slider({ label: 'Rasio tekanan r_p', ...CYCLES.brayton.ranges.rpB, value: s.cRpB, digits: 1, onInput: (v) => store.set({ cRpB: v }) });
    ctl.T3 = slider({ label: 'T₃ masuk turbin', ...CYCLES.brayton.ranges.T3, value: s.cT3, digits: 0, unit: 'K', onInput: (v) => store.set({ cT3: v }) });
    ctl.theta = slider({ label: 'Posisi θ', min: -360, max: 360, step: 0.5, value: s.theta, format: signedDeg, tip: 'Piston: sudut engkol. Brayton: 180° per proses (1→2, 2→3, 3→4, 4→1).', onInput: (v) => store.set(scrubPatch(store.get(), v)) });
    ctl.rpm = slider({ label: 'Kecepatan animasi', ...RPM_VISUAL, value: s.rpmVisual, digits: 0, unit: 'rpm visual', onInput: (v) => store.set({ rpmVisual: v }) });
    ctl.play = button({ label: 'Jeda', key: 'Spasi', onClick: () => store.set(togglePlayPatch(store.get())) });
    ctl.freeze = button({ label: 'Beku', key: 'F', onClick: () => store.set(toggleFreezePatch(store.get())) });
    ctl.reset = button({ label: 'Reset', key: 'R', tip: 'Kembalikan parameter siklus ke nilai acuan (golden test)', onClick: resetCycle });
    ctl.replay = button({ label: 'Putar ulang waterfall', key: 'W', onClick: () => wf.replay() });

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
      ctl.play.setLabel(s.playing ? 'Jeda' : 'Putar');
      ctl.play.setOn(!s.playing);
      ctl.play.setDisabled(s.frozen);
      ctl.freeze.setLabel(s.frozen ? 'Lepas beku' : 'Beku');
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
        level: f.modelLevel,
        note: f.isPiston ? 'Celah ideal → nyata = fisika, bukan kesalahan: k(T), waktu pembakaran, panas ke dinding, friksi.' : 'Real: efisiensi komponen (ηc, ηt), rugi tekanan, rugi mekanis.',
      });
    }
    hud.update(f);
  }

  function updateWaterfall(f) {
    if (f.isPiston) {
      const name = f.waterfallEngine === 'gas' ? 'gas engine' : 'diesel';
      wf.setData(f.waterfall, {
        title: `Waterfall ${name}: batas ideal → η rem (r = ${fmt(f.rEngine, 1)})`,
        level: f.waterfallLevel,
        caption: 'lossWaterfall(…, {window: \'preset\'}): IVC/EVO preset, langkah terakhir = η rem cylinderSim',
      });
    } else {
      wf.setData(f.waterfall, { title: 'Brayton: ideal → real', level: f.waterfallLevel, caption: 'Dua bar: model Brayton tidak punya rincian rugi bertahap' });
    }
    wf.update();
  }

  function updateOverlay(f, s) {
    for (const n of el.querySelectorAll('[data-k]')) {
      const k = n.dataset.k;
      let v;
      if (k === 'formula') v = ETA_FORMULA[f.kind];
      else if (k === 'proc') v = f.point.label;
      else if (k === 'T') v = f.point.visible ? `${fmt(f.point.T, 0)} K` : '–';
      else if (k === 'P') v = f.point.visible ? `${fmt(f.point.P / 1e5, 2)} bar` : '–';
      else if (k === 'level') v = f.modelLevel;
      else continue;
      setText(n, v);
    }
    const notes = q('.overlay--notes');
    const nh = f.notes.map((t) => `<div class="note-chip">⚠ ${t}</div>`).join('');
    if (notes.innerHTML !== nh) notes.innerHTML = nh;
    const status = [];
    if (s.frozen) status.push(`<span class="pill pill--freeze">BEKU · θ = ${signedDeg(s.theta)}</span>`);
    else if (!s.playing) status.push('<span class="pill">JEDA</span>');
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
      ctx.setMessage?.(`Pada r sama Otto ≥ Diesel; diesel unggul karena r-nya jauh lebih tinggi. Teori ${fmt(kn.idealLo * 100, 0)}\u2060–\u2060${fmt(kn.idealHi * 100, 0)}% → η\u00a0rem ${fmt(kn.brakeLo * 100, 0)}\u2060–\u2060${fmt(kn.brakeHi * 100, 0)}% (model).`);
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

