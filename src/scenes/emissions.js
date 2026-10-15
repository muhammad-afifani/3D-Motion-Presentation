/**
 * Scene 8 — Emisi gabungan: diesel vs gas vs turbin.
 * Alur: kontrol (methane slip) → store.set → deriveEmis(state) → frame → { emissionRig, bar CO₂/CO₂e, bar NOx, HUD }.
 * Angka dari cylinderSim / braytonReal / dlnFromResult / ppmToGkWh / co2Specific / co2eWithSlip; tanpa perhitungan di sini.
 */
import * as THREE from 'three';
import { html } from './sceneBase.js';
import { togglePlayPatch, toggleFreezePatch, emisInitialState } from '../state/store.js';
import { deriveEmis } from '../state/deriveEmis.js';
import { EMIS } from '../model/presets.js';
import { createRenderer } from '../gfx/renderer.js';
import { createEmissionRig, UNIT_X, SPECIES } from '../gfx/emissionRig.js';
import { SPECIES_COLORS } from '../gfx/species.js';
import { createBarChart } from '../charts/barChart.js';
import { slider, button } from '../ui/controls.js';
import { animSpeedSlider } from '../ui/animSpeed.js';
import { createHud } from '../ui/hud.js';
import { fmt } from '../ui/format.js';
import { STR } from '../ui/strings.js';

const S = STR.scene8, C = STR.common, U = STR.common.units, H = STR.scene8.hud;

export const meta = { id: 'emissions', number: 8, title: S.title, message: S.message };

/** Item HUD (diekspor untuk tes). */
export function hudItems() {
  return [
    { id: 'co2d', label: H.co2Diesel.label, unit: U.gkWh, value: (f) => fmt(f.rows.diesel.co2, 0), tip: H.co2Diesel.tip },
    { id: 'co2eg', label: H.co2eGas.label, unit: U.gkWh, value: (f) => fmt(f.rows.gas.co2e, 0), tip: H.co2eGas.tip },
    { id: 'co2et', label: H.co2eGt.label, unit: U.gkWh, value: (f) => fmt(f.rows.turbine.co2e, 0), tip: H.co2eGt.tip },
    { id: 'slip', label: H.slip.label, unit: '', value: (f) => H.slip.value(f.slip, f.rows.gas.ch4), tip: H.slip.tip },
    { id: 'inc', label: H.inc.label, unit: U.pct, value: (f) => H.inc.value(f.slipIncrease), tip: H.inc.tip },
    { id: 'gwp', label: H.gwp.label, unit: '', sub: H.gwp.sub, value: (f) => fmt(f.gwp, 1), tip: H.gwp.tip },
    { id: 'cal', label: H.calib.label, unit: '', sub: H.calib.sub, value: (f) => H.calib.value(f.calib.engine.diesel, f.calib.dln), tip: H.calib.tip },
    { id: 'pm', label: S.pm.label, unit: '', sub: S.pm.sub, value: () => S.pm.value, tip: S.pm.tip },
  ];
}

/** Baris bar chart CO₂/CO₂e (diekspor untuk tes): segmen CO₂ + CH₄·GWP. */
export function co2Rows(f) {
  return f.list.map((r) => ({
    label: S.machines[r.id], value: r.co2e, color: SPECIES_COLORS.CO2, active: true,
    sub: S.charts.sub(r.eta, r.co2, r.ch4),
    stack: [{ value: r.co2, color: SPECIES_COLORS.CO2 }, { value: r.co2e - r.co2, color: SPECIES_COLORS.CH4 }],
  }));
}
/** Baris bar chart NOx (diekspor untuk tes). */
export function noxRows(f) {
  return f.list.map((r) => ({
    label: S.machines[r.id], value: r.nox, color: SPECIES_COLORS.NOx, active: true,
    sub: r.id === 'turbine' ? S.charts.subTurbine(r.noxPpm, C.basis.short(f.basis.refO2, f.basis.TrefC)) : undefined,
  }));
}
/** Pesan kunci (diekspor untuk tes). */
export function keyMessage(f) {
  return f.slip > 0 ? S.messageSlip(f.slip, f.slipIncrease, f.gasVsDiesel.co2e) : S.messageNoSlip(f.gasVsDiesel.co2);
}
/** Catatan kalibrasi di bawah grafik NOx (diekspor untuk tes). */
export function noxNote(f) {
  const c = f.calib, L = c.literature;
  return S.charts.noxNote(c.engine.diesel, c.engine.gas, c.dln, L.engine.diesel, L.engine.gas, L.dlnPpm, L.dlnRefO2);
}

