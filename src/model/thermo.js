/**
 * thermo.js — Model termodinamika & emisi untuk presentasi 3D mesin/turbin
 *
 * ES module murni (tanpa dependensi, tanpa side effect). Jalan di browser dan Node.
 *
 * Satuan: SI (K, Pa, J/kg, kg/s, m, W) kecuali dinyatakan lain.
 * Sudut engkol: derajat, 0 = TDC pembakaran (ATDC). 4-tak: -360..+360.
 *   -360→-180 intake | -180→0 kompresi | 0→180 ekspansi | 180→360 exhaust
 *
 * Tingkat model:
 *   A. Ideal air-standard      : otto, diesel, dual, braytonIdeal
 *   B. Real (efisiensi komponen): braytonReal, singleShaftLoad, twinShaft, gasCompressor
 *   C. Semi-empiris engine      : cylinderSim (crank-slider + Wiebe + hukum pertama, k(T))
 *
 * PERINGATAN: korelasi emisi (NOx, CO) bersifat INDIKATIF. Bentuk/tren benar
 * (Arrhenius untuk NOx, jendela suhu untuk CO), angka absolut harus dikalibrasi
 * ke data CEMS / OEM unit yang dipresentasikan. Lihat calibrateTo().
 */

// ───────────────────────────── Konstanta ─────────────────────────────
export const R_AIR = 287.0;                         // J/kg·K
export const K_AIR = 1.4;
export const CV_AIR = R_AIR / (K_AIR - 1);          // 717.5
export const CP_AIR = K_AIR * CV_AIR;               // 1004.5
export const CP_GAS = 1148;                         // gas panas sisi turbin
export const K_GAS = 1.333;
export const R_UNIV = 8.314462;                     // J/mol·K
export const GWP_CH4 = 29.8;                        // AR6, 100 tahun (AR5: 28)
export const MW = { NO: 30.006, NO2: 46.005, CO: 28.010, CO2: 44.010, CH4: 16.043, N2: 28.013, O2: 31.999, H2O: 18.015, SO2: 64.066 };

/** LHV kJ/kg; EF g CO2/MJ (IPCC default); AFRst massa; dTad = koreksi T_ad terhadap tabel CH4 */
export const FUELS = {
  diesel: { name: 'Diesel oil (HSD)', x: 12, y: 23, LHV: 42500, EF: 74.1, AFRst: 14.57, dTad: 40 },
  gas:    { name: 'Natural gas (≈CH4)', x: 1, y: 4, LHV: 48000, EF: 56.1, AFRst: 17.1, dTad: 0 },
};

// ───────────────────────────── Utilitas ─────────────────────────────
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const deg2rad = (d) => (d * Math.PI) / 180;

/** Interpolasi linear 1D dari titik [[x,y],...]. Dipakai untuk menyuntik kurva OEM/CEMS. */
export function lookup1D(points) {
  const pts = points.slice().sort((p, q) => p[0] - q[0]);
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    const last = pts[pts.length - 1];
    if (x >= last[0]) return last[1];
    let i = 1;
    while (pts[i][0] < x) i++;
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  };
}

export function bisect(f, lo, hi, { tol = 1e-6, maxIter = 80 } = {}) {
  let flo = f(lo);
  const fhi = f(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi)) return NaN;
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (flo * fhi > 0) return Math.abs(flo) < Math.abs(fhi) ? lo : hi;
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (!Number.isFinite(fm)) return NaN;
    if (Math.abs(hi - lo) < tol || fm === 0) return mid;
    if (flo * fm < 0) hi = mid;
    else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

/** Cari faktor kalibrasi c sehingga fn(c) = target (fn harus ~linear terhadap c). */
export function calibrateTo(fn, target) {
  const base = fn(1);
  return base > 0 ? target / base : 1;
}

/** cv(T) udara (J/kg·K), fit linear 300–2500 K; k(T) turunannya. */
export const cvOfT = (T) => CV_AIR + 0.115 * (T - 300);
export const kOfT = (T) => 1 + R_AIR / cvOfT(T);

// ─────────────────── Jalur proses (untuk kurva P-V & T-s) ───────────────────
const mkState = (T, P, s = 0) => ({ T, P, v: (R_AIR * T) / P, s });

/**
 * Titik-titik sepanjang satu proses dari state a ke b.
 * type: 'isentropic' | 'isochoric' | 'isobaric' | 'polytropic'
 */
export function processPath(type, a, b, n = 40, { cp = CP_AIR, cv = CV_AIR, k = K_AIR } = {}) {
  const pts = [];
  const m = type === 'polytropic' ? Math.log(b.T / a.T) / Math.log(b.P / a.P) : 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let T, P, v, s;
    switch (type) {
      case 'isentropic':
        v = a.v * Math.pow(b.v / a.v, t);
        T = a.T * Math.pow(a.v / v, k - 1);
        P = a.P * Math.pow(a.v / v, k);
        s = a.s;
        break;
      case 'isochoric':
        T = lerp(a.T, b.T, t); v = a.v; P = (R_AIR * T) / v;
        s = a.s + cv * Math.log(T / a.T);
        break;
      case 'isobaric':
        T = lerp(a.T, b.T, t); P = a.P; v = (R_AIR * T) / P;
        s = a.s + cp * Math.log(T / a.T);
        break;
      case 'polytropic':
        P = a.P * Math.pow(b.P / a.P, t);
        T = a.T * Math.pow(P / a.P, m);
        v = (R_AIR * T) / P;
        s = a.s + cp * Math.log(T / a.T) - R_AIR * Math.log(P / a.P);
        break;
      default: throw new Error('processPath: unknown process type ' + type);
    }
    pts.push({ T, P, v, s });
  }
  return pts;
}

function buildCycle(states, procs, extra) {
  const sample = (n = 40) =>
    procs.map((p) => ({ name: p.name, type: p.type, pts: processPath(p.type, states[p.from], states[p.to], n, p.props) }));
  return { states, processes: procs, sample, ...extra };
}

// ───────────────────────── A. Siklus ideal piston ─────────────────────────

/** Siklus Otto (gas engine). Input: r, T1, P1, dan Tmax ATAU qin (J/kg). */
export function otto({ r = 10, T1 = 300, P1 = 101325, Tmax = 2200, qin = null, k = K_AIR } = {}) {
  const cv = R_AIR / (k - 1), cp = k * cv, props = { k, cp, cv };
  const s1 = mkState(T1, P1, 0);
  const T2 = T1 * Math.pow(r, k - 1);
  const s2 = { T: T2, P: P1 * Math.pow(r, k), v: s1.v / r, s: 0 };
  const T3 = qin != null ? T2 + qin / cv : Tmax;
  const s3 = { T: T3, P: (s2.P * T3) / T2, v: s2.v, s: cv * Math.log(T3 / T2) };
  const T4 = T3 / Math.pow(r, k - 1);
  const s4 = { T: T4, P: s3.P / Math.pow(r, k), v: s1.v, s: s3.s };
  const q_in = cv * (T3 - T2), q_out = cv * (T4 - T1), wnet = q_in - q_out;
  return buildCycle([s1, s2, s3, s4], [
    { name: '1→2 isentropic compression', type: 'isentropic', from: 0, to: 1, props },
    { name: '2→3 constant-volume heat addition (spark)', type: 'isochoric', from: 1, to: 2, props },
    { name: '3→4 isentropic expansion', type: 'isentropic', from: 2, to: 3, props },
    { name: '4→1 constant-volume heat rejection', type: 'isochoric', from: 3, to: 0, props },
  ], { eta: 1 - 1 / Math.pow(r, k - 1), etaCheck: wnet / q_in, wnet, qin: q_in, qout: q_out, mep: wnet / (s1.v - s2.v), r });
}

