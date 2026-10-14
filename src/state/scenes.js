/**
 * scenes.js — registry scene (id + nomor) tanpa memuat modul scene. Dipakai jendela utama (main.js,
 * dengan loader lazy) dan jendela presenter (presenter.js) agar keduanya sepakat urutan & nomor scene.
 */
export const SCENE_LIST = Object.freeze([
  { id: 'piston', number: 1 },
  { id: 'cycles', number: 2 },
  { id: 'combustion', number: 3 },
  { id: 'nox', number: 4 },
  { id: 'turbine', number: 5 },
  { id: 'partload', number: 6 },
  { id: 'compressor', number: 7 },
  { id: 'emissions', number: 8 },
  { id: 'policy', number: 9 },
  { id: 'controls', number: 10 },
  { id: 'closing', number: 11 },
].map(Object.freeze));

export const SCENE_NUMBERS = Object.freeze(SCENE_LIST.map((x) => x.number));

/** Nomor scene berikutnya (null bila sudah terakhir). */
export function nextSceneNumber(n) {
  const i = SCENE_NUMBERS.indexOf(n);
  return i >= 0 && i < SCENE_NUMBERS.length - 1 ? SCENE_NUMBERS[i + 1] : null;
}
