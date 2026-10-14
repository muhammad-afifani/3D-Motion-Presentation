/**
 * content.js — konten presenter: Scene 10–11 (content/controls.json, content/closing.json) dan catatan
 * mode presenter (content/presenter.json, M8a).
 * Dimuat saat runtime dari `${BASE_URL}content/…` (bisa diedit di dist/content/ tanpa build ulang), dengan
 * fallback bawaan yang dibundel dari file sumber yang sama. Tidak pernah throw:
 *   - file tidak bisa di-fetch (tanpa server, 404, atau fallback SPA index.html) → fallback bawaan, TANPA galat
 *   - file ditemukan tetapi JSON rusak / skema salah → fallback bawaan + daftar galat (nama file, bidang)
 * Teks konten bukan hasil model dan tidak boleh memuat angka termodinamika/emisi (dijaga tests/content.test.js).
 */
import controlsFallback from '../../content/controls.json';
import closingFallback from '../../content/closing.json';
import presenterFallback from '../../content/presenter.json';

export const CONTENT_FILES = Object.freeze({ controls: 'controls.json', closing: 'closing.json', presenter: 'presenter.json' });
export const MACHINES = Object.freeze(['diesel', 'gas', 'turbine']);
export const CARD_FIELDS = Object.freeze(['lowers', 'raises', 'efficiency', 'operation']);
const FALLBACK = { controls: controlsFallback, closing: closingFallback, presenter: presenterFallback };
/** Batas atas target durasi per scene (menit) di presenter.json. */
export const TARGET_MIN_MAX = 120;
const DEFAULT_SCENES = Array.from({ length: 11 }, (_, i) => i + 1);

/** URL fetch konten untuk base Vite (Pages '/<repo>/', offline './', dev '/'). */
export function contentUrl(file, base = import.meta.env?.BASE_URL ?? '/') {
  return `${base.endsWith('/') ? base : `${base}/`}content/${file}`;
}

const isText = (x) => typeof x === 'string' && x.trim().length > 0;
const isTextList = (x) => Array.isArray(x) && x.length > 0 && x.every(isText);

/**
 * Validasi controls.json. @returns {{field:string, code:string}[]} kosong bila valid.
 * Kode galat dipetakan ke teks di ui/strings.js (STR.content.codes).
 */
export function validateControls(j, sceneNumbers = DEFAULT_SCENES) {
  const e = [];
  if (!j || typeof j !== 'object' || Array.isArray(j)) return [{ field: '(root)', code: 'notObject' }];
  if (j.version !== 1) e.push({ field: 'version', code: 'version' });
  if (!Array.isArray(j.cards) || !j.cards.length) return [...e, { field: 'cards', code: 'array' }];
  const ids = new Set();
  j.cards.forEach((c, i) => {
    const f = (k) => `cards[${i}].${k}`;
    if (!c || typeof c !== 'object') { e.push({ field: `cards[${i}]`, code: 'notObject' }); return; }
    if (!isText(c.id)) e.push({ field: f('id'), code: 'text' });
    else if (ids.has(c.id)) e.push({ field: f('id'), code: 'duplicate' });
    else ids.add(c.id);
    if (!isText(c.name)) e.push({ field: f('name'), code: 'text' });
    for (const k of ['lowers', 'raises', 'operation']) if (!isTextList(c[k])) e.push({ field: f(k), code: 'textList' });
    if (!isText(c.efficiency)) e.push({ field: f('efficiency'), code: 'text' });
    if (!Array.isArray(c.appliesTo) || !c.appliesTo.length || !c.appliesTo.every((m) => MACHINES.includes(m))) e.push({ field: f('appliesTo'), code: 'machines' });
    if (!Array.isArray(c.relatedScenes) || !c.relatedScenes.every((n) => sceneNumbers.includes(n))) e.push({ field: f('relatedScenes'), code: 'scenes' });
  });
  return e;
}

