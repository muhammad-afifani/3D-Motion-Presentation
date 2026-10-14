/**
 * renderer.js — WebGL2 renderer, kamera, OrbitControls, environment map prosedural, resize.
 * Melempar error bila WebGL tidak tersedia (scene menampilkan layar fallback).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createComposer } from './composer.js';

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

/**
 * @param {HTMLElement} container
 * @param {{fov?:number, camPos?:[number,number,number], target?:[number,number,number], bloom?:boolean}} [opts]
 */
export function createRenderer(container, { fov = 35, camPos = [1, 0.8, 1.6], target = [0, 0.5, 0], bloom = true } = {}) {
  if (!webglAvailable()) throw new Error('WebGL2 tidak tersedia');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.01, 50);
  camera.position.set(...camPos);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...target);
  controls.enableDamping = true;
  controls.minDistance = 0.4;
  controls.maxDistance = 6;
  controls.update();

  // key + rim + fill
  const key = new THREE.DirectionalLight(0xfff1e0, 2.2);
  key.position.set(1.5, 2.5, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1, right: 1, top: 1.5, bottom: -0.5, near: 0.5, far: 6 });
  const rim = new THREE.DirectionalLight(0x6fa8ff, 1.4);
  rim.position.set(-2, 1.2, -1.5);
  scene.add(key, rim, new THREE.HemisphereLight(0x8899bb, 0x10131a, 0.35));

  const composer = bloom ? createComposer(renderer, scene, camera) : null;

  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer?.setSize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  return {
    THREE, renderer, scene, camera, controls,
    render() {
      controls.update();
      if (composer) composer.render(); else renderer.render(scene, camera);
    },
    dispose() {
      ro.disconnect();
      controls.dispose();
      composer?.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
