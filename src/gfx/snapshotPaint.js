/**
 * snapshotPaint.js — pelukis DOM → canvas 2D untuk snapshot PNG (ui/snapshot.js). Murni grafis: menyalin apa yang
 * tampil (latar, border, canvas 3D/grafik, teks, input) pada skala k; tanpa perhitungan model.
 */
export const SNAP_SKIP = '.asm, .pres-host, .toast, [data-snap-skip]';
const SKIP = SNAP_SKIP;

const alphaOf = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c ?? ''); if (!m) return c && c !== 'transparent' ? 1 : 0; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? Number(p[3]) : 1; };
const intersect = (a, b) => {
  if (!a) return b;
  const l = Math.max(a.l, b.l), t = Math.max(a.t, b.t), r = Math.min(a.r, b.r), bo = Math.min(a.b, b.b);
  return { l, t, r: Math.max(l, r), b: Math.max(t, bo) };
};
const rectOf = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
/** Token warna tema aktif (bagian B): PNG mengikuti tema yang tampil. */
const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function roundRect(ctx, x, y, w, h, rad) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(rad, w / 2, h / 2));
  else ctx.rect(x, y, w, h);
}

function paintBox(ctx, r, cs, k) {
  const rad = parseFloat(cs.borderTopLeftRadius) || 0;
  const x = r.left * k, y = r.top * k, w = r.width * k, h = r.height * k;
  if (w <= 0 || h <= 0) return;
  const bg = cs.backgroundColor, img = cs.backgroundImage;
  if (img && img.includes('gradient')) {
    const cols = img.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/gi) ?? [];
    if (cols.length) {
      const g = ctx.createRadialGradient(x + w / 2, y + h * 0.4, 0, x + w / 2, y + h * 0.4, Math.max(w, h) * 0.75);
      g.addColorStop(0, cols[0]); g.addColorStop(1, cols[cols.length - 1]);
      ctx.fillStyle = g; roundRect(ctx, x, y, w, h, rad * k); ctx.fill();
    }
  } else if (alphaOf(bg) > 0) {
    ctx.fillStyle = bg; roundRect(ctx, x, y, w, h, rad * k); ctx.fill();
  }
  const sides = ['Top', 'Right', 'Bottom', 'Left'].map((s) => [parseFloat(cs[`border${s}Width`]) || 0, cs[`border${s}Color`]]);
  if (sides.every(([bw, c]) => bw === sides[0][0] && c === sides[0][1]) && sides[0][0] > 0 && alphaOf(sides[0][1]) > 0) {
    const bw = sides[0][0] * k;
    ctx.strokeStyle = sides[0][1]; ctx.lineWidth = bw;
    roundRect(ctx, x + bw / 2, y + bw / 2, w - bw, h - bw, Math.max(0, rad * k - bw / 2)); ctx.stroke();
  } else {
    const [[tw, tc], [rw, rc], [bw2, bc], [lw, lc]] = sides;
    if (tw && alphaOf(tc)) { ctx.fillStyle = tc; ctx.fillRect(x, y, w, tw * k); }
    if (rw && alphaOf(rc)) { ctx.fillStyle = rc; ctx.fillRect(x + w - rw * k, y, rw * k, h); }
    if (bw2 && alphaOf(bc)) { ctx.fillStyle = bc; ctx.fillRect(x, y + h - bw2 * k, w, bw2 * k); }
    if (lw && alphaOf(lc)) { ctx.fillStyle = lc; ctx.fillRect(x, y, lw * k, h); }
  }
}

function paintInput(ctx, el, r, cs, k) {
  const x = r.left * k, y = r.top * k, w = r.width * k, h = r.height * k;
  const accent = token('--accent-hot') || cs.color;
  if (el.type === 'range') {
    const min = Number(el.min || 0), max = Number(el.max || 100), f = max > min ? (Number(el.value) - min) / (max - min) : 0;
    ctx.fillStyle = token('--track') || cs.color; ctx.fillRect(x, y + h / 2 - 2 * k, w, 4 * k);
    ctx.fillStyle = accent; ctx.fillRect(x, y + h / 2 - 2 * k, w * f, 4 * k);
    ctx.beginPath(); ctx.arc(x + w * f, y + h / 2, 7 * k, 0, Math.PI * 2); ctx.fill();
  } else if (el.type === 'checkbox' || el.type === 'radio') {
    ctx.strokeStyle = cs.color; ctx.lineWidth = 1.5 * k; ctx.strokeRect(x, y, w, h);
    if (el.checked) { ctx.fillStyle = accent; ctx.fillRect(x + 3 * k, y + 3 * k, w - 6 * k, h - 6 * k); }
  } else if (el.value) {
    ctx.fillStyle = cs.color; ctx.font = fontOf(cs, k); ctx.textBaseline = 'middle';
    ctx.fillText(el.value, x + (parseFloat(cs.paddingLeft) || 0) * k, y + h / 2, w);
  }
}