/** @param {import('./sceneBase.js').SceneContext} ctx */
export function createScene(ctx) {
  const { store } = ctx;
  const disposers = [];
  let el, gfx = null, rig = null, co2Chart, noxChart, hud, lastMsg = '';
  const ctl = {};
  const labelEls = {};
  const v3 = new THREE.Vector3();

  const q = (sel) => el.querySelector(sel);
  const cache = new Map();
  const setText = (n, t) => { if (cache.get(n) !== t) { n.textContent = t; cache.set(n, t); } };
  const setHTML = (n, t) => { if (cache.get(n) !== t) { n.innerHTML = t; cache.set(n, t); } };

  function buildDom() {
    const chips = SPECIES.map((k) => `<span class="sw" style="background:${SPECIES_COLORS[k]}"></span>${S.species[k]}`).join(' · ');
    el = html(`
      <section class="scene scene--load scene--emis">
        <div class="pl-view">
          <div class="view3d"></div>
          <div class="overlay overlay--legend"><div class="nox-species">${chips}</div></div>
          <div class="overlay overlay--labels"></div>
          <div class="overlay overlay--status num"></div>
          <div class="view3d__fallback" hidden>${C.webglFallback}</div>
        </div>
        <div class="pl-emis chart-slot"></div>
        <div class="pl-aux emis-aux"><div class="chart-slot emis-aux__chart"></div><div class="chart-note" data-k="noxNote"></div></div>
        <div class="scene__controls"></div>
        <div class="scene__hud"></div>
      </section>`);
    ctx.root.appendChild(el);
  }

  function buildControls() {
    const s = store.get();
    ctl.slip = slider({ label: S.slip, ...EMIS.slip, value: s.eSlip, digits: 1, unit: U.pct, tip: S.tips.slip, onInput: (v) => store.set({ eSlip: v }) });
    ctl.speed = animSpeedSlider(store);
    ctl.play = button({ label: C.pause, key: C.keySpace, tip: C.tips.play, onClick: () => store.set(togglePlayPatch(store.get())) });
    ctl.freeze = button({ label: C.freeze, key: 'F', tip: C.tips.freeze, onClick: () => store.set(toggleFreezePatch(store.get())) });
    ctl.reset = button({ label: C.reset, key: 'R', tip: S.tips.reset, onClick: () => resetParams() });
    const g1 = html('<div class="ctl-group"></div>');
    g1.append(ctl.slip.el, ctl.speed.el);
    const g2 = html('<div class="ctl-group ctl-group--buttons"></div>');
    g2.append(ctl.play.el, ctl.freeze.el, ctl.reset.el);
    q('.scene__controls').append(g1, g2);
  }
  function resetParams() { store.set(emisInitialState()); ctx.toast?.(STR.app.toast.reset); }
  function syncControls(s, changed) {
    ctl.slip.set(s.eSlip);
    ctl.speed.set(s.animSpeed);
    if (changed.includes('playing') || changed.includes('frozen')) {
      ctl.play.setLabel(s.playing ? C.pause : C.play);
      ctl.play.setOn(!s.playing);
      ctl.play.setDisabled(s.frozen);
      ctl.freeze.setLabel(s.frozen ? C.unfreeze : C.freeze);
      ctl.freeze.setOn(s.frozen);
    }
  }

  function updateLabels() {
    const box = q('.overlay--labels');
    const w = box.clientWidth, h = box.clientHeight;
    const items = { ...Object.fromEntries(Object.keys(UNIT_X).map((k) => [k, [rig.anchors[k], S.labels3d[k]]])), pm: [rig.anchors.dieselTop, S.labels3d.pm] };
    for (const [k, [a, txt]] of Object.entries(items)) {
      let n = labelEls[k];
      if (!n) { n = labelEls[k] = document.createElement('div'); n.className = `label3d${k === 'pm' ? ' label3d--muted' : ''}`; box.appendChild(n); }
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
      co2Chart = createBarChart(q('.pl-emis'), { title: S.charts.co2.title, xLabel: S.charts.co2.xLabel, unit: U.gkWh, digits: 0, labelWidth: 230, indicative: true, padTop: 64 });
      noxChart = createBarChart(q('.emis-aux__chart'), { title: S.charts.nox.title, xLabel: S.charts.nox.xLabel, unit: U.gkWh, digits: 2, labelWidth: 230, indicative: true });
      hud = createHud(q('.scene__hud'), hudItems(), { level: C.level.semiEmpirical, note: H.note });
      try {
        gfx = createRenderer(q('.view3d'), { camPos: [0.3, 2.6, 8.6], target: [0, 1.3, 0] });
        gfx.controls.maxDistance = 14;
        gfx.camera.position.set(0.3, 2.6, 8.6); // posisi ulang: batas jarak default renderer (6) sudah memotongnya
        gfx.controls.update();
        rig = createEmissionRig();
        gfx.scene.add(rig.group);
      } catch (err) {
        console.warn('[emissions] 3D dinonaktifkan:', err);
        gfx = null; rig = null;
        q('.view3d__fallback').hidden = false;
      }
      disposers.push(store.subscribe((s, prev, changed) => syncControls(s, changed)));
      syncControls(store.get(), ['playing', 'frozen']);
    },
    update(dt) {
      const s = store.get();
      const f = deriveEmis(s);
      co2Chart.update(co2Rows(f), { caption: S.charts.co2.caption(SPECIES_COLORS.CO2, SPECIES_COLORS.CH4, f.gwp) });
      noxChart.update(noxRows(f));
      setText(q('[data-k="noxNote"]'), noxNote(f));
      hud.update(f);
      const st = [];
      if (s.frozen) st.push(`<span class="pill pill--freeze">${C.frozen(s.theta)}</span>`);
      else if (!s.playing) st.push(`<span class="pill">${C.paused}</span>`);
      setHTML(q('.overlay--status'), st.join(' '));
      const msg = keyMessage(f);
      if (msg !== lastMsg) { lastMsg = msg; ctx.setMessage?.(msg); }
      if (gfx) {
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
      co2Chart?.dispose(); noxChart?.dispose(); hud?.dispose();
      el?.remove();
    },
  };
}
