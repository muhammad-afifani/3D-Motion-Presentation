/**
 * Scene 9 — Emisi teregulasi: lima tab (1 Limits, 2 Formation, 3 Levers, 4 Load window, 5 GHG).
 * Alur: kontrol → store.set → (Worker: leverSweep, debounce) → derivePolicy(state, sweep) → frame → { grafik, HUD, tab }.
 * Tab Limits dan Levers membaca frame yang sama (chip kepatuhan mesin mengikuti slider tuas). Angka dari leverSweep /
 * ghgPenalty / loadSweep (deriveLoad) / jalur regulasi; tanpa perhitungan di sini.
 */
import { html } from './sceneBase.js';
import { policyInitialState, limitsInitialState } from '../state/store.js';
import { derivePolicy, limitsInputPatch } from '../state/derivePolicy.js';
import { leverSweepParams, leverSweepKey, leverPatch, leverEngine, leversResetPatch } from '../state/deriveLevers.js';
import { createSimClient } from '../state/simClient.js';
import { POLICY, LOAD_RANGE, LEVER_AXIS_DISPLAY, EMIS } from '../model/presets.js';
import { SPECIES_VAR } from '../gfx/species.js';
import { createMultiLineChart } from '../charts/multiLineChart.js';
import { decadeTicks, decadeFmt } from '../charts/xyChart.js';
import { niceCeil } from '../charts/chartBase.js';
import { slider, segmented, button } from '../ui/controls.js';
import { createHud } from '../ui/hud.js';
import { createHelpButton } from '../ui/helpButton.js';
import { createLimitsInput } from '../ui/limitsInput.js';
import { createRegHeader } from '../ui/regHeader.js';
import { createLimitsTab } from '../ui/limitsTab.js';
import { createFormationTab } from '../ui/formationTab.js';
import { formationCards } from '../state/formationView.js';
import { contentOf, onContent } from '../state/contentStore.js';
import { createContentBanner } from '../ui/contentBanner.js';
import { deriveCompliance } from '../state/deriveCompliance.js';
import { regulationsContent, onRegulations } from '../state/regulationsStore.js';
import { regSelection, regSelectionPatch, siteDataPatch, EQUIPMENT } from '../state/regulations.js';
import { fuelSulfurPatch, fuelGasPatch } from '../state/deriveFuel.js';
import { createLeversTab } from '../ui/leversTab.js';
import { fmt, pct } from '../ui/format.js';
import { STR } from '../ui/strings.js';
import { CV } from '../charts/chartBase.js';

const S = STR.scene9, C = STR.common, U = STR.common.units, H = STR.scene9.hud, LV = STR.scene9.leversTab, R = STR.regulation;

export const meta = { id: 'policy', number: 9, title: S.title, message: S.message };

const KEYS_TAB = Object.fromEntries(POLICY.tabs.map((t, i) => [String(i + 1), t]));
/** Tab berlayout lebar (tanpa grafik dan HUD). */
export const WIDE_TABS = Object.freeze(['limits', 'formation']);
const MCOLOR = { diesel: CV.diesel, gas: CV.cold, turbine: CV.main };
const DASH = { single: [], twin: [7, 5] };
const ETA_COLOR = CV.fg;
const LEVER_DEBOUNCE_MS = 150;
/** Perubahan state yang memicu sapuan tuas baru (di Worker, setelah debounce). */
const SWEEP_FIELDS = ['p9Lev', 'p9Axis', 'regEquip', 'pEngine', 'calEngine'];

/** Teks jendela beban: rentang hasil model, 'tidak ada', atau 'kosong' bila batas belum diisi. */
const winText = (w) => (w ? STR.scene6.windowText(w.ranges) : H.empty);
/** Teks basis lengkap sesuai satuan (ppmvd atau mg/Nm³) dan spesies. */
const basisText = (sp, unit, b) => (unit === 'mg' ? (sp === 'nox' ? C.basis.fullMg : C.basis.fullMgCO) : (sp === 'nox' ? C.basis.full : C.basis.fullCO))(b.refO2, b.TrefC);