/** Siklus Diesel. Input: r, dan rc (cutoff ratio) ATAU Tmax ATAU qin. */
export function diesel({ r = 18, T1 = 300, P1 = 101325, rc = 2, Tmax = null, qin = null, k = K_AIR } = {}) {
  const cv = R_AIR / (k - 1), cp = k * cv, props = { k, cp, cv };
  const s1 = mkState(T1, P1, 0);
  const T2 = T1 * Math.pow(r, k - 1);
  const s2 = { T: T2, P: P1 * Math.pow(r, k), v: s1.v / r, s: 0 };
  let T3 = rc * T2;
  if (Tmax != null) T3 = Tmax;
  if (qin != null) T3 = T2 + qin / cp;
  const rcE = T3 / T2;
  const s3 = { T: T3, P: s2.P, v: s2.v * rcE, s: cp * Math.log(rcE) };
  const T4 = T3 * Math.pow(rcE / r, k - 1);
  const s4 = { T: T4, P: (R_AIR * T4) / s1.v, v: s1.v, s: s3.s };
  const q_in = cp * (T3 - T2), q_out = cv * (T4 - T1), wnet = q_in - q_out;
  const eta = Math.abs(rcE - 1) < 1e-9 ? 1 - 1 / Math.pow(r, k - 1)
    : 1 - (1 / Math.pow(r, k - 1)) * (Math.pow(rcE, k) - 1) / (k * (rcE - 1));
  return buildCycle([s1, s2, s3, s4], [
    { name: '1→2 isentropic compression', type: 'isentropic', from: 0, to: 1, props },
    { name: '2→3 constant-pressure injection/combustion', type: 'isobaric', from: 1, to: 2, props },
    { name: '3→4 isentropic expansion', type: 'isentropic', from: 2, to: 3, props },
    { name: '4→1 constant-volume heat rejection', type: 'isochoric', from: 3, to: 0, props },
  ], { eta, etaCheck: wnet / q_in, wnet, qin: q_in, qout: q_out, mep: wnet / (s1.v - s2.v), r, rc: rcE });
}

/** Siklus Dual (diesel modern): rp = P3/P2 (isokorik), rc = cutoff (isobarik). */
export function dual({ r = 16, T1 = 300, P1 = 101325, rp = 1.5, rc = 1.4, k = K_AIR } = {}) {
  const cv = R_AIR / (k - 1), cp = k * cv, props = { k, cp, cv };
  const s1 = mkState(T1, P1, 0);
  const T2 = T1 * Math.pow(r, k - 1);
  const s2 = { T: T2, P: P1 * Math.pow(r, k), v: s1.v / r, s: 0 };
  const T3 = T2 * rp;
  const s3 = { T: T3, P: s2.P * rp, v: s2.v, s: cv * Math.log(rp) };
  const T4 = T3 * rc;
  const s4 = { T: T4, P: s3.P, v: s3.v * rc, s: s3.s + cp * Math.log(rc) };
  const T5 = T4 * Math.pow(rc / r, k - 1);
  const s5 = { T: T5, P: (R_AIR * T5) / s1.v, v: s1.v, s: s4.s };
  const q_in = cv * (T3 - T2) + cp * (T4 - T3), q_out = cv * (T5 - T1), wnet = q_in - q_out;
  const eta = 1 - (1 / Math.pow(r, k - 1)) * (rp * Math.pow(rc, k) - 1) / ((rp - 1) + k * rp * (rc - 1));
  return buildCycle([s1, s2, s3, s4, s5], [
    { name: '1→2 isentropic compression', type: 'isentropic', from: 0, to: 1, props },
    { name: '2→3 constant-volume heat addition', type: 'isochoric', from: 1, to: 2, props },
    { name: '3→4 constant-pressure heat addition', type: 'isobaric', from: 2, to: 3, props },
    { name: '4→5 isentropic expansion', type: 'isentropic', from: 3, to: 4, props },
    { name: '5→1 constant-volume heat rejection', type: 'isochoric', from: 4, to: 0, props },
  ], { eta, etaCheck: wnet / q_in, wnet, qin: q_in, qout: q_out, mep: wnet / (s1.v - s2.v), r, rp, rc });
}

// ───────────────────────── Turbin gas (Brayton) ─────────────────────────

export function braytonIdeal({ rp = 15, T1 = 288.15, P1 = 101325, T3 = 1500, k = K_AIR } = {}) {
  const x = (k - 1) / k, cp = (k * R_AIR) / (k - 1), props = { k, cp, cv: cp - R_AIR };
  const T2 = T1 * Math.pow(rp, x), T4 = T3 / Math.pow(rp, x);
  const s1 = mkState(T1, P1, 0);
  const s2 = mkState(T2, P1 * rp, 0);
  const s3 = mkState(T3, P1 * rp, cp * Math.log(T3 / T2));
  const s4 = mkState(T4, P1, s3.s);
  const wc = cp * (T2 - T1), wt = cp * (T3 - T4), q_in = cp * (T3 - T2);
  return buildCycle([s1, s2, s3, s4], [
    { name: '1→2 isentropic compression', type: 'polytropic', from: 0, to: 1, props },
    { name: '2→3 constant-pressure combustion', type: 'isobaric', from: 1, to: 2, props },
    { name: '3→4 isentropic expansion', type: 'polytropic', from: 2, to: 3, props },
    { name: '4→1 constant-pressure heat rejection', type: 'isobaric', from: 3, to: 0, props },
  ], { eta: 1 - 1 / Math.pow(rp, x), etaCheck: (wt - wc) / q_in, wnet: wt - wc, wc, wt, qin: q_in, backWorkRatio: wc / wt, rp,
       rpOptWork: Math.pow(T3 / T1, k / (2 * (k - 1))) });
}

/**
 * Brayton real: efisiensi kompresor/turbin, rugi tekanan combustor, mech loss.
 * mdot dalam kg/s udara. Daya dalam W. HeatRate dalam kJ/kWh.
 */
export function braytonReal({
  T1 = 288.15, P1 = 101325, rp = 15, T3 = 1500, mdot = 1,
  etaC = 0.87, etaT = 0.90, dpComb = 0.04, mech = 0.99, combEff = 0.99,
  cpa = CP_AIR, ka = K_AIR, cpg = CP_GAS, kg = K_GAS, fuel = 'gas',
} = {}) {
  const xa = (ka - 1) / ka, xg = (kg - 1) / kg;
  const T2 = T1 * (1 + (Math.pow(rp, xa) - 1) / etaC);
  const P2 = P1 * rp, P3 = P2 * (1 - dpComb);
  const rpt = P3 / P1;
  const T4 = T3 * (1 - etaT * (1 - Math.pow(rpt, -xg)));
  const wc = cpa * (T2 - T1);
  const wt = cpg * (T3 - T4) * mech;
  const wnet = wt - wc;
  const qin = cpg * (T3 - T2);
  const eta = wnet / qin;
  const fu = FUELS[fuel];
  const mf = (mdot * qin) / (fu.LHV * 1e3 * combEff);
  const s1 = mkState(T1, P1, 0);
  const s2 = mkState(T2, P2, cpa * Math.log(T2 / T1) - R_AIR * Math.log(rp));
  const s3 = mkState(T3, P3, s2.s + cpg * Math.log(T3 / T2) - R_AIR * Math.log(P3 / P2));
  const s4 = mkState(T4, P1, s3.s + cpg * Math.log(T4 / T3) - R_AIR * Math.log(P1 / P3));
  const cyc = buildCycle([s1, s2, s3, s4], [
    { name: '1→2 real compression', type: 'polytropic', from: 0, to: 1, props: { cp: cpa } },
    { name: '2→3 combustor (ΔP)', type: 'polytropic', from: 1, to: 2, props: { cp: cpg } },
    { name: '3→4 real expansion', type: 'polytropic', from: 2, to: 3, props: { cp: cpg } },
    { name: '4→1 exhaust', type: 'isobaric', from: 3, to: 0, props: { cp: cpg } },
  ], {});
  return {
    ...cyc, T2, T3, T4, P2, P3, rp, rpt, wc, wt, wnet, qin, eta, mdot, mf,
    power: mdot * wnet, powerKW: (mdot * wnet) / 1e3, heatRate: 3600 / eta, specificWork: wnet,
    backWorkRatio: wc / wt, fuel, params: { T1, P1, rp, T3, mdot, etaC, etaT, dpComb, mech, combEff, fuel },
  };
}

/** Tekanan standar atmosfer pada ketinggian h (m). */
export const pressureAtAltitude = (h) => 101325 * Math.pow(1 - 2.25577e-5 * h, 5.25588);

/** Derating akibat suhu ambient/ketinggian: aliran massa ∝ P/T, siklus dihitung ulang. */
export function braytonDerated(base, { TambC = 35, altitude = 0 } = {}) {
  const iso = braytonReal({ ...base });
  const T1 = TambC + 273.15, P1 = pressureAtAltitude(altitude);
  const mdot = (base.mdot ?? 1) * (P1 / 101325) * (288.15 / T1);
  const res = braytonReal({ ...base, T1, P1, mdot });
  return { ...res, derate: res.power / iso.power, isoPower: iso.power, perDegC: (1 - res.power / iso.power) / (TambC - 15) };
}

