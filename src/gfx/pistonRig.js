/**
 * pistonRig.js — rig 3D prosedural silinder + piston + batang torak + poros engkol + katup.
 * Hanya membaca `frame`: posisi piston = frame.pistonPos (engineGeometry thermo.js),
 * angkat katup = frame.valveIn/valveEx, warna gas = frame.gasRGB, nyala ∝ frame.dxbNorm.
 * Satuan scene: meter (sama dengan geometri model).
 */
import * as THREE from 'three';
import { createMaterials } from './materials.js';

const DEG = Math.PI / 180;
const CUT_START = 90 * DEG;   // jendela cutaway menghadap kamera (−60°…+90°, diukur dari +Z ke +X)
const CUT_LEN = 210 * DEG;    // bagian dinding yang tetap ada
const CUT_FACES = [CUT_START - 0.004, CUT_START + CUT_LEN + 0.004]; // bidang potongan sedikit di luar sisi padat (tanpa z-fighting)
export const HP = 0.11;       // tinggi kompresi piston (pin → crown), visual
export const VALVE_MAX = 0.016; // angkat katup maksimum (m), visual

/**
 * Dimensi poros engkol (m, visual). Syarat: bigEndW + 2·clearance ≤ webGap (big end muat di celah web).
 * webT termasuk bevel; cwR = jari-jari counterweight dari sumbu poros; cwHalfAngle = setengah sudut sektornya.
 */
export const CRANK = Object.freeze({
  webGap: 0.064, webT: 0.032, webBevel: 0.004,
  journalR: 0.045, journalRTip: 0.034, journalLenL: 0.07, journalLenR: 0.1,
  pinR: 0.042, pinEndR: 0.056,
  bigEndR: 0.062, bigEndW: 0.04, shankW: 0.026,
  cwR: 0.12, cwHalfAngle: 0.95,
  clearance: 0.008,
});
if (CRANK.bigEndW + 2 * CRANK.clearance > CRANK.webGap) throw new Error('CRANK: big end tidak muat di celah web');

/**
 * Garis luar web (bidang xy, sumbu poros di asal, crankpin di (0, a)): sektor counterweight di sisi −y,
 * sisi lengan melengkung (bukan batang lurus) ke ujung crankpin yang membulat.
 * @param {number} a jari-jari engkol (m)
 */
export function crankWebShape(a) {
  const K = CRANK, sh = new THREE.Shape();
  const cx = K.cwR * Math.sin(K.cwHalfAngle), cy = -K.cwR * Math.cos(K.cwHalfAngle);
  sh.moveTo(-cx, cy);
  sh.absarc(0, 0, K.cwR, -Math.PI / 2 - K.cwHalfAngle, -Math.PI / 2 + K.cwHalfAngle, false);
  sh.quadraticCurveTo(K.pinEndR * 1.35, a * 0.35, K.pinEndR, a);
  sh.absarc(0, a, K.pinEndR, 0, Math.PI, false);
  sh.quadraticCurveTo(-K.pinEndR * 1.35, a * 0.35, -cx, cy);
  return sh;
}

/** Sektor cincin (dinding terpotong) setinggi `h`, dasar di y=0. Sudut θ ala three (dari +Z ke +X). */
function annularSector(rIn, rOut, thStart, thLen, h, segs = 48) {
  const shape = new THREE.Shape();
  const p0 = thStart - Math.PI / 2, p1 = thStart + thLen - Math.PI / 2;
  shape.absarc(0, 0, rOut, p0, p1, false);
  if (rIn > 0) shape.absarc(0, 0, rIn, p1, p0, true);
  else shape.lineTo(0, 0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: segs });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Bidang potongan berwarna pada tepi cutaway (sudut θ), dari rIn ke rOut, setinggi h. */
function cutFace(rIn, rOut, th, h) {
  const g = new THREE.PlaneGeometry(rOut - rIn, h);
  g.translate((rIn + rOut) / 2, h / 2, 0);
  g.rotateY(th - Math.PI / 2);
  return g;
}

