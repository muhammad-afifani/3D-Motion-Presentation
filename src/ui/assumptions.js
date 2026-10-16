/**
 * assumptions.js — panel asumsi model (tombol H, semua scene; Esc menutup).
 * Data dari state/deriveAssumptions.js (nilai langsung dari store), teks dari strings.js.
 * Input basis O₂ / volume hanya di sini; perubahan lewat store.set(basisPatch(...)).
 */
import { STR } from './strings.js';
import { fmt, sci } from './format.js';
import { deriveAssumptions } from '../state/deriveAssumptions.js';
import { basisPatch, basisResetPatch, displayPatch, QUALITY_ORDER, BLOOM_ORDER } from '../state/store.js';
import { QUALITY_TUNING, TIER_MAX, displayState } from '../gfx/quality.js';
import { rendererStats } from '../gfx/renderer.js';
import { BASIS } from '../model/basis.js';
import { LEVER_STATUS } from '../state/levers.js';

const A = STR.assumptions, C = STR.common;
const WATCH = ['emRefO2', 'emTrefC', 'calEngine', 'calDln', 'quality', 'bloomMode', 'qTier'];
const D = A.display;

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
  s6emis: () => STR.scene6.charts.emis.title,
  s6aux: () => `${STR.scene6.charts.flame.title}${A.levels.sep}${STR.scene6.charts.eta.title}`,
  s7hq: () => STR.scene7.charts.hq.title,
  s7pn: () => STR.scene7.charts.pn.title,
  s8co2: () => STR.scene8.charts.co2.title,
  s8nox: () => STR.scene8.charts.nox.title,
};

const list = (items) => `<ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul>`;
const row = (cells, tag = 'td') => `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join('')}</tr>`;

/**
 * @param {{get:()=>any, set:(p:any)=>void, subscribe:(fn:any)=>()=>void}} store
 * @param {HTMLElement} [parent]
 * @param {{available:boolean, onReset:()=>void}} [saved] persistensi (Reset saved settings)
 */
