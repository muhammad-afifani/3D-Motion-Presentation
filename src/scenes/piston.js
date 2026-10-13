/**
 * Scene 1 — Piston: dari engkol ke diagram P-V.
 * Alur: kontrol → store.set → (Worker) cylinderSim → derive(state, sim) → frame →
 *       { rig 3D, P-V, P-θ, HUD, legenda, rumus }.
 */
import * as THREE from 'three';
import { html, wrapTheta } from './sceneBase.js';
import { resetPatch, engineSwitchPatch } from '../state/store.js';
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

export const meta = {
  id: 'piston',
  number: 1,
  title: 'Piston: dari engkol ke diagram P-V',
  message: 'Satu siklus (2 putaran engkol, 4-tak) = satu loop di diagram P-V; luas loop = kerja.',
};

const PHASE_LABEL = { intake: 'Intake', kompresi: 'Kompresi', ekspansi: 'Ekspansi', exhaust: 'Exhaust' };
const LABELS = {
  crank: 'Poros engkol', rod: 'Batang torak', piston: 'Piston', valveIn: 'Katup masuk', valveEx: 'Katup buang',
  gas: 'Gas (warna = suhu)', top: null,
};

const signedDeg = (v) => `${v < 0 ? '−' : ''}${fmt(Math.abs(v), 1)}°`;
const plusDeg = (v) => `${v < 0 ? '−' : '+'}${fmt(Math.abs(v), 1)}°`;

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
            <div class="f-line"><span class="fv v-s">s(<span class="v-theta">θ</span>)</span> = a·cos <span class="v-theta">θ</span> + √(l² − a²·sin²<span class="v-theta">θ</span>)</div>
            <div class="f-line"><span class="fv v-V">V(<span class="v-theta">θ</span>)</span> = <span class="fv v-vc">V<sub>c</sub></span> + (πB²/4)·(l + a − s(<span class="v-theta">θ</span>))</div>
            <div class="f-vals">
              <span><span class="v-theta">θ</span> = <b data-k="theta"></b></span>
              <span>l + a − s = <b data-k="x"></b></span>
              <span class="v-V">V = <b data-k="V"></b></span>
            </div>
            <div class="f-vals f-vals--dim">
              <span>B = <b data-k="B"></b></span><span>a = <b data-k="a"></b></span><span>l = <b data-k="l"></b></span>
              <span class="v-vc">V<sub>c</sub> = V<sub>d</sub>/(r−1) = <b data-k="Vc"></b></span>
            </div>
          </div>
          <div class="overlay overlay--readout num">
            <div class="ro-phase" data-k="phase"></div>
            <div class="ro-grid">
              <span>P</span><b data-k="P"></b>
              <span>T</span><b data-k="T"></b>
              <span>x<sub>b</sub></span><b data-k="xb"></b>
            </div>
            <div class="gauge" data-tip="Tekanan silinder relatif terhadap Pmax siklus ini"><div class="gauge__bar"></div></div>
          </div>
          <div class="overlay overlay--legend"></div>
          <div class="overlay overlay--labels"></div>
          <div class="overlay overlay--status num"></div>
          <div class="view3d__fallback" hidden>
            <b>WebGL2 tidak tersedia.</b><br />Grafik dan angka tetap berjalan; tampilan 3D dinonaktifkan.
          </div>
        </div>
        <aside class="scene__charts">
          <div class="chart-slot chart-slot--main"></div>
          <div class="chart-slot chart-slot--sub"></div>
        </aside>
        <div class="scene__controls"></div>
        <div class="scene__hud"></div>
      </section>`);
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
      label: 'Mesin',
      options: [{ value: 'diesel', label: 'Diesel', key: '1' }, { value: 'gas', label: 'Gas engine', key: '2' }],
      value: s.engine,
      onChange: (v) => switchEngine(v),
    });
    ctl.r = slider({ label: 'Rasio kompresi r', ...R.r, value: s.r, digits: 1, tip: 'r = (Vc+Vd)/Vc. Mengubah Vc, sehingga tinggi ruang bakar, Pmax, dan η berubah.', onInput: (v) => store.set({ r: v }) });
    ctl.phi = slider({ label: 'Rasio ekuivalen φ', ...R.phi, value: s.phi, digits: 2, tip: 'φ = (bahan bakar/udara) ÷ stoikiometrik. φ < 1 = miskin (lean).', onInput: (v) => store.set({ phi: v }) });
    ctl.theta0 = slider({ label: 'Awal pembakaran θ₀', ...R.theta0, value: s.theta0, format: signedDeg, tip: 'Timing injeksi (diesel) / percikan busi (gas). Negatif = sebelum TDC.', onInput: (v) => store.set({ theta0: v }) });
    ctl.rpm = slider({ label: 'Kecepatan animasi', ...RPM_VISUAL, value: s.rpmVisual, digits: 0, unit: 'rpm visual', tip: 'Hanya kecepatan tampilan (slow-motion). N mesin di model tetap.', onInput: (v) => store.set({ rpmVisual: v }) });
    ctl.theta = slider({ label: 'Sudut engkol θ', min: -360, max: 360, step: 0.5, value: s.theta, format: signedDeg, tip: 'Geser untuk menjeda dan memeriksa satu sudut. 0° = TDC pembakaran.', onInput: (v) => store.set({ theta: v, playing: false }) });
    ctl.play = button({ label: 'Jeda', key: 'Spasi', onClick: () => store.set({ playing: !store.get().playing }) });
    ctl.freeze = button({ label: 'Beku', key: 'F', tip: 'Bekukan waktu (θ tetap) untuk menunjuk satu state', onClick: () => store.set({ frozen: !store.get().frozen }) });
    ctl.reset = button({ label: 'Reset', key: 'R', tip: 'Kembalikan parameter ke preset mesin', onClick: resetParams });
    ctl.labels = button({ label: 'Label', key: 'L', tip: 'Tampilkan/sembunyikan label komponen 3D', onClick: toggleLabels });
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
      ctl.play.setLabel(s.playing ? 'Jeda' : 'Putar');
      ctl.play.setOn(!s.playing);
      ctl.freeze.setOn(s.frozen);
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
    hud = createHud(q('.scene__hud'), [
      { id: 'pmax', label: 'P<sub>max</sub>', unit: 'bar', value: (f) => fmt(toBar(f.summary.Pmax), 1),
        tip: 'Tekanan puncak silinder.\nSumber: cylinderSim().Pmax: integrasi RK4 hukum I termodinamika, pelepasan panas Wiebe, k(T).' },
      { id: 'thpmax', label: 'θ saat P<sub>max</sub>', unit: 'thd TDC', value: (f) => plusDeg(f.summary.thetaPmax),
        tip: 'Sudut engkol saat tekanan puncak; + = setelah TDC.\nSumber: cylinderSim().thetaPmax.' },
      { id: 'imep', label: 'IMEP (kotor)', unit: 'bar', value: (f) => fmt(toBar(f.summary.imepG), 1),
        tip: 'IMEP = W kotor / Vd, dengan W = ∮P dV fase tertutup (IVC→EVO) = luas arsir P-V.\nKerja pumping diabaikan.\nSumber: cylinderSim().imepG.' },
      { id: 'etai', label: 'η indikator', unit: '%', value: (f) => pct(f.eta.ind, 1),
        tip: 'η ind = W kotor / (m_bb · LHV) per siklus.\nSumber: cylinderSim().etaInd.' },
      { id: 'etab', label: 'η rem', unit: '%', value: (f) => pct(f.eta.brake, 1),
        tip: 'η rem = P rem / (ṁ_bb · LHV); BMEP = IMEP − FMEP.\nFMEP: korelasi Chen–Flynn (indikatif).\nSumber: cylinderSim().etaBrake.' },
      { id: 'bsfc', label: 'BSFC', unit: 'g/kWh', value: (f) => fmt(f.summary.bsfc, 0),
        tip: 'Konsumsi bahan bakar spesifik rem = ṁ_bb / P rem.\nSumber: cylinderSim().bsfc.' },
    ], { level: 'Semi-empiris', note: 'cylinderSim: crank-slider + Wiebe + hukum I, k(T); rugi panas dilumpkan; friksi Chen–Flynn (indikatif). Bukan prediksi vendor.' });
  }

  // ── grafik ──
  function buildCharts() {
    pv = createPVChart(q('.chart-slot--main'));
    pth = createLineChart(q('.chart-slot--sub'), { title: 'Tekanan vs sudut engkol (P-θ)', modelLevel: 'Semi-empiris', xLabel: 'Sudut engkol θ [°], 0 = TDC pembakaran', yLabel: 'P [bar]' });
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
          { x0: -360, x1: g.ivc, label: 'Intake', color: 'rgba(90,169,255,0.07)' },
          { x0: g.ivc, x1: 0, label: 'Kompresi', color: 'rgba(255,255,255,0.025)' },
          { x0: g.theta0, x1: g.theta0 + g.dur, label: '', color: 'rgba(255,154,60,0.13)' },
          { x0: 0, x1: g.evo, label: 'Ekspansi', color: 'rgba(255,255,255,0.025)' },
          { x0: g.evo, x1: 360, label: 'Exhaust', color: 'rgba(255,138,76,0.07)' },
        ],
        vlines: [{ x: -360, label: 'TDC' }, { x: -180, label: 'BDC' }, { x: 0, label: 'TDC' }, { x: 180, label: 'BDC' }, { x: 360, label: 'TDC' }],
        markers: [{ x: f.summary.thetaPmax, y: PmaxBar, label: `Pmax ${fmt(PmaxBar, 1)} bar` }],
      });
      pth.setCaption(`<span class="sw" style="background:rgba(255,154,60,0.35)"></span>pembakaran θ₀ ${signedDeg(g.theta0)} … ${signedDeg(g.theta0 + g.dur)} (Wiebe) · intake/exhaust disederhanakan`);
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
        case 'x': v = `${fmt(toMm(f.pistonPos), 1)} mm`; break;
        case 'V': v = `${fmt(toLiter(f.V), 3)} L`; break;
        case 'B': v = `${fmt(toMm(g.bore), 0)} mm`; break;
        case 'a': v = `${fmt(toMm(g.a), 0)} mm`; break;
        case 'l': v = `${fmt(toMm(g.conrod), 0)} mm`; break;
        case 'Vc': v = `${fmt(toLiter(g.Vc), 3)} L (r = ${fmt(g.r, 1)})`; break;
        case 'phase': v = PHASE_LABEL[f.phase] ?? f.phase; break;
        case 'P': v = `${fmt(toBar(f.P), 1)} bar`; break;
        case 'T': v = `${fmt(f.T, 0)} K`; break;
        case 'xb': v = `${fmt(f.xb * 100, 0)} %`; break;
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
    status.push(`Slow-motion ×${fmt(f.slowMo, 3)} · ${fmt(f.rpmVisual, 0)} rpm visual (mesin ${fmt(f.N, 0)} rpm)`);
    if (s.frozen) status.push('<span class="pill pill--freeze">BEKU</span>');
    else if (!s.playing) status.push('<span class="pill">JEDA</span>');
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
    for (const [k, name] of Object.entries(LABELS)) {
      const a = rig.anchors[k];
      if (!a) continue;
      let n = labelEls[k];
      if (!n) { n = labelEls[k] = document.createElement('div'); n.className = 'label3d'; box.appendChild(n); }
      const txt = k === 'top' ? (f.fuel === 'diesel' ? 'Injektor' : 'Busi') : name;
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
      if (s0.playing && !s0.frozen) store.set({ theta: wrapTheta(s0.theta + 6 * s0.rpmVisual * dt) });
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
      if (e.key === 'l' || e.key === 'L') { toggleLabels(); return true; }
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
