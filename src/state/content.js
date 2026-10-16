/**
 * content.js — konten presenter: Scene 10–11 (content/controls.json, content/closing.json) dan catatan
 * mode presenter (content/presenter.json, M8a), daftar sumber (content/references.json, M9 Step 02), dan baku mutu
 * (content/regulations.json, M9 Step 03: angka limit hanya ada di file ini, tidak pernah di kode), dan glossary
 * (content/glossary.json, M9 Step 06: definisi istilah saja, tanpa angka).
 * Dimuat saat runtime dari `${BASE_URL}content/…` (bisa diedit di dist/content/ tanpa build ulang), dengan
 * fallback bawaan yang dibundel dari file sumber yang sama. Tidak pernah throw:
 *   - file tidak bisa di-fetch (tanpa server, 404, atau fallback SPA index.html) → fallback bawaan, TANPA galat
 *   - file ditemukan tetapi JSON rusak / skema salah → fallback bawaan + daftar galat (nama file, bidang)
 * Teks konten bukan hasil model dan tidak boleh memuat angka termodinamika/emisi (dijaga tests/content.test.js).
 */
import controlsFallback from '../../content/controls.json';
import closingFallback from '../../content/closing.json';
import presenterFallback from '../../content/presenter.json';
import referencesFallback from '../../content/references.json';
import regulationsFallback from '../../content/regulations.json';
import formationFallback from '../../content/emission_formation.json';
import glossaryFallback from '../../content/glossary.json';

export const CONTENT_FILES = Object.freeze({ controls: 'controls.json', closing: 'closing.json', presenter: 'presenter.json', references: 'references.json', regulations: 'regulations.json', formation: 'emission_formation.json', glossary: 'glossary.json' });
export const MACHINES = Object.freeze(['diesel', 'gas', 'turbine']);
export const CARD_FIELDS = Object.freeze(['lowers', 'raises', 'efficiency', 'operation']);
const FALLBACK = { controls: controlsFallback, closing: closingFallback, presenter: presenterFallback, references: referencesFallback, regulations: regulationsFallback, formation: formationFallback, glossary: glossaryFallback };
/** Cara model menghitung tiap parameter (kartu Formation, Scene 9) dan arah efek/pendorong. */
export const FORMATION_MODELED = Object.freeze(['calibrated', 'mass-balance', 'semi-empirical', 'qualitative', 'site-input']);
export const FORMATION_DIRECTIONS = Object.freeze(['up', 'down', 'flat', 'mixed']);
/** Satuan limit yang diizinkan di regulations.json dan bahan bakar per baris. */
export const REG_UNITS = Object.freeze(['mg/Nm3', '%']);
export const REG_FUELS = Object.freeze(['oil', 'gas']);
/** Jenis sumber di references.json (urutan = urutan kelompok di halaman References). */
export const REFERENCE_TYPES = Object.freeze(['book', 'paper', 'standard', 'regulation', 'database', 'report']);
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

/**
 * Validasi references.json: { version: 1, references: [{ id, type, cite, use, locator, locatorVerified }] }.
 * id unik (huruf kecil/angka/-); locator boleh kosong; locatorVerified wajib boolean (hanya pemilik proyek yang
 * mengubahnya menjadi true).
 */
export function validateReferences(j) {
  const e = [];
  if (!j || typeof j !== 'object' || Array.isArray(j)) return [{ field: '(root)', code: 'notObject' }];
  if (j.version !== 1) e.push({ field: 'version', code: 'version' });
  if (!Array.isArray(j.references) || !j.references.length) return [...e, { field: 'references', code: 'array' }];
  const ids = new Set();
  j.references.forEach((r, i) => {
    const f = (k) => `references[${i}].${k}`;
    if (!r || typeof r !== 'object') { e.push({ field: `references[${i}]`, code: 'notObject' }); return; }
    if (!isText(r.id) || !/^[a-z0-9][a-z0-9-]*$/.test(r.id)) e.push({ field: f('id'), code: 'refId' });
    else if (ids.has(r.id)) e.push({ field: f('id'), code: 'duplicate' });
    else ids.add(r.id);
    if (!REFERENCE_TYPES.includes(r.type)) e.push({ field: f('type'), code: 'refType' });
    if (!isText(r.cite)) e.push({ field: f('cite'), code: 'text' });
    if (!isText(r.use)) e.push({ field: f('use'), code: 'text' });
    if (typeof r.locator !== 'string') e.push({ field: f('locator'), code: 'string' });
    if (typeof r.locatorVerified !== 'boolean') e.push({ field: f('locatorVerified'), code: 'boolean' });
  });
  return e;
}

