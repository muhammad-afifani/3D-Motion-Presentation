/**
 * presenter.js — jendela presenter (presenter.html, dibuka dari jendela utama dengan P).
 * Sinkron lewat BroadcastChannel (origin sama): menerima scene aktif, mengirim nav/goto. Catatan dari
 * content/presenter.json (loader yang sama dengan konten lain; fallback bawaan, banner hanya bila JSON rusak).
 */
import './styles.css';
import { STR } from './ui/strings.js';
import { createPresenterView } from './ui/presenterView.js';
import { loadContent, fallbackContent } from './state/content.js';
import { openChannel, createPresenterLink } from './state/presenterSync.js';
import { SCENE_NUMBERS } from './state/scenes.js';

document.title = STR.presenter.docTitle;
const channel = openChannel();
let link = null;
const view = createPresenterView(document.getElementById('presenter'), {
  content: fallbackContent('presenter'),
  onNav: (dir) => link?.nav(dir),
  onReconnect: () => link?.hello(),
});
if (channel) link = createPresenterLink(channel, { onState: (m) => view.setScene(m.scene, m) });
else view.setStatusText(STR.presenter.noChannel);

loadContent('presenter', { sceneNumbers: [...SCENE_NUMBERS] }).then((r) => view.setContent(r));

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'ArrowRight') link?.nav(1);
  else if (e.key === 'ArrowLeft') link?.nav(-1);
  else if (e.key === ' ') { e.preventDefault(); view.toggleTimer(); }
  else return;
  e.preventDefault();
});
window.addEventListener('pagehide', () => link?.dispose());