/**
 * Single-shaft (generator, N konstan). Strategi IGV: aliran turun dulu sampai igvMin
 * dengan T3 ditahan (efisiensi & flame T terjaga); di bawah itu T3 yang turun.
 * igvMin = 1 berarti hanya bahan bakar yang dikurangi (tanpa IGV) → T3 langsung turun.
 */
export function singleShaftLoad(design, loadFrac, { igvMin = 0.7 } = {}) {
  const d = braytonReal(design);
  const target = loadFrac * d.power;
  let mdot, T3;
  if (loadFrac >= igvMin) { mdot = loadFrac * d.mdot; T3 = design.T3; }
  else {
    mdot = igvMin * d.mdot;
    T3 = bisect((t3) => braytonReal({ ...design, T3: t3, mdot }).power - target,
      d.T2 + 40, design.T3, { tol: 0.01 });
  }
  const res = braytonReal({ ...design, T3, mdot });
  return { ...res, loadFrac, N: 1, strategy: loadFrac >= igvMin ? 'IGV (T3 held)' : (igvMin >= 1 ? 'fuel-only' : 'IGV min → T3 falls') };
}

/**
 * Twin-shaft (gas generator + free power turbine). Model keseimbangan sederhana:
 *   mdot ∝ Ngg, rp = 1 + (rp_d−1)·Ngg² (kenaikan tekanan ∝ U²),
 *   kerja turbin GG = kerja kompresor, sisanya diekspansi di power turbine ke ambient.
 */
export function twinShaft({
  Ngg = 1, T3 = 1450, T1 = 288.15, P1 = 101325, rpDesign = 20, mdotDesign = 1,
  etaC = 0.86, etaGG = 0.89, etaPT = 0.90, dpComb = 0.04, mech = 0.99, fuel = 'gas', combEff = 0.99,
} = {}) {
  const xa = (K_AIR - 1) / K_AIR, xg = (K_GAS - 1) / K_GAS;
  const mdot = mdotDesign * Ngg;
  const rp = 1 + (rpDesign - 1) * Ngg * Ngg;
  const T2 = T1 * (1 + (Math.pow(rp, xa) - 1) / etaC);
  const wc = CP_AIR * (T2 - T1);
  const T45 = T3 - wc / (mech * CP_GAS);
  const base = { Ngg, T1, T2, T3, T45, rp, mdot, P3: P1 * rp * (1 - dpComb), valid: false, power: 0, eta: 0, T5: NaN, qin: CP_GAS * (T3 - T2) };
  const g = 1 - (1 - T45 / T3) / etaGG;
  if (!(T45 > 0) || !(g > 0)) return base;
  const epsGG = Math.pow(g, -1 / xg);
  const P45 = base.P3 / epsGG;
  const rpt = P45 / P1;
  if (!(rpt > 1)) return base;
  const T5 = T45 * (1 - etaPT * (1 - Math.pow(rpt, -xg)));
  const wpt = CP_GAS * (T45 - T5) * mech;
  const qin = CP_GAS * (T3 - T2);
  const fu = FUELS[fuel];
  return { ...base, valid: true, rpt, T5, wpt, power: mdot * wpt, powerKW: (mdot * wpt) / 1e3, eta: wpt / qin, qin,
           mf: (mdot * qin) / (fu.LHV * 1e3 * combEff), heatRate: 3600 / (wpt / qin) };
}

/** Beban fraksi → (Ngg, T3) dengan jadwal T3 = T3d·(a + (1−a)·Ngg). Return hasil twinShaft. */
export function twinShaftForLoad(design, loadFrac, { t3Sched = 0.75 } = {}) {
  const d = twinShaft({ ...design, Ngg: 1, T3: design.T3 });
  const target = loadFrac * d.power;
  const f = (N) => twinShaft({ ...design, Ngg: N, T3: design.T3 * (t3Sched + (1 - t3Sched) * N) }).power - target;
  const N = bisect(f, 0.5, 1.0, { tol: 1e-5 });
  const res = twinShaft({ ...design, Ngg: N, T3: design.T3 * (t3Sched + (1 - t3Sched) * N) });
  return { ...res, loadFrac, designPower: d.power };
}

/**
 * Suhu per tahap kompresor aksial (visual warna bilah): rasio tekanan antara π_i = rp^(i/n) dimasukkan
 * ke rumus T₂ braytonReal/twinShaft → tahap terakhir TEPAT T₂. Return [{T, PR}] untuk i = 1..n.
 */
export function compressorStages(T1, rp, etaC, n, k = K_AIR) {
  const x = (k - 1) / k, out = [];
  for (let i = 1; i <= n; i++) {
    const pr = Math.pow(rp, i / n);
    out.push({ T: T1 * (1 + (Math.pow(pr, x) - 1) / etaC), PR: pr });
  }
  return out;
}

/**
 * Suhu per tahap turbin (visual): rasio ekspansi antara ε_i = er^(i/n) dimasukkan ke rumus ekspansi
 * T = Tin·(1 − η·(1 − ε^(−x))) → tahap terakhir TEPAT T₄ (braytonReal) / T₄₅, T₅ (twinShaft).
 * er = rasio ekspansi total turbin tsb (P_in/P_out). Return [{T, ER}] untuk i = 1..n.
 */
export function turbineStages(Tin, er, etaT, n, k = K_GAS) {
  const x = (k - 1) / k, out = [];
  for (let i = 1; i <= n; i++) {
    const e = Math.pow(er, i / n);
    out.push({ T: Tin * (1 - etaT * (1 - Math.pow(e, -x))), ER: e });
  }
  return out;
}

/**
 * Siklus twin-shaft (gas generator + free power turbine) di atas twinShaft(): state 1, 2, 3, 4.5, 5
 * (T, P, v, s) dan jalur proses (sample) untuk T-s / P-v, plus derating ambient.
 * Ambient: T1/P1 berubah, ṁ ∝ (P1/101325)·(288,15/T1) pada Ngg tetap (analog braytonDerated).
 * Pada TambC = 15 dan altitude 0, nilai identik dengan twinShaft(design).
 */
export function twinShaftCycle(design = {}, { TambC = 15, altitude = 0 } = {}) {
  const iso = twinShaft({ ...design, T1: 288.15, P1: 101325 });
  const T1 = TambC + 273.15, P1 = pressureAtAltitude(altitude);
  const mdotDesign = (design.mdotDesign ?? 1) * (P1 / 101325) * (288.15 / T1);
  const r = twinShaft({ ...design, T1, P1, mdotDesign });
  const dp = design.dpComb ?? 0.04, P2 = P1 * r.rp, P3 = P2 * (1 - dp), P45 = r.rpt * P1;
  const xa = (K_AIR - 1) / K_AIR;
  const s1 = mkState(T1, P1, 0);
  const s2 = mkState(r.T2, P2, CP_AIR * Math.log(r.T2 / T1) - R_AIR * Math.log(r.rp));
  const s3 = mkState(r.T3, P3, s2.s + CP_GAS * Math.log(r.T3 / r.T2) - R_AIR * Math.log(P3 / P2));
  const s45 = mkState(r.T45, P45, s3.s + CP_GAS * Math.log(r.T45 / r.T3) - R_AIR * Math.log(P45 / P3));
  const s5 = mkState(r.T5, P1, s45.s + CP_GAS * Math.log(r.T5 / r.T45) - R_AIR * Math.log(P1 / P45));
  const cyc = buildCycle([s1, s2, s3, s45, s5], [
    { name: '1→2 real compression', type: 'polytropic', from: 0, to: 1, props: { cp: CP_AIR } },
    { name: '2→3 combustor (ΔP)', type: 'polytropic', from: 1, to: 2, props: { cp: CP_GAS } },
    { name: '3→4.5 gas-generator turbine', type: 'polytropic', from: 2, to: 3, props: { cp: CP_GAS } },
    { name: '4.5→5 power turbine', type: 'polytropic', from: 3, to: 4, props: { cp: CP_GAS } },
    { name: '5→1 exhaust', type: 'isobaric', from: 4, to: 0, props: { cp: CP_GAS } },
  ], {});
  const wc = CP_AIR * (r.T2 - T1);
  return {
    ...cyc, ...r, P1, P2, P3, P45, epsGG: P3 / P45, wc, wnet: r.wpt,
    backWorkRatio: wc / (wc + r.wpt), // kerja kompresor / kerja turbin total (GG + PT)
    derate: r.power / iso.power, isoPower: iso.power,
    perDegC: TambC !== 15 ? (1 - r.power / iso.power) / (TambC - 15) : NaN,
    params: { ...design, T1, P1, mdotDesign, xa },
  };
}

// ─────────────────────── Kompresor gas (mechanical drive) ───────────────────────

