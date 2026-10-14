/**
 * presenterSync.js — sinkronisasi jendela utama ↔ jendela presenter lewat BroadcastChannel (M8a).
 * BroadcastChannel hanya menghubungkan halaman pada ORIGIN yang sama (skema + host + port): kedua jendela harus
 * dibuka dari server yang sama. Channel di-inject (mudah dites dengan tiruan).
 *
 * Protokol (objek kecil, tanpa fungsi):
 *   presenter → utama : { type:'hello' } saat jendela presenter dibuka (minta state awal)
 *                       { type:'nav', dir: ±1 } · { type:'goto', n } · { type:'bye' } saat ditutup
 *   utama → presenter : { type:'state', scene, total, playing, frozen }
 */
export const CHANNEL_NAME = 'etel-presenter';
/** Nama & fitur jendela presenter untuk window.open (satu jendela; P berikutnya memfokuskan). */
export const PRESENTER_WINDOW = Object.freeze({ name: 'etel-presenter', features: 'popup,width=980,height=760' });

/** Buka channel; null bila BroadcastChannel tidak tersedia / gagal. */
export function openChannel(name = CHANNEL_NAME, Impl = globalThis.BroadcastChannel) {
  try { return Impl ? new Impl(name) : null; } catch { return null; }
}

const isMsg = (m) => !!m && typeof m === 'object' && typeof m.type === 'string';

/**
 * Sisi jendela utama.
 * @param {{postMessage:(m:any)=>void, addEventListener:Function, removeEventListener:Function}} channel
 * @param {{getState:()=>{scene:number,total:number,playing:boolean,frozen:boolean}, onNav:(dir:number)=>void, onGoto:(n:number)=>void, onPresenter?:(connected:boolean)=>void}} h
 */
export function createMainLink(channel, { getState, onNav, onGoto, onPresenter }) {
  const post = () => { try { channel.postMessage({ type: 'state', ...getState() }); } catch { /* channel ditutup */ } };
  const onMsg = (e) => {
    const m = e?.data;
    if (!isMsg(m)) return;
    if (m.type === 'hello') { post(); onPresenter?.(true); }
    else if (m.type === 'nav' && (m.dir === 1 || m.dir === -1)) onNav(m.dir);
    else if (m.type === 'goto' && Number.isInteger(m.n)) onGoto(m.n);
    else if (m.type === 'bye') onPresenter?.(false);
  };
  channel.addEventListener('message', onMsg);
  return { post, dispose() { channel.removeEventListener('message', onMsg); } };
}

/**
 * Sisi jendela presenter. Mengirim 'hello' saat dibuat.
 * @param {{postMessage:(m:any)=>void, addEventListener:Function, removeEventListener:Function}} channel
 * @param {{onState:(s:{scene:number,total:number,playing:boolean,frozen:boolean})=>void}} h
 */
export function createPresenterLink(channel, { onState }) {
  const send = (m) => { try { channel.postMessage(m); } catch { /* channel ditutup */ } };
  const onMsg = (e) => { const m = e?.data; if (isMsg(m) && m.type === 'state' && Number.isInteger(m.scene)) onState(m); };
  channel.addEventListener('message', onMsg);
  send({ type: 'hello' });
  return {
    nav(dir) { send({ type: 'nav', dir: dir > 0 ? 1 : -1 }); },
    goto(n) { send({ type: 'goto', n }); },
    hello() { send({ type: 'hello' }); },
    dispose() { send({ type: 'bye' }); channel.removeEventListener('message', onMsg); },
  };
}