export function createAssumptionsPanel(store, parent = document.body, saved = null) {
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
        <section data-section="display" style="grid-column: 1 / -1">
          <h3>${D.title} <kbd>${D.keys}</kbd></h3>
          <div class="asm-basis">
            <div class="ctl ctl--seg"><span class="ctl__label">${D.quality}</span><div class="seg" data-quality></div></div>
            <div class="ctl ctl--seg"><span class="ctl__label">${D.bloom}</span><div class="seg" data-bloom></div></div>
          </div>
          <div class="asm-active" data-v="display"></div>
          <div class="asm__intro"><b>${D.visualOnly}</b></div>
          <div class="asm__intro">${D.autoNote(QUALITY_TUNING.downFps, QUALITY_TUNING.upFps, QUALITY_TUNING.downSec, QUALITY_TUNING.upSec)} ${D.bloomNote}</div>
        </section>
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
        <section><h3>${A.engine.title}</h3>${list(A.engine.items)}<h3>${A.engine.leversTitle}</h3>${list(Object.entries(LEVER_STATUS).map(([k, st]) => `<b>${A.engine.leverNames[k]}</b>: ${A.engine.leverStatus[st]}`))}</section>
        <section><h3>${A.turbine.title}</h3>${list(A.turbine.items)}</section>
        <section><h3>${A.compressor.title}</h3>${list(A.compressor.items)}</section>
        <section><h3>${A.ghg.title}</h3>${list(A.ghg.items)}</section>
        <section><h3>${A.calib.title}</h3><table data-v="calib"></table><div class="asm__intro">${A.calib.notUnit}</div></section>
        <section><h3>${A.flame.title}</h3><table data-v="flame"></table><div class="asm__intro" data-v="flameNote"></div></section>
        <section style="grid-column: 1 / -1"><h3>${A.levels.title}</h3><table data-v="levels"></table></section>
        <section style="grid-column: 1 / -1" data-section="functions"><h3>${A.functions.title}</h3><div class="asm__intro">${A.functions.intro}</div>
          <table data-v="functions"></table></section>
        <section style="grid-column: 1 / -1" data-section="issues"><h3>${A.issues.title}</h3><div class="asm__intro">${A.issues.intro}</div>
          <ul data-v="issues"></ul></section>
        ${saved ? `<section style="grid-column: 1 / -1"><h3>${A.saved.title}</h3>
          <div class="asm__intro">${saved.available ? A.saved.note : A.saved.unavailable}</div>
          <button type="button" class="btn btn--sm" data-reset-saved data-tip="${A.saved.resetTip}">${A.saved.reset}</button></section>` : ''}
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
  const segBtns = (sel, order, labels, key) => order.map((v) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seg__btn';
    b.textContent = labels[v];
    b.addEventListener('click', () => store.set(displayPatch({ [key]: v })));
    q(sel).appendChild(b);
    return [v, b];
  });
  const qBtns = segBtns('[data-quality]', QUALITY_ORDER, D.qualityOpts, 'quality');
  const bBtns = segBtns('[data-bloom]', BLOOM_ORDER, D.bloomOpts, 'bloomMode');
  o2.addEventListener('change', () => {
    const patch = basisPatch({ refO2: String(o2.value).replace(',', '.') });
    if (Object.keys(patch).length) store.set(patch);
    render(); // nilai di-clamp → tampilkan nilai yang berlaku
  });
  o2.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  q('[data-reset]').addEventListener('click', () => store.set(basisResetPatch()));
  q('[data-close]').addEventListener('click', () => setOpen(false));
  q('[data-reset-saved]')?.addEventListener('click', () => saved.onReset());
  el.addEventListener('click', (e) => { if (e.target === el) setOpen(false); });

  function render() {
    const st = store.get();
    for (const [v, btn] of qBtns) { btn.classList.toggle('is-on', v === st.quality); btn.setAttribute('aria-pressed', String(v === st.quality)); }
    for (const [v, btn] of bBtns) { btn.classList.toggle('is-on', v === st.bloomMode); btn.setAttribute('aria-pressed', String(v === st.bloomMode)); }
    const ds = displayState();
    V('display').textContent = D.status(ds.tier, TIER_MAX, rendererStats().pixelRatio, ds.bloom, ds.particles);
    const d = deriveAssumptions(st);
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
      + ['single', 'twin'].map((k) => row([A.calib.rows[k], A.calib.factor(c.dln[k]), A.calib.factor(c.defaults.dln[k]), A.calib.targetDln(L.dlnPpm, L.dlnRefO2)])).join('');
    V('flame').innerHTML = row(A.flame.head, 'th') + d.flame.rows.map((r) => row([fmt(r.phi, 1), fmt(r.gas, 0), fmt(r.diesel, 0)])).join('');
    V('flameNote').textContent = A.flame.note(d.flame.Tin);
    V('levels').innerHTML = row(A.levels.head, 'th')
      + d.chartLevels.map((x) => row([String(x.scene), CHART_TITLES[x.chart](), x.levels.map((k) => C.level[k]).join(A.levels.sep)])).join('');
  }

  // Theory basis per function: rows come straight from src/model/basis.js (clicking a row opens its Basis card)
  const fnRows = Object.entries(BASIS).map(([name, b]) => {
    const src = b.refs.length ? b.refs.join(', ') : A.functions.none;
    return `<tr class="asm-fn" role="button" tabindex="0" data-basis="${name}"><td><code>${name}</code></td><td>${b.level}</td><td>${src}${b.toVerify.length ? ` · <b>${A.functions.toVerify}</b>` : ''}</td></tr>`;
  });
  V('functions').innerHTML = row(A.functions.head, 'th') + fnRows.join('');
  // penyimpangan yang diketahui (basis.js knownIssue), mis. cv(T) linear vs data polinomial NASA (koreksi direncanakan M10)
  V('issues').innerHTML = Object.entries(BASIS).filter(([, b]) => b.knownIssue).map(([name, b]) => `<li class="asm-fn" role="button" tabindex="0" data-basis="${name}"><code>${name}</code>: ${b.knownIssue}</li>`).join('');

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
    /** Buka panel dan gulir ke satu bagian (mis. 'display' dari pill Quality reduced). */
    openSection(name) { setOpen(true); q(`[data-section="${name}"]`)?.scrollIntoView({ block: 'start' }); },
    render,
    dispose() { unsub(); window.removeEventListener('keydown', onKey, true); el.remove(); },
  };
}