/** Validasi closing.json: tepat 3 poin teks + opsi { id, text } unik. */
export function validateClosing(j) {
  const e = [];
  if (!j || typeof j !== 'object' || Array.isArray(j)) return [{ field: '(root)', code: 'notObject' }];
  if (j.version !== 1) e.push({ field: 'version', code: 'version' });
  if (!Array.isArray(j.points) || j.points.length !== 3 || !j.points.every(isText)) e.push({ field: 'points', code: 'threePoints' });
  if (!Array.isArray(j.options) || !j.options.length) e.push({ field: 'options', code: 'array' });
  else {
    const ids = new Set();
    j.options.forEach((o, i) => {
      if (!o || !isText(o.id)) e.push({ field: `options[${i}].id`, code: 'text' });
      else if (ids.has(o.id)) e.push({ field: `options[${i}].id`, code: 'duplicate' });
      else ids.add(o.id);
      if (!o || !isText(o.text)) e.push({ field: `options[${i}].text`, code: 'text' });
    });
  }
  return e;
}

/**
 * Validasi presenter.json: { version: 1, scenes: [{ number, keyMessage, notes[], targetMin? }] }.
 * number unik dan termasuk scene aplikasi; targetMin opsional (menit, > 0 dan ≤ TARGET_MIN_MAX).
 */
export function validatePresenter(j, sceneNumbers = DEFAULT_SCENES) {
  const e = [];
  if (!j || typeof j !== 'object' || Array.isArray(j)) return [{ field: '(root)', code: 'notObject' }];
  if (j.version !== 1) e.push({ field: 'version', code: 'version' });
  if (!Array.isArray(j.scenes) || !j.scenes.length) return [...e, { field: 'scenes', code: 'array' }];
  const seen = new Set();
  j.scenes.forEach((sc, i) => {
    const f = (k) => `scenes[${i}].${k}`;
    if (!sc || typeof sc !== 'object') { e.push({ field: `scenes[${i}]`, code: 'notObject' }); return; }
    if (!sceneNumbers.includes(sc.number)) e.push({ field: f('number'), code: 'scenes' });
    else if (seen.has(sc.number)) e.push({ field: f('number'), code: 'duplicate' });
    else seen.add(sc.number);
    if (!isText(sc.keyMessage)) e.push({ field: f('keyMessage'), code: 'text' });
    if (!isTextList(sc.notes)) e.push({ field: f('notes'), code: 'textList' });
    if (sc.targetMin != null && !(typeof sc.targetMin === 'number' && sc.targetMin > 0 && sc.targetMin <= TARGET_MIN_MAX)) e.push({ field: f('targetMin'), code: 'minutes' });
  });
  return e;
}

/** Catatan presenter untuk scene n (null bila tidak ada). */
export const presenterNotes = (data, n) => data?.scenes?.find((x) => x.number === n) ?? null;

const VALIDATE = { controls: validateControls, closing: (j) => validateClosing(j), presenter: validatePresenter };

/**
 * Muat konten. @param {'controls'|'closing'|'presenter'} kind
 * @returns {Promise<{data:any, source:'file'|'fallback', file:string, errors:{field:string, code:string, detail?:string}[]}>}
 */
export async function loadContent(kind, { fetchFn = globalThis.fetch, base, sceneNumbers } = {}) {
  const file = CONTENT_FILES[kind];
  const fallback = (errors = []) => ({ data: FALLBACK[kind], source: 'fallback', file, errors });
  let text;
  try {
    const res = await fetchFn(contentUrl(file, base), { cache: 'no-store' });
    if (!res || !res.ok) return fallback();          // tidak ada file / 404 → fallback tanpa galat
    // server dengan fallback SPA (mis. vite preview) mengembalikan index.html (200) untuk file yang tidak ada
    if (/html/i.test(res.headers?.get?.('content-type') ?? '')) return fallback();
    text = await res.text();
    if (/^\s*</.test(text)) return fallback();
  } catch {
    return fallback();                                // tanpa server (file://), jaringan → fallback tanpa galat
  }
  let json;
  try { json = JSON.parse(text); } catch (err) { return fallback([{ field: '(json)', code: 'parse', detail: String(err.message ?? err) }]); }
  const errors = kind === 'closing' ? VALIDATE.closing(json) : VALIDATE[kind](json, sceneNumbers);
  return errors.length ? fallback(errors) : { data: json, source: 'file', file, errors: [] };
}

/** Konten bawaan (sinkron) — dipakai sebelum fetch selesai. */
export const fallbackContent = (kind) => FALLBACK[kind];