/** Head & daya politropik. Psuc, Pdis dalam Pa; Tsuc K; MW kg/kmol; mdot kg/s. */
export function gasCompressor({ Psuc, Pdis, Tsuc = 305, MWgas = 18, Z = 0.95, k = 1.27, etaP = 0.80, mdot = 1 }) {
  const R = (R_UNIV * 1000) / MWgas;
  const rp = Pdis / Psuc;
  const m = (k - 1) / (k * etaP);
  const head = (Z * R * Tsuc / m) * (Math.pow(rp, m) - 1);       // J/kg
  const Tdis = Tsuc * Math.pow(rp, m);
  return { rp, head, headKJ: head / 1e3, power: (mdot * head) / etaP, powerKW: (mdot * head) / etaP / 1e3, Tdis, m, R };
}

/** Hukum affinitas (η tetap): Q∝N, H∝N², P∝N³. */
export function affinity({ N0, N1, Q0 = 1, H0 = 1, P0 = 1 }) {
  const r = N1 / N0;
  return { Q: Q0 * r, H: H0 * r * r, P: P0 * r * r * r };
}
export const speedForHead = ({ Hreq, Hdesign, Ndesign }) => Ndesign * Math.sqrt(Hreq / Hdesign);

/**
 * Aliran volumetrik aktual di suction (m³/s): Q = ṁ·Z·R·T/(P·MW). Hukum affinitas berlaku untuk aliran
 * volumetrik (Q ∝ N), bukan aliran massa — dipakai sumbu "flow" grafik head-flow Scene 7.
 */
export function suctionFlow({ mdot, Psuc, Tsuc = 305, MWgas = 18, Z = 0.95 }) {
  return (mdot * Z * R_UNIV * 1000 * Tsuc) / (Psuc * MWgas);
}

/**
 * Rangkaian kompresor gas + compressor-drive (twin-shaft) — Scene 7 → Scene 5/6:
 *   gasCompressor(comp) → daya poros; beban turbin = P_kompresor / P_PT desain (twinShaft N_GG = 1);
 *   beban diklem ke loadRange (rentang Scene 6) → twinShaftForLoad → dlnFromResult (fixed premix split).
 *   Bila compDesign diberikan: speed yang dibutuhkan = speedForHead(head, head_desain) — dari head saja;
 *   kecocokan aliran–speed, peta kompresor, surge, dan batas speed TIDAK dimodelkan.
 * Default gtDesign = compressor drive Scene 5 (rp 20, T3 1450 K, ṁ 20 kg/s → P_PT 6,58 MW).
 */
export function compressorTrain({
  comp, compDesign = null,
  gtDesign = { rpDesign: 20, T3: 1450, etaC: 0.86, etaGG: 0.89, etaPT: 0.90, mdotDesign: 20 },
  calib = 1, loadRange = [0.4, 1], phiPzDesign = 0.5, tauMs = 12, refO2 = 15,
}) {
  const g = gasCompressor(comp);
  const d = twinShaft({ ...gtDesign, Ngg: 1 });
  const loadRaw = g.power / d.power;
  const load = clamp(loadRaw, loadRange[0], loadRange[1]);
  const r = twinShaftForLoad(gtDesign, load);
  const e = dlnFromResult(r, d, { phiPzDesign, tauMs, calib, refO2 });
  const Nreq = compDesign ? speedForHead({ Hreq: g.head, Hdesign: gasCompressor(compDesign).head, Ndesign: 1 }) : null;
  return {
    comp: g, Nreq, ptPower: d.power, loadRaw, load, inRange: loadRaw >= loadRange[0] && loadRaw <= loadRange[1],
    Ngg: r.Ngg, T3: r.T3, eta: r.eta, Tflame: e.Tflame, NOx_ppm: e.NOx_ppm, CO_ppm: e.CO_ppm, phiPz: e.phiPz,
  };
}

// ───────────────────────── C. Piston: geometri & simulasi ─────────────────────────

export function engineGeometry({ bore = 0.2, stroke = 0.26, conrod = 0.52, r = 16 } = {}) {
  const a = stroke / 2, A = (Math.PI * bore * bore) / 4;
  const Vd = A * stroke, Vc = Vd / (r - 1);
  const root = (t) => Math.sqrt(conrod * conrod - a * a * Math.sin(t) ** 2);
  const s = (th) => { const t = deg2rad(th); return a * Math.cos(t) + root(t); };
  return {
    bore, stroke, conrod, r, a, A, Vd, Vc,
    /** posisi piston dari TDC (m): 0 di TDC, stroke di BDC */
    pistonPos: (th) => conrod + a - s(th),
    V: (th) => Vc + A * (conrod + a - s(th)),
    /** dV/dθ per derajat */
    dVdth: (th) => { const t = deg2rad(th); return A * a * Math.sin(t) * (1 + (a * Math.cos(t)) / root(t)) * (Math.PI / 180); },
    meanPistonSpeed: (N) => (2 * stroke * N) / 60,
  };
}

/** Fungsi Wiebe: fraksi terbakar kumulatif & laju (per derajat). */
export function wiebe(th, th0, dur, m = 2, a = 6.908) {
  if (th <= th0) return { x: 0, dx: 0 };
  const y = (th - th0) / dur, e = Math.exp(-a * Math.pow(y, m + 1));
  return { x: 1 - e, dx: (a * (m + 1) / dur) * Math.pow(y, m) * e };
}

/** Friksi Chen–Flynn (indikatif!). Pmax dalam bar, Sp m/s → FMEP Pa. */
export function chenFlynnFMEP(PmaxBar, Sp, { C = 0.4, PF = 0.005, MPSF = 0.09, MPSQ = 0.0009 } = {}) {
  return (C + PF * PmaxBar + MPSF * Sp + MPSQ * Sp * Sp) * 1e5;
}

/**
 * Faktor kalibrasi laju NOx engine. Zeldovich + asumsi kesetimbangan atom O cenderung
 * OVERESTIMATE ~6× pada zona terbakar non-seragam. 0,17 dipilih agar diesel ≈ 11 g/kWh dan gas
 * lean-burn ≈ 2,5 g/kWh (nilai tipikal literatur, tanpa kontrol). BUKAN data unit Anda:
 * ganti dengan hasil CEMS/OEM via cylinderSim({ calib }) atau calibrateTo().
 */
export const ENGINE_NOX_CALIB = 0.17;

export const ENGINE_PRESETS = {
  diesel: { fuel: 'diesel', bore: 0.2, stroke: 0.26, conrod: 0.52, r: 16, N: 1000, Pivc: 2.0e5, Tivc: 330, ivc: -150, evo: 150,
            phi: 0.5, combEff: 0.98, lossFrac: 0.12, theta0: -4, dur: 45, m: 2, premixFrac: 0.2, durPremix: 8, phiLocal: 0.95, calib: ENGINE_NOX_CALIB },
  gas:    { fuel: 'gas', bore: 0.2, stroke: 0.26, conrod: 0.52, r: 11, N: 1000, Pivc: 2.2e5, Tivc: 325, ivc: -150, evo: 150,
            phi: 0.62, combEff: 0.985, lossFrac: 0.12, theta0: -14, dur: 55, m: 2, premixFrac: 0, durPremix: 8, phiLocal: null, calib: ENGINE_NOX_CALIB },
};

/**
 * Simulasi silinder tertutup (IVC→EVO): dP/dθ = −k(T)·P/V·dV/dθ + (k(T)−1)/V·dQ/dθ.
 * Hasil: array θ,V,P,T(rata2),xb + ringkasan (Pmax, IMEP, η, BMEP, daya, BSFC, CO2, NOx).
 * Yang diabaikan (sengaja): kerja pumping, kerja setelah EVO, rugi dinding terdistribusi
 * (dilumpkan ke lossFrac). Pakai untuk TREN & orde besaran, bukan prediksi vendor.
 */
