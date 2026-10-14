/**
 * assumptions.js — panel asumsi model (tombol H, semua scene; Esc menutup).
 * Data dari state/deriveAssumptions.js (nilai langsung dari store), teks dari strings.js.
 * Input basis O₂ / volume hanya di sini; perubahan lewat store.set(basisPatch(...)).
 */
import { STR } from './strings.js';
import { fmt, sci } from './format.js';
import { deriveAssumptions } from '../state/deriveAssumptions.js';
import { basisPatch, basisResetPatch } from '../state/store.js';

const A = STR.assumptions, C = STR.common;
const WATCH = ['emRefO2', 'emTrefC', 'calEngine', 'calDln'];

/** Judul grafik per kunci CHART_LEVELS (dari strings.js, tidak ada teks baru). */
export const CHART_TITLES = {
  s1pv: () => STR.charts.pv.title,
  s1pth: () => STR.scene1.ptheta.title,
  s2cycle: () => `${STR.charts.cycle.pv.title}${A.levels.sep}${STR.charts.cycle.ts.title}`,
  s2schem: () => STR.charts.brayton.title,
  s2wf: () => STR.charts.waterfall.title,
  s3flame: () => STR.charts.flame.title,
  s3bars: () => STR.scene3.bars.title,
  s4trade: () => STR.scene4.tradeoff.title,
  s4arr: () => STR.scene4.arrhenius.title,
  s5cycle: () => `${STR.charts.cycle.ts.title}${A.levels.sep}${STR.charts.cycle.pv.title}`,
};

const list = (items) => `<ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul>`;
const row = (cells, tag = 'td') => `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join('')}</tr>`;

/**
 * @param {{get:()=>any, set:(p:any)=>void, subscribe:(fn:any)=>()=>void}} store
 * @param {HTMLElement} [parent]
 */
export function createAssumptionsPanel(store, parent = document.body) {
  const el = document.createElement('div');
  el.className = 'asm';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', A.title);
  el.innerHTML = `
    <div class="asm__box">
      <div class="asm__head"><h2>${A.title}</h2><button type="button" class="btn btn--sm" data-close>${A.close} <kbd>${A.keys}</kbd></button></div>
      <p class="asm__intro">${A.intro}</p>
      <div class="asm__grid">
        <section>
          <h3>${A.basis.title}</h3>
          <div class="asm-basis">
            <label class="asm-input"><span>${A.basis.o2}</span><input type="number" data-o2 /></label>
            <div class="ctl ctl--seg"><span class="ctl__label">${A.basis.vol}</span><div class="seg" data-vol></div></div>
            <button type="button" class="btn btn--sm" data-reset>${A.basis.reset}</button>
          </div>
          <div class="asm-active" data-v="active"></div>
          <div class="asm__intro" data-v="example"></div>
          <div class="asm__intro">${A.basis.note}</div>
        </section>
        <section>
          <h3>${A.zeldovich.title}</h3>
          <div class="f-line" data-v="zeld"></div>
          ${list(A.zeldovich.notes)}
        </section>
        <section><h3>${A.engine.title}</h3>${list(A.engine.items)}</section>
        <section><h3>${A.turbine.title}</h3>${list(A.turbine.items)}</section>
        <section><h3>${A.calib.title}</h3><table data-v="calib"></table><div class="asm__intro">${A.calib.notUnit}</div></section>
        <section><h3>${A.flame.title}</h3><table data-v="flame"></table><div class="asm__intro" data-v="flameNote"></div></section>
        <section style="grid-column: 1 / -1"><h3>${A.levels.title}</h3><table data-v="levels"></table></section>
      </div>
    </div>`;
  parent.appendChild(el);

  const q = (sel) => el.querySelector(sel);
  const V = (k) => q(`[data-v="${k}"]`);
  const o2 = /** @type {HTMLInputElement} */ (q('[data-o2]'));
  const d0 = deriveAssumptions(store.get());
  o2.min = String(d0.basis.range.min); o2.max = String(d0.basis.range.max); o2.step = String(d0.basis.range.step);
  o2.title = A.basis.o2Tip(d0.basis.range.min, d0.basis.range.max);
  const volBtns = d0.basis.options.map((T) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seg__btn';
    b.textContent = A.basis.vols[T];
    b.addEventListener('click', () => store.set(basisPatch({ TrefC: T })));
    q('[data-vol]').appendChild(b);
    return [T, b];
  });
  o2.addEventListener('change', () => {
    const patch = basisPatch({ refO2: String(o2.value).replace(',', '.') });
    if (Object.keys(patch).length) store.set(patch);
    render(); // nilai di-clamp → tampilkan nilai yang berlaku
  });
  o2.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  q('[data-reset]').addEventListener('click', () => store.set(basisResetPatch()));
  q('[data-close]').addEventListener('click', () => setOpen(false));
  el.addEventListener('click', (e) => { if (e.target === el) setOpen(false); });

  function render() {
    const d = deriveAssumptions(store.get());
    const b = d.basis, basisTxt = C.basis.full(b.refO2, b.TrefC);
    if (document.activeElement !== o2) o2.value = String(b.refO2);
    for (const [T, btn] of volBtns) { btn.classList.toggle('is-on', T === b.TrefC); btn.setAttribute('aria-pressed', String(T === b.TrefC)); }
    const act = V('active');
    act.textContent = `${A.basis.active(basisTxt)}${b.isDefault ? '' : ` · ${C.basis.flag}`}`;
    act.classList.toggle('is-flag', !b.isDefault);
    V('example').textContent = A.basis.example(d.example.ppm15, d.example.ppm, d.example.mgNm3, basisTxt);
    V('zeld').innerHTML = A.zeldovich.formula(sci(d.zeldovich.A), fmt(d.zeldovich.Ea, 0));
    const c = d.calib, L = c.literature;
    V('calib').innerHTML = row(A.calib.head, 'th')
      + ['diesel', 'gas'].map((k) => row([A.calib.rows[k], A.calib.factor(c.engine[k]), A.calib.factor(c.defaults.engine[k]), A.calib.targetEngine(L.engine[k])])).join('')
      + row([A.calib.rows.dln, A.calib.factor(c.dln), A.calib.factor(c.defaults.dln), A.calib.targetDln(L.dlnPpm, L.dlnRefO2)]);
    V('flame').innerHTML = row(A.flame.head, 'th') + d.flame.rows.map((r) => row([fmt(r.phi, 1), fmt(r.gas, 0), fmt(r.diesel, 0)])).join('');
    V('flameNote').textContent = A.flame.note(d.flame.Tin);
    V('levels').innerHTML = row(A.levels.head, 'th')
      + d.chartLevels.map((x) => row([String(x.scene), CHART_TITLES[x.chart](), x.levels.map((k) => C.level[k]).join(A.levels.sep)])).join('');
  }

  function setOpen(on) {
    el.hidden = !on;
    if (on) render();
  }
  const unsub = store.subscribe((s, prev, changed) => { if (!el.hidden && changed.some((k) => WATCH.includes(k))) render(); });
  const onKey = (e) => { if (e.key === 'Escape' && !el.hidden) { setOpen(false); e.stopPropagation(); } };
  window.addEventListener('keydown', onKey, true);

  return {
    el,
    get open() { return !el.hidden; },
    setOpen,
    toggle() { setOpen(el.hidden); },
    render,
    dispose() { unsub(); window.removeEventListener('keydown', onKey, true); el.remove(); },
  };
}
