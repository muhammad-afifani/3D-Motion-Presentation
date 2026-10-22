/**
 * presenter.js — jendela presenter (presenter.html, dibuka dari jendela utama dengan P).
 * Sinkron lewat BroadcastChannel (origin sama): menerima scene aktif, mengirim nav/goto. Catatan dari
 * content/presenter.json (loader yang sama dengan konten lain; fallback bawaan, banner hanya bila JSON rusak).
 */
import './styles.css';
import { STR, applyStringLang } from './ui/strings.js';
import { setNumberLang, numberLang, fmt } from './ui/format.js';
import { LANG_KEY, langStorage, readLangChoice, resolveLang } from './state/lang.js';
import { createPresenterView } from './ui/presenterView.js';
import { isTypingTarget } from './ui/keys.js';
import { loadContent, fallbackContent } from './state/content.js';
import { openChannel, createPresenterLink } from './state/presenterSync.js';
import { SCENE_NUMBERS } from './state/scenes.js';
import { THEME_KEY, themeStorage, readThemeChoice, applyTheme } from './state/theme.js';
import { UNITS_KEY, unitsStore } from './state/unitsStore.js';

// bahasa teks dan format angka ikut jendela utama (etel:lang; tanpa pilihan: bahasa browser / English). Berganti lewat event
// storage tanpa memuat ulang: teks kerangka (judul, tombol, label) dan format angka berubah, catatan presenter tetap Indonesia.
let view = null;
const syncLang = () => {
  const l = resolveLang(readLangChoice(langStorage()), navigator.language);
  if (l === numberLang()) return;
  setNumberLang(l); applyStringLang(l);
  document.title = STR.presenter.docTitle;
  view?.relabel();
};
{ const l = resolveLang(readLangChoice(langStorage()), navigator.language); setNumberLang(l); applyStringLang(l); }
window.addEventListener('storage', (e) => { if (e.key === LANG_KEY || e.key === null) syncLang(); });
document.title = STR.presenter.docTitle;
// hook uji (smoke): bahasa angka aktif dan contoh format di jendela ini
window.__etelPresenter = { numLang: () => numberLang(), sample: () => fmt(1500.5, 1), unit: (q) => unitsStore.unit(q) };
// satuan tampilan ikut jendela utama lewat event storage (etel:units), seperti bahasa dan tema; belum ada angka berunit di jendela ini
window.addEventListener('storage', (e) => { if (e.key === UNITS_KEY || e.key === null) unitsStore.reload(); });
// tema ikut jendela utama hanya bila storage terbaca (pilihan tersimpan); selain itu tetap Dark
const syncTheme = () => { const c = readThemeChoice(themeStorage()); applyTheme(c.stored ? c.theme : 'dark'); };
syncTheme();
window.addEventListener('storage', (e) => { if (e.key === THEME_KEY || e.key === null) syncTheme(); });
const channel = openChannel();
let link = null;
view = createPresenterView(document.getElementById('presenter'), {
  content: fallbackContent('presenter'),
  onNav: (dir) => link?.nav(dir),
  onReconnect: () => link?.hello(),
});
if (channel) link = createPresenterLink(channel, { onState: (m) => view.setScene(m.scene, m) });
else view.setStatusText(() => STR.presenter.noChannel);

loadContent('presenter', { sceneNumbers: [...SCENE_NUMBERS] }).then((r) => view.setContent(r));

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
  if (e.key === 'ArrowRight') link?.nav(1);
  else if (e.key === 'ArrowLeft') link?.nav(-1);
  else if (e.key === ' ') { e.preventDefault(); view.toggleTimer(); }
  else return;
  e.preventDefault();
});
window.addEventListener('pagehide', () => link?.dispose());