export function cylinderSim(p = {}) {
  const q = { ...ENGINE_PRESETS.diesel, ...p };
  const { r, N, Pivc, Tivc, ivc, evo, phi, combEff, lossFrac, theta0, dur, m, premixFrac, durPremix, fuel, step = 0.5 } = q;
  const fu = FUELS[fuel];
  const geo = engineGeometry(q);
  const phiLocal = q.phiLocal ?? phi;
  const mass = (Pivc * geo.V(ivc)) / (R_AIR * Tivc);
  const mFuel = (phi * mass) / fu.AFRst;
  const Efuel = mFuel * fu.LHV * 1e3;
  const Qtot = Efuel * combEff * (1 - lossFrac);

  const burn = (th) => {
    const a = wiebe(th, theta0, dur, m), b = wiebe(th, theta0, durPremix, 1.5);
    return { x: (1 - premixFrac) * a.x + premixFrac * b.x, dx: (1 - premixFrac) * a.dx + premixFrac * b.dx };
  };
  const f = (th, P) => {
    const V = geo.V(th), T = (P * V) / (mass * R_AIR), k = kOfT(T);
    return (-k * P / V) * geo.dVdth(th) + ((k - 1) / V) * Qtot * burn(th).dx;
  };

  const n = Math.round((evo - ivc) / step);
  const th = new Float64Array(n + 1), V = new Float64Array(n + 1), P = new Float64Array(n + 1);
  const T = new Float64Array(n + 1), xb = new Float64Array(n + 1);
  P[0] = Pivc;
  for (let i = 0; i <= n; i++) {
    th[i] = ivc + i * step; V[i] = geo.V(th[i]);
    T[i] = (P[i] * V[i]) / (mass * R_AIR); xb[i] = burn(th[i]).x;
    if (i < n) {
      const h = step, t0 = th[i];
      const k1 = f(t0, P[i]), k2 = f(t0 + h / 2, P[i] + (h / 2) * k1);
      const k3 = f(t0 + h / 2, P[i] + (h / 2) * k2), k4 = f(t0 + h, P[i] + h * k3);
      P[i + 1] = P[i] + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    }
  }

  let W = 0, Pmax = 0, iPmax = 0, dPmax = 0;
  for (let i = 0; i < n; i++) {
    W += 0.5 * (P[i] + P[i + 1]) * (V[i + 1] - V[i]);
    dPmax = Math.max(dPmax, (P[i + 1] - P[i]) / step);
  }
  for (let i = 0; i <= n; i++) if (P[i] > Pmax) { Pmax = P[i]; iPmax = i; }

  const imepG = W / geo.Vd, etaInd = W / Efuel;
  const Sp = geo.meanPistonSpeed(N);
  const fmep = chenFlynnFMEP(Pmax / 1e5, Sp);
  const bmep = imepG - fmep;
  const cyclesPerSec = N / 120;                              // 4-tak
  const Pb = bmep * geo.Vd * cyclesPerSec;
  const mfRate = mFuel * cyclesPerSec;
  const etaBrake = Pb / (mfRate * fu.LHV * 1e3);
  const bsfc = (mfRate * 3600 * 1000) / (Pb / 1000);
  const co2 = (fu.EF * 3.6) / etaBrake;

  const summary = {
    mass, mFuel, Efuel, Qtot, Pmax, thetaPmax: th[iPmax], dPdthMaxBar: dPmax / 1e5, Tmax: Math.max(...T),
    Wgross: W, imepG, imepGBar: imepG / 1e5, etaInd, fmep, bmep, bmepBar: bmep / 1e5, powerKW: Pb / 1e3,
    etaBrake, bsfc, co2_gkWh: co2, Sp, Vd: geo.Vd, Vc: geo.Vc, Tevo: T[n], Pevo: P[n],
  };

  const out = { params: q, geo, th, V, P, T, xb, ...summary, summary };
  if (q.nox !== false) {
    Object.assign(out, engineNOx({ th, P, step, N, Pivc, Tivc, phi, phiLocal, fuel, mFuel, mass, burn, calib: q.calib ?? 1, refO2: q.refO2 ?? 15, theta0, dur }));
    // NOx (sbg NO2) per kWh poros: kmol/siklus × 46,005 kg/kmol × 1000 g/kg ÷ (kerja rem per siklus dalam kWh)
    out.NOx_gkWh = (out.nNOkmol * MW.NO2 * 1000) / ((bmep * geo.Vd) / 3.6e6);
  }
  return out;
}

// ───────────────────────────── Emisi ─────────────────────────────

const T_AD_CH4 = lookup1D([[0.2, 830], [0.25, 960], [0.3, 1080], [0.4, 1310], [0.5, 1530], [0.6, 1730], [0.7, 1900], [0.8, 2050],
  [0.9, 2160], [1.0, 2226], [1.05, 2235], [1.1, 2220], [1.2, 2160], [1.4, 2010], [1.6, 1860]]);

/** Suhu nyala adiabatik (K), INDIKATIF (±100 K). Tin = suhu campuran masuk (K). */
export function flameTemperature(phi, Tin = 300, fuel = 'gas') {
  // dissociation menumpulkan efek preheat mendekati stoikiometrik: gain 0,8 (lean) → 0,5 (φ≥1)
  const gain = phi <= 0.8 ? 0.8 : phi >= 1 ? 0.5 : lerp(0.8, 0.5, (phi - 0.8) / 0.2);
  return T_AD_CH4(phi) + FUELS[fuel].dTad * clamp(phi, 0, 1) + gain * (Tin - 300);
}
/** Invers sisi lean: φ yang menghasilkan T tertentu. */
export const phiFromFlameT = (T, Tin = 300, fuel = 'gas') =>
  bisect((ph) => flameTemperature(ph, Tin, fuel) - T, 0.25, 1.0, { tol: 1e-5 });

/** Komposisi produk (fraksi mol basah) untuk CxHy; φ>1 diperlakukan stoikiometrik. */
export function burnedComposition(phi, fuel = 'gas') {
  const { x, y } = FUELS[fuel];
  const a = x + y / 4, ph = Math.min(phi, 1);
  const nO2 = a * (1 / ph - 1), nN2 = (3.76 * a) / ph, nCO2 = x, nH2O = y / 2;
  const n = nO2 + nN2 + nCO2 + nH2O;
  const c = { xO2: nO2 / n, xN2: nN2 / n, xCO2: nCO2 / n, xH2O: nH2O / n };
  c.MW = c.xO2 * MW.O2 + c.xN2 * MW.N2 + c.xCO2 * MW.CO2 + c.xH2O * MW.H2O;
  return c;
}

const kpNO = (T) => Math.exp(1.49 - 10861 / T);                 // ½N2+½O2→NO (aprox.)
/** Konstanta Zeldovich (Heywood): d[NO]/dt ≈ A/√T · exp(−Ea/T) · [O₂]^½ [N₂]. Diekspor untuk panel asumsi. */
export const ZELDOVICH = Object.freeze({ A: 6e16, Ea: 69090 });
const zeldovichK0 = (T, P, xO2, xN2) => {                       // laju per mol campuran (1/s)
  const C = (P / (R_UNIV * T)) * 1e-6;                          // mol/cm3
  return (ZELDOVICH.A / Math.sqrt(T)) * Math.exp(-ZELDOVICH.Ea / T) * Math.sqrt(xO2 * C) * xN2;
};

/**
 * NO termal (Zeldovich, Heywood) pada zona terbakar bersuhu tetap selama tau (s).
 * dx/dt = k0·(1−(x/xeq)²) → x = xeq·tanh(k0·t/xeq). Return fraksi mol basah.
 */
export function noxThermal({ T, P, phi, fuel = 'gas', tau = 0.012, calib = 1, xO2Floor = 0.01 }) {
  const c = burnedComposition(phi, fuel);
  const xO2 = Math.max(c.xO2, xO2Floor);
  const k0 = calib * zeldovichK0(T, P, xO2, c.xN2);
  const xEq = kpNO(T) * Math.sqrt(xO2 * c.xN2);
  const xNO = xEq * Math.tanh((k0 * tau) / xEq);
  return { xNO, xEq, k0, ppmWet: xNO * 1e6 };
}

/**
 * Laju awal pembentukan NO termal (Zeldovich, 1/s per mol campuran), calib = 1:
 * d[NO]/dt ≈ 6×10¹⁶/√T · exp(−69.090/T) · [O₂]^½ [N₂]. Untuk grafik Arrhenius Scene 4.
 */
export function zeldovichRate({ T, P = 15e5, phi = 0.5, fuel = 'gas', xO2Floor = 0.01 }) {
  const c = burnedComposition(phi, fuel);
  return zeldovichK0(T, P, Math.max(c.xO2, xO2Floor), c.xN2);
}
/**
 * Rasio laju Zeldovich pada T+dT terhadap T ("+100 K ≈ ×N"). Hanya bergantung pada T
 * (P dan komposisi saling menghapus), jadi berlaku sama untuk engine dan turbin.
 */