/**
 * Validasi regulations.json (skema: docs/m9_pack/seeds/regulations.seed.json).
 * sources[{id, title, short, url}] unik; groups[{id, equipment, source ∈ sources, verified:boolean,
 * basis{refO2Pct:number, dry:boolean, TrefC:number, PatmAbs:number, NOxAs}, capacityClasses[{id,label,minKW,maxKW}],
 * rows[{class ∈ capacityClasses, fuel ∈ REG_FUELS, param, limit > 0, unit ∈ REG_UNITS, method}], notes[]}].
 */
export function validateRegulations(j) {
  const e = [];
  if (!j || typeof j !== 'object' || Array.isArray(j)) return [{ field: '(root)', code: 'notObject' }];
  if (j.version !== 1) e.push({ field: 'version', code: 'version' });
  const num = (x) => typeof x === 'number' && Number.isFinite(x);
  const numOrNull = (x) => x === null || num(x);
  const srcIds = new Set();
  if (!Array.isArray(j.sources) || !j.sources.length) e.push({ field: 'sources', code: 'array' });
  else j.sources.forEach((s, i) => {
    const f = (k) => `sources[${i}].${k}`;
    if (!s || typeof s !== 'object') { e.push({ field: `sources[${i}]`, code: 'notObject' }); return; }
    if (!isText(s.id)) e.push({ field: f('id'), code: 'text' });
    else if (srcIds.has(s.id)) e.push({ field: f('id'), code: 'duplicate' });
    else srcIds.add(s.id);
    for (const k of ['title', 'short', 'url']) if (!isText(s[k])) e.push({ field: f(k), code: 'text' });
  });
  if (!Array.isArray(j.groups) || !j.groups.length) return [...e, { field: 'groups', code: 'array' }];
  const gIds = new Set();
  j.groups.forEach((g, gi) => {
    const f = (k) => `groups[${gi}].${k}`;
    if (!g || typeof g !== 'object') { e.push({ field: `groups[${gi}]`, code: 'notObject' }); return; }
    if (!isText(g.id)) e.push({ field: f('id'), code: 'text' });
    else if (gIds.has(g.id)) e.push({ field: f('id'), code: 'duplicate' });
    else gIds.add(g.id);
    if (!isText(g.equipment)) e.push({ field: f('equipment'), code: 'text' });
    if (!srcIds.has(g.source)) e.push({ field: f('source'), code: 'regSource' });
    if (typeof g.verified !== 'boolean') e.push({ field: f('verified'), code: 'boolean' });
    const b = g.basis;
    if (!b || typeof b !== 'object') e.push({ field: f('basis'), code: 'notObject' });
    else {
      if (!num(b.refO2Pct) || b.refO2Pct < 0 || b.refO2Pct >= 21) e.push({ field: f('basis.refO2Pct'), code: 'regO2' });
      if (typeof b.dry !== 'boolean') e.push({ field: f('basis.dry'), code: 'boolean' });
      if (!num(b.TrefC)) e.push({ field: f('basis.TrefC'), code: 'number' });
      if (!num(b.PatmAbs) || b.PatmAbs <= 0) e.push({ field: f('basis.PatmAbs'), code: 'number' });
      if (!isText(b.NOxAs)) e.push({ field: f('basis.NOxAs'), code: 'text' });
    }
    const cls = new Set();
    if (!Array.isArray(g.capacityClasses) || !g.capacityClasses.length) e.push({ field: f('capacityClasses'), code: 'array' });
    else g.capacityClasses.forEach((c, ci) => {
      const fc = (k) => `groups[${gi}].capacityClasses[${ci}].${k}`;
      if (!c || !isText(c.id)) { e.push({ field: fc('id'), code: 'text' }); return; }
      if (cls.has(c.id)) e.push({ field: fc('id'), code: 'duplicate' });
      cls.add(c.id);
      if (!isText(c.label)) e.push({ field: fc('label'), code: 'text' });
      if (!numOrNull(c.minKW) || !numOrNull(c.maxKW)) e.push({ field: fc('minKW'), code: 'numberOrNull' });
    });
    if (!Array.isArray(g.rows) || !g.rows.length) e.push({ field: f('rows'), code: 'array' });
    else g.rows.forEach((r, ri) => {
      const fr = (k) => `groups[${gi}].rows[${ri}].${k}`;
      if (!r || typeof r !== 'object') { e.push({ field: `groups[${gi}].rows[${ri}]`, code: 'notObject' }); return; }
      if (!cls.has(r.class)) e.push({ field: fr('class'), code: 'regClass' });
      if (!REG_FUELS.includes(r.fuel)) e.push({ field: fr('fuel'), code: 'regFuel' });
      if (!isText(r.param)) e.push({ field: fr('param'), code: 'text' });
      if (!num(r.limit) || r.limit <= 0) e.push({ field: fr('limit'), code: 'positive' });
      if (!REG_UNITS.includes(r.unit)) e.push({ field: fr('unit'), code: 'regUnit' });
      if (!isText(r.method)) e.push({ field: fr('method'), code: 'text' });
    });
    if (g.notes != null && !(Array.isArray(g.notes) && g.notes.every(isText))) e.push({ field: f('notes'), code: 'textList' });
  });
  return e;
}

