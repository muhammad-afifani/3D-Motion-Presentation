/**
 * composer.js — EffectComposer + UnrealBloomPass. Ambang tinggi sehingga bloom hanya
 * mengenai nyala/gas sangat panas (emissive), bukan pantulan logam.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.7, 0.4, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    bloom,
    render: () => composer.render(),
    setSize: (w, h) => composer.setSize(w, h),
    setPixelRatio: (k) => composer.setPixelRatio(k),
    dispose: () => composer.dispose(),
  };
}
