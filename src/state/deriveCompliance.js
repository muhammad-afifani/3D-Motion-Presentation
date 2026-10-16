/**
 * deriveCompliance.js — chip kepatuhan untuk pilihan regulasi di store (Scene 9, strip "Model value vs limit").
 * Nilai model (ppmvd @ 15 % O₂, mentah) dari deriveEmis: cylinderSim preset (engine) dan titik desain DLN (turbin gas).
 * Perbandingan HANYA lewat jalur regulasi (state/regulations.js → toRegulationBasis, koreksi O₂ 21).
 * Override limit / Permit-OEM CO (limNOx / limCO) hanya berlaku untuk turbin gas (isiannya ada di Scene 6 dan panel C).
 */
import { deriveEmis } from './deriveEmis.js';
import { EQUIPMENT, regSelection, rowsFor, complianceRows, sourceOf } from './regulations.js';
import { emissionBasis } from './deriveNox.js';
import { deriveFuel } from './deriveFuel.js';

/**
 * @param {any} s state store (regEquip, regClass, regFuel, siteData, limNOx, limCO, emRefO2, emTrefC, calEngine, calDln)
 * @param {any} regData isi content/regulations.json
 */
export function deriveCompliance(s, regData) {
  const sel = regSelection(s, regData);
  const E = EQUIPMENT[sel.equip];
  const params = E.params[sel.fuel] ?? [];
  const em = deriveEmis(s);
  const r = em.rows[E.model];
  const model = {};
  if (params.includes('NOx')) model.NOx = r.noxPpm15 ?? null;
  if (params.includes('CO')) model.CO = r.coPpm15 ?? null;
  // SO₂: neraca massa sulfur bahan bakar, dihitung @15 % O₂ (basis mentah model) pada suhu grup; baris kepatuhan lalu
  // mengonversi ke basis grup lewat jalur regulasi. null sampai presenter mengisi sulfur (tanpa nilai default di kode).
  const fuel = deriveFuel(s, { refO2Pct: 15, TrefC: sel.group?.basis?.TrefC ?? 25 });
  const needsInput = [];
  if (params.includes('SO2')) {
    const so = fuel.so2[sel.fuel];
    if (so) model.SO2 = so.ppmAtRef; else needsInput.push('SO2');
  }
  const turbine = sel.equip === 'gasTurbine';
  const hasRegCo = rowsFor(sel.group, sel.cls, sel.fuel).some((x) => x.param === 'CO');
  const rows = complianceRows(sel, model, {
    siteData: s.siteData?.[sel.equip] ?? {},
    overrides: turbine ? { NOx: s.limNOx ?? null, CO: s.limCO ?? null } : {},
    overrideKind: { NOx: 'override', CO: hasRegCo ? 'override' : 'permit' },
    displayO2: s.emRefO2,
    needsInput,
  });
  const basis = sel.group?.basis ?? null;
  const display = emissionBasis(s);
  const src = sourceOf(regData, sel.group);
  return {
    sel: { equip: sel.equip, cls: sel.cls, fuel: sel.fuel, classes: sel.classes, fuels: sel.fuels },
    rows, basis,
    verified: sel.group?.verified === true,
    source: src ? { short: src.short, url: src.url } : null,
    displayDiffers: !!basis && (display.refO2 !== basis.refO2Pct || display.TrefC !== basis.TrefC),
    display,
    isEngine: E.group === 'engine', turbine, turbineOil: turbine && sel.fuel === 'oil',
    calibrated: rows.some((x) => x.valueSource === 'model' && x.param !== 'SO2'),
    fuel: { kind: sel.fuel, sulfur: fuel.sulfur[sel.fuel], so2: fuel.so2[sel.fuel], exhaustO2: E.model === 'turbine' ? null : fuel.exhaustO2[E.model], lambda: E.model === 'turbine' ? null : fuel.lambda[E.model] },
  };
}