/** Item HUD per tab (diekspor untuk tes). */
export function hudItems(f) {
  if (f.tab === 'levers') {
    const L = f.levers, HL = LV.hud, b = L.limit.basis;
    const num = (v, d) => (v == null ? HL.pending : fmt(v, d));
    const pt = (x) => (x.levers.ready ? x.levers.point : null);
    return [
      { id: 'nox', help: 'hud.noxMg', label: HL.nox.label, unit: U.mgNm3, sub: b ? C.basis.fullMg(b.refO2Pct, b.TrefC) : undefined, value: (x) => num(pt(x)?.noxMg, (pt(x)?.noxMg ?? 0) < 100 ? 1 : 0), tip: HL.nox.tip },
      { id: 'st', help: 'hud.limitStatus', label: R.title, unit: '', sub: (x) => statusSub(x.levers), value: (x) => (pt(x) ? R.status[pt(x).status] : HL.pending), tip: HL.status.tip },
      { id: 'eta', help: 'hud.etaBrake', label: HL.eta.label, unit: U.pct, value: (x) => (pt(x) ? pct(pt(x).etaBrake, 1) : HL.pending), tip: HL.eta.tip },
      { id: 'co2', help: 'hud.co2', label: HL.co2.label, unit: U.gkWh, value: (x) => num(pt(x)?.co2_gkWh, 0), tip: HL.co2.tip },
      { id: 'pmax', help: 'hud.pmax', label: HL.pmax.label, unit: U.bar, value: (x) => num(pt(x)?.Pmax_bar, 1), tip: HL.pmax.tip },
      { id: 'o2', help: 'hud.exhaustO2', label: HL.o2.label, unit: U.pct, sub: HL.dry, value: (x) => fmt(x.fuel.exhaustO2[x.levers.kind], 1), tip: HL.o2.tip },
      { id: 'lam', help: 'hud.lambda', label: HL.lambda.label, unit: '', value: (x) => fmt(x.fuel.lambda[x.levers.kind], 2), tip: HL.lambda.tip },
      { id: 'ms', help: 'hud.sweepTime', label: HL.ms.label, unit: U.ms, value: (x) => (x.levers.ms == null ? HL.pending : fmt(x.levers.ms, 0)), tip: HL.ms.tip },
    ];
  }
  if (f.tab === 'B') {
    return [
      { id: 'pen', help: 'hud.fuelPenalty', label: H.penB.label, unit: U.pct, value: (x) => fmt(x.B.value, 1), tip: H.penB.tip },
      { id: 'slip', help: 'hud.slip', label: H.slip.label, unit: U.pct, value: (x) => fmt(x.B.slip, 1), tip: H.slip.tip },
      ...f.B.machines.map((m, i) => ({ id: `co2${m.id}`, label: H.co2B(STR.scene8.machines[m.id]), unit: U.gkWh, value: (x) => H.before(x.B.machines[i].current.co2_0, x.B.machines[i].current.co2_1), tip: H.co2BTip })),
      ...f.B.machines.flatMap((m, i) => (m.gasFired ? [{ id: `co2e${m.id}`, label: H.co2e(STR.scene8.machines[m.id]), unit: U.gkWh, value: (x) => H.before(x.B.machines[i].current.co2_1, x.B.machines[i].currentE.co2e), tip: H.co2eTip }] : [])),
      { id: 'share', help: 'hud.slipShare', label: H.share.label, unit: U.pct, value: (x) => pct(x.B.machines.find((m) => m.id === 'gas').currentE.slipShare, 1), tip: H.share.tip },
    ];
  }
  const c = f.C, unitLbl = S.unitLabel[c.unit];
  return [
    { id: 'ln', help: 'hud.limitNox', label: H.limN.label, unit: c.limits.nox == null ? '' : unitLbl, model: limitSourceText(c.limits.source.nox, c.regulation), sub: basisText('nox', c.unit, c.basis), value: (x) => (x.C.limits.nox == null ? H.empty : fmt(x.C.limits.nox, 1)), tip: H.limN.tip },
    { id: 'lc', help: 'hud.limitCo', label: H.limC.label, unit: c.limits.co == null ? '' : unitLbl, model: limitSourceText(c.limits.source.co, c.regulation), sub: basisText('co', c.unit, c.basis), value: (x) => (x.C.limits.co == null ? H.empty : fmt(x.C.limits.co, 1)), tip: H.limC.tip },
    { id: 'ws', help: 'hud.loadWindow', label: H.winS.label, unit: '', value: (x) => winText(x.C.single.window), tip: H.winS.tip },
    { id: 'wt', help: 'hud.loadWindow', label: H.winT.label, unit: '', value: (x) => winText(x.C.twin.window), tip: H.winT.tip },
  ];
}

