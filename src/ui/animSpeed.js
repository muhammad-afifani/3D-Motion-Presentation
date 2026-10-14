/**
 * animSpeed.js — kontrol bersama "Animation speed" (0,1×–2×) untuk semua scene beranimasi.
 * Hanya store.set(animSpeedPatch(v)); loop utama (main.js) mengalikan dt dengan state.animSpeed.
 */
import { slider } from './controls.js';
import { STR } from './strings.js';
import { ANIM_SPEED } from '../model/presets.js';
import { animSpeedPatch } from '../state/store.js';

const C = STR.common;

/** @param {{get:()=>any, set:(p:any)=>void}} store */
export function animSpeedSlider(store) {
  return slider({
    label: C.animSpeed, min: ANIM_SPEED.min, max: ANIM_SPEED.max, step: ANIM_SPEED.step,
    value: store.get().animSpeed ?? ANIM_SPEED.default,
    format: (v) => C.animSpeedValue(v), tip: C.tips.animSpeed,
    onInput: (v) => store.set(animSpeedPatch(v)),
  });
}
