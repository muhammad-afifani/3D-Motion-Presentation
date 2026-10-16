/**
 * route.js — router hash sederhana (M9 Step 06), fungsi murni tanpa dependensi.
 * Alamat:
 *   #/scene/N                   scene N (1–11)
 *   #/scene/9/<tab>             Scene 9 dengan tab: limits | formation | levers | load-window | ghg
 *   #/regulations  #/formation  #/references  #/references/<id>  #/glossary  #/assumptions   halaman penuh
 * Alamat lain / rusak → null (aplikasi memakai scene awal yang tersimpan).
 */
import { SCENE_NUMBERS } from './scenes.js';
import { referenceIdFromHash } from './basisView.js';

/** Halaman penuh, urutan = urutan di navigasi. */
export const PAGES = Object.freeze(['regulations', 'formation', 'references', 'glossary', 'assumptions']);
/** Slug tab Scene 9 di alamat → id tab di store (POLICY.tabs). */
export const SCENE9_TAB_SLUGS = Object.freeze({ limits: 'limits', formation: 'formation', levers: 'levers', 'load-window': 'C', ghg: 'B' });
const TAB_TO_SLUG = Object.freeze(Object.fromEntries(Object.entries(SCENE9_TAB_SLUGS).map(([slug, id]) => [id, slug])));
/** Scene yang punya tab di alamat. */
export const TABBED_SCENE = 9;

/**
 * @param {string} hash location.hash
 * @returns {{type:'scene', n:number, tab:string|null} | {type:'page', page:string, id:string|null} | null}
 */
export function parseHash(hash) {
  const h = String(hash ?? '').replace(/\?.*$/, '').replace(/\/+$/, '');
  let m = /^#\/scene\/(\d{1,2})(?:\/([\w-]+))?$/.exec(h);
  if (m) {
    const n = Number(m[1]);
    if (!SCENE_NUMBERS.includes(n)) return null;
    const tab = n === TABBED_SCENE && m[2] ? SCENE9_TAB_SLUGS[m[2]] ?? null : null;
    return { type: 'scene', n, tab };
  }
  m = /^#\/([a-z]+)(?:\/[^/]+)?$/.exec(h);
  if (m && PAGES.includes(m[1])) {
    if (m[1] === 'references') return { type: 'page', page: 'references', id: referenceIdFromHash(h) };
    if (h !== `#/${m[1]}`) return null; // hanya References yang punya sub-alamat
    return { type: 'page', page: m[1], id: null };
  }
  return null;
}

/** Alamat scene (tab hanya untuk Scene 9). @param {number} n @param {string|null} [tab] id tab store */
export function sceneHash(n, tab = null) {
  const slug = n === TABBED_SCENE && tab ? TAB_TO_SLUG[tab] : null;
  return slug ? `#/scene/${n}/${slug}` : `#/scene/${n}`;
}

/** Alamat halaman. */
export const pageHash = (page) => `#/${page}`;
