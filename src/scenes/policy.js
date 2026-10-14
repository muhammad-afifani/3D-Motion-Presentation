/**
 * Scene 9 — Trade-off kebijakan: NOx vs CO vs GHG. Tiga panel (tab 1/2/3), satu grafik utama + satu pendukung.
 * Alur: kontrol → store.set → (Worker: retardSweep) → derivePolicy(state, sweep) → frame → { grafik, HUD, kartu info }.
 * Angka dari retardSweep / ghgPenalty / loadSweep (deriveLoad) / ppmToMgNm3 / mgNm3ToPpm; tanpa perhitungan di sini.
 */
import { html } from './sceneBase.js';
import { policyInitialState, policyEnginePatch, limitsInitialState } from '../state/store.js';
import { derivePolicy, policySweepParams, policySweepKey, limitsInputPatch } from '../state/derivePolicy.js';
import { createSimClient } from '../state/simClient.js';
import { NOX_TIMING, POLICY, LOAD_RANGE } from '../model/presets.js';
import { SPECIES_COLORS } from '../gfx/species.js';
import { createMultiLineChart } from '../charts/multiLineChart.js';
import { decadeTicks, decadeFmt } from '../charts/xyChart.js';
import { niceCeil } from '../charts/chartBase.js';
import { slider, segmented, button } from '../ui/controls.js';
import { createHud } from '../ui/hud.js';
import { createLimitsInput } from '../ui/limitsInput.js';
import { fmt, pct } from '../ui/format.js';
import { STR, signedDeg, plusDeg } from '../ui/strings.js';

const S = STR.scene9, C = STR.common, U = STR.common.units, H = STR.scene9.hud;

export const meta = { id: 'policy', number: 9, title: S.title, message: S.message };

const KEYS_TAB = { 1: 'A', 2: 'B', 3: 'C' };
const MCOLOR = { diesel: '#a9b4c7', gas: '#4fb3ff', turbine: '#ffb15c' };
const DASH = { single: [], twin: [7, 5] };
const ETA_COLOR = '#e6ebf3';

/** Teks jendela beban: rentang hasil model, 'tidak ada', atau 'kosong' bila batas belum diisi. */
const winText = (w) => (w ? STR.scene6.windowText(w.ranges) : H.empty);
/** Teks basis lengkap sesuai satuan (ppmvd atau mg/Nm³) dan spesies. */
const basisText = (sp, unit, b) => (unit === 'mg' ? (sp === 'nox' ? C.basis.fullMg : C.basis.fullMgCO) : (sp === 'nox' ? C.basis.full : C.basis.fullCO))(b.refO2, b.TrefC);

