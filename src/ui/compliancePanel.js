/**
 * compliancePanel.js — strip "Model value vs limit (indicative)" (Scene 9; Step 05 boleh memindahkannya).
 * DOM murni: pemilih (equipment, kelas kapasitas, bahan bakar) dan input site data hanya memanggil callback
 * (store.set); isi tabel dari frame deriveCompliance. Tidak menghitung apa pun dan tidak memuat angka limit.
 */
import { STR } from './strings.js';
import { segmented } from './controls.js';
import { EQUIPMENT_ORDER, SITE_PARAMS } from '../state/regulations.js';

const R = STR.regulation;

/**
 * @param {HTMLElement} container
 * @param {{onSelect:(p:{equip?:string, cls?:string, fuel?:string})=>void, onSite:(param:string, field:string, value:string)=>void, onSulfur?:(kind:'oil'|'gas', value:string)=>void}} cb
 */
export function createCompliancePanel(container, cb) {
  const el = document.createElement('section');
  el.className = 'reg';
  el.innerHTML = `
    <h3 class="reg__title"></h3>
    <div class="reg__banner" data-v="banner" hidden></div>
    <div class="reg__pick"></div>
    <div class="reg__basis num" data-v="basis"></div>
    <div class="reg__note" data-v="display" hidden></div>
    <div class="reg__note" data-v="single" hidden></div>
    <div class="reg__note" data-v="oil" hidden></div>
    <label class="ctl reg__sulfur"><span class="ctl__label" data-v="sulfurLabel"></span><input type="number" min="0" step="any" inputmode="decimal" data-v="sulfur" /></label>
    <div class="reg__note num" data-v="o2" hidden></div>
    <table class="reg__table num"><thead></thead><tbody></tbody></table>
    <div class="reg__note" data-v="override" hidden></div>
    <div class="reg__note" data-v="calib" hidden></div>`;
  el.querySelector('.reg__title').textContent = R.title;
  el.querySelector('thead').innerHTML = `<tr>${R.head.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  container.appendChild(el);
  const V = (k) => el.querySelector(`[data-v="${k}"]`);
  const pick = el.querySelector('.reg__pick');

  const equip = segmented({ label: R.equipment, options: EQUIPMENT_ORDER.map((k) => ({ value: k, label: R.equipments[k] })), value: EQUIPMENT_ORDER[0], onChange: (v) => cb.onSelect({ equip: v }) });
  const fuel = segmented({ label: R.fuel, options: ['oil', 'gas'].map((k) => ({ value: k, label: R.fuels[k] })), value: 'oil', onChange: (v) => cb.onSelect({ fuel: v }) });
  const clsWrap = document.createElement('label');
  clsWrap.className = 'ctl reg__cls';
  clsWrap.innerHTML = `<span class="ctl__label">${R.capacity}</span><select></select>`;
  const clsSel = /** @type {HTMLSelectElement} */ (clsWrap.querySelector('select'));
  clsSel.addEventListener('change', () => cb.onSelect({ cls: clsSel.value }));
  pick.append(equip.el, clsWrap, fuel.el);

  const sulfur = /** @type {HTMLInputElement} */ (V('sulfur'));
  sulfur.placeholder = R.fuelSulfur.placeholder;
  el.querySelector('.reg__sulfur').dataset.tip = R.fuelSulfurTip;
  let sulfurKind = 'oil';
  sulfur.addEventListener('change', () => cb.onSulfur?.(sulfurKind, sulfur.value));
  sulfur.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });

  const tbody = el.querySelector('tbody');
  let tableKey = '', clsKey = '';
  /** @type {Map<string, {model:HTMLElement, limit:HTMLElement, chip:HTMLElement, why:HTMLElement, inputs?:Record<string, HTMLInputElement|HTMLSelectElement>}>} */
  let cells = new Map();
  const set = (n, t) => { if (n.textContent !== t) n.textContent = t; };
  const show = (n, on, t = '') => { n.hidden = !on; if (on) set(n, t); };

  function buildTable(f) {
    cells = new Map();
    tbody.replaceChildren();
    for (const r of f.rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="reg__param"></td><td data-c="model"></td><td data-c="site"></td><td data-c="limit"></td><td><span class="reg-chip"></span><div class="reg__why"></div></td>`;
      tr.querySelector('.reg__param').textContent = r.param;
      const c = { model: tr.querySelector('[data-c="model"]'), limit: tr.querySelector('[data-c="limit"]'), chip: tr.querySelector('.reg-chip'), why: tr.querySelector('.reg__why') };
      c.chip.dataset.tip = R.statusTip;
      const site = tr.querySelector('[data-c="site"]');
      if (SITE_PARAMS.includes(r.param)) {
        site.innerHTML = `<div class="reg__site"><input type="number" min="0" step="any" inputmode="decimal" data-f="value" /><select data-f="unit"></select><input type="number" min="0" max="20.9" step="0.1" inputmode="decimal" data-f="o2" /></div>`;
        site.dataset.tip = R.siteTip;
        const inputs = {};
        for (const n of site.querySelectorAll('[data-f]')) {
          const f2 = /** @type {HTMLInputElement} */ (n).dataset.f;
          inputs[f2] = n;
          n.addEventListener('change', () => cb.onSite(r.param, f2, /** @type {HTMLInputElement} */ (n).value));
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
    /** @param {ReturnType<import('../state/deriveCompliance.js').deriveCompliance>} f @param {any} siteData input mentah untuk equipment aktif */
    update(f, siteData = {}) {
      equip.set(f.sel.equip);
      fuel.set(f.sel.fuel);
      for (const b of fuel.el.querySelectorAll('.seg__btn')) b.disabled = f.sel.fuels.length < 2;
      const ck = f.sel.classes.map((c) => c.id).join('|');
      if (ck !== clsKey) { clsKey = ck; clsSel.innerHTML = f.sel.classes.map((c) => `<option value="${c.id}">${c.label}</option>`).join(''); }
      if (clsSel.value !== f.sel.cls) clsSel.value = f.sel.cls ?? '';
      clsSel.disabled = f.sel.classes.length < 2;

      show(V('banner'), !f.verified, `⚠ ${R.banner}`);
      set(V('basis'), f.basis ? `${R.basis(f.basis.refO2Pct, f.basis.TrefC, f.basis.NOxAs)} · ${R.basisChips}` : '');
      show(V('display'), f.displayDiffers, R.displayDiffers(STR.common.basis.short(f.display.refO2, f.display.TrefC)));
      show(V('single'), f.isEngine, R.singleCylinder);
      show(V('oil'), f.turbineOil, R.turbineOil);
      show(V('override'), f.turbine, R.overrideNote);
      show(V('calib'), f.calibrated, R.calibrated);
      if (f.fuel) {
        sulfurKind = f.fuel.kind;
        set(V('sulfurLabel'), R.fuelSulfur[f.fuel.kind]);
        const sv = f.fuel.sulfur == null ? '' : String(f.fuel.sulfur);
        if (document.activeElement !== sulfur && sulfur.value !== sv) sulfur.value = sv;
        show(V('o2'), f.fuel.exhaustO2 != null, f.fuel.exhaustO2 != null ? R.exhaustO2(f.fuel.exhaustO2, f.fuel.lambda) : '');
      }

      const tk = `${f.sel.equip}|${f.rows.map((r) => r.param).join(',')}`;
      if (tk !== tableKey) { tableKey = tk; buildTable(f); }
      for (const r of f.rows) {
        const c = cells.get(r.param);
        if (!c) continue;
        const fmtV = (v) => (v == null ? R.none : r.unit === '%' ? R.pct(v) : R.mg(v));
        set(c.model, fmtV(r.model));
        const src = r.limitSource === 'regulation' ? R.limitSource.regulation(f.source?.short ?? '') : r.limitSource ? R.limitSource[r.limitSource] : '';
        set(c.limit, r.limit == null ? R.none : `${fmtV(r.limit)} · ${src}`);
        set(c.chip, `${R.status[r.status]}${r.valueSource === 'site' ? ` · ${R.siteTag}` : ''}`);
        c.chip.className = `reg-chip reg-chip--${r.status}${r.valueSource === 'site' ? ' reg-chip--site' : ''}`;
        set(c.why, r.status === 'notModeled' && r.reason ? R.reason[r.reason] : '');
        if (c.inputs) {
          const v = siteData[r.param] ?? { value: '', unit: 'mg', o2: '' };
          for (const k of ['value', 'unit', 'o2']) if (document.activeElement !== c.inputs[k] && c.inputs[k].value !== String(v[k] ?? '')) c.inputs[k].value = String(v[k] ?? '');
        }
      }
    },
    dispose() { el.remove(); },
  };
}
