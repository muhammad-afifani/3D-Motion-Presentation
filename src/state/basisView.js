/**
 * basisView.js — data for the Basis card and the References page.
 * Pure shaping of src/model/basis.js + content/references.json (no thermodynamics, no UI text).
 * Rule: only ids that exist in references.json are shown as sources. An id that is missing there (file edited,
 * entry removed) comes back as `known: false` and the UI shows "source to verify", never an invented citation.
 */
import { BASIS, BASIS_GROUPS, UTILITY } from '../model/basis.js';
import { REFERENCE_TYPES } from './content.js';

export const REFERENCES_HASH = '#/references';
/** true when a location hash opens the References page ("#/references", optionally with a trailing slash/query). */
export const isReferencesHash = (hash) => /^#\/references\/?(\?.*)?$/.test(hash ?? '');

/** spec = group id (string) or array of BASIS keys → { id, keys } with unknown names dropped. */
export function resolveBasis(spec) {
  if (typeof spec === 'string') {
    if (spec in BASIS_GROUPS) return { id: spec, keys: [...BASIS_GROUPS[spec]] };
    return { id: null, keys: spec.split(',').map((x) => x.trim()).filter((k) => k in BASIS) };
  }
  return { id: null, keys: (spec ?? []).filter((k) => k in BASIS) };
}

/**
 * Card content. @param {string|string[]} spec @param {{references:any[]}|null} refsData
 * @returns {{id:string|null, entries:{name:string, level:string, derivation:string, assumptions:string[], toVerify:string[], refs:{id:string, known:boolean, cite?:string, locator?:string, locatorVerified?:boolean}[], noSource:boolean}[], levels:string[]}}
 */
export function cardData(spec, refsData) {
  const { id, keys } = resolveBasis(spec);
  const byId = new Map((refsData?.references ?? []).map((r) => [r.id, r]));
  const entries = keys.map((name) => {
    const b = BASIS[name];
    return {
      name, level: b.level, derivation: b.derivation, assumptions: [...b.assumptions], toVerify: [...b.toVerify],
      refs: b.refs.map((rid) => {
        const r = byId.get(rid);
        return r ? { id: rid, known: true, cite: r.cite, locator: r.locator, locatorVerified: r.locatorVerified === true } : { id: rid, known: false };
      }),
      noSource: b.refs.length === 0,
    };
  });
  return { id, entries, levels: [...new Set(entries.map((x) => x.level))] };
}

/** Names of the entries (and utilities) that cite each reference id. */
export function citedBy() {
  const out = new Map();
  for (const [name, b] of Object.entries(BASIS)) for (const rid of b.refs) (out.get(rid) ?? out.set(rid, []).get(rid)).push(name);
  return out;
}

/** References page: groups in REFERENCE_TYPES order, each item with the functions that cite it. */
export function groupReferences(refsData) {
  const cites = citedBy();
  const list = refsData?.references ?? [];
  return REFERENCE_TYPES.map((type) => ({
    type,
    items: list.filter((r) => r.type === type).map((r) => ({ ...r, locatorVerified: r.locatorVerified === true, citedBy: cites.get(r.id) ?? [] })),
  })).filter((g) => g.items.length);
}

export { UTILITY };
