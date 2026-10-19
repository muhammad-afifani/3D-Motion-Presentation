/**
 * presenterMode.js — tombol P di jendela utama: buka jendela presenter (presenter.html) yang sinkron lewat
 * BroadcastChannel; bila pop-up diblokir atau BroadcastChannel tidak ada → toast yang jelas + panel presenter
 * di dalam halaman (komponen yang sama, presenterView.js) sebagai pengganti.
 */
import { STR } from './strings.js';
import { createPresenterView } from './presenterView.js';
import { loadContent, fallbackContent } from '../state/content.js';
import { openChannel, createMainLink, PRESENTER_WINDOW } from '../state/presenterSync.js';
import { SCENE_NUMBERS } from '../state/scenes.js';

const T = STR.presenter;

/**
 * @param {{getState:()=>{scene:number,total:number,playing:boolean,frozen:boolean}, onNav:(dir:number)=>void, onGoto:(n:number)=>void,
 *   toast:(m:string)=>void, url:string, openWindow?:(url:string)=>Window|null, channel?:any, host?:HTMLElement}} o
 */
export function createPresenterMode(o) {
  const openWindow = o.openWindow ?? ((u) => window.open(u, PRESENTER_WINDOW.name, PRESENTER_WINDOW.features));
  const channel = o.channel === undefined ? openChannel() : o.channel;
  const link = channel ? createMainLink(channel, { getState: o.getState, onNav: o.onNav, onGoto: o.onGoto }) : null;
  let win = null, panel = null, host = null;

  function sync() {
    link?.post();
    if (panel) { const s = o.getState(); panel.setScene(s.scene, s); }
  }
  function openInPage(msg) {
    if (msg) o.toast(msg);
    if (panel) return;
    host = document.createElement('div');
    host.className = 'pres-host';
    (o.host ?? document.body).appendChild(host);
    panel = createPresenterView(host, { content: fallbackContent('presenter'), onNav: o.onNav, onClose: closeInPage, inPage: true });
    loadContent('presenter', { sceneNumbers: [...SCENE_NUMBERS] }).then((r) => panel?.setContent(r));
    sync();
  }
  function closeInPage() { panel?.dispose(); host?.remove(); panel = null; host = null; }

  /** Tombol P: buka/fokus jendela presenter; panel di halaman ditutup bila sedang terbuka. */
  function toggle() {
    if (panel) { closeInPage(); return 'closed'; }
    if (win && !win.closed) { win.focus?.(); o.toast(T.focused); return 'focused'; }
    if (!link) { openInPage(T.noChannelToast); return 'inpage'; }
    let w = null;
    try { w = openWindow(o.url); } catch { w = null; }
    if (!w || w.closed) { openInPage(T.blocked); return 'inpage'; }
    win = w;
    return 'window';
  }

  return {
    toggle, sync,
    /** Bahasa berubah: panel di halaman ikut (jendela presenter memakai presenter.js). */
    relabel() { panel?.relabel(); },
    get inPageOpen() { return !!panel; },
    get windowOpen() { return !!win && !win.closed; },
    dispose() { closeInPage(); link?.dispose(); try { channel?.close?.(); } catch { /* sudah ditutup */ } },
  };
}
