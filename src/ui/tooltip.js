/**
 * tooltip.js — tooltip rumus untuk elemen ber-atribut data-tip (hover atau fokus keyboard).
 * Baris baru pada data-tip ditulis sebagai "\n" literal atau &#10;.
 */
export function installTooltips(root = document.body) {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  let target = null;

  function show(el) {
    target = el;
    tip.textContent = el.dataset.tip.replace(/\\n/g, '\n');
    tip.classList.add('is-on');
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    let y = r.top - th - 10;
    if (y < 8) y = r.bottom + 10;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  function hide() { target = null; tip.classList.remove('is-on'); }
  const find = (e) => e.target instanceof Element ? e.target.closest('[data-tip]') : null;
  const over = (e) => { const el = find(e); if (el && el !== target) show(el); else if (!el && target) hide(); };
  root.addEventListener('mouseover', over);
  root.addEventListener('focusin', over);
  root.addEventListener('focusout', hide);
  root.addEventListener('mouseleave', hide);
  return () => {
    root.removeEventListener('mouseover', over);
    root.removeEventListener('focusin', over);
    root.removeEventListener('focusout', hide);
    root.removeEventListener('mouseleave', hide);
    tip.remove();
  };
}