/** Baris kecil di bawah chip HUD Levers: limit + kelas, margin (%) dan keterangan bila lebih kecil dari ketidakpastian model. */
export function statusSub(L) {
  const HL = LV.hud;
  if (L.limit.mg == null) return HL.noLimit;
  const lim = HL.limitSub(fmt(L.limit.mg, L.limit.mg < 100 ? 1 : 0), L.limit.cls ?? '');
  const p = L.ready ? L.point : null;
  if (!p || p.marginPct == null) return lim;
  return `${lim} · ${R.margin(p.marginPct)}${p.marginSmall ? ` · ${R.marginSmall}` : ''}`;
}

/** Asal limit untuk label kecil di HUD: regulasi (nama singkat), user override, atau permit/OEM (diekspor untuk tes). */
export function limitSourceText(source, regulation) {
  if (!source) return undefined;
  return source === 'regulation' ? STR.regulation.limitSource.regulation(regulation?.short ?? '') : STR.regulation.limitSource[source];
}

/** Baris hasil di bawah judul panel (diekspor untuk tes). */
export function resultLine(f) {
  if (f.tab === 'B') { const g = f.B.machines.find((m) => m.id === 'gas'); return S.B.result(f.B.value, g.current.co2_0, g.current.co2_1); }
  return f.C.limits.set ? S.C.result(winText(f.C.single.window), winText(f.C.twin.window)) : S.C.prompt;
}