const fontOf = (cs, k) => `${cs.fontStyle} ${cs.fontWeight} ${(parseFloat(cs.fontSize) || 14) * k}px ${cs.fontFamily}`;

function paintText(ctx, node, cs, k) {
  const text = node.textContent;
  if (!text || !text.trim()) return;
  ctx.font = fontOf(cs, k);
  ctx.fillStyle = cs.color;
  ctx.textBaseline = 'middle';
  const upper = cs.textTransform === 'uppercase';
  const range = document.createRange();
  for (const m of text.matchAll(/\S+/g)) {
    range.setStart(node, m.index);
    range.setEnd(node, m.index + m[0].length);
    const rr = range.getClientRects()[0];
    if (!rr || rr.width === 0) continue;
    const word = upper ? m[0].toUpperCase() : m[0];
    ctx.fillText(word, rr.left * k, (rr.top + rr.height / 2) * k, rr.width * k * 1.05);
  }
  range.detach?.();
}

/** Lukis pohon DOM (urutan dokumen) ke ctx pada skala k. Melempar bila browser menolak (→ jalur canvas saja). */
export function paintDom(ctx, root, k) {
  const walk = (el, clip, alpha) => {
    if (el.matches?.(SKIP)) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const a = alpha * (Number(cs.opacity) || 0);
    if (a <= 0) return;
    const r = el.getBoundingClientRect();
    ctx.save();
    if (clip) { ctx.beginPath(); ctx.rect(clip.l * k, clip.t * k, (clip.r - clip.l) * k, (clip.b - clip.t) * k); ctx.clip(); }
    ctx.globalAlpha = a;
    if (!(el instanceof HTMLInputElement && el.type === 'range')) paintBox(ctx, r, cs, k); // track digambar paintInput
    if (el instanceof HTMLCanvasElement && el.width && el.height && r.width && r.height) ctx.drawImage(el, r.left * k, r.top * k, r.width * k, r.height * k);
    else if (el instanceof HTMLInputElement) paintInput(ctx, el, r, cs, k);
    const childClip = cs.overflowX !== 'visible' || cs.overflowY !== 'visible' ? intersect(clip, rectOf(r)) : clip;
    for (const n of el.childNodes) if (n.nodeType === 3) paintText(ctx, n, cs, k);
    ctx.restore();
    for (const n of el.children) walk(n, childClip, a);
  };
  walk(root, null, 1);
}

/** Canvas saja (3D + grafik), tanpa teks: jalur cadangan. */
export function paintCanvases(ctx, root, k) {
  for (const c of root.querySelectorAll('canvas')) {
    if (c.closest(SKIP)) continue;
    const r = c.getBoundingClientRect();
    if (c.width && c.height && r.width && r.height) ctx.drawImage(c, r.left * k, r.top * k, r.width * k, r.height * k);
  }
}

/** Warna latar dasar halaman (token --bg-0 tema aktif). */
export const pageBackground = () => token('--bg-0') || 'black';

/** Teks footer satu baris di bawah tangkapan. */
export function paintFooter(ctx, text, { x, y, maxWidth, k }) {
  ctx.fillStyle = token('--snap-footer') || token('--muted');
  ctx.font = `${12 * k}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y, maxWidth);
}

/** Simpan canvas sebagai PNG (unduhan). Menolak bila browser tidak bisa mengekspor canvas. */
export function savePng(c, fileName) {
  return new Promise((res, rej) => {
    c.toBlob((blob) => {
      if (!blob) { rej(new Error('toBlob null')); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      res();
    }, 'image/png');
  });
}
