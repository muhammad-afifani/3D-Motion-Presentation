/**
 * renderer.js — WebGL2 renderer, kamera, OrbitControls, environment map prosedural, resize.
 * Melempar error bila WebGL tidak tersedia (scene menampilkan layar fallback).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createComposer } from './composer.js';

/** Renderer aktif (snapshot PNG 2×, overlay debug, kualitas). */
const ACTIVE = new Set();
/** Log dispose (uji kebocoran): sumber daya GPU yang masih tercatat tepat sebelum renderer dilepas. */
const DISPOSE_LOG = [];
export const disposeLog = () => DISPOSE_LOG.slice();

/** Statistik renderer aktif untuk overlay debug (renderer.info; dihitung ulang tiap gfx.render()). */
export function rendererStats() {
  const out = { count: ACTIVE.size, calls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0, pixelRatio: null, bloom: false, software: null, gpu: null };
  for (const r of ACTIVE) {
    const i = r.renderer.info;
    out.calls += i.render.calls; out.triangles += i.render.triangles;
    out.geometries += i.memory.geometries; out.textures += i.memory.textures; out.programs += i.programs?.length ?? 0;
    out.pixelRatio = r.renderer.getPixelRatio(); out.bloom ||= r.bloomActive();
    const g = gpuName(r.renderer);
    out.gpu = g; out.software = isSoftwareGpu(g);
  }
  return out;
}

/** Nama GPU dari WEBGL_debug_renderer_info (null bila disembunyikan browser). */
export function gpuName(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : null;
  } catch {
    return null;
  }
}
/** true bila rendering software (SwiftShader / llvmpipe / software rasterizer): fps bukan fps GPU. */
export const isSoftwareGpu = (name) => (name == null ? null : /swiftshader|llvmpipe|software|softpipe|basic render/i.test(name));
/** Tampilan global dari pengontrol kualitas (gfx/quality.js): batas pixel ratio + bloom. */
const display = { pixelRatioCap: null, bloom: false };
let exportScale = null;
const basePixelRatio = () => exportScale ?? Math.min(globalThis.devicePixelRatio || 1, 1.5, display.pixelRatioCap ?? Infinity);

/** Snapshot: set pixel ratio semua renderer aktif ke `k` (null = kembali ke pixel ratio kualitas saat ini). */
export function setRendererExportScale(k = null) {
  exportScale = k;
  for (const r of ACTIVE) r.setScale(basePixelRatio());
}

/** Kualitas: batas pixel ratio (null = normal) dan bloom global; berlaku untuk semua renderer aktif & berikutnya. */
export function setRendererDisplay({ pixelRatioCap = null, bloom = false } = {}) {
  const prChanged = pixelRatioCap !== display.pixelRatioCap;
  display.pixelRatioCap = pixelRatioCap;
  display.bloom = !!bloom;
  if (prChanged) for (const r of ACTIVE) r.setScale(basePixelRatio());
}

let webglOk = null;
/** Cek WebGL2 sekali (hasil di-cache; konteks probe langsung dilepas agar tidak menambah konteks aktif). */
export function webglAvailable() {
  if (webglOk != null) return webglOk;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    webglOk = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglOk = false;
  }
  return webglOk;
}

/**
 * @param {HTMLElement} container
 * Bloom mengikuti pengaturan global (setRendererDisplay); composer dibuat lazy saat bloom pertama kali menyala.
 * @param {{fov?:number, camPos?:[number,number,number], target?:[number,number,number], allowBloom?:boolean}} [opts]
 */
export function createRenderer(container, { fov = 35, camPos = [1, 0.8, 1.6], target = [0, 0.5, 0], allowBloom = true } = {}) {
  if (!webglAvailable()) throw new Error('WebGL2 tidak tersedia');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(basePixelRatio());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false; // reset manual per frame: draw call bloom (beberapa pass) ikut terhitung
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envRT = pmrem.fromScene(room, 0.04);
  const envTex = envRT.texture;
  room.dispose?.(); // geometri/material ruangan hanya dipakai sekali untuk environment map
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

  let composer = null;
  const bloomOn = () => allowBloom && display.bloom;

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
  const entry = { renderer, bloomActive: bloomOn, setScale(k) { renderer.setPixelRatio(k); composer?.setPixelRatio(k); resize(); } };
  ACTIVE.add(entry);

  return {
    THREE, renderer, scene, camera, controls,
    render() {
      controls.update();
      renderer.info.reset();
      if (bloomOn()) {
        if (!composer) {
          composer = createComposer(renderer, scene, camera);
          composer.setPixelRatio(renderer.getPixelRatio());
          composer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
        }
        composer.render();
      } else renderer.render(scene, camera);
    },
    get bloomOn() { return bloomOn(); },
    dispose() {
      ACTIVE.delete(entry);
      ro.disconnect();
      controls.dispose();
      composer?.dispose();
      envRT.dispose();
      pmrem.dispose();
      scene.traverse((o) => { if (o.isLight) o.shadow?.dispose?.(); });
      // sisa sumber daya setelah rig & milik renderer dilepas → harus 0 (uji dispose, scripts/e2e)
      DISPOSE_LOG.push({ geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures });
      if (DISPOSE_LOG.length > 200) DISPOSE_LOG.shift();
      renderer.dispose();
      renderer.forceContextLoss(); // lepas konteks WebGL sekarang (jangan tunggu GC; batas ±16 konteks aktif)
      renderer.domElement.remove();
    },
  };
}