/** Pesan kunci per tab (diekspor untuk tes): arah & besar hasil model. */
export function keyMessage(f) {
  if (f.tab === 'limits') return S.messageLimits;
  if (f.tab === 'formation') return S.messageFormation;
  if (f.tab === 'levers') {
    const L = f.levers, eng = LV.engines[L.kind];
    if (L.atPreset || !L.ready) return LV.messagePreset(eng);
    return LV.message(eng, LV.axes[L.axis], L.delta.noxMg, L.delta.eta);
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
  let el, main, sub, lim, regHead, limitsTab, formTab, levTab, formBanner, regBanner, backBtn, presetBtn, hud = null, hudKey = '', mainKey = '', lastMsg = '', tabShown = '';
  let compMemo = { s: null, data: null, lev: null, f: null };
  let sweep = null, sweepKey = null;
  const ctl = {};

  // sapuan tuas di Web Worker; hasil lama dibuang (simClient), kunci = mesin + sumbu + tuas lain + kalibrasi
  const sweepClient = createSimClient((r, key) => { sweep = r; sweepKey = key; }, { job: 'leverSweep', debounceMs: LEVER_DEBOUNCE_MS, paramsOf: leverSweepParams, keyOf: leverSweepKey });

  const q = (sel) => el.querySelector(sel);
  const cache = new Map();
  const setText = (n, t) => { if (cache.get(n) !== t) { n.textContent = t; cache.set(n, t); } };

  function buildDom() {
    el = html(`
      <section class="scene scene--load scene--policy">
        <div class="pol-head"><div class="pol-head__reg"></div><div class="pol-head__state"><span class="pol-badge" data-k="badge"></span><span data-k="preset"></span></div><div class="pol-head__back"></div></div>
        <div class="pol-wide"><div class="pol-limits"></div><div class="pol-formation"></div></div>
        <div class="pl-view pol-levers"></div>
        <div class="pl-view pol-card">
          <h2 class="pol-title" data-k="title"></h2>
          <p class="pol-result num" data-k="result"></p>
          <p class="pol-note" data-k="note"></p>
          <p class="pol-note" data-k="strategy"></p>
          <p class="pol-note pol-ref" data-k="ref" hidden><span></span><a class="fm-ref"></a></p>
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
    ctl.tab = segmented({ help: 'ui.s9tabs', label: S.tab, tip: S.tips.tab, options: POLICY.tabs.map((t, i) => ({ value: t, label: S.tabs[t], key: String(i + 1) })), value: s.pTab, onChange: (v) => store.set({ pTab: v }) });
    ctl.penalty = slider({ help: 'ctl.fuelPenalty', label: S.penalty, ...POLICY.penalty, value: s.pPenalty, digits: 1, unit: U.pct, tip: S.tips.penalty, onInput: (v) => store.set({ pPenalty: v }) });
    ctl.slip = slider({ help: 'ctl.slip', label: S.slip, ...EMIS.slip, value: s.eSlip ?? EMIS.slip.default, digits: 1, unit: U.pct, tip: S.tips.slip, onInput: (v) => store.set({ eSlip: v }) });
    ctl.unit = segmented({ help: 'ctl.limUnit', label: S.unit, tip: S.tips.unit, options: POLICY.limUnits.map((u) => ({ value: u, label: S.units[u] })), value: s.limUnit, onChange: (v) => store.set({ limUnit: v }) });
    ctl.reset = button({ help: 'ctl.reset', label: C.reset, key: 'R', tip: S.tips.reset, onClick: () => resetParams() });
    const g1 = html('<div class="ctl-group"></div>');
    g1.append(ctl.tab.el, ctl.penalty.el, ctl.slip.el, ctl.unit.el);
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
    store.set({ ...policyInitialState(), ...leversResetPatch(), pTab: s.pTab, limUnit: s.limUnit, p9Sub: s.p9Sub });
    ctx.toast?.(STR.app.toast.reset);
  }

  function syncControls(s) {
    ctl.tab.set(s.pTab); ctl.unit.set(s.limUnit); ctl.penalty.set(s.pPenalty); ctl.slip.set(s.eSlip ?? EMIS.slip.default);
    ctl.penalty.el.hidden = s.pTab !== 'B'; ctl.slip.el.hidden = s.pTab !== 'B';
    ctl.unit.el.hidden = s.pTab !== 'C'; ctl.limits.hidden = s.pTab !== 'C';
  }

  function updateLimits(f, s) {
    const c = f.C;
    // input hanya menampilkan isian presenter (override / permit-OEM); kosong = limit dari file regulasi
    lim.update({ nox: c.limits.overrideShown.nox, co: c.limits.overrideShown.co, basisText: `${basisText('nox', c.unit, c.basis)} · ${basisText('co', c.unit, c.basis)}`, labels: S.limitLabels[s.limUnit] });
  }

  function updateHud(f) {
    if (WIDE_TABS.includes(f.tab)) { hud?.dispose(); hud = null; hudKey = ''; return; }
    const L = f.levers;
    const key = f.tab === 'levers'
      ? `levers|${L.kind}|${L.limit.mg}|${L.limit.cls}|${L.limit.basis?.TrefC}`
      : `${f.tab}|${f.C.unit}|${f.C.basis.refO2}|${f.C.basis.TrefC}|${f.C.limits.nox == null}|${f.C.limits.co == null}|${f.C.limits.source.nox}|${f.C.limits.source.co}`;
    if (key !== hudKey) { hud?.dispose(); hudKey = key; hud = createHud(q('.scene__hud'), hudItems(f), { level: C.level.semiEmpirical, basis: 'policy', note: STR.common.indicative }); }
    hud.update(f);
  }

  /** Header + tab Limits: dihitung ulang hanya bila state, file regulasi, atau titik operasi tab Levers berganti. */
  function updateCompliance(s, data, lev) {
    const levSig = lev.ready ? `${lev.kind}|${lev.point.NOx_ppm}` : `${lev.kind}|${lev.modified}`;
    if (compMemo.s !== s || compMemo.data !== data || compMemo.lev !== levSig) compMemo = { s, data, lev: levSig, f: deriveCompliance(s, data, lev) };
    regHead?.update(compMemo.f);
    if (s.pTab === 'limits') limitsTab?.update(compMemo.f, s.siteData?.[compMemo.f.sel.equip] ?? {});
    if (s.pTab === 'formation') {
      const sel = compMemo.f.sel;
      formTab?.update(formationCards(contentOf('formation').data, sel.equip, contentOf('references').data), { gasFuel: sel.fuel === 'gas' });
    }
  }

  /** Tampilkan / sembunyikan area tab (layout lebar untuk Limits & Formation), lencana Preset/Modified, tombol kembali. */
  function updateLayout(s, f) {
    if (tabShown !== s.pTab) {
      tabShown = s.pTab;
      el.dataset.tab = s.pTab;
      q('.pol-limits').hidden = s.pTab !== 'limits';
      q('.pol-formation').hidden = s.pTab !== 'formation';
    }
    const mod = f.levers.modified;
    const badge = q('[data-k="badge"]');
    setText(badge, mod ? S.badge.modified : S.badge.preset);
    badge.classList.toggle('is-modified', mod);
    presetBtn.el.disabled = !mod;
    const back = s.p9Return != null;
    backBtn.el.hidden = !back;
    if (back) backBtn.setLabel(S.back(s.p9Return));
  }

  /** Kembali ke scene asal (dibuka dari tautan Scene 6): Esc atau ←. */
  function goBack() {
    const n = store.get().p9Return;
    if (n == null) return false;
    store.set({ p9Return: null });
    ctx.goToScene?.(n);
    return true;
  }

  function updateCard(f) {
    setText(q('[data-k="title"]'), S.titles[f.tab]);
    setText(q('[data-k="result"]'), resultLine(f));
    setText(q('[data-k="note"]'), f.tab === 'B' ? S.B.slipNote(f.B.gwp) : f.tab === 'C' ? S.C.model : '');
    const ref = q('[data-k="ref"]');
    ref.hidden = f.tab !== 'B' || !f.B.gwpRef;
    if (!ref.hidden) { setText(ref.querySelector('span'), `${S.B.source}: `); const a = ref.querySelector('a'); setText(a, f.B.gwpRef); a.href = `#/references/${f.B.gwpRef}`; }
    setText(q('[data-k="strategy"]'), f.tab === 'C' ? S.C.strategy(f.C.strategy) : '');
    setText(q('[data-k="disclaimer"]'), S.disclaimer(basisText('nox', f.C.unit, f.C.basis), basisText('co', f.C.unit, f.C.basis)));
  }

  /** Tab Levers: NOx (mg/Nm³, basis regulasi) vs tuas + garis limit; η rem vs tuas yang sama; titik dari satu frame. */
  function chartsLevers(f) {
    const L = f.levers;
    const xFmt = (v) => fmt(v, LEVER_AXIS_DISPLAY[L.axis].digits);
    const k = `l|${L.kind}|${L.axis}|${L.ready}|${L.ready ? L.noxMg.join(',') : ''}|${L.limit.mg}|${L.limit.cls}`;
    if (k !== mainKey) {
      mainKey = k;
      const xDomain = [L.x[0], L.x.at(-1)];
      main.setTitle(LV.main.title); main.setXLabel(LV.xLabels[L.axis]); main.setYLabel(LV.main.yLabel); main.setLog(false);
      sub.setTitle(LV.aux.title); sub.setXLabel(LV.xLabels[L.axis]); sub.setYLabel(LV.aux.yLabel); sub.setLog(false);
      const b = L.limit.basis;
      const basis = b ? C.basis.fullMg(b.refO2Pct, b.TrefC) : '';
      const limTxt = L.limit.mg == null ? null : LV.limitLine(L.limit.cls ?? '', L.limit.source ?? '');
      if (!L.ready) {
        main.setData({ series: [], xDomain, yDomain: [0, 1], xFmt });
        sub.setData({ series: [], xDomain, yDomain: [0, 1], xFmt });
        main.setCaption(LV.computing); sub.setCaption(LV.computing);
      } else {
        const hlines = L.limit.mg == null ? [] : [{ y: L.limit.mg, color: SPECIES_VAR.NOx, dash: [6, 4], label: LV.limitLabel, align: 'left' }];
        const yMax = niceCeil(Math.max(...L.noxMg, L.limit.mg ?? 0) * 1.25);
        main.setData({ series: [{ x: L.x, y: L.noxMg, color: SPECIES_VAR.NOx }], xDomain, yDomain: [0, yMax], xFmt, hlines });
        main.setCaption(LV.caption(basis, limTxt));
        const lo = Math.floor(Math.min(...L.etaPct) - 0.5), hi = Math.ceil(Math.max(...L.etaPct) + 0.5);
        sub.setData({ series: [{ x: L.x, y: L.etaPct, color: ETA_COLOR }], xDomain, yDomain: [lo, hi], yTicks: [lo, (lo + hi) / 2, hi], yFmt: (v) => fmt(v, Number.isInteger(v) ? 0 : 1), xFmt });
        sub.setCaption(LV.aux.caption);
      }
    }
    if (!L.ready) { main.setPoints([]); sub.setPoints([]); return; }
    const px = L.presetX;
    main.setPoints([{ x: px, y: L.presetPoint.noxMg, fill: 'transparent', ring: CV.fg, guide: false }, { x: L.currentX, y: L.point.noxMg, fill: SPECIES_VAR.NOx }]);
    sub.setPoints([{ x: px, y: L.presetPoint.etaBrake * 100, fill: 'transparent', ring: CV.fg, guide: false }, { x: L.currentX, y: L.etaPct[L.i], fill: ETA_COLOR }]);
  }

  /** Tab GHG: CO₂ (garis penuh) dan CO₂e dengan slip (putus-putus, mesin gas) vs penalti; CO₂e vs slip di grafik pendamping. */
  function chartsB(f) {
    const B = f.B, gasM = B.machines.filter((m) => m.gasFired);
    const k = `b|${B.machines.map((m) => m.eta).join(',')}|${B.slip}|${B.value}`;
    if (k !== mainKey) {
      mainKey = k;
      main.setTitle(S.B.main.title); main.setXLabel(S.B.main.xLabel); main.setYLabel(S.B.main.yLabel); main.setLog(false);
      const series = [
        ...B.machines.map((m) => ({ x: B.penalty, y: m.co2, color: MCOLOR[m.id] })),
        ...gasM.map((m) => ({ x: B.penalty, y: m.co2e, color: MCOLOR[m.id], dash: [7, 5] })),
      ];
      const all = series.flatMap((x) => x.y);
      main.setData({ series, xDomain: [B.penalty[0], B.penalty.at(-1)], yDomain: [Math.floor(Math.min(...all) / 50) * 50, niceCeil(Math.max(...all) * 1.02)], xFmt: (v) => fmt(v, 0) });
      main.setCaption(S.B.caption(B.slip));
      sub.setTitle(S.B.sub.title); sub.setXLabel(S.B.sub.xLabel); sub.setYLabel(S.B.sub.yLabel); sub.setLog(false);
      const allS = gasM.flatMap((m) => [...m.co2eVsSlip, m.current.co2_1]);
      sub.setData({
        series: gasM.map((m) => ({ x: B.slips, y: m.co2eVsSlip, color: MCOLOR[m.id] })),
        hlines: gasM.map((m) => ({ y: m.current.co2_1, color: MCOLOR[m.id], dash: [2, 3] })),
        xDomain: [B.slips[0], B.slips.at(-1)], yDomain: [Math.floor(Math.min(...allS) / 50) * 50, niceCeil(Math.max(...allS) * 1.02)], xFmt: (v) => fmt(v, 1),
      });
      sub.setCaption(S.B.sub.caption);
    }
    main.setPoints([
      ...B.machines.map((m) => ({ x: B.value, y: m.current.co2_1, fill: MCOLOR[m.id] })),
      ...gasM.map((m) => ({ x: B.value, y: m.currentE.co2e, fill: 'transparent', ring: MCOLOR[m.id] })),
    ]);
    sub.setPoints(gasM.map((m) => ({ x: B.slip, y: m.currentE.co2e, fill: MCOLOR[m.id] })));
  }

  function chartsC(f) {
    const c = f.C;
    const k = `c|${c.unit}|${c.basis.refO2}|${c.basis.TrefC}|${c.limits.noxPpm}|${c.limits.coPpm}|${c.limits.source.nox}|${c.strategy}|${c.single.nox[0]}|${c.twin.nox[0]}`;
    const xDomain = [LOAD_RANGE.max, LOAD_RANGE.min];
    if (k !== mainKey) {
      mainKey = k;
      main.setTitle(S.C.main.title); main.setXLabel(S.C.main.xLabel); main.setYLabel(S.unitLabel[c.unit]); main.setLog(true);
      const series = ['single', 'twin'].flatMap((cfg) => [
        { x: c[cfg].load, y: c[cfg].nox, color: SPECIES_VAR.NOx, dash: DASH[cfg] },
        { x: c[cfg].load, y: c[cfg].co, color: SPECIES_VAR.CO, dash: DASH[cfg] },
      ]);
      const yMax = 10 ** Math.ceil(Math.log10(Math.max(...series.flatMap((x) => [...x.y]), c.limits.nox ?? 0, c.limits.co ?? 0)));
      const yDomain = [yMax / 1e4, yMax];
      const hlines = [];
      if (c.limits.nox != null) hlines.push({ y: c.limits.nox, color: SPECIES_VAR.NOx, label: c.limits.source.nox === 'override' ? STR.scene6.charts.limit.noxOverride : STR.scene6.charts.limit.nox, align: 'left' });
      if (c.limits.co != null) hlines.push({ y: c.limits.co, color: SPECIES_VAR.CO, label: STR.scene6.charts.limit.co });
      const bands = ['single', 'twin'].flatMap((cfg) => c[cfg].coViolation.map(([hi, lo]) => ({ x0: hi + 0.5, x1: lo - 0.5, color: cfg === 'single' ? CV.coBandSingle : CV.coBandTwin })));
      main.setData({ series, xDomain, yDomain, yTicks: decadeTicks(...yDomain), yFmt: decadeFmt, xFmt: (v) => fmt(v, 0), hlines, bands });
      main.setCaption(S.C.caption(SPECIES_VAR.NOx, SPECIES_VAR.CO, basisText('nox', c.unit, c.basis), basisText('co', c.unit, c.basis), bands.length > 0));
      sub.setTitle(S.C.sub.title); sub.setXLabel(S.C.sub.xLabel); sub.setYLabel(''); sub.setLog(false);
      const segs = [];
      ['single', 'twin'].forEach((cfg, i) => (c[cfg].window?.ranges ?? []).forEach(([hi, lo]) => segs.push({ x: [hi + 0.4, lo - 0.4], y: [2 - i, 2 - i], color: cfg === 'single' ? CV.fg : CV.cold, width: 14 })));
      sub.setData({ series: segs, xDomain, yDomain: [0.4, 2.6], yTicks: [1, 2], yFmt: (v) => (v === 2 ? S.C.sub.yLabels.single : S.C.sub.yLabels.twin), xFmt: (v) => fmt(v, 0) });
      sub.setCaption(c.limits.set ? '' : S.C.prompt);
    }
    main.setPoints(['single', 'twin'].flatMap((cfg) => [
      { x: c[cfg].point.load, y: c[cfg].point.nox, fill: SPECIES_VAR.NOx, ring: cfg === 'twin' ? CV.cold : CV.ring },
      { x: c[cfg].point.load, y: c[cfg].point.co, fill: SPECIES_VAR.CO, ring: cfg === 'twin' ? CV.cold : CV.ring },
    ]));
    sub.setPoints([]);
  }

  return {
    meta,
    mount() {
      buildDom();
      buildControls();
      main = createMultiLineChart(q('.pl-emis'), { title: LV.main.title, modelLevel: 'semiEmpirical', basis: 'policy', xLabel: LV.xLabels.theta0, yLabel: LV.main.yLabel, pad: { l: 64, r: 18, t: 86, b: 40 } });
      sub = createMultiLineChart(q('.pl-aux'), { title: LV.aux.title, modelLevel: 'semiEmpirical', basis: 'policy', xLabel: LV.xLabels.theta0, yLabel: LV.aux.yLabel, pad: { l: 120, r: 18, t: 74, b: 40 } });
      const s0 = store.get();
      sweepClient.runNow(s0); // frame pertama: sinkron; selanjutnya Worker + debounce
      disposers.push(store.subscribe((s, prev, changed) => {
        if (changed.some((k) => SWEEP_FIELDS.includes(k))) sweepClient.request(s);
        if (changed.includes('pTab')) { mainKey = ''; requestAnimationFrame(() => { main?.sync(); sub?.sync(); }); } // tab dibuka: ukur ulang + gambar ulang
        syncControls(s);
      }));
      syncControls(s0);
      regHead = createRegHeader(q('.pol-head__reg'), {
        onSelect: (p) => {
          const patch = regSelectionPatch(store.get(), regulationsContent().data, p);
          const m = EQUIPMENT[patch.regEquip]?.model;
          store.set(m === 'diesel' || m === 'gas' ? { ...patch, pEngine: m } : patch); // mesin terakhir untuk tab Levers
        },
      });
      presetBtn = button({ label: S.resetPreset, tip: S.resetPresetTip, onClick: () => store.set(leversResetPatch()) });
      q('[data-k="preset"]').append(presetBtn.el);
      q('[data-k="badge"]').after(createHelpButton('ui.presetBadge', { describes: q('[data-k="badge"]') }).el);
      backBtn = button({ label: S.back(6), key: S.backKey, tip: S.backTip, onClick: () => goBack() });
      backBtn.el.hidden = true;
      q('.pol-head__back').append(backBtn.el);
      regBanner = createContentBanner(q('.pol-limits'));
      regBanner.show(regulationsContent());
      disposers.push(onRegulations((r) => regBanner?.show(r)));
      formBanner = createContentBanner(q('.pol-formation'));
      formBanner.show(contentOf('formation'));
      disposers.push(onContent('formation', (r) => formBanner?.show(r)));
      formTab = createFormationTab(q('.pol-formation'));
      limitsTab = createLimitsTab(q('.pol-limits'), {
        onSite: (param, field, v) => { const st = store.get(); store.set(siteDataPatch(st, regSelection(st, regulationsContent().data).equip, param, field, v)); },
        onSulfur: (kind, v) => store.set(fuelSulfurPatch(kind === 'oil' ? 'fuelS' : 'fuelH2S', v)),
      });
      levTab = createLeversTab(q('.pol-levers'), {
        onSub: (v) => store.set({ p9Sub: v }),
        onAxis: (a) => store.set({ p9Axis: a }),
        onLever: (a, v) => { const st = store.get(); store.set(leverPatch(st, leverEngine(st), a, v)); },
        onGas: (k, v) => store.set(fuelGasPatch(store.get(), k, v)),
        onH2S: (v) => store.set(fuelSulfurPatch('fuelH2S', String(v))),
        onSulfur: (v) => store.set(fuelSulfurPatch('fuelS', String(v))),
      });
    },
    update() {
      const s = store.get();
      const reg = regulationsContent();
      const f = derivePolicy(s, sweepKey === leverSweepKey(s) ? sweep : null, reg.data);
      updateLayout(s, f);
      updateCompliance(s, reg.data, f.levers);
      updateHud(f);
      if (f.tab === 'levers') {
        levTab.update(f.levers, f.fuel, s);
        chartsLevers(f);
      } else if (!WIDE_TABS.includes(f.tab)) {
        updateCard(f);
        updateLimits(f, s);
        if (f.tab === 'B') chartsB(f); else chartsC(f);
      }
      const msg = keyMessage(f);
      if (msg !== lastMsg) { lastMsg = msg; ctx.setMessage?.(msg); }
    },
    onKey(e) {
      const k = e.key.toLowerCase();
      if ((e.key === 'Escape' || e.key === 'ArrowLeft') && store.get().p9Return != null) return goBack();
      if (KEYS_TAB[k]) { store.set({ pTab: KEYS_TAB[k] }); return true; }
      if (k === 'r') { resetParams(); return true; }
      return false;
    },
    dispose() {
      for (const d of disposers.splice(0)) d();
      if (store.get().p9Return != null) store.set({ p9Return: null }); // jalan kembali hanya berlaku sekali kunjungan
      sweepClient.dispose();
      main?.dispose(); sub?.dispose(); hud?.dispose(); lim?.dispose(); regHead?.dispose(); limitsTab?.dispose(); formTab?.dispose(); levTab?.dispose(); formBanner?.dispose(); regBanner?.dispose();
      el?.remove();
    },
  };
}
