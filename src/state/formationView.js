/**
 * formationView.js — data kartu Formation (Scene 9) dari content/emission_formation.json + references.json.
 * Pure shaping, tanpa angka model dan tanpa teks UI. Teks pasangan { en, id } dipilih bahasa aktif lewat tl() saat kartu dibentuk. Sumber yang tidak ada di references.json → known:false
 * (UI menulis "source to verify"). Tautan sumber memakai alamat #/references/<id>.
 */
import { EQUIPMENT } from './regulations.js';
import { tl } from './langStore.js';

/** Alamat halaman References untuk satu sumber. */
export const referenceHref = (id) => `#/references/${encodeURIComponent(id)}`;

/**
 * Pecah rumus reaksi menjadi potongan teks dan subskrip: angka setelah huruf atau ')' = subskrip (N2 → N₂);
 * koefisien di depan spesies (2 NO, 1/2 O2) tetap teks biasa. '<=>' → '⇌', '=>' → '→'.
 * @param {string} s @returns {{t:string, sub:boolean}[]}
 */
export function chemTokens(s) {
  const src = String(s).replace(/<=>/g, '⇌').replace(/=>/g, '→');
  const out = [];
  const push = (t, sub) => { if (!t) return; const last = out[out.length - 1]; if (last && last.sub === sub) last.t += t; else out.push({ t, sub }); };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (/\d/.test(c)) {
      const prev = src[i - 1] ?? '';
      push(c, /[A-Za-z)]/.test(prev) || (/\d/.test(prev) && out[out.length - 1]?.sub === true));
    } else push(c, false);
  }
  return out;
}

/**
 * Kartu untuk equipment aktif (kunci EQUIPMENT di store: dieselEngine / gasEngine / gasTurbine).
 * @returns {{equipment:string|null, label:string|null, cards:any[]}}
 */
export function formationCards(data, equip, refsData) {
  const key = EQUIPMENT[equip]?.formation ?? null;
  const eq = key ? data?.equipment?.[key] : null;
  const byId = new Map((refsData?.references ?? []).map((r) => [r.id, r]));
  const ref = (id) => (byId.has(id) ? { id, known: true, cite: byId.get(id).cite, href: referenceHref(id) } : { id, known: false });
  if (!eq) return { equipment: key, label: null, cards: [] };
  const cards = Object.entries(eq.params).map(([param, p]) => ({
    param, modeled: p.modeled,
    summary: tl(p.formation.summary), reactionsName: chemTokens(tl(p.formation.reactionsName)), rateNote: p.formation.rateNote ? tl(p.formation.rateNote) : '',
    reactions: p.formation.reactions.map(chemTokens),
    refs: p.formation.refs.map(ref),
    drivers: p.drivers.map((d) => ({ ...d, label: tl(d.label), why: tl(d.why) })),
    levers: p.levers.map((l) => ({ id: l.id, label: tl(l.label), effects: Object.entries(l.effects).map(([k, v]) => ({ key: k, dir: v })), consequence: tl(l.consequence), refs: (l.refs ?? []).map(ref) })),
  }));
  return { equipment: key, label: tl(eq.label), cards };
}