export function createPistonRig() {
  const mat = createMaterials();
  const geoms = [];
  const G = (g) => { geoms.push(g); return g; };
  const mesh = (g, m, { cast = true, receive = true } = {}) => {
    const o = new THREE.Mesh(G(g), m);
    o.castShadow = cast; o.receiveShadow = receive;
    return o;
  };

  const root = new THREE.Group();
  const anchors = {};
  let geomKey = '';
  let fuel = '';

  // bagian yang dibangun ulang bila geometri mesin berubah
  let staticGroup = null, crank = null, rod = null, piston = null, valves = null, gas = null, flame = null, spark = null, light = null;
  let dims = null;

  function build(g) {
    if (staticGroup) { root.clear(); for (const x of geoms.splice(0)) x.dispose(); }
    const R = g.bore / 2, a = g.a, l = g.conrod, hc = g.hc;
    const deck = l + a + HP + hc;                         // bidang bawah kepala silinder
    const linerBottom = l - a + HP - 0.17;
    dims = { R, a, l, hc, deck };

    staticGroup = new THREE.Group();
    // dinding silinder (cutaway) + potongan berwarna
    const wall = 0.022;
    const liner = mesh(annularSector(R, R + wall, CUT_START, CUT_LEN, deck - linerBottom), mat.block);
    liner.position.y = linerBottom;
    staticGroup.add(liner);
    for (const th of CUT_FACES) {
      const f = mesh(cutFace(R, R + wall, th, deck - linerBottom), mat.cut, { cast: false });
      f.position.y = linerBottom;
      staticGroup.add(f);
    }
    // kepala silinder (cutaway)
    const headH = 0.1;
    const head = mesh(annularSector(0, R + wall + 0.015, CUT_START, CUT_LEN, headH), mat.block);
    head.position.y = deck;
    staticGroup.add(head);
    for (const th of CUT_FACES) {
      const f = mesh(cutFace(0, R + wall + 0.015, th, headH), mat.cut, { cast: false });
      f.position.y = deck;
      staticGroup.add(f);
    }
    root.add(staticGroup);

    // poros engkol (berputar terhadap sumbu Z). Satu throw, sepanjang sumbu z:
    //   journal kiri | web kiri | crankpin (hanya di celah) | web kanan | journal kanan (tirus).
    // Tidak ada geometri poros di antara web selain crankpin (big end berputar di sini).
    const K = CRANK;
    const zWeb = K.webGap / 2 + K.webT / 2;               // pusat tebal web
    const zOut = K.webGap / 2 + K.webT;                   // muka luar web
    crank = new THREE.Group();
    const jL = mesh(new THREE.CylinderGeometry(K.journalR, K.journalR, K.journalLenL, 32), mat.steel);
    jL.rotation.x = Math.PI / 2;                          // sumbu silinder → z
    jL.position.z = -(zOut + K.journalLenL / 2);
    jL.name = 'journalL';
    const jR = mesh(new THREE.CylinderGeometry(K.journalRTip, K.journalR, K.journalLenR, 32), mat.steel); // +y → +z: tirus ke luar
    jR.rotation.x = Math.PI / 2;
    jR.position.z = zOut + K.journalLenR / 2;
    jR.name = 'journalR';
    const pin = mesh(new THREE.CylinderGeometry(K.pinR, K.pinR, K.webGap + K.webT, 32), mat.steel); // ujung tertanam ½ tebal di tiap web
    pin.rotation.x = Math.PI / 2;
    pin.position.y = a;
    pin.name = 'crankpin';
    crank.add(jL, jR, pin);
    // web: pelat berbentuk; ujung crankpin membulat, counterweight di sisi berlawanan (180°)
    const webGeo = new THREE.ExtrudeGeometry(crankWebShape(a), {
      depth: K.webT - 2 * K.webBevel, bevelEnabled: true, bevelSize: K.webBevel, bevelThickness: K.webBevel, bevelSegments: 2, curveSegments: 24,
    });
    webGeo.translate(0, 0, -(K.webT - 2 * K.webBevel) / 2);
    for (const side of [-1, 1]) {
      const w = mesh(side < 0 ? webGeo : webGeo.clone(), mat.steelDark);
      w.position.z = side * zWeb;
      w.name = side < 0 ? 'webL' : 'webR';
      crank.add(w);
    }
    root.add(crank);
    anchors.crank = new THREE.Object3D();
    anchors.crank.position.set(0.12, -0.08, 0.2);
    root.add(anchors.crank);

    // batang torak: titik asal di crankpin, sumbu +Y menuju pin piston
    rod = new THREE.Group();
    const shank = mesh(new THREE.BoxGeometry(0.036, l - 0.08, CRANK.shankW), mat.steel);
    shank.name = 'shank';
    shank.position.y = l / 2;
    const bigEnd = mesh(new THREE.CylinderGeometry(CRANK.bigEndR, CRANK.bigEndR, CRANK.bigEndW, 32), mat.steel);
    bigEnd.name = 'bigEnd';
    bigEnd.rotation.x = Math.PI / 2;
    const smallEnd = mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.04, 24), mat.steel);
    smallEnd.rotation.x = Math.PI / 2;
    smallEnd.position.y = l;
    smallEnd.name = 'smallEnd';
    rod.add(shank, bigEnd, smallEnd);
    anchors.rod = new THREE.Object3D();
    anchors.rod.position.y = l * 0.45;
    rod.add(anchors.rod);
    root.add(rod);

    // piston (titik asal = pin piston)
    piston = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(R - 0.002, R - 0.002, 0.15, 48), mat.alu);
    body.position.y = HP - 0.075;
    piston.add(body);
    for (let i = 0; i < 3; i++) {
      const ring = mesh(new THREE.TorusGeometry(R - 0.0015, 0.0025, 6, 48), mat.steelDark, { cast: false });
      ring.rotation.x = Math.PI / 2;
      ring.position.y = HP - 0.012 - i * 0.012;
      piston.add(ring);
    }
    const ppin = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.17, 24), mat.steelDark);
    ppin.rotation.x = Math.PI / 2;
    piston.add(ppin);
    anchors.piston = new THREE.Object3D();
    anchors.piston.position.set(R * 0.7, HP - 0.05, R * 0.7);
    piston.add(anchors.piston);
    root.add(piston);

    // gas di ruang silinder (crown → deck)
    gas = mesh(new THREE.CylinderGeometry(R - 0.003, R - 0.003, 1, 48), mat.gas, { cast: false, receive: false });
    gas.renderOrder = 2;
    root.add(gas);
    anchors.gas = new THREE.Object3D();
    root.add(anchors.gas);

    // katup masuk (biru, kiri) & buang (oranye, kanan): diletakkan di sisi depan agar tampak lewat cutaway
    valves = {};
    for (const [key, x, m] of [['in', -0.048, mat.intake], ['ex', 0.048, mat.exhaust]]) {
      const v = new THREE.Group();
      const disc = mesh(new THREE.CylinderGeometry(0.034, 0.026, 0.008, 32), m);
      disc.position.y = -0.004;
      const stem = mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.16, 12), m);
      stem.position.y = 0.08;
      const retainer = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.006, 20), mat.steelDark);
      retainer.position.y = 0.155;
      v.add(disc, stem, retainer);
      v.position.set(x, deck, 0.05);
      root.add(v);
      // port (saluran) keluar ke samping
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, deck + 0.012, 0.05),
        new THREE.Vector3(x * 1.6, deck + 0.05, 0.05),
        new THREE.Vector3(Math.sign(x) * 0.26, deck + 0.075, 0.05),
      ]);
      const port = mesh(new THREE.TubeGeometry(curve, 24, 0.022, 16, false), m, { cast: false });
      root.add(port);
      valves[key] = v;
      anchors[key === 'in' ? 'valveIn' : 'valveEx'] = new THREE.Object3D();
      anchors[key === 'in' ? 'valveIn' : 'valveEx'].position.set(Math.sign(x) * 0.24, deck + 0.075, 0.05);
      root.add(anchors[key === 'in' ? 'valveIn' : 'valveEx']);
    }

    // injektor (diesel) / busi (gas) di tengah
    const injector = new THREE.Group();
    injector.add(mesh(new THREE.CylinderGeometry(0.009, 0.006, 0.14, 16), mat.steel));
    injector.children[0].position.y = 0.07;
    injector.position.set(0, deck, 0.0);
    injector.name = 'injector';
    const plug = new THREE.Group();
    const insul = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.07, 16), mat.ceramic);
    insul.position.y = 0.1;
    const shell = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6), mat.steel);
    shell.position.y = 0.035;
    const tip = mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.008, 6), mat.steelDark);
    tip.position.y = -0.004;
    plug.add(insul, shell, tip);
    plug.position.set(0, deck, 0);
    plug.name = 'plug';
    root.add(injector, plug);
    anchors.top = new THREE.Object3D();
    anchors.top.position.set(0, deck + 0.17, 0);
    root.add(anchors.top);

    // nyala: diesel = 6 semburan radial dari injektor; gas = bola muka nyala yang membesar
    flame = new THREE.Group();
    const plumeGeo = G(new THREE.ConeGeometry(0.012, 1, 12, 1, true));
    plumeGeo.translate(0, -0.5, 0);
    plumeGeo.rotateZ(Math.PI); // ujung di asal, mengembang ke +Y
    const plumes = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(plumeGeo, mat.flame);
      const az = (i / 6) * Math.PI * 2;
      p.rotation.order = 'YXZ';
      p.rotation.y = az;
      p.rotation.x = Math.PI / 2 + 0.35; // condong ke bawah
      plumes.add(p);
    }
    plumes.name = 'plumes';
    const kernel = new THREE.Mesh(G(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat.flame); // belahan bawah
    kernel.name = 'kernel';
    flame.add(plumes, kernel);
    flame.position.set(0, deck - 0.004, 0);
    root.add(flame);

    spark = new THREE.Mesh(G(new THREE.SphereGeometry(0.008, 12, 8)), mat.spark);
    spark.position.set(0, deck - 0.008, 0);
    root.add(spark);

    light = new THREE.PointLight(0xffaa66, 0, 0.8, 2);
    light.position.set(0, deck - 0.02, 0);
    root.add(light);
  }

  const tmpColor = new THREE.Color();

  return {
    group: root,
    anchors,
    materials: mat,
    /** Bagian rig untuk verifikasi (tes); hanya untuk dibaca. */
    get parts() { return { crank, rod, piston, valves, gas, dims }; },
    /** @param {any} f frame */
    update(f) {
      const g = f.geom;
      const key = `${g.bore}|${g.stroke}|${g.conrod}|${g.hc.toFixed(6)}`;
      if (key !== geomKey) { geomKey = key; build(g); fuel = ''; }
      if (f.fuel !== fuel) {
        fuel = f.fuel;
        root.getObjectByName('injector').visible = fuel === 'diesel';
        root.getObjectByName('plug').visible = fuel !== 'diesel';
      }
      const { a, l, deck, R } = dims;
      const th = f.theta * DEG;

      // kinematika: crank & pin piston dari state yang sama (pistonPos dari thermo.js)
      crank.rotation.z = -th;
      const cx = a * Math.sin(th), cy = a * Math.cos(th);
      const pinY = l + a - f.pistonPos;
      piston.position.set(0, pinY, 0);
      rod.position.set(cx, cy, 0);
      rod.rotation.z = Math.atan2(-(0 - cx), pinY - cy);

      // gas: dari crown ke deck
      const crown = pinY + HP;
      const h = Math.max(1e-4, deck - crown);
      gas.scale.set(1, h, 1);
      gas.position.y = crown + h / 2;
      tmpColor.setRGB(f.gasRGB[0], f.gasRGB[1], f.gasRGB[2], THREE.SRGBColorSpace);
      mat.gas.color.copy(tmpColor);
      mat.gas.emissive.copy(tmpColor);
      mat.gas.emissiveIntensity = 0.35 + 0.9 * Math.max(0, (f.T - 600) / 2000);
      anchors.gas.position.set(-R * 0.55, crown + h / 2, R * 0.75);

      // katup
      valves.in.position.y = deck - f.valveIn * VALVE_MAX;
      valves.ex.position.y = deck - f.valveEx * VALVE_MAX;

      // nyala ∝ laju pembakaran
      const k = f.dxbNorm;
      tmpColor.setRGB(f.flameRGB[0], f.flameRGB[1], f.flameRGB[2], THREE.SRGBColorSpace);
      mat.flame.color.copy(tmpColor).multiplyScalar(1.6);
      const plumes = flame.getObjectByName('plumes'), kernel = flame.getObjectByName('kernel');
      if (f.fuel === 'diesel') {
        plumes.visible = k > 0.01;
        kernel.visible = false;
        const len = Math.min(R * 0.95, 0.03 + R * 0.9 * k);
        for (const p of plumes.children) p.scale.set(1 + 2.5 * k, len, 1 + 2.5 * k);
        mat.flame.opacity = Math.min(0.9, 0.15 + k);
      } else {
        plumes.visible = false;
        const burning = f.xb > 0.002 && f.xb < 0.995;
        kernel.visible = burning;
        const rad = Math.max(0.006, R * Math.cbrt(f.xb));
        kernel.scale.set(rad, Math.min(rad, Math.max(0.004, h - 0.004)), rad);
        mat.flame.opacity = burning ? Math.min(0.85, 0.12 + 0.9 * k) : 0;
      }
      // percikan busi pada awal pembakaran (θ0 … θ0+3°)
      const dth = f.theta - g.theta0;
      mat.spark.opacity = f.fuel !== 'diesel' && dth >= -0.5 && dth <= 3 ? 1 : 0;
      light.color.copy(tmpColor);
      light.intensity = 3 * k;
    },
    dispose() {
      for (const x of geoms.splice(0)) x.dispose();
      mat.dispose();
      root.clear();
    },
  };
}
