/**
 * limitsTab.js — tab Limits Scene 9: tabel limit dari regulations.json untuk pilihan aktif (parameter, limit, unit,
 * metode uji) berdampingan dengan nilai model dan site data pada basis regulasi + chip Within / Above / Not modeled
 * (alasan selalu tertulis untuk Not modeled), catatan jujur, input sulfur bahan bakar, O₂ buang, dan matriks cakupan.
 * DOM murni: input hanya memanggil callback (store.set); semua angka dari frame deriveCompliance.
 */
import { STR } from './strings.js';
import { fmt } from './format.js';
import { SITE_PARAMS } from '../state/regulations.js';
import { COVERAGE_PARAMS, COVERAGE_EQUIP, MODEL_COVERAGE } from '../state/coverage.js';
import { REG_UNITS } from '../state/content.js';

const R = STR.regulation, L = STR.scene9.limitsTab;

/**
 * @param {HTMLElement} container
 * @param {{onSite:(param:string, field:string, value:string)=>void, onSulfur:(kind:'oil'|'gas', value:string)=>void}} cb
 */
export function createLimitsTab(container, cb) {
  const el = document.createElement('div');
  el.className = 'lim-tab';
  el.innerHTML = `
    <section class="lim-tab__main">
      <h3 class="reg__title"></h3>
      <div class="reg__note num" data-v="basis"></div>
      <table class="reg__table num"><thead></thead><tbody></tbody></table>
      <div class="lim-tab__notes">
        <div class="reg__note" data-v="noCo" hidden></div>
        <div class="reg__note" data-v="oil" hidden></div>
        <div class="reg__note" data-v="single" hidden></div>
        <div class="reg__note" data-v="override" hidden></div>
        <div class="reg__note" data-v="display" hidden></div>
        <div class="reg__note" data-v="calib" hidden></div>
        <div class="reg__note" data-v="comp" hidden></div>
      </div>
      <div class="lim-tab__fuel">
        <label class="ctl reg__sulfur"><span class="ctl__label" data-v="sulfurLabel"></span><input type="number" min="0" step="any" inputmode="decimal" data-v="sulfur" /></label>
        <span class="reg__note num" data-v="o2" hidden></span>
      </div>
    </section>
    <section class="lim-tab__cov">
      <h3 class="reg__title" data-v="covTitle"></h3>
      <table class="reg__table cov-table"><thead></thead><tbody></tbody></table>
    </section>`;
  container.appendChild(el);
  const V = (k) => el.querySelector(`[data-v="${k}"]`);
  el.querySelector('.lim-tab__main .reg__title').textContent = R.title;
  el.querySelector('.lim-tab__main thead').innerHTML = `<tr>${L.head.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  V('covTitle').textContent = L.coverageTitle;
  const covHead = el.querySelector('.cov-table thead'), covBody = el.querySelector('.cov-table tbody');
  covHead.innerHTML = `<tr><th>${L.coverageHead}</th>${COVERAGE_EQUIP.map((k) => `<th data-eq="${k}">${L.coverageEquip[k]}</th>`).join('')}</tr>`;
  covBody.innerHTML = COVERAGE_PARAMS.map((p) => `<tr><th>${L.coverageParam[p]}</th>${COVERAGE_EQUIP.map((k) => `<td data-eq="${k}" class="cov cov--${MODEL_COVERAGE[p][k]}">${L.coverage[MODEL_COVERAGE[p][k]]}</td>`).join('')}</tr>`).join('');

  const sulfur = /** @type {HTMLInputElement} */ (V('sulfur'));
  sulfur.placeholder = R.fuelSulfur.placeholder;
  el.querySelector('.reg__sulfur').dataset.tip = R.fuelSulfurTip;
  let sulfurKind = 'oil';
  sulfur.addEventListener('change', () => cb.onSulfur(sulfurKind, sulfur.value));
  sulfur.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });

  const tbody = el.querySelector('.lim-tab__main tbody');
  let tableKey = '', eqShown = '';
  /** @type {Map<string, any>} */
  let cells = new Map();
  const set = (n, t) => { if (n.textContent !== t) n.textContent = t; };
  const show = (n, on, t = '') => { n.hidden = !on; if (on) set(n, t); };

  function buildTable(f) {
    cells = new Map();
    tbody.replaceChildren();
    for (const r of f.rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="reg__param"></td><td data-c="limit"><div data-c="lv"></div><div class="reg__why" data-c="lsrc"></div></td><td data-c="unit"></td><td data-c="method"></td><td data-c="model"></td><td data-c="site"></td><td><span class="reg-chip"></span><span class="reg__margin num" data-c="margin"></span><div class="reg__why" data-c="why"></div></td>`;
      tr.querySelector('.reg__param').textContent = r.param;
      const c = { lv: tr.querySelector('[data-c="lv"]'), lsrc: tr.querySelector('[data-c="lsrc"]'), unit: tr.querySelector('[data-c="unit"]'), method: tr.querySelector('[data-c="method"]'), model: tr.querySelector('[data-c="model"]'), chip: tr.querySelector('.reg-chip'), why: tr.querySelector('[data-c="why"]'), margin: tr.querySelector('[data-c="margin"]') };
      c.chip.dataset.tip = R.statusTip;
      const site = tr.querySelector('[data-c="site"]');
      if (SITE_PARAMS.includes(r.param)) {
        site.innerHTML = `<div class="reg__site"><input type="number" min="0" step="any" inputmode="decimal" data-f="value" /><select data-f="unit"></select><input type="number" min="0" max="20.9" step="0.1" inputmode="decimal" data-f="o2" /></div>`;
        site.dataset.tip = R.siteTip;
        const inputs = {};
        for (const n of site.querySelectorAll('[data-f]')) {
          const key = /** @type {HTMLInputElement} */ (n).dataset.f;
          inputs[key] = n;
          n.addEventListener('change', () => cb.onSite(r.param, key, /** @type {HTMLInputElement} */ (n).value));
          n.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
        }
        inputs.value.placeholder = R.siteValue;
        inputs.o2.placeholder = R.siteO2;
        inputs.o2.setAttribute('aria-label', R.siteO2);
        inputs.value.setAttribute('aria-label', `${r.param} ${R.siteTag}`);
        inputs.unit.innerHTML = Object.entries(R.siteUnits).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
        c.inputs = inputs;
      } else site.textContent = R.siteNA;
      tbody.appendChild(tr);
      cells.set(r.param, c);
    }
  }

  return {
    el,
    /** @param {ReturnType<import('../state/deriveCompliance.js').deriveCompliance>} f @param {any} siteData */
    update(f, siteData = {}) {
      set(V('basis'), f.basis ? R.basis(f.basis.refO2Pct, f.basis.TrefC, f.basis.NOxAs) : '');
      show(V('noCo'), f.turbine, L.noCoLimit);
      show(V('oil'), f.turbineOil, R.turbineOil);
      show(V('single'), f.isEngine, R.singleCylinder);
      show(V('override'), f.turbine, R.overrideNote);
      show(V('display'), f.displayDiffers, R.displayDiffers(STR.common.basis.short(f.display.refO2, f.display.TrefC)));
      show(V('calib'), f.calibrated, R.calibrated);
      show(V('comp'), f.sel.fuel === 'gas', L.composition);
      if (f.fuel) {
        sulfurKind = f.fuel.kind;
        set(V('sulfurLabel'), R.fuelSulfur[f.fuel.kind]);
        const sv = f.fuel.sulfur == null ? '' : String(f.fuel.sulfur);
        if (document.activeElement !== sulfur && sulfur.value !== sv) sulfur.value = sv;
        show(V('o2'), f.fuel.exhaustO2 != null, f.fuel.exhaustO2 != null ? R.exhaustO2(f.fuel.exhaustO2, f.fuel.lambda) : '');
      }
      if (eqShown !== f.sel.equip) {
        eqShown = f.sel.equip;
        for (const n of el.querySelectorAll('.cov-table [data-eq]')) n.classList.toggle('is-active', n.dataset.eq === f.sel.equip);
      }
      const tk = `${f.sel.equip}|${f.rows.map((r) => r.param).join(',')}`;
      if (tk !== tableKey) { tableKey = tk; buildTable(f); }
      for (const r of f.rows) {
        const c = cells.get(r.param);
        if (!c) continue;
        const num = (v) => (v == null ? R.none : fmt(v, v < 100 ? 1 : 0));
        set(c.lv, num(r.limit));
        set(c.lsrc, r.limitSource === 'regulation' ? R.limitSource.regulation(f.source?.short ?? '') : r.limitSource ? R.limitSource[r.limitSource] : '');
        set(c.unit, r.unit === REG_UNITS[0] ? R.siteUnits.mg : r.unit);
        set(c.method, r.row?.method ?? R.none);
        set(c.model, num(r.model));
        set(c.chip, `${R.status[r.status]}${r.valueSource === 'site' ? ` · ${R.siteTag}` : ''}`);
        c.chip.className = `reg-chip reg-chip--${r.status}${r.valueSource === 'site' ? ' reg-chip--site' : ''}`;
        // margin (%) di samping chip; alasan selalu tertulis untuk Not modeled; margin kecil → keterangan ketidakpastian
        set(c.margin, r.marginPct == null ? '' : R.margin(r.marginPct));
        c.margin.dataset.tip = R.marginTip(f.marginNotePct);
        c.margin.classList.toggle('is-small', !!r.marginSmall);
        set(c.why, r.status === 'notModeled' ? R.reason[r.reason ?? 'noValue'] : r.marginSmall ? R.marginSmall : '');
        if (c.inputs) {
          const v = siteData[r.param] ?? { value: '', unit: 'mg', o2: '' };
          for (const k of ['value', 'unit', 'o2']) if (document.activeElement !== c.inputs[k] && c.inputs[k].value !== String(v[k] ?? '')) c.inputs[k].value = String(v[k] ?? '');
        }
      }
    },
    dispose() { el.remove(); },
  };
}
