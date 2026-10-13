/**
 * sceneBase.js — kontrak lifecycle scene.
 *
 * Setiap modul scene mengekspor `createScene(ctx)` yang mengembalikan:
 *   mount()            → membangun DOM/3D di ctx.root
 *   update(dt)         → dipanggil tiap frame animasi (dt detik)
 *   onKey?(e)          → tombol khusus scene; return true bila ditangani
 *   dispose()          → melepas geometri, material, listener, worker
 *
 * Scene hanya membaca `frame` hasil derive(); tidak menghitung termodinamika.
 *
 * @typedef {Object} SceneContext
 * @property {HTMLElement} root
 * @property {ReturnType<typeof import('../state/store.js').createStore>} store
 * @property {(msg:string)=>void} toast
 *
 * @typedef {Object} SceneInstance
 * @property {() => void} mount
 * @property {(dt:number) => void} update
 * @property {(e:KeyboardEvent) => boolean} [onKey]
 * @property {() => void} dispose
 */

/** Buat elemen dari string HTML (satu akar). */
export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return /** @type {HTMLElement} */ (t.content.firstElementChild);
}
