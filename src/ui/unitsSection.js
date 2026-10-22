/**
 * unitsSection.js — seksi "Units" di Settings (ui/settingsPanel.js): pilih preset SI / US customary, ubah satuan per
 * besaran (lipatan "Per quantity"), kembali ke preset, ringkasan basis gas, dan penjelasan ppmvd vs mg/Nm³ dengan
 * contoh hitung dari model (state/deriveUnitsGuide.js). Hanya tampilan: pilihan disimpan di state/unitsStore.js.
 * Seksi hanya dipasang bila bendera UNITS_UI menyala (unitsStore.enabled). Teks dua bahasa dari STR.units (diisi ulang
 * oleh applyStringLang); seksi dilukis ulang saat bahasa, satuan, atau panel dibuka.
 */
import { STR } from './strings.js';
import { fmt } from './format.js';
import { unitsStore, QUANTITIES } from '../state/unitsStore.js';
import { unitsGuideExample } from '../state/deriveUnitsGuide.js';
import { createHelpButton } from './helpButton.js';

const T = STR.units;

function h(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/**
 * @param {HTMLElement} box isi seksi (judul h3 dibuat panel)
 * @param {{getState:()=>any}} ctx getState = state store (basis gas global, kalibrasi DLN)
 * @returns {() => void} paint
 */
export function buildUnitsSection(box, ctx) {
  box.classList.add('set-units');
  const lead = h('p', 'set-row__desc set-units__lead');
  const help = createHelpButton('ui.units', { describes: lead }).el;
  help.classList.add('set-units__help');
  const head = h('div', 'set-units__head');
  head.append(lead, help);

  const sysLabel = h('span', 'set-row__label');
  sysLabel.id = 'set-units-system';
  const presets = h('div', 'theme-switch set-units__preset');
  presets.setAttribute('role', 'radiogroup');
  presets.setAttribute('aria-labelledby', sysLabel.id);
  const pbtn = {};
  for (const id of /** @type {const} */ (['si', 'us', 'custom'])) {
    const b = h('button', 'theme-switch__btn');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.preset = id;
    if (id === 'custom') b.addEventListener('click', () => { more.open = true; });
    else b.addEventListener('click', () => unitsStore.setPreset(id));
    presets.append(b);
    pbtn[id] = b;
  }

  const more = /** @type {HTMLDetailsElement} */ (h('details', 'set-units__more'));
  const moreSum = h('summary');
  const rows = h('div', 'set-units__rows');
  const selects = {};
  const names = {};
  for (const q of QUANTITIES) {
    const row = h('label', 'set-units__row');
    const name = h('span', 'set-units__name');
    const sel = /** @type {HTMLSelectElement} */ (h('select', 'set-units__select'));
    sel.dataset.qty = q.id;
    for (const u of q.options) { const o = h('option'); o.value = u; sel.append(o); }
    sel.addEventListener('change', () => unitsStore.setUnit(q.id, sel.value));
    row.append(name, sel);
    rows.append(row);
    selects[q.id] = sel;
    names[q.id] = name;
  }
  const back = h('button', 'btn btn--sm set-units__back');
  back.type = 'button';
  back.addEventListener('click', () => unitsStore.clearOverrides());
  more.append(moreSum, rows, back);

  const basisLine = h('p', 'set-row__note set-units__basis');
  const scope = h('p', 'set-row__note set-units__scope');

  // penjelasan ppmvd vs mg/Nm³ + contoh hitung dari model
  const guide = /** @type {HTMLDetailsElement} */ (h('details', 'set-units__guide'));
  const gSum = h('summary');
  const gBody = h('div', 'set-units__guide-body');
  const gP = ['what', 'whyO2', 'whyVolume', 'how', 'differ'].map((k) => { const p = h('p'); p.dataset.guide = k; return p; });
  const exHead = h('div', 'set-units__ex-head');
  const exTitle = h('strong');
  const exHelp = createHelpButton('ui.concentration', { describes: exTitle }).el;
  exHead.append(exTitle, exHelp);
  const exLead = h('p');
  const exTable = h('table', 'set-units__ex');
  const exMV = h('p', 'set-row__note');
  const exNote = h('p', 'set-row__note set-units__ex-note');
  gBody.append(...gP, exHead, exLead, exTable, exMV, exNote);
  guide.append(gSum, gBody);

  box.append(head, sysLabel, presets, more, basisLine, scope, guide);

  return () => {
    lead.textContent = T.lead;
    sysLabel.textContent = T.system;
    const custom = unitsStore.custom;
    const active = custom ? 'custom' : unitsStore.preset;
    for (const [id, b] of Object.entries(pbtn)) {
      b.textContent = T.preset[id];
      b.dataset.tip = T.presetTip[id];
      b.classList.toggle('is-on', id === active);
      b.setAttribute('aria-checked', String(id === active));
    }
    presets.dataset.tip = T.presetTip[active];
    moreSum.textContent = T.perQuantity;
    for (const q of QUANTITIES) {
      names[q.id].textContent = T.qty[q.id];
      const tip = T.qtyTip[q.id] ?? '';
      names[q.id].parentElement.title = tip;
      const sel = selects[q.id];
      for (const o of sel.options) o.textContent = o.value === 'auto' ? T.auto : T.sym[o.value];
      sel.value = unitsStore.unit(q.id);
    }
    back.textContent = T.backToPreset;
    back.hidden = !custom;
    const s = ctx.getState();
    basisLine.textContent = T.basisLine(s.emRefO2, s.emTrefC);
    scope.textContent = T.scope;

    gSum.textContent = T.guide.summary;
    for (const p of gP) p.textContent = T.guide[p.dataset.guide];
    const ex = unitsGuideExample(s);
    exTitle.textContent = T.guide.exampleTitle;
    exLead.textContent = T.guide.exampleLead(ex.ppmRaw, ex.refFrom);
    exTable.replaceChildren();
    const trh = h('tr');
    for (const c of T.guide.exampleHead) trh.append(h('th', '', c));
    exTable.append(trh);
    for (const r of ex.rows) {
      const tr = h('tr');
      const first = h('td');
      const kind = h('span', 'set-units__ex-kind', T.guide.exampleRow[r.kind]);
      first.append(kind, h('span', 'set-units__ex-basis', T.guide.basisOf(r.refO2, r.TrefC)));
      tr.append(first, h('td', 'num', fmt(r.ppm, 1)), h('td', 'num', fmt(r.mg, 1)));
      exTable.append(tr);
    }
    exMV.textContent = T.guide.exampleMV(ex.M, ex.V0, ex.V25);
    exNote.textContent = T.guide.exampleNote;
  };
}
