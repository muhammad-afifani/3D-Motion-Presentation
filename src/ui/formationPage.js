/**
 * formationPage.js — halaman Emission formation (#/formation, M9 Step 06): kartu Formation Step 05 untuk equipment
 * pilihan, tanpa harus lewat Scene 9. Equipment = regEquip di store (sama dengan header Scene 9; satu state).
 */
import { STR } from './strings.js';
import { segmented } from './controls.js';
import { createPageShell } from './pageShell.js';
import { createFormationTab } from './formationTab.js';
import { createContentBanner } from './contentBanner.js';
import { formationCards } from '../state/formationView.js';
import { contentOf, onContent } from '../state/contentStore.js';
import { regulationsContent } from '../state/regulationsStore.js';
import { EQUIPMENT_ORDER, regSelection, regSelectionPatch } from '../state/regulations.js';

const P = STR.pages.formation;

/** @param {{get:()=>any, set:(p:any)=>void, subscribe:(fn:any)=>()=>void}} store @param {{homeHash?:()=>string, win?:Window}} [opts] */
export function createFormationPage(store, { homeHash, win } = {}) {
  let tab = null, banner = null, equip = null;
  function render(body) {
    if (!tab) {
      const intro = document.createElement('p');
      intro.className = 'refs__intro';
      intro.textContent = P.intro;
      equip = segmented({ label: P.equipment, tip: P.equipmentTip, options: EQUIPMENT_ORDER.map((k) => ({ value: k, label: STR.regulation.equipments[k] })), value: EQUIPMENT_ORDER[0],
        onChange: (v) => store.set(regSelectionPatch(store.get(), regulationsContent().data, { equip: v })) });
      equip.el.classList.add('page__pick');
      body.append(intro, equip.el);
      banner = createContentBanner(body);
      tab = createFormationTab(body);
    }
    const sel = regSelection(store.get(), regulationsContent().data);
    equip.set(sel.equip);
    banner.show(contentOf('formation'));
    tab.update(formationCards(contentOf('formation').data, sel.equip, contentOf('references').data), { gasFuel: sel.fuel === 'gas' });
  }
  const shell = createPageShell({ className: 'refs--formation', title: P.title, hash: '#/formation', render, homeHash, win });
  const unsub = [
    store.subscribe((s, prev, changed) => { if (changed.includes('regEquip') || changed.includes('regFuel')) shell.refresh(); }),
    onContent('formation', () => shell.refresh()),
    onContent('references', () => shell.refresh()),
  ];
  return { ...shell, get open() { return shell.open; }, dispose() { for (const u of unsub) u(); shell.dispose(); } };
}
