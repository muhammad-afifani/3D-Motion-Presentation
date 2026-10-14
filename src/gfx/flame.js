/**
 * flame.js — material nyala prosedural (ShaderMaterial + noise fbm), additive, cocok dengan bloom.
 * Sumbu nyala = koordinat uv.y geometri (0 = pangkal, 1 = ujung). Warna dari frame (flameColor),
 * intensitas (0…1) dari frame (laju pelepasan panas). Tidak ada perhitungan model di sini.
 */
import * as THREE from 'three';

const vert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

const frag = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uFlicker;
  uniform vec3 uColor;
  uniform vec3 uCore;
  uniform float uAlongPow;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  void main() {
    float along = clamp(vUv.y, 0.0, 1.0);
    float rim = 0.35 + 0.65 * pow(abs(dot(normalize(vN), normalize(vView))), 1.2); // lembut di tepi siluet
    float n = fbm(vec2(vUv.x * 6.0, along * 3.0 - uTime * 1.8));
    float body = pow(1.0 - along, uAlongPow) * (0.55 + 0.9 * n * uFlicker + (1.0 - uFlicker) * 0.45);
    // kecerahan naik monoton dengan intensitas; lantai 0,4 agar nyala kecil tetap terbaca (ukuran tetap ∝ intensitas)
    float a = clamp(body * rim * (0.4 + 0.8 * uIntensity), 0.0, 1.0);
    vec3 col = mix(uColor, uCore, rim * (1.0 - along));
    gl_FragColor = vec4(col * (0.5 + 0.7 * uIntensity), a);
  }`;

/**
 * @param {{color?: number[], core?: number[], flicker?: number, alongPow?: number}} [o]
 */
export function createFlameMaterial({ color = [1, 0.6, 0.2], core = [1, 1, 1], flicker = 1, alongPow = 1.2 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uFlicker: { value: flicker },
      uColor: { value: new THREE.Color().setRGB(...color, THREE.SRGBColorSpace) },
      uCore: { value: new THREE.Color().setRGB(...core, THREE.SRGBColorSpace) },
      uAlongPow: { value: alongPow },
    },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/** Perbarui uniform material nyala. rgb 0…1 (sRGB). */
export function setFlame(mat, { time, intensity, color, core }) {
  const u = mat.uniforms;
  if (time != null) u.uTime.value = time;
  if (intensity != null) u.uIntensity.value = intensity;
  if (color) u.uColor.value.setRGB(color[0], color[1], color[2], THREE.SRGBColorSpace);
  if (core) u.uCore.value.setRGB(core[0], core[1], core[2], THREE.SRGBColorSpace);
}