/** Item HUD per tab (diekspor untuk tes). */
export function hudItems(f) {
  if (f.tab === 'A') {
    const signP = (v) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v), 1)}`;
    return [
      { id: 'th', label: S.timing[f.A?.engine ?? 'diesel'], unit: U.atdc, value: (x) => (x.A ? plusDeg(x.A.current.theta0) : '–'), tip: S.tips.timing },
      { id: 'nox', label: H.noxA.label, unit: U.gkWh, value: (x) => (x.A ? fmt(x.A.current.nox, 2) : '–'), tip: H.noxA.tip },
      { id: 'eta', label: H.etaA.label, unit: U.pct, value: (x) => (x.A ? pct(x.A.current.eta, 1) : '–'), tip: H.etaA.tip },
      { id: 'co2', label: H.co2A.label, unit: U.gkWh, value: (x) => (x.A ? fmt(x.A.current.co2, 0) : '–'), tip: H.co2A.tip },
      { id: 'dn', label: H.dNox.label, unit: U.pct, value: (x) => (x.A ? signP(x.A.delta.nox) : '–'), tip: H.dNox.tip },
      { id: 'dc', label: H.dCo2.label, unit: U.pct, value: (x) => (x.A ? signP(x.A.delta.co2) : '–'), tip: H.dCo2.tip },
    ];
  }
  if (f.tab === 'B') {
    return [
      { id: 'pen', label: H.penB.label, unit: U.pct, value: (x) => fmt(x.B.value, 1), tip: H.penB.tip },
      ...f.B.machines.map((m, i) => ({ id: `co2${m.id}`, label: H.co2B(STR.scene8.machines[m.id]), unit: U.gkWh, value: (x) => H.before(x.B.machines[i].current.co2_0, x.B.machines[i].current.co2_1), tip: H.co2BTip })),
    ];
  }
  const c = f.C, unitLbl = S.unitLabel[c.unit];
  return [
    { id: 'ln', label: H.limN.label, unit: c.limits.nox == null ? '' : unitLbl, sub: basisText('nox', c.unit, c.basis), value: (x) => (x.C.limits.nox == null ? H.empty : fmt(x.C.limits.nox, 1)), tip: H.limN.tip },
    { id: 'lc', label: H.limC.label, unit: c.limits.co == null ? '' : unitLbl, sub: basisText('co', c.unit, c.basis), value: (x) => (x.C.limits.co == null ? H.empty : fmt(x.C.limits.co, 1)), tip: H.limC.tip },
    { id: 'ws', label: H.winS.label, unit: '', value: (x) => winText(x.C.single.window), tip: H.winS.tip },
    { id: 'wt', label: H.winT.label, unit: '', value: (x) => winText(x.C.twin.window), tip: H.winT.tip },
  ];
}

/** Baris hasil di bawah judul panel (diekspor untuk tes). */
export function resultLine(f) {
  if (f.tab === 'A') return f.A ? S.A.result(S.engines[f.A.engine], f.A.current.theta0, f.A.delta.nox, f.A.delta.co2) : '';
  if (f.tab === 'B') { const g = f.B.machines.find((m) => m.id === 'gas'); return S.B.result(f.B.value, g.current.co2_0, g.current.co2_1); }
  return f.C.limits.set ? S.C.result(winText(f.C.single.window), winText(f.C.twin.window)) : S.C.prompt;
}

/** Pesan kunci per tab (diekspor untuk tes): arah & besar hasil model. */
export function keyMessage(f) {
  if (f.tab === 'A') {
    if (!f.A) return S.message;
    const atPreset = f.A.current.theta0 === f.A.preset;
    const th = atPreset ? f.A.extreme.theta0 : f.A.current.theta0;
    return S.messageA(S.engines[f.A.engine], th, atPreset ? f.A.extreme.nox : f.A.delta.nox, atPreset ? f.A.extreme.co2 : f.A.delta.co2);
  }
  if (f.tab === 'B') { const g = f.B.machines.find((m) => m.id === 'gas'); return S.messageB(f.B.value, g.current.co2_0, g.current.co2_1); }
  const c = f.C;
  if (!c.limits.set) return S.messageC;
  return S.messageCSet(c.limits.nox, c.limits.co, S.unitLabel[c.unit], C.basis.short(c.basis.refO2, c.basis.TrefC), winText(c.single.window), winText(c.twin.window));
}

/** @param {import('./sceneBase.js').SceneContext} ctx */
export function createScene(ctx) {
  const { store } = ctx;
  const disposers = [];
  let el, main, sub, lim, hud = null, hudKey = '', mainKey = '', lastMsg = '';
  let sweep = null, sweepKey = null;
  const ctl = {};

  const sweepClient = createSimClient((r, key) => { sweep = r; sweepKey = key; }, { job: 'retardSweep', debounceMs: 0, paramsOf: policySweepParams, keyOf: policySweepKey });

  const q = (sel) => el.querySelector(sel);
  const cache = new Map();
  const setText = (n, t) => { if (cache.get(n) !== t) { n.textContent = t; cache.set(n, t); } };

  function buildDom() {
    el = html(`
      <section class="scene scene--load scene--policy">
        <div class="pl-view pol-card">
          <h2 class="pol-title" data-k="title"></h2>
          <p class="pol-result num" data-k="result"></p>
          <p class="pol-note" data-k="note"></p>
          <p class="pol-note" data-k="strategy"></p>
          <div class="pol-disclaimer" data-k="disclaimer"></div>
        </div>
        <div class="pl-emis chart-slot"></div>
        <div class="pl-aux chart-slot"></div>
        <div class="scene__controls"></div>
        <div class="scene__hud"></div>
      </section>`);
    ctx.root.appendChild(el);
  }

  function buildControls() {
    const s = store.get();
    ctl.tab = segmented({ label: S.tab, tip: S.tips.tab, options: POLICY.tabs.map((t, i) => ({ value: t, label: S.tabs[t], key: String(i + 1) })), value: s.pTab, onChange: (v) => store.set({ pTab: v }) });
    ctl.engine = segmented({ label: S.engine, tip: S.tips.engine, options: [{ value: 'diesel', label: S.engines.diesel }, { value: 'gas', label: S.engines.gas }], value: s.pEngine, onChange: (v) => store.set(policyEnginePatch(v)) });
    ctl.timing = slider({ label: S.timing[s.pEngine], ...NOX_TIMING[s.pEngine], value: s.pTheta0, format: signedDeg, tip: S.tips.timing, onInput: (v) => store.set({ pTheta0: v }) });
    ctl.penalty = slider({ label: S.penalty, ...POLICY.penalty, value: s.pPenalty, digits: 1, unit: U.pct, tip: S.tips.penalty, onInput: (v) => store.set({ pPenalty: v }) });
    ctl.unit = segmented({ label: S.unit, tip: S.tips.unit, options: POLICY.limUnits.map((u) => ({ value: u, label: S.units[u] })), value: s.limUnit, onChange: (v) => store.set({ limUnit: v }) });
    ctl.reset = button({ label: C.reset, key: 'R', tip: S.tips.reset, onClick: () => resetParams() });
    const g1 = html('<div class="ctl-group"></div>');
    g1.append(ctl.tab.el, ctl.engine.el, ctl.timing.el, ctl.penalty.el, ctl.unit.el);
    const g2 = html('<div class="ctl-group"></div>');
    lim = createLimitsInput(g2, {
      onChange: (p) => store.set(limitsInputPatch(store.get(), p)),
      onClear: () => store.set(limitsInitialState()),
    });
    const g3 = html('<div class="ctl-group ctl-group--buttons"></div>');
    g3.append(ctl.reset.el);
    q('.scene__controls').append(g1, g2, g3);
    ctl.limits = g2;
  }

  function resetParams() {
    const s = store.get();
    store.set({ ...policyInitialState(), pTab: s.pTab, limUnit: s.limUnit });
    ctx.toast?.(STR.app.toast.reset);
  }

  function syncControls(s, changed) {
    ctl.tab.set(s.pTab); ctl.engine.set(s.pEngine); ctl.unit.set(s.limUnit);
    if (changed.includes('pEngine')) { ctl.timing.setRange(NOX_TIMING[s.pEngine]); ctl.timing.el.querySelector('.ctl__label').textContent = S.timing[s.pEngine]; }
    ctl.timing.set(s.pTheta0); ctl.penalty.set(s.pPenalty);
    ctl.engine.el.hidden = s.pTab !== 'A'; ctl.timing.el.hidden = s.pTab !== 'A';
    ctl.penalty.el.hidden = s.pTab !== 'B';
    ctl.unit.el.hidden = s.pTab !== 'C'; ctl.limits.hidden = s.pTab !== 'C';
  }

  function updateLimits(f, s) {
    const c = f.C;
    lim.update({ nox: c.limits.nox, co: c.limits.co, basisText: `${basisText('nox', c.unit, c.basis)} · ${basisText('co', c.unit, c.basis)}`, labels: S.limitLabels[s.limUnit] });
  }

  function updateHud(f) {
    const key = `${f.tab}|${f.A?.engine}|${f.C.unit}|${f.C.basis.refO2}|${f.C.basis.TrefC}|${f.C.limits.nox == null}|${f.C.limits.co == null}`;
    if (key !== hudKey) { hud?.dispose(); hudKey = key; hud = createHud(q('.scene__hud'), hudItems(f), { level: C.level.semiEmpirical, note: STR.common.indicative }); }
    hud.update(f);
  }

  function updateCard(f) {
    setText(q('[data-k="title"]'), S.titles[f.tab]);
    setText(q('[data-k="result"]'), resultLine(f));
    setText(q('[data-k="note"]'), f.tab === 'A' ? S.A.note : '');
    setText(q('[data-k="strategy"]'), f.tab === 'C' ? S.C.strategy(f.C.strategy) : '');
    setText(q('[data-k="disclaimer"]'), S.disclaimer(basisText('nox', f.C.unit, f.C.basis), basisText('co', f.C.unit, f.C.basis)));
  }

  function chartsA(f) {
    const A = f.A;
    if (!A) return;
    const k = `a|${A.engine}|${A.nox.join(',')}`;
    if (k !== mainKey) {
      mainKey = k;
      main.setTitle(S.A.main.title); main.setXLabel(S.A.main.xLabel); main.setYLabel(S.A.main.yLabel); main.setLog(false);
      main.setData({ series: [{ x: A.theta, y: A.nox, color: SPECIES_COLORS.NOx }], xDomain: [A.theta[0], A.theta.at(-1)], yDomain: [0, niceCeil(Math.max(...A.nox) * 1.1)], xFmt: (v) => fmt(v, 0) });
      main.setCaption(S.A.note);
      sub.setTitle(S.A.sub.title); sub.setXLabel(S.A.main.xLabel); sub.setYLabel(S.A.sub.yLabel); sub.setLog(false);
      const all = [...A.dEta, ...A.dCo2];
      const lo = Math.floor(Math.min(...all) - 1), hi = Math.ceil(Math.max(...all) + 1);
      sub.setData({ series: [{ x: A.theta, y: A.dEta, color: ETA_COLOR }, { x: A.theta, y: A.dCo2, color: SPECIES_COLORS.CO2 }], xDomain: [A.theta[0], A.theta.at(-1)], yDomain: [lo, hi], xFmt: (v) => fmt(v, 0), hlines: [{ y: 0, color: 'rgba(169,180,199,0.6)', dash: [2, 3] }] });
      sub.setCaption(S.A.sub.caption(ETA_COLOR, SPECIES_COLORS.CO2));
    }
    const th = A.current.theta0;
    main.setPoints([{ x: A.theta[A.ip], y: A.presetPoint.nox, fill: 'rgba(0,0,0,0)', ring: '#e6ebf3', guide: false }, { x: th, y: A.current.nox, fill: SPECIES_COLORS.NOx }]);
    sub.setPoints([{ x: th, y: A.dEta[A.i], fill: ETA_COLOR }, { x: th, y: A.dCo2[A.i], fill: SPECIES_COLORS.CO2 }]);
  }

  function chartsB(f) {
    const B = f.B;
    const k = `b|${B.machines.map((m) => m.eta).join(',')}`;
    if (k !== mainKey) {
      mainKey = k;
      main.setTitle(S.B.main.title); main.setXLabel(S.B.main.xLabel); main.setYLabel(S.B.main.yLabel); main.setLog(false);
      const all = B.machines.flatMap((m) => m.co2);
      main.setData({ series: B.machines.map((m) => ({ x: B.penalty, y: m.co2, color: MCOLOR[m.id] })), xDomain: [B.penalty[0], B.penalty.at(-1)], yDomain: [Math.floor(Math.min(...all) / 50) * 50, niceCeil(Math.max(...all) * 1.02)], xFmt: (v) => fmt(v, 0) });
      main.setCaption(S.B.sub.caption);
      sub.setTitle(S.B.sub.title); sub.setXLabel(S.B.main.xLabel); sub.setYLabel(S.B.sub.yLabel); sub.setLog(false);
      const allD = B.machines.flatMap((m) => m.dCo2);
      sub.setData({ series: B.machines.map((m) => ({ x: B.penalty, y: m.dCo2, color: MCOLOR[m.id] })), xDomain: [B.penalty[0], B.penalty.at(-1)], yDomain: [0, niceCeil(Math.max(...allD) * 1.1)], xFmt: (v) => fmt(v, 0) });
      sub.setCaption(S.B.sub.caption);
    }
    main.setPoints(B.machines.map((m) => ({ x: B.value, y: m.current.co2_1, fill: MCOLOR[m.id] })));
    sub.setPoints(B.machines.map((m) => ({ x: B.value, y: m.current.co2_1 - m.current.co2_0, fill: MCOLOR[m.id] })));
  }

  function chartsC(f) {
    const c = f.C;
    const k = `c|${c.unit}|${c.basis.refO2}|${c.basis.TrefC}|${c.limits.noxPpm}|${c.limits.coPpm}|${c.strategy}|${c.single.nox[0]}|${c.twin.nox[0]}`;
    const xDomain = [LOAD_RANGE.max, LOAD_RANGE.min];
    if (k !== mainKey) {
      mainKey = k;
      main.setTitle(S.C.main.title); main.setXLabel(S.C.main.xLabel); main.setYLabel(S.unitLabel[c.unit]); main.setLog(true);
      const series = ['single', 'twin'].flatMap((cfg) => [
        { x: c[cfg].load, y: c[cfg].nox, color: SPECIES_COLORS.NOx, dash: DASH[cfg] },
        { x: c[cfg].load, y: c[cfg].co, color: SPECIES_COLORS.CO, dash: DASH[cfg] },
      ]);
      const yMax = 10 ** Math.ceil(Math.log10(Math.max(...series.flatMap((x) => [...x.y]), c.limits.nox ?? 0, c.limits.co ?? 0)));
      const yDomain = [yMax / 1e4, yMax];
      const hlines = [];
      if (c.limits.nox != null) hlines.push({ y: c.limits.nox, color: SPECIES_COLORS.NOx, label: STR.scene6.charts.limit.nox, align: 'left' });
      if (c.limits.co != null) hlines.push({ y: c.limits.co, color: SPECIES_COLORS.CO, label: STR.scene6.charts.limit.co });
      const bands = ['single', 'twin'].flatMap((cfg) => c[cfg].coViolation.map(([hi, lo]) => ({ x0: hi + 0.5, x1: lo - 0.5, color: cfg === 'single' ? 'rgba(224,64,122,0.16)' : 'rgba(224,64,122,0.08)' })));
      main.setData({ series, xDomain, yDomain, yTicks: decadeTicks(...yDomain), yFmt: decadeFmt, xFmt: (v) => fmt(v, 0), hlines, bands });
      main.setCaption(S.C.caption(SPECIES_COLORS.NOx, SPECIES_COLORS.CO, basisText('nox', c.unit, c.basis), basisText('co', c.unit, c.basis), bands.length > 0));
      sub.setTitle(S.C.sub.title); sub.setXLabel(S.C.sub.xLabel); sub.setYLabel(''); sub.setLog(false);
      const segs = [];
      ['single', 'twin'].forEach((cfg, i) => (c[cfg].window?.ranges ?? []).forEach(([hi, lo]) => segs.push({ x: [hi + 0.4, lo - 0.4], y: [2 - i, 2 - i], color: cfg === 'single' ? '#e6ebf3' : '#4fb3ff', width: 14 })));
      sub.setData({ series: segs, xDomain, yDomain: [0.4, 2.6], yTicks: [1, 2], yFmt: (v) => (v === 2 ? S.C.sub.yLabels.single : S.C.sub.yLabels.twin), xFmt: (v) => fmt(v, 0) });
      sub.setCaption(c.limits.set ? '' : S.C.prompt);
    }
    main.setPoints(['single', 'twin'].flatMap((cfg) => [
      { x: c[cfg].point.load, y: c[cfg].point.nox, fill: SPECIES_COLORS.NOx, ring: cfg === 'twin' ? '#4fb3ff' : '#fff' },
      { x: c[cfg].point.load, y: c[cfg].point.co, fill: SPECIES_COLORS.CO, ring: cfg === 'twin' ? '#4fb3ff' : '#fff' },
    ]));
    sub.setPoints([]);
  }

  return {
    meta,
    mount() {
      buildDom();
      buildControls();
      main = createMultiLineChart(q('.pl-emis'), { title: S.A.main.title, modelLevel: 'semiEmpirical', xLabel: S.A.main.xLabel, yLabel: S.A.main.yLabel, pad: { l: 64, r: 18, t: 86, b: 40 } });
      sub = createMultiLineChart(q('.pl-aux'), { title: S.A.sub.title, modelLevel: 'semiEmpirical', xLabel: S.A.main.xLabel, yLabel: S.A.sub.yLabel, pad: { l: 120, r: 18, t: 74, b: 40 } });
      const s0 = store.get();
      sweepClient.runNow(s0);
      disposers.push(store.subscribe((s, prev, changed) => {
        if (changed.includes('pEngine') || changed.includes('calEngine')) sweepClient.request(s);
        if (changed.includes('pTab')) mainKey = '';
        syncControls(s, changed);
      }));
      syncControls(s0, ['pEngine']);
    },
    update() {
      const s = store.get();
      const f = derivePolicy(s, sweepKey === policySweepKey(s) ? sweep : null);
      updateCard(f);
      updateHud(f);
      updateLimits(f, s);
      if (f.tab === 'A') chartsA(f); else if (f.tab === 'B') chartsB(f); else chartsC(f);
      const msg = keyMessage(f);
      if (msg !== lastMsg) { lastMsg = msg; ctx.setMessage?.(msg); }
    },
    onKey(e) {
      const k = e.key.toLowerCase();
      if (KEYS_TAB[k]) { store.set({ pTab: KEYS_TAB[k] }); return true; }
      if (k === 'r') { resetParams(); return true; }
      return false;
    },
    dispose() {
      for (const d of disposers.splice(0)) d();
      sweepClient.dispose();
      main?.dispose(); sub?.dispose(); hud?.dispose(); lim?.dispose();
      el?.remove();
    },
  };
}
