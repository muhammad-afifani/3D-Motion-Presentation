/** materials.js — material bersama (logam PBR sederhana, potongan cutaway, gas). */
import * as THREE from 'three';
import { viewportTone, glowBlending } from './viewportTone.js';

/** @param {'dark'|'light'} [tone] tone viewport: nyala/percikan aditif di latar gelap, normal di latar terang */
export function createMaterials(tone = viewportTone()) {
  const glow = glowBlending(tone);
  const m = {
    steel: new THREE.MeshStandardMaterial({ color: 0xb9c0cb, metalness: 0.9, roughness: 0.32 }),
    steelDark: new THREE.MeshStandardMaterial({ color: 0x6c7480, metalness: 0.85, roughness: 0.42 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xd4d9e0, metalness: 0.75, roughness: 0.28 }),
    block: new THREE.MeshStandardMaterial({ color: 0x4a5566, metalness: 0.6, roughness: 0.55, side: THREE.DoubleSide }),
    cut: new THREE.MeshStandardMaterial({ color: 0xc8553d, metalness: 0.2, roughness: 0.7, side: THREE.DoubleSide }),
    linerInner: new THREE.MeshStandardMaterial({ color: 0x8d96a3, metalness: 0.8, roughness: 0.25, side: THREE.BackSide }),
    intake: new THREE.MeshStandardMaterial({ color: 0x5aa9ff, metalness: 0.6, roughness: 0.35 }),
    exhaust: new THREE.MeshStandardMaterial({ color: 0xff8a4c, metalness: 0.6, roughness: 0.35 }),
    gas: new THREE.MeshStandardMaterial({ color: 0x3355aa, emissive: 0x3355aa, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, depthWrite: false, roughness: 1, metalness: 0 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: glow }),
    spark: new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0, depthWrite: false, blending: glow }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, metalness: 0, roughness: 0.4 }),
  };
  return {
    ...m,
    dispose() { for (const v of Object.values(m)) v.dispose(); },
  };
}