export const noxRateRatio = (T, dT = 100, opts = {}) => zeldovichRate({ ...opts, T: T + dT }) / zeldovichRate({ ...opts, T });
/** Kurva Arrhenius: laju relatif terhadap Tref (Tref → 1) pada Tmin…Tmax. */
export function zeldovichCurve({ Tmin = 1600, Tmax = 3000, n = 70, Tref = 1800 } = {}) {
  const r0 = zeldovichRate({ T: Tref });
  const out = [];
  for (let i = 0; i <= n; i++) { const T = Tmin + ((Tmax - Tmin) * i) / n; out.push({ T, rel: zeldovichRate({ T }) / r0 }); }
  return out;
}

/** fraksi mol basah → ppmvd terkoreksi O2 acuan (default 15%). comp = burnedComposition(). */
export function toDryRef(xWet, comp, refO2 = 15) {
  const dry = xWet / (1 - comp.xH2O);
  const o2dry = (comp.xO2 / (1 - comp.xH2O)) * 100;
  return dry * 1e6 * ((20.9 - refO2) / (20.9 - o2dry));
}
export const correctToRefO2 = (C, O2meas, O2ref) => C * ((20.9 - O2ref) / (20.9 - O2meas));

/** Volume molar (m³/kmol) pada Tref (K), 1 atm. 273,15 → "Nm³"; 298,15 → basis 25 °C. */
export const molarVolume = (Tref = 273.15) => 22.414 * (Tref / 273.15);
export const ppmToMgNm3 = (ppm, MWspecies, Tref = 273.15) => (ppm * MWspecies) / molarVolume(Tref);
/** Kebalikan ppmToMgNm3: mg/Nm³ → ppm (input batas presenter dalam mg/Nm³, Scene 9). */
export const mgNm3ToPpm = (mg, MWspecies, Tref = 273.15) => (mg * molarVolume(Tref)) / MWspecies;

/**
 * Volume flue gas KERING stoikiometrik per kg bahan bakar (F-factor, Nm³/kg pada 0 °C):
 * CxHy + (x + y/4)(O₂ + 3,76 N₂) → x CO₂ + (y/2) H₂O + 3,76(x + y/4) N₂; kering = x + 3,76(x + y/4) kmol.
 * gas (CH₄) ≈ 11,90 Nm³/kg; diesel (C₁₂H₂₃) ≈ 10,55 Nm³/kg. Udara kering, bahan bakar tanpa N/S/abu.
 */
export function dryFlueNm3PerKg(fuel = 'gas') {
  const { x, y } = FUELS[fuel];
  return ((x + 3.76 * (x + y / 4)) / (12.011 * x + 1.008 * y)) * molarVolume(273.15);
}

/**
 * ppmvd @ refO2 → g/kWh: konsentrasi × volume flue gas kering pada O₂ acuan per kWh.
 *   V = fuelPerKWh(η) · F_kering · 20,9/(20,9 − refO2)   [Nm³/kWh, 0 °C]
 *   g/kWh = ppm·1e-6 · (MW/22,414) kg/Nm³ · 1000 · V
 * Dipakai untuk turbin (hanya punya ppm). Validasi silang: preset cylinderSim diesel 730 ppm → 10,75 vs
 * NOx_gkWh 10,69; gas 168 ppm → 2,58 vs 2,57 (< 1 %). η = efisiensi berbasis daya keluaran (rem / poros).
 */
export function ppmToGkWh({ ppm, refO2 = 15, MWspecies = MW.NO2, eta, fuel = 'gas' }) {
  const V = fuelPerKWh(eta, fuel) * dryFlueNm3PerKg(fuel) * (20.9 / (20.9 - refO2));
  return ppm * 1e-6 * (MWspecies / molarVolume(273.15)) * 1000 * V;
}
/**
 * Angka emisi pada basis tampilan: ppmvd dari O₂ acuan refFrom ke refO2 (correctToRefO2),
 * lalu mg/Nm³ sebagai spesies MW pada basis volume TrefK (ppmToMgNm3). Dry basis tetap.
 * Contoh golden (docs/ALUR_SLIDE): 25 ppm NOx @15% O₂ → 51,3 mg/Nm³ (0 °C; 2,05 per ppm), 47,0 (25 °C; 1,88).
 */
export function emissionAtBasis({ ppm, refFrom = 15, refO2 = 15, TrefK = 273.15, MWspecies = MW.NO2 }) {
  const ppmB = correctToRefO2(ppm, refFrom, refO2);
  return { ppm: ppmB, mgNm3: ppmToMgNm3(ppmB, MWspecies, TrefK), refO2, TrefK };
}
export const massRateKgH = (C_mgNm3, Q_Nm3h) => C_mgNm3 * Q_Nm3h * 1e-6;
/** Aliran flue gas (Nm³/h, 0 °C) dari laju massa udara+bahan bakar (kg/s); ρ ≈ 1,30 kg/Nm³. */
export const exhaustFlowNm3h = (mAir, mFuel) => ((mAir + mFuel) * 3600) / 1.30;

/** CO DLN vs suhu nyala: jendela lean-premix. BENTUK ilustratif; ganti dengan kurva OEM via lookup1D. */
export function coDLN(Tflame, { co0 = 5, amp = 600, Tc = 1650, w = 40 } = {}) {
  return co0 + amp / (1 + Math.exp((Tflame - Tc) / w));
}

/**
 * Emisi combustor DLN pada satu titik operasi.
 * phiPz = φ zona premix (≈0,5 saat desain); NOx terkoreksi 15% O2 kering; calib dari calibrateTo().
 */
export function dlnEmissions({ T2, P3, phiPz, tauMs = 12, fuel = 'gas', refO2 = 15, calib = 1, noxOffset = 0, co = {} }) {
  const Tflame = flameTemperature(phiPz, T2, fuel);
  const comp = burnedComposition(phiPz, fuel);
  const nx = noxThermal({ T: Tflame, P: P3, phi: phiPz, fuel, tau: tauMs / 1000, calib });
  return { phiPz, Tflame, NOx_ppm: toDryRef(nx.xNO, comp, refO2) + noxOffset, CO_ppm: coDLN(Tflame, co), noxDetail: nx };
}

/** Emisi DLN dari hasil siklus (braytonReal/singleShaft/twinShaft) relatif terhadap titik desain. */
export function dlnFromResult(res, resDesign, { phiPzDesign = 0.5, ...opts } = {}) {
  const phiPz = phiPzDesign * (res.qin / resDesign.qin);
  return dlnEmissions({ T2: res.T2, P3: res.P3 ?? res.states[2].P, phiPz, ...opts });
}

/** Sapuan beban turbin: T3, suhu nyala, NOx, CO, efisiensi. mode: 'single' | 'twin' | 'fuelOnly'. */
export function loadSweep(design, loads = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4], { mode = 'single', phiPzDesign = 0.5, tauMs = 12, calib = 1, igvMin = 0.7 } = {}) {
  const d = mode === 'twin' ? twinShaft({ ...design, Ngg: 1, T3: design.T3 }) : braytonReal(design);
  return loads.map((L) => {
    const r = mode === 'twin' ? twinShaftForLoad(design, L)
      : singleShaftLoad(design, L, { igvMin: mode === 'fuelOnly' ? 1 : igvMin });
    const e = dlnFromResult(r, d, { phiPzDesign, tauMs, calib });
    return { load: L, T3: r.T3, T2: r.T2, eta: r.eta, N: r.Ngg ?? 1, ...e };
  });
}

/**
 * Faktor kalibrasi DLN: NOx di titik desain braytonReal(design) — atau twinShaft(design) bila mode 'twin' —
 * (φ zona premix = phiPzDesign) = targetPpm
 * (ppmvd @refO2). Memakai calibrateTo + satu koreksi (tanh membuat sedikit tak linear).
 * Default 15 ppm @15% O₂ = nilai tipikal literatur, BUKAN data unit.
 */
export function calibrateDLN({ targetPpm = 15, design = {}, phiPzDesign = 0.5, tauMs = 12, refO2 = 15, mode = 'single' } = {}) {
  // mode 'twin': titik desain twinShaft (N_GG = 1) — kalibrasi per konfigurasi (Scene 6); 'single' = braytonReal
  const d = mode === 'twin' ? twinShaft({ ...design, Ngg: 1 }) : braytonReal(design);
  const nox = (c) => dlnFromResult(d, d, { phiPzDesign, tauMs, refO2, calib: c }).NOx_ppm;
  let calib = calibrateTo(nox, targetPpm);
  calib *= calibrateTo((k) => nox(calib * k), targetPpm);
  const e = dlnFromResult(d, d, { phiPzDesign, tauMs, refO2, calib });
  return { calib, NOx_ppm: e.NOx_ppm, Tflame: e.Tflame, T2: d.T2, P3: d.P3 ?? d.states[2].P, targetPpm, refO2 };
}

