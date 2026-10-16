/**
 * pageShell.js — kerangka halaman penuh (M9 Step 06) untuk halaman baru (Emission formation, Glossary): dialog dengan
 * judul + tombol Close, alamat hash sendiri (#/<page>), Esc / klik latar menutup, kembali ke alamat scene (homeHash).
 * Isi dirender oleh pemanggil (render) setiap kali halaman dibuka. Halaman References dan Regulations memakai pola
 * yang sama di filenya sendiri (sudah ada sejak Step 02/03).
 */
import { STR } from './strings.js';

/**
 * @param {{className:string, title:string, hash:string, render:(body:HTMLElement)=>void, parent?:HTMLElement, win?:Window,
 *   homeHash?:() => string}} o
 */
export function createPageShell(o) {
  const win = o.win ?? window;
  const isHash = (h) => String(h ?? '').replace(/\?.*$/, '').replace(/\/+$/, '') === o.hash;
  const el = document.createElement('div');
  el.className = `refs ${o.className}`;
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', o.title);
  const box = document.createElement('div');
  box.className = 'refs__box';
  const head = document.createElement('div');
  head.className = 'refs__head';
  const h2 = document.createElement('h2');
  h2.textContent = o.title;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn btn--sm';
  close.textContent = STR.pages.close;
  close.addEventListener('click', () => setOpen(false));
  head.append(h2, close);
  const body = document.createElement('div');
  body.className = 'page__body';
  box.append(head, body);
  el.appendChild(box);
  (o.parent ?? document.body).appendChild(el);
  let opener = null;

  function setOpen(on, { fromHash = false } = {}) {
    if (on === !el.hidden) return;
    el.hidden = !on;
    if (on) {
      opener = document.activeElement;
      o.render(body);
      box.scrollTop = 0;
      close.focus();
      if (!fromHash && !isHash(win.location.hash)) win.history.replaceState(null, '', o.hash);
    } else {
      if (!fromHash && isHash(win.location.hash)) win.history.replaceState(null, '', o.homeHash?.() ?? `${win.location.pathname}${win.location.search}`);
      /** @type {HTMLElement|null} */ (opener)?.focus?.();
    }
  }
  const onHash = () => setOpen(isHash(win.location.hash), { fromHash: true });
  const onKey = (e) => { if (e.key === 'Escape' && !el.hidden) { setOpen(false); e.stopImmediatePropagation(); } };
  el.addEventListener('click', (e) => { if (e.target === el) setOpen(false); });
  win.addEventListener('hashchange', onHash);
  win.addEventListener('keydown', onKey, true);
  if (isHash(win.location.hash)) setOpen(true, { fromHash: true });

  return {
    el, body,
    get open() { return !el.hidden; },
    setOpen,
    toggle() { setOpen(el.hidden); },
    /** Render ulang isi bila sedang terbuka (mis. konten selesai dimuat, store berubah). */
    refresh() { if (!el.hidden) o.render(body); },
    dispose() { win.removeEventListener('hashchange', onHash); win.removeEventListener('keydown', onKey, true); el.remove(); },
  };
}