/**
 * Validasi emission_formation.json (skema: docs/m9_pack/seeds/emission_formation.seed.json):
 * { version: 1, equipment: { <id>: { label, params: { <param>: { modeled ∈ FORMATION_MODELED,
 *   formation: { summary, reactions[], reactionsName, rateNote (boleh kosong), refs[] }, drivers: [{ id, label, direction, why }],
 *   levers: [{ id, label, effects: { <key>: direction }, consequence, refs[] }] } } } } }.
 * Hanya bentuk yang diperiksa; id sumber divalidasi terhadap references.json saat tampil ("source to verify" bila hilang).
 */
export function validateFormation(j) {
  const e = [];
  if (!j || typeof j !== 'object' || Array.isArray(j)) return [{ field: '(root)', code: 'notObject' }];
  if (j.version !== 1) e.push({ field: 'version', code: 'version' });
  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  const textArr = (x) => Array.isArray(x) && x.every(isText);
  if (!isObj(j.equipment) || !Object.keys(j.equipment).length) return [...e, { field: 'equipment', code: 'notObject' }];
  for (const [ek, ev] of Object.entries(j.equipment)) {
    const fe = (k) => `equipment.${ek}.${k}`;
    if (!isObj(ev)) { e.push({ field: `equipment.${ek}`, code: 'notObject' }); continue; }
    if (!isText(ev.label)) e.push({ field: fe('label'), code: 'text' });
    if (!isObj(ev.params) || !Object.keys(ev.params).length) { e.push({ field: fe('params'), code: 'notObject' }); continue; }
    for (const [pk, pv] of Object.entries(ev.params)) {
      const fp = (k) => `equipment.${ek}.params.${pk}.${k}`;
      if (!isObj(pv)) { e.push({ field: `equipment.${ek}.params.${pk}`, code: 'notObject' }); continue; }
      if (!FORMATION_MODELED.includes(pv.modeled)) e.push({ field: fp('modeled'), code: 'formModeled' });
      const f = pv.formation;
      if (!isObj(f)) e.push({ field: fp('formation'), code: 'notObject' });
      else {
        for (const k of ['summary', 'reactionsName']) if (!isText(f[k])) e.push({ field: fp(`formation.${k}`), code: 'text' });
        if (typeof f.rateNote !== 'string') e.push({ field: fp('formation.rateNote'), code: 'string' }); // boleh kosong (mis. CO₂)
        if (!textArr(f.reactions)) e.push({ field: fp('formation.reactions'), code: 'textList' });
        if (!textArr(f.refs)) e.push({ field: fp('formation.refs'), code: 'textList' });
      }
      if (!Array.isArray(pv.drivers)) e.push({ field: fp('drivers'), code: 'array' });
      else pv.drivers.forEach((d, i) => {
        if (!isObj(d) || !isText(d.id) || !isText(d.label) || !isText(d.why)) e.push({ field: fp(`drivers[${i}]`), code: 'text' });
        else if (!FORMATION_DIRECTIONS.includes(d.direction)) e.push({ field: fp(`drivers[${i}].direction`), code: 'formDirection' });
      });
      if (!Array.isArray(pv.levers)) e.push({ field: fp('levers'), code: 'array' });
      else pv.levers.forEach((l, i) => {
        if (!isObj(l) || !isText(l.id) || !isText(l.label) || !isText(l.consequence)) { e.push({ field: fp(`levers[${i}]`), code: 'text' }); return; }
        if (!isObj(l.effects) || !Object.values(l.effects).every((v) => FORMATION_DIRECTIONS.includes(v))) e.push({ field: fp(`levers[${i}].effects`), code: 'formDirection' });
        if (!textArr(l.refs ?? [])) e.push({ field: fp(`levers[${i}].refs`), code: 'textList' });
      });
    }
  }
  return e;
}