/** Sapuan suhu nyala → NOx & CO (slide trade-off). */
export function noxCoTradeoff({ T2 = 700, P3 = 15e5, tauMs = 12, fuel = 'gas', calib = 1, Tmin = 1500, Tmax = 2000, n = 26 } = {}) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const Tf = Tmin + ((Tmax - Tmin) * i) / n;
    const phi = phiFromFlameT(Tf, T2, fuel);
    const e = dlnEmissions({ T2, P3, phiPz: phi, tauMs, fuel, calib });
    out.push({ Tflame: Tf, phi, NOx_ppm: e.NOx_ppm, CO_ppm: e.CO_ppm });
  }
  return out;
}

// ── NOx engine: zona terbakar per elemen (mirip Heywood two-zone, versi ringan) ──
function engineNOx({ th, P, step, N, Pivc, Tivc, phi, phiLocal, fuel, mFuel, mass, burn, calib, refO2 }) {
  const fu = FUELS[fuel], comp = burnedComposition(phiLocal, fuel);
  const xO2 = Math.max(comp.xO2, 0.01), xN2 = comp.xN2, n = th.length - 1;
  const dt = step / (6 * N);
  let nNO = 0, TbMax = 0;
  // Jejak per θ (tambahan visual, tidak mengubah hasil): TbTrace[i] = suhu tertinggi di antara elemen
  // zona terbakar pada θ[i] (0 = belum ada zona terbakar); noTrace[i] = NO kumulatif (kmol) pada θ[i].
  const TbTrace = new Float64Array(n + 1), noTrace = new Float64Array(n + 1);
  let prev = burn(th[0]).x;
  for (let j = 0; j < n; j++) {
    const xNow = burn(th[j + 1]).x, w = xNow - prev; prev = xNow;
    if (w < 1e-7) continue;
    const Tu = Tivc * Math.pow(P[j] / Pivc, 0.2647);                      // campuran tak terbakar (k≈1,36)
    const Tb0 = flameTemperature(phiLocal, Tu, fuel);
    const mBurned = w * mFuel * (1 + fu.AFRst / phiLocal);                 // kg
    let x = 0;
    for (let i = j; i < n; i++) {
      const Tb = Tb0 * Math.pow(P[i] / P[j], 0.219);                       // kompresi/ekspansi gas terbakar (k≈1,28)
      if (Tb > TbMax) TbMax = Tb;
      if (Tb > TbTrace[i]) TbTrace[i] = Tb;
      const xe = kpNO(Tb) * Math.sqrt(xO2 * xN2);
      if (x < xe) { x += calib * zeldovichK0(Tb, P[i], xO2, xN2) * (1 - (x / xe) ** 2) * dt; if (x > xe) x = xe; }
      noTrace[i + 1] += (x * mBurned) / comp.MW;
    }
    nNO += (x * mBurned) / comp.MW;                                        // kmol-ish (kg / (kg/kmol))
  }
  TbTrace[n] = TbTrace[n - 1];
  const compExh = burnedComposition(phi, fuel);
  const nExh = (mass + mFuel) / compExh.MW;
  const xExhWet = nNO / nExh;
  const NOx_ppmvd_ref = toDryRef(xExhWet, compExh, refO2);
  return { TburnedMax: TbMax, NO_ppmWet: xExhWet * 1e6, NOx_ppmvd_ref, NOx_mgNm3_ref: ppmToMgNm3(NOx_ppmvd_ref, MW.NO2), nNOkmol: nNO, TbTrace, noTrace };
}

/**
 * Panas yang dilepas per kg udara pada rasio ekuivalen φ (J/kg udara):
 * q = φ · LHV · combEff / AFRst. Untuk combustor premix: per kg udara ZONA PREMIX (bukan seluruh aliran).
 * Konsisten dengan cylinderSim (mFuel = φ·m/AFRst → Efuel/m = qinPerKgAir(φ)) dan braytonReal (mf = ṁ·qin/(LHV·combEff)).
 */
export const qinPerKgAir = (phi, fuel = 'gas', combEff = 1) => (phi * FUELS[fuel].LHV * 1e3 * combEff) / FUELS[fuel].AFRst;
/** Invers qinPerKgAir: φ yang melepas q (J/kg udara). Mis. φ keseluruhan turbin = phiFromQinPerKgAir(braytonReal().qin, 'gas', 0,99). */
export const phiFromQinPerKgAir = (q, fuel = 'gas', combEff = 1) => q / qinPerKgAir(1, fuel, combEff);

// ───────────────────── CO2, GHG, trade-off kebijakan ─────────────────────

/** CO2 spesifik g/kWh = EF[g/MJ]·3,6/η */
export const co2Specific = (eta, fuel = 'gas') => (FUELS[fuel].EF * 3.6) / eta;
/** Laju CO2 kg/h dari laju bahan bakar kg/h. */
export const co2MassRate = (mfKgH, fuel = 'gas') => (mfKgH * FUELS[fuel].LHV / 1e3 * FUELS[fuel].EF) / 1e3;
/** Bahan bakar kg/kWh = 3600/(η·LHV). */
export const fuelPerKWh = (eta, fuel = 'gas') => 3600 / (eta * FUELS[fuel].LHV);

/** CO2e termasuk methane slip (fraksi bahan bakar gas lolos tak terbakar). */
export function co2eWithSlip({ eta, slipFrac = 0.01, fuel = 'gas', gwp = GWP_CH4 }) {
  const co2 = co2Specific(eta, fuel);
  const ch4_g = fuelPerKWh(eta, fuel) * 1000 * slipFrac;
  return { co2, ch4_g, co2e: co2 + gwp * ch4_g, slipShare: (gwp * ch4_g) / (co2 + gwp * ch4_g) };
}

/** Penalti GHG langsung dari penalti bahan bakar (%) hasil modifikasi demi NOx. */
export function ghgPenalty({ eta, fuelPenaltyPct, fuel = 'gas' }) {
  const f = 1 + fuelPenaltyPct / 100, eta2 = eta / f;
  return { eta0: eta, eta1: eta2, co2_0: co2Specific(eta, fuel), co2_1: co2Specific(eta2, fuel), deltaPct: (f - 1) * 100 };
}

/** Sapuan retard timing pada engine: NOx turun, η turun, CO2 naik. (Hubungan NOx–GHG dari fisika, bukan angka tebakan.) */
export function retardSweep(kind = 'diesel', thetas = [-8, -6, -4, -2, 0, 2, 4], over = {}) {
  return thetas.map((t0) => {
    const s = cylinderSim({ ...ENGINE_PRESETS[kind], theta0: t0, ...over });
    return { theta0: t0, Pmax_bar: s.Pmax / 1e5, TburnedMax: s.TburnedMax, NOx_ppm: s.NOx_ppmvd_ref, NOx_gkWh: s.NOx_gkWh, etaBrake: s.etaBrake, bsfc: s.bsfc, co2_gkWh: s.co2_gkWh };
  });
}

/**
 * Faktor kalibrasi NOx engine agar preset (+ over) menghasilkan targetGkWh (g/kWh).
 * NOx TIDAK linear terhadap calib (dibatasi kesetimbangan NO: calib 1 → 23,7 g/kWh diesel, bukan 63),
 * jadi calibrateTo diulang (iterasi titik tetap) sampai |galat| < tol relatif.
 */
export function calibrateEngineNOx(kind = 'diesel', targetGkWh, over = {}, { calib0 = ENGINE_NOX_CALIB, maxIter = 12, tol = 1e-3 } = {}) {
  const nox = (c) => cylinderSim({ ...ENGINE_PRESETS[kind], ...over, calib: c }).NOx_gkWh;
  let calib = calib0, got = nox(calib), iter = 0;
  while (Math.abs(got / targetGkWh - 1) > tol && iter < maxIter) {
    calib *= calibrateTo((k) => (k === 1 ? got : nox(calib * k)), targetGkWh);
    got = nox(calib); iter++;
  }
  return { calib, NOx_gkWh: got, iterations: iter, converged: Math.abs(got / targetGkWh - 1) <= tol };
}

/**
 * Waterfall: dari batas ideal ke efisiensi rem (5 langkah). Nilai = η kumulatif.
 * window: 'full' (default) = fase tertutup penuh ±180°; 'preset' = IVC/EVO preset (±150°),
 * sehingga langkah terakhir sama dengan η rem cylinderSim preset (HUD Scene 1).
 */
export function lossWaterfall(kind = 'diesel', over = {}, { window = 'full' } = {}) {
  const base = { ...ENGINE_PRESETS[kind], ...over, nox: false, ...(window === 'full' ? { ivc: -180, evo: 180 } : {}) };
  const eta0 = 1 - 1 / Math.pow(base.r, K_AIR - 1);
  const s1 = cylinderSim({ ...base, theta0: -1, dur: 2, premixFrac: 0, lossFrac: 0, combEff: 1 });
  const s2 = cylinderSim({ ...base, lossFrac: 0, combEff: 1 });
  const s3 = cylinderSim({ ...base });
  const steps = [
    { label: 'Ideal limit (Otto, k = 1.4)', eta: eta0 },
    { label: 'Specific heat rises with T (k falls)', eta: s1.etaInd },
    { label: 'Combustion takes time (Wiebe)', eta: s2.etaInd },
    { label: 'Wall heat loss + unburned fuel', eta: s3.etaInd },
    { label: 'Mechanical friction (brake efficiency)', eta: s3.etaBrake },
  ];
  return steps.map((s, i) => ({ ...s, delta: i ? s.eta - steps[i - 1].eta : 0 }));
}

/**
 * Volume spesifik & entropi sepanjang hasil cylinderSim (untuk diagram T-s real).
 * v = V/m; s − s(IVC) = ∫cv(T)/T dT + R·ln(v/v_ivc), memakai cvOfT yang sama dengan simulasi
 * (cv = CV_AIR + 0,115·(T−300) → ∫cv/T dT = (CV_AIR − 34,5)·ln(T/T0) + 0,115·(T−T0)).
 * Kompresi adiabatik → Δs ≈ 0; pembakaran menaikkan s. Acuan s = 0 di IVC.
 */
export function simStates(sim) {
  const n = sim.th.length, v = new Float64Array(n), s = new Float64Array(n);
  const T0 = sim.T[0], v0 = sim.V[0] / sim.mass, a = CV_AIR - 0.115 * 300;
  for (let i = 0; i < n; i++) {
    v[i] = sim.V[i] / sim.mass;
    s[i] = a * Math.log(sim.T[i] / T0) + 0.115 * (sim.T[i] - T0) + R_AIR * Math.log(v[i] / v0);
  }
  return { v, s };
}

// ───────────────────── Gas exchange & sampling untuk animasi ─────────────────────

/** Angkat katup half-sine antara open..close (derajat); 0 di luar jendela. */
export const valveLift = (th, open, close, max = 1) => (th <= open || th >= close) ? 0 : max * Math.sin((Math.PI * (th - open)) / (close - open));

/** Sudut engkol pada waktu t (s) untuk rpm visual (slow-motion), dinormalkan ke [-360,360). */
export const crankAngleAt = (t, rpmVisual = 30, th0 = -360) => (((th0 + 6 * rpmVisual * t + 360) % 720) + 720) % 720 - 360;

/** Keadaan silinder pada sudut tertentu (interpolasi dari cylinderSim; di luar fase tertutup disederhanakan). */
export function sampleSim(sim, th, { Pexh = 1.05e5 } = {}) {
  const { th: arr, P, T, V, xb, params: q, geo } = sim;
  const lo = arr[0], hi = arr[arr.length - 1];
  const Vcur = geo.V(th);
  if (th >= lo && th <= hi) {
    const f = (th - lo) / (hi - lo) * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(f)), u = f - i;
    return { th, V: Vcur, P: lerp(P[i], P[i + 1], u), T: lerp(T[i], T[i + 1], u), xb: lerp(xb[i], xb[i + 1], u), phase: th < 0 ? 'kompresi' : 'ekspansi', pistonPos: geo.pistonPos(th) };
  }
  if (th > hi) {
    const Pn = Pexh + (P[P.length - 1] - Pexh) * Math.exp(-(th - hi) / 10);
    const Tn = T[T.length - 1] * Math.pow(Pn / P[P.length - 1], 0.22);
    return { th, V: Vcur, P: Pn, T: Tn, xb: 1, phase: 'exhaust', pistonPos: geo.pistonPos(th) };
  }
  return { th, V: Vcur, P: q.Pivc, T: q.Tivc, xb: 0, phase: 'intake', pistonPos: geo.pistonPos(th) };
}

/** Loop P-V (Pa, m³) fase tertutup + penutup sederhana untuk plotting. */
export function pvLoop(sim) {
  const closed = Array.from(sim.th, (_, i) => ({ V: sim.V[i], P: sim.P[i], th: sim.th[i] }));
  const last = closed[closed.length - 1], first = closed[0];
  const Pexh = 1.05e5;
  return { closed, blowdown: [last, { V: last.V, P: Pexh }], exhaust: [{ V: last.V, P: Pexh }, { V: sim.geo.Vc, P: Pexh }],
           intake: [{ V: sim.geo.Vc, P: first.P }, { V: first.V, P: first.P }] };
}

// ───────────────────────── Helper visual (3D) ─────────────────────────

function gradient(stops, t) {
  const u = clamp(t, 0, 1);
  for (let i = 1; i < stops.length; i++) {
    if (u <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], k = (u - t0) / (t1 - t0);
      return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)];
    }
  }
  return stops[stops.length - 1][1];
}
const TEMP_STOPS = [[0, [0.05, 0.10, 0.55]], [0.25, [0.0, 0.55, 0.85]], [0.5, [0.95, 0.85, 0.20]], [0.75, [0.95, 0.35, 0.08]], [1, [1, 0.97, 0.9]]];
/** Suhu (K) → RGB 0..1 (biru → cyan → kuning → oranye → putih). Skala harus ditampilkan sebagai legenda. */
export const tempToRGB = (T, Tmin = 300, Tmax = 2600) => gradient(TEMP_STOPS, (T - Tmin) / (Tmax - Tmin));
/** φ → warna api: lean biru, stoikiometrik biru-putih, rich kuning/oranye. */
export const flameColor = (phi) => gradient([[0, [0.25, 0.45, 1]], [0.45, [0.55, 0.75, 1]], [0.55, [0.95, 0.97, 1]], [0.75, [1, 0.75, 0.25]], [1, [1, 0.45, 0.1]]], (phi - 0.4) / 1.2);
/** Normalisasi log 0..1 untuk laju partikel/emisi (value dibanding ref). */
export const logNorm = (value, ref, decades = 2) => clamp(1 + Math.log10(Math.max(value, 1e-12) / ref) / decades, 0, 1);

// ───────────────────────────── Self-test ─────────────────────────────

/** Jalankan di console browser/Node: selfTest() → {passed, failed, results[]}. */
export function selfTest() {
  const results = [];
  const near = (name, got, want, tol) => results.push({ name, got, want, ok: Math.abs(got - want) <= tol });
  const o = otto({ r: 10 }), d = diesel({ r: 18, rc: 2 }), du = dual({ r: 16, rp: 1.5, rc: 1.4 }), b = braytonIdeal({ rp: 15 });
  near('Otto r=10 η', o.eta, 0.6019, 5e-4);
  near('Diesel r=18 rc=2 η', d.eta, 0.6316, 1e-3);
  for (const [n, c] of [['otto', o], ['diesel', d], ['dual', du], ['brayton', b]]) near(`${n}: η rumus = wnet/qin`, c.eta, c.etaCheck, 1e-9);
  near('Brayton ideal rp=15 η', b.eta, 0.5388, 5e-4);
  const g = engineGeometry({ bore: 0.2, stroke: 0.26, conrod: 0.52, r: 16 });
  near('V(0)=Vc', g.V(0), g.Vc, 1e-12);
  near('V(180)=Vc+Vd', g.V(180), g.Vc + g.Vd, 1e-12);
  near('CO2 gas η=0,35 [g/kWh]', co2Specific(0.35, 'gas'), 577.0, 0.2);
  near('CO2 diesel η=0,42 [g/kWh]', co2Specific(0.42, 'diesel'), 635.1, 0.2);
  const real = braytonReal({});
  near('Brayton real η (rp15, T3 1500)', real.eta, 0.385, 0.01);
  const sim = cylinderSim({ ...ENGINE_PRESETS.diesel, nox: false });
  results.push({ name: 'Sim diesel: Pmax 100–220 bar', got: sim.Pmax / 1e5, want: '100–220', ok: sim.Pmax / 1e5 > 100 && sim.Pmax / 1e5 < 220 });
  results.push({ name: 'Sim diesel: η rem 0,35–0,50', got: sim.etaBrake, want: '0,35–0,50', ok: sim.etaBrake > 0.35 && sim.etaBrake < 0.5 });
  const passed = results.filter((r) => r.ok).length;
  return { passed, failed: results.length - passed, results };
}