/**
 * Validasi glossary.json: { version: 1, terms: [{ id, term, expansion?, definition, refs?: [id], scenes?: [n] }] }.
 * Definisi saja: teks term / expansion / definition tidak boleh memuat angka (limit dan faktor tidak ditulis di sini).
 * Id sumber diperiksa terhadap references.json saat tampil ("source to verify" bila hilang) dan di tes.
 */
export function validateGlossary(j, sceneNumbers = DEFAULT_SCENES) {
  const e = [];
  if (!j || typeof j !== 'object' || Array.isArray(j)) return [{ field: '(root)', code: 'notObject' }];
  if (j.version !== 1) e.push({ field: 'version', code: 'version' });
  if (!Array.isArray(j.terms) || !j.terms.length) return [...e, { field: 'terms', code: 'array' }];
  const ids = new Set();
  j.terms.forEach((t, i) => {
    const f = (k) => `terms[${i}].${k}`;
    if (!t || typeof t !== 'object' || Array.isArray(t)) { e.push({ field: `terms[${i}]`, code: 'notObject' }); return; }
    if (!isText(t.id) || !/^[a-z0-9-]+$/.test(t.id)) e.push({ field: f('id'), code: 'refId' });
    else if (ids.has(t.id)) e.push({ field: f('id'), code: 'duplicate' });
    else ids.add(t.id);
    for (const k of ['term', 'definition']) if (!isText(t[k])) e.push({ field: f(k), code: 'text' });
    if (t.expansion != null && !isText(t.expansion)) e.push({ field: f('expansion'), code: 'text' });
    for (const k of ['term', 'expansion', 'definition']) if (typeof t[k] === 'string' && /[0-9]/.test(t[k])) e.push({ field: f(k), code: 'noNumbers' });
    if (t.refs != null && !(Array.isArray(t.refs) && t.refs.every((x) => isText(x) && /^[a-z0-9-]+$/.test(x)))) e.push({ field: f('refs'), code: 'refId' });
    if (t.scenes != null && !(Array.isArray(t.scenes) && t.scenes.every((n) => sceneNumbers.includes(n)))) e.push({ field: f('scenes'), code: 'scenes' });
  });
  return e;
}

/** Catatan presenter untuk scene n (null bila tidak ada). */
export const presenterNotes = (data, n) => data?.scenes?.find((x) => x.number === n) ?? null;

const VALIDATE = { controls: validateControls, closing: (j) => validateClosing(j), presenter: validatePresenter, references: (j) => validateReferences(j), regulations: (j) => validateRegulations(j), formation: (j) => validateFormation(j), glossary: validateGlossary };

/**
 * Muat konten. @param {'controls'|'closing'|'presenter'|'references'|'regulations'|'formation'|'glossary'} kind
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
  const errors = VALIDATE[kind](json, sceneNumbers);
  return errors.length ? fallback(errors) : { data: json, source: 'file', file, errors: [] };
}

/** Konten bawaan (sinkron) — dipakai sebelum fetch selesai. */
export const fallbackContent = (kind) => FALLBACK[kind];
