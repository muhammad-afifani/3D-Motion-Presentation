/**
 * strings.js — SATU-SATUNYA tempat teks UI. Edit di sini untuk mengubah tampilan.
 *
 * Aturan bahasa (CLAUDE.md → Konvensi):
 *   - Inggris: istilah teknis engineering dan label kontrol/menu/HUD/judul grafik/sumbu/status.
 *   - Indonesia: kalimat penjelasan, pesan kunci, judul scene, tooltip, catatan/caption, toast.
 *   - Jangan memaksakan terjemahan bila canggung. Angka tetap dari model/frame; pemisah desimal koma.
 * Teks berparameter ditulis sebagai fungsi kecil. `\n` di tooltip = baris baru.
 */
import { fmt } from './format.js';

/** Sudut bertanda: −4,0° */
export const signedDeg = (v) => `${v < 0 ? '−' : ''}${fmt(Math.abs(v), 1)}°`;
/** Sudut dengan tanda + / −: +3,5° */
export const plusDeg = (v) => `${v < 0 ? '−' : '+'}${fmt(Math.abs(v), 1)}°`;

export const STR = {
  // ─────────────────────────── umum (dipakai semua scene) ───────────────────────────
  common: {
    play: 'Play', pause: 'Pause', freeze: 'Freeze', unfreeze: 'Unfreeze', reset: 'Reset', labels: 'Labels',
    animSpeed: 'Animation speed', crankAngle: 'Crank angle θ',
    keySpace: 'Space',
    paused: 'PAUSED',
    frozen: (theta) => `FROZEN · θ = ${signedDeg(theta)}`,
    locked: '(locked)',
    slowMo: (k, rpm, N) => `Slow-motion ×${fmt(k, 3)} · ${fmt(rpm, 0)} rpm visual (engine ${fmt(N, 0)} rpm)`,
    units: { bar: 'bar', K: 'K', pct: '%', mm: 'mm', L: 'L', gkWh: 'g/kWh', kJkg: 'kJ/kg', kJkWh: 'kJ/kWh', MW: 'MW', degC: '°C', pp: 'pp', atdc: 'ATDC', rpmVisual: 'rpm visual' },
    /** Label tingkat model (pojok tiap grafik). */
    level: { ideal: 'Ideal', real: 'Real (component efficiency)', semiEmpirical: 'Semi-empirical', siteData: 'Site data' },
    levelTip: 'Tingkat model: Ideal / Real (efisiensi komponen) / Semi-empiris / data lapangan',
    phase: { intake: 'Intake', kompresi: 'Compression', ekspansi: 'Expansion', exhaust: 'Exhaust' },
    tempLegend: 'Gas T [K]',
    /** Basis angka emisi — wajib tampil di samping setiap ppm / mg/Nm³ (basis aktif dari panel H). */
    basis: {
      full: (refO2, TrefC) => `sebagai NO₂, dry (ppmvd), @ ${fmt(refO2, Number.isInteger(refO2) ? 0 : 1)} % O₂, ${fmt(TrefC, 0)} °C`,
      flag: 'Non-default basis',
      flagTip: 'Basis tampilan diubah di panel asumsi (H). Default: 15 % O₂, 0 °C.',
    },
    webglFallback: '<b>WebGL2 tidak tersedia.</b><br />Grafik dan angka tetap berjalan; tampilan 3D dinonaktifkan.',
    tips: {
      play: 'Jeda/putar animasi. Saat jeda, θ masih bisa digeser.',
      freeze: 'Bekukan state: waktu berhenti dan θ terkunci untuk menunjuk satu titik. Tekan lagi untuk melepas.',
      animSpeed: 'Hanya kecepatan tampilan (slow-motion). N mesin di model tetap.',
      crankAngle: 'Geser untuk menjeda dan memeriksa satu sudut. 0° = TDC pembakaran. Terkunci saat Freeze (F).',
    },
  },

  // ─────────────────────────── aplikasi (bilah atas, toast, lencana) ───────────────────────────
  app: {
    brand: 'Engine & Turbine Emission Lab',
    sceneTag: (n, title) => `Scene ${n} · ${title}`,
    docTitle: (title) => `${title} · Engine & Turbine Emission Lab`,
    toast: {
      noScene: 'Scene lain dibangun di milestone berikutnya',
      frozenHint: 'Sedang Freeze: tekan F untuk melepas',
      reset: 'Parameter dikembalikan ke preset',
      turbine: 'Turbin: Scene 5 (milestone M5)',
      presenter: 'Mode presenter: milestone M8',
    },
    badge: {
      ok: (passed, total) => `Model OK · ${passed}/${total}`,
      fail: (failed, total) => `Model FAIL · ${failed}/${total}`,
      okTip: (passed) => `selfTest() thermo.js: ${passed} tes lulus`,
    },
  },

  // ─────────────────────────── grafik bersama ───────────────────────────
  charts: {
    pv: {
      title: 'P-V diagram', xLabel: 'Cylinder volume V [L]', yLabel: 'Pressure P [bar]',
      scaleLinear: 'Scale: linear', scaleLog: 'Scale: log-log',
      scaleTip: 'Ganti skala linier / log-log (proses politropik tampak lurus pada skala log-log)',
      tdc: 'TDC', bdc: 'BDC',
      caption: (wKJ, imepBar, vdL) => `Luas arsir = W kotor = <b>${fmt(wKJ, 2)} kJ</b>/siklus (IMEP ${fmt(imepBar, 1)} bar × V<sub>d</sub> ${fmt(vdL, 2)} L)`,
      captionGasx: 'pertukaran gas (disederhanakan)',
    },
    cycle: {
      pv: { title: 'P-v diagram', xLabel: 'Specific volume v [m³/kg]', yLabel: 'Pressure P [bar]' },
      ts: { title: 'T-s diagram', xLabel: 'Entropy s − s₁ [kJ/(kg·K)]', yLabel: 'Temperature T [K]' },
      stateInfo: (label, note, T, P, v, s) =>
        `State ${label}${note ? ` (${note})` : ''}\nT = ${fmt(T, 0)} K\nP = ${fmt(P / 1e5, 2)} bar\nv = ${fmt(v, 4)} m³/kg\ns − s₁ = ${fmt(s / 1e3, 3)} kJ/(kg·K)`,
      ghost: 'pembanding ideal (garis putus)',
      closing: 'EVO→IVC: pertukaran gas tidak digambar',
      hoverHint: 'Arahkan kursor ke titik state untuk melihat T, P, v, s',
    },
    waterfall: { title: 'Efficiency waterfall', yLabel: 'η [%]' },
    brayton: {
      title: 'Brayton schematic (state markers)',
      compressor: 'Compressor', combustor: 'Combustor', turbine: 'Turbine',
      returnPath: '4→1 buang panas ke lingkungan (siklus tertutup secara konsep)',
      note: 'Skema 2D penanda state, bukan rig turbin (rig 3D: Scene 5)',
    },
    flame: {
      title: 'Adiabatic flame temperature vs φ (indikatif ±100 K)',
      xLabel: 'Equivalence ratio φ (1 = stoichiometric)', yLabel: 'Adiabatic flame T [K]',
      stoich: 'stoichiometric', lean: '← lean', rich: 'rich →',
      caption: (Tin, manual, fuel) => `T<sub>in</sub> = ${fmt(Tin, 0)} K ${manual ? '(manual)' : '(model)'} · T<sub>in</sub> = 300 K (garis putus) · bahan bakar: ${fuel === 'diesel' ? 'solar' : 'gas alam'}`,
      dT: (dT) => `ΔT = +${fmt(dT, 0)} K`,
      point: (label, phi, T) => `${label}: φ ${fmt(phi, 2)} → ${fmt(T, 0)} K`,
    },
  },

  // ─────────────────────────── Scene 1 — piston & P-V ───────────────────────────
  scene1: {
    title: 'Piston: dari engkol ke diagram P-V',
    message: 'Satu siklus (2 putaran engkol, 4-tak) = satu loop di diagram P-V; luas loop = kerja.',
    engine: 'Engine',
    engines: { diesel: 'Diesel', gas: 'Gas engine' },
    r: 'Compression ratio r',
    phi: 'Equivalence ratio φ',
    theta0: 'Start of combustion θ₀',
    tips: {
      r: 'r = (Vc+Vd)/Vc. Mengubah Vc, sehingga tinggi ruang bakar, Pmax, dan η berubah.',
      phi: 'φ = (bahan bakar/udara) ÷ stoikiometrik. φ < 1 = miskin (lean).',
      theta0: 'Timing injeksi (diesel) / percikan busi (gas). Negatif = sebelum TDC.',
      reset: 'Kembalikan parameter ke preset mesin',
      labels: 'Tampilkan/sembunyikan label komponen 3D',
      gauge: 'Tekanan silinder relatif terhadap Pmax siklus ini',
    },
    labels3d: {
      crank: 'Crankshaft', rod: 'Connecting rod', piston: 'Piston', valveIn: 'Intake valve', valveEx: 'Exhaust valve',
      gas: 'Gas (warna = suhu)', injector: 'Injector', sparkPlug: 'Spark plug',
    },
    /** Rumus crank-slider (HTML; span bertanda kelas menyala saat relevan). */
    formula: {
      s: '<span class="fv v-s">s(<span class="v-theta">θ</span>)</span> = a·cos <span class="v-theta">θ</span> + √(l² − a²·sin²<span class="v-theta">θ</span>)',
      V: '<span class="fv v-V">V(<span class="v-theta">θ</span>)</span> = <span class="fv v-vc">V<sub>c</sub></span> + (πB²/4)·(l + a − s(<span class="v-theta">θ</span>))',
      theta: '<span class="v-theta">θ</span> = ', x: 'l + a − s = ', Vnow: 'V = ', B: 'B = ', a: 'a = ', l: 'l = ',
      Vc: 'V<sub>c</sub> = V<sub>d</sub>/(r−1) = ',
      VcVal: (vcL, r) => `${fmt(vcL, 3)} L (r = ${fmt(r, 1)})`,
    },
    readout: { P: 'P', T: 'T', xb: 'x<sub>b</sub>' },
    hud: {
      pmax: { label: 'P<sub>max</sub>', tip: 'Tekanan puncak silinder.\nSumber: cylinderSim().Pmax: integrasi RK4 hukum I termodinamika, pelepasan panas Wiebe, k(T).' },
      thpmax: { label: 'θ at P<sub>max</sub>', tip: 'Sudut engkol saat tekanan puncak; + = setelah TDC (ATDC).\nSumber: cylinderSim().thetaPmax.' },
      imep: { label: 'IMEP (gross)', tip: 'IMEP = W kotor / Vd, dengan W = ∮P dV fase tertutup (IVC→EVO) = luas arsir P-V.\nKerja pumping diabaikan.\nSumber: cylinderSim().imepG.' },
      etai: { label: 'Indicated η', tip: 'η indikator = W kotor / (m_bb · LHV) per siklus.\nSumber: cylinderSim().etaInd.' },
      etab: { label: 'Brake η', tip: 'η rem = P rem / (ṁ_bb · LHV); BMEP = IMEP − FMEP.\nFMEP: korelasi Chen–Flynn (indikatif).\nSumber: cylinderSim().etaBrake.' },
      bsfc: { label: 'BSFC', tip: 'Konsumsi bahan bakar spesifik rem = ṁ_bb / P rem.\nSumber: cylinderSim().bsfc.' },
      note: 'cylinderSim: crank-slider + Wiebe + hukum I, k(T); rugi panas dilumpkan; friksi Chen–Flynn (indikatif). Bukan prediksi vendor.',
    },
    ptheta: {
      title: 'Pressure vs crank angle (P-θ)', xLabel: 'Crank angle θ [°], 0 = firing TDC', yLabel: 'P [bar]',
      tdc: 'TDC', bdc: 'BDC',
      pmax: (p) => `Pmax ${fmt(p, 1)} bar`,
      caption: (t0, t1) => `pembakaran θ₀ ${signedDeg(t0)} … ${signedDeg(t1)} (Wiebe) · intake/exhaust disederhanakan`,
    },
  },

  // ─────────────────────────── Scene 2 — siklus ideal vs real ───────────────────────────
  scene2: {
    title: 'Siklus ideal vs real',
    message: 'Pada r sama Otto ≥ Diesel; diesel unggul karena r-nya jauh lebih tinggi.',
    messageWithNumbers: (idealLo, idealHi, brakeLo, brakeHi) =>
      `Pada r sama Otto ≥ Diesel; diesel unggul karena r-nya jauh lebih tinggi. Teori ${fmt(idealLo * 100, 0)}⁠–⁠${fmt(idealHi * 100, 0)}% → η rem ${fmt(brakeLo * 100, 0)}⁠–⁠${fmt(brakeHi * 100, 0)}% (model).`,
    cycle: 'Cycle', model: 'Model', ideal: 'Ideal', real: 'Real',
    kinds: { otto: 'Otto', diesel: 'Diesel', dual: 'Dual', brayton: 'Brayton' },
    r: 'Compression ratio r', rc: 'Cut-off ratio r_c', rp: 'Pressure ratio r_p (isochoric)', rpB: 'Pressure ratio r_p',
    T3: 'Turbine inlet T₃', theta: 'Position θ', replay: 'Replay waterfall',
    readT: 'T = ', readP: 'P = ',
    tips: {
      mode: 'Ideal: siklus air-standard. Real: cylinderSim (piston) atau braytonReal (turbin), dengan pembanding ideal.',
      rc: 'r_c = v3/v2: lama injeksi pada tekanan tetap.',
      theta: 'Piston: sudut engkol. Brayton: 180° per proses (1→2, 2→3, 3→4, 4→1).',
      reset: 'Kembalikan parameter siklus ke nilai acuan (golden test)',
      replay: 'Putar ulang animasi bar waterfall dari awal',
    },
    /** Rumus η ideal (teks; nilainya dihitung thermo.js). */
    formula: {
      otto: 'η = 1 − 1 / r^(k−1)',
      diesel: 'η = 1 − (1 / r^(k−1)) · (r_c^k − 1) / (k·(r_c − 1))',
      dual: 'η = 1 − (1 / r^(k−1)) · (r_p·r_c^k − 1) / ((r_p − 1) + k·r_p·(r_c − 1))',
      brayton: 'η = 1 − 1 / r_p^((k−1)/k)',
    },
    hud: {
      etaIdeal: 'Ideal η', ottoSameR: 'Otto η (same r)', mep: 'MEP', tmax: 'T max', pmax: 'P max',
      etaIdealQin: 'Ideal η (same q_in)', etaIdealDual: 'Ideal η (r_p, r_c slider)', etaInd: 'Indicated η', etaBrake: 'Brake η',
      gapBrake: 'Gap ideal → brake', pmaxReal: 'Real P<sub>max</sub>', bwr: 'Back-work ratio', wnet: 'w<sub>net</sub>',
      t2: 'T<sub>2</sub> compressor outlet', t4: 'T<sub>4</sub> exhaust', etaReal: 'Real η', gapReal: 'Gap ideal → real',
      tips: {
        etaIdeal: (formula, fn) => `${formula}\nk = 1,4 (air-standard).\nSumber: ${fn}().eta`,
        ottoSameR: 'Pembanding: Otto ideal pada r yang sama.\nPada r sama Otto ≥ Diesel; diesel unggul karena r lebih tinggi.\nSumber: otto({r}).eta',
        mep: 'Tekanan efektif rata-rata = w_net / (v1 − v2).\nSumber: cycle.mep',
        tmax: 'Suhu state tertinggi siklus ideal.\nOtto: Tmax default 2200 K; Diesel/Dual: dari r_c, r_p.',
        pmax: 'Tekanan state tertinggi (T1 = 300 K, P1 = 1 atm).',
        etaIdealQin: (formula) => `${formula}\nPembanding ideal memakai T1, P1 = IVC real dan q_in = Qtot/massa cylinderSim.`,
        etaIdealDual: (formula) => `${formula}\nPembanding Dual memakai r_p dan r_c slider; q_in tidak disamakan dengan pembakaran real.`,
        etaInd: 'η indikator = W kotor / energi bahan bakar.\nSumber: cylinderSim().etaInd',
        etaBrake: 'η rem = P rem / (ṁ_bb·LHV); friksi Chen–Flynn (indikatif).\nSumber: cylinderSim().etaBrake',
        gapBrake: 'η ideal − η rem (poin persen). Rinciannya di waterfall: k(T), pembakaran berwaktu, rugi panas, friksi.',
        pmaxReal: 'Sumber: cylinderSim().Pmax',
        etaIdealBrayton: (formula) => `${formula}\nSumber: braytonIdeal().eta`,
        bwrIdeal: 'Kerja kompresor / kerja turbin.\nSumber: braytonIdeal().backWorkRatio',
        wnet: 'Kerja bersih per kg udara.',
        t2: 'Suhu keluar kompresor.',
        t4: 'Suhu gas buang turbin.\nSumber: braytonReal().T4',
        etaReal: 'ηc 0,87, ηt 0,90, ΔP combustor 4%, mekanis 0,99.\nSumber: braytonReal().eta',
        gapReal: 'η ideal − η real (poin persen), akibat efisiensi komponen.',
        bwrReal: 'Kompresor memakan sebagian besar kerja turbin.\nSumber: braytonReal().backWorkRatio',
      },
      notePiston: 'Celah ideal → nyata = fisika, bukan kesalahan: k(T), waktu pembakaran, panas ke dinding, friksi.',
      noteBrayton: 'Real: efisiensi komponen (ηc, ηt), rugi tekanan, rugi mekanis.',
    },
    /** Nama proses untuk tampilan (thermo.js tidak diubah; dipetakan per jenis & indeks). */
    procs: {
      otto: ['1→2 isentropic compression', '2→3 constant-volume heat addition (spark)', '3→4 isentropic expansion', '4→1 constant-volume heat rejection'],
      diesel: ['1→2 isentropic compression', '2→3 constant-pressure heat addition (injection)', '3→4 isentropic expansion', '4→1 constant-volume heat rejection'],
      dual: ['1→2 isentropic compression', '2→3 constant-volume heat addition', '3→4 constant-pressure heat addition', '4→5 isentropic expansion', '5→1 constant-volume heat rejection'],
      brayton: ['1→2 isentropic compression', '2→3 constant-pressure combustion', '3→4 isentropic expansion', '4→1 constant-pressure heat rejection'],
      braytonReal: ['1→2 real compression', '2→3 combustor (ΔP)', '3→4 real expansion', '4→1 exhaust'],
      real: ['Closed phase IVC→EVO (cylinderSim)', 'Gas exchange (tidak dimodelkan di diagram)'],
    },
    point: {
      exchangeIdeal: 'Langkah buang/isap: tidak ada di siklus air-standard',
      closedReal: 'Closed phase (cylinderSim)',
      exchangeReal: 'Pertukaran gas: di luar diagram fase tertutup',
    },
    refNotes: { ivc: 'IVC', soc: 'SOC θ₀', pmax: 'Pmax', evo: 'EVO' },
    notes: {
      knockIdeal: (rMax) => `r > ${fmt(rMax, 0)} tidak realistis untuk gas engine (knocking, tidak dimodelkan).`,
      knockReal: (rMax) => `r gas engine nyata dibatasi ≤ ${fmt(rMax, 0)} (knocking, tidak dimodelkan).`,
      dualRef: 'Pembanding ideal Dual memakai r_p dan r_c slider (q_in tidak disamakan dengan pembakaran real).',
    },
    waterfall: {
      title: (engine, r) => `${engine === 'gas' ? 'Gas engine' : 'Diesel'} waterfall: ideal limit → brake η (r = ${fmt(r, 1)})`,
      caption: 'lossWaterfall(…, {window: \'preset\'}): IVC/EVO preset, langkah terakhir = η rem cylinderSim',
      steps: ['Ideal limit (Otto, k = 1,4)', 'Variable specific heat k(T)', 'Finite combustion duration (Wiebe)', 'Wall heat loss + unburned', 'Mechanical friction (brake η)'],
      braytonTitle: 'Brayton: ideal → real',
      braytonCaption: 'Dua bar: model Brayton tidak punya rincian rugi bertahap',
      brayton: { braytonIdeal: 'Brayton ideal', braytonReal: 'Real: ηc, ηt, combustor ΔP, mechanical loss' },
    },
  },

  // ─────────────────────────── Scene 3 — pembakaran ───────────────────────────
  scene3: {
    title: 'Pembakaran, φ, dan suhu nyala',
    message: 'Suhu nyala ditentukan campuran. Diesel punya zona panas lokal; gas lean-burn homogen dan lebih dingin.',
    chamber: 'Combustion chamber',
    modes: { diesel: 'Diesel', gas: 'Gas engine', turbine: 'Turbine (premix)' },
    phiLabel: { diesel: 'Global φ (mean)', gas: 'Mixture φ (homogeneous)', turbine: 'Premix-zone φ' },
    phiLocal: 'Local φ (flame zone)',
    tin: 'Inlet mixture T',
    tinValue: (Tin, manual) => `${fmt(Tin, 0)} K ${manual ? '(manual)' : '(model)'}`,
    tinModel: 'T_in from model',
    focus: 'Combustion window focus',
    bloom: { auto: 'Bloom: Auto', on: 'Bloom: On', off: 'Bloom: Off' },
    tips: {
      phiLocal: 'Diesel: semprotan bahan bakar membentuk kantong hampir stoikiometrik di sekitar plume (phiLocal).',
      tin: 'Geser = skenario "bagaimana jika". Default dari model.',
      tinModel: 'Kembalikan suhu masuk ke nilai model (piston: T saat θ₀; turbin: T₂)',
      focus: 'Animasi θ hanya diputar di sekitar θ₀ … akhir pembakaran, agar nyala tidak hanya tampak sebentar.',
      bloom: 'Efek cahaya (glow) di sekitar nyala. Matikan bila animasi berat.\nAuto: dimatikan otomatis bila fps < 30 selama 2 detik. Klik: Auto → On → Off.',
      reset: 'Kembalikan parameter ruang bakar ke preset',
    },
    hud: {
      tflame: { label: 'Adiabatic flame temperature', tip: (diesel) => `flameTemperature(φ${diesel ? ' lokal' : ''}, T_in, bahan bakar).\nSuhu nyala adiabatik SAAT campuran terbakar, BUKAN "Peak burned-zone temperature" di Scene 4 (gas terbakar yang ikut tertekan, lebih panas).\nIndikatif ±100 K.` },
      dT: { label: 'ΔT local zone vs global φ', tip: 'flameTemperature(φ lokal) − flameTemperature(φ global) pada T_in yang sama.\nCampuran tak homogen: kantong hampir stoikiometrik walau rata-rata miskin.' },
      phiTip: { turbine: 'φ di zona premix combustor (DLN), bukan φ keseluruhan turbin.', other: 'φ = (bahan bakar/udara) ÷ stoikiometrik.' },
      tin: { label: 'Inlet mixture T', tipTurbine: 'Model: T₂ keluar kompresor (braytonReal).', tipPiston: 'Model: suhu gas saat θ₀ (akhir kompresi, sebelum terbakar) dari cylinderSim.' },
      q: { label: 'q_in per kg premix-zone air', tip: 'qinPerKgAir(φ zona premix, gas) = φ·LHV/AFR_st.\nUkuran nyala ∝ q_in (dinormalisasi ke φ = 1,2).' },
      hr: { label: 'Heat release rate (relative)', tip: 'Qtot·dx_b/dθ dari cylinderSim, dinormalisasi ke φ = 1,2.\nUkuran & kecerahan nyala mengikuti nilai ini.' },
      note: 'flameTemperature: tabel T_ad CH₄ + koreksi solar; efek preheat 0,5–0,8 × ΔT_in (disosiasi). Indikatif ±100 K.',
    },
    overlay: {
      tflameLabel: 'Suhu nyala adiabatik saat terbakar:',
      mixDiesel: (phi, phiLocal, dT) => `Campuran TAK homogen: rata-rata φ ${fmt(phi, 2)}, zona nyala φ ${fmt(phiLocal, 2)} (ΔT +${fmt(dT, 0)} K)`,
      mixGas: (phi) => `Campuran homogen: seluruh muatan φ ${fmt(phi, 2)} → nyala lebih dingin`,
      mixTurbine: (phi, Tin) => `Premix miskin: φ zona premix ${fmt(phi, 2)}, T_in = T₂ ${fmt(Tin, 0)} K`,
      phasePiston: (theta, phase, pctHr) => `θ = ${signedDeg(theta)} · ${phase} · laju pelepasan panas ${fmt(pctHr, 0)}% (relatif)`,
      phaseTurbine: (qKJ) => `q_in zona premix ${fmt(qKJ, 0)} kJ/kg udara · nyala ∝ q_in`,
    },
    notes: {
      premix: (T3, phiOverall) => `φ zona premix, bukan φ keseluruhan (T₃ ${fmt(T3, 0)} K ≈ ${fmt(phiOverall, 2)})`,
      tinManual: (TinModel) => `T_in manual (model: ${fmt(TinModel, 0)} K)`,
    },
    status: {
      bloom: (on, autoOff) => `Bloom ${on ? 'on' : 'off'}${autoOff ? ' (auto: low fps)' : ''}`,
    },
    toastBloomOff: (fps) => `Bloom dimatikan otomatis (fps ${fmt(fps, 0)} < 30). Tekan B untuk mengatur.`,
    points: {
      phiGlobalHypo: 'Global φ (if homogeneous)', phiMixture: 'Mixture φ', phiPremix: 'Premix-zone φ', phiLocal: 'Local φ (flame zone)',
    },
    bars: {
      title: 'Adiabatic flame temperature in the reaction zone (comparison)',
      xLabel: 'Adiabatic flame T [K]',
      labels: { diesel: 'Diesel: local-φ zone', gas: 'Gas lean-burn (homogeneous)', turbine: 'Turbine: premix zone' },
      sub: (phi, Tin) => `φ ${fmt(phi, 2)} · T_in ${fmt(Tin, 0)} K`,
      caption: 'Masing-masing pada T_in model-nya; mode aktif mengikuti slider. Warna bar = flameColor(φ).',
    },
  },
  // ─────────────────────────── Scene 4 — NOx ───────────────────────────
  scene4: {
    title: 'NOx: kenapa suhu begitu menentukan',
    message: 'NOx tidak naik linier dengan suhu, tetapi eksponensial.',
    messageWithNumbers: (ratio, Tref) =>
      `NOx naik eksponensial terhadap suhu: +100 K di ${fmt(Tref, 0)} K ≈ ×${fmt(ratio, 1)} laju pembentukan NO (model Zeldovich).`,
    engine: 'Engine',
    engines: { diesel: 'Diesel', gas: 'Gas lean-burn' },
    timing: { diesel: 'Injection timing θ₀', gas: 'Spark timing θ₀' },
    window: 'Crank angle θ',
    tips: {
      engine: 'Preset engine dari thermo.js (sama dengan Scene 1). Hanya timing yang diubah di scene ini.',
      timing: 'Awal pembakaran θ₀ (° ATDC; negatif = sebelum TDC). Geser ke kanan = retard: puncak suhu zona terbakar turun → NOx turun, tetapi η turun dan CO₂ naik.',
      window: 'Animasi hanya memutar jendela akhir kompresi → EVO, tempat zona terbakar ada. Geser untuk menjeda di satu sudut.',
      reset: 'Kembalikan timing ke preset engine',
      labels: 'Tampilkan/sembunyikan label komponen 3D',
    },
    formula: {
      zeldovich: 'd[NO]/dt ≈ 6×10¹⁶/√T · exp(−69.090/T) · [O₂]<sup>½</sup> [N₂]',
      o2: 'C<sub>ref</sub> = C · (20,9 − O₂<sub>ref</sub>) / (20,9 − O₂<sub>ukur</sub>)',
      note: (refO2) => `Zeldovich termal (Heywood) · koreksi ke ${fmt(refO2, 0)}% O₂, gas kering · indikatif`,
    },
    readout: {
      Tgas: 'Mean gas T', Tb: 'Burned-zone T', noFrac: 'NO formed', none: '–',
      tbTip: 'Suhu zona terbakar pada θ ini (elemen terpanas). Gelembung 3D diwarnai dengan suhu ini (legenda K).',
    },
    tempLegend: 'Gas / burned-zone T [K]',
    speciesNo: 'NO (thermal)',
    labels3d: { burned: 'Burned zone', no: 'NO particles', piston: 'Piston', top: { diesel: 'Injector', gas: 'Spark plug' } },
    tradeoff: {
      title: 'NOx vs brake efficiency (timing sweep)',
      xLabel: 'Brake efficiency η [%]',
      yLabel: 'NOx [g/kWh] · indikatif',
      preset: 'Preset',
      point: (theta0) => `${theta0 > 0 ? '+' : theta0 < 0 ? '−' : ''}${fmt(Math.abs(theta0), 0)}°`,
      now: (nox, eta) => `${fmt(nox, 1)} g/kWh · η ${fmt(eta * 100, 1)}%`,
      caption: (dNox, dCo2) =>
        `Retard → NOx turun, η turun, CO₂ naik. Terhadap preset: NOx <b>${dNox >= 0 ? '+' : '−'}${fmt(Math.abs(dNox) * 100, 0)}%</b>, CO₂ <b>${dCo2 >= 0 ? '+' : '−'}${fmt(Math.abs(dCo2) * 100, 1)}%</b> (retardSweep, indikatif)`,
      captionWait: 'Menghitung sapuan timing…',
    },
    arrhenius: {
      title: 'Zeldovich rate vs temperature (Arrhenius)',
      xLabel: 'Temperature T [K]',
      yLabel: (Tref) => `Rel. NO rate (${fmt(Tref, 0)} K = 1)`,
      bandEngine: 'Engine burned zone',
      bandDln: 'DLN flame T',
      peak: 'Peak burned-zone T',
      caption: (ratioRef, Tref, ratioPeak, Tpeak) =>
        `+100 K → laju NO <b>×${fmt(ratioRef, 1)}</b> di ${fmt(Tref, 0)} K, <b>×${fmt(ratioPeak, 1)}</b> di T puncak ${fmt(Tpeak, 0)} K.<br />Rentang T zona terbakar engine (2200–3000 K) berbeda dari flame T DLN (1500–2000 K, noxCoTradeoff di Scene 6/9).`,
    },
    hud: {
      timing: { label: (diesel) => (diesel ? 'Injection timing' : 'Spark timing'), tip: 'θ₀ = awal pembakaran (Wiebe), ° ATDC. Negatif = sebelum TDC.' },
      tbPeak: {
        label: 'Peak burned-zone temperature',
        tip: 'Suhu tertinggi zona terbakar selama siklus (cylinderSim → TburnedMax). Gas yang sudah terbakar ikut tertekan saat tekanan silinder naik, jadi bisa melampaui suhu nyala adiabatik.\nBeda dengan "Adiabatic flame temperature" di Scene 3: suhu SAAT campuran terbakar, pada kondisi masuk tetap.\nNOx termal (Zeldovich) ditentukan oleh suhu zona terbakar ini.',
      },
      noxG: { label: 'NOx · indikatif', tip: 'NOx spesifik (sebagai NO₂) per kWh poros: cylinderSim → NOx_gkWh.\nDikalibrasi ke nilai tipikal literatur, bukan data unit.' },
      noxPpm: { label: 'NOx · indikatif', unit: 'ppmvd', tip: 'ppm volume, gas kering (ppmvd), sebagai NO₂, dikoreksi ke O₂ acuan: C·(20,9 − O₂ref)/(20,9 − O₂ukur) (emissionAtBasis).\nBasis diubah di panel asumsi (H).' },
      noxMg: { label: 'NOx as NO₂ · indikatif', unit: 'mg/Nm³', tip: 'mg/Nm³ = ppm · M(NO₂) / volume molar pada basis volume (22,414 m³/kmol pada 0 °C; 24,465 pada 25 °C) (emissionAtBasis).' },
      eta: { label: 'Brake η', tip: 'Efisiensi rem cylinderSim (sama dengan Scene 1 pada preset).' },
      co2: { label: 'CO₂', tip: 'CO₂ spesifik = faktor emisi bahan bakar × 3,6 / η rem. Retard → η turun → CO₂ naik.' },
      calib: {
        label: 'NOx calib', value: (c) => `×${fmt(c, c < 0.1 ? 3 : 2)}`,
        sub: (isDefault) => (isDefault ? 'default · ENGINE_NOX_CALIB' : 'custom · Calibration'),
        tip: 'Faktor laju Zeldovich engine (default ENGINE_NOX_CALIB = 0,17 agar preset ≈ nilai tipikal literatur: diesel ≈ 11, gas lean-burn ≈ 2,5 g/kWh). Ditampilkan karena ≠ 1. Ubah di panel Calibration.',
      },
      note: (eng, dln) => `NOx: Zeldovich termal per elemen zona terbakar (cylinderSim, Wiebe). Kalibrasi: engine ×${fmt(eng, 2)} · DLN single ×${fmt(dln.single, 2)} / twin ×${fmt(dln.twin, 2)} (Scene 6). Level NOx absolut dikalibrasi ke nilai tipikal literatur, bukan data unit atau vendor. Indikatif.`,
    },
    calib: {
      button: 'Calibration',
      key: 'C',
      tip: 'Panel kalibrasi NOx: faktor engine (ENGINE_NOX_CALIB) dan DLN (calibrateDLN).',
      title: 'NOx calibration',
      note: 'Level NOx absolut dikalibrasi ke nilai tipikal literatur, bukan data unit atau vendor. Ganti target dengan data CEMS/OEM unit bila tersedia.',
      engineTitle: 'Engine (Zeldovich rate factor)',
      engines: { diesel: 'Diesel', gas: 'Gas lean-burn' },
      factor: 'Factor',
      defaultEngine: (c) => `default ×${fmt(c, 2)} (ENGINE_NOX_CALIB)`,
      targetEngine: 'Target NOx at preset timing [g/kWh]',
      litEngine: (v) => `literatur tipikal ≈ ${fmt(v, 1)} g/kWh`,
      dlnTitle: 'DLN combustor (design point per configuration)',
      dlnRows: { single: 'Generator (single-shaft)', twin: 'Compressor drive (twin-shaft)' },
      defaultDln: (c, ppm, ref) => `default ×${fmt(c, 2)} (${fmt(ppm, 0)} ppmvd @ ${fmt(ref, 0)} % O₂)`,
      targetDln: 'Target NOx at design point [ppmvd]',
      usedBy: 'Dipakai Scene 6 (part-load turbin), kalibrasi terpisah per konfigurasi. Tidak memengaruhi angka engine di scene ini.',
      apply: 'Apply',
      reset: 'Reset to default',
      close: 'Close',
      computing: 'Menghitung (Worker)…',
      doneEngine: (got, it) => `Selesai: ${fmt(got, 2)} g/kWh pada timing preset (${it} iterasi)`,
      notConverged: 'Belum konvergen; periksa target.',
      doneDln: (ppm, Tf) => `Selesai: ${fmt(ppm, 1)} ppmvd di flame T desain ${fmt(Tf, 0)} K`,
      invalid: 'Masukkan angka > 0',
      resetDone: 'Kalibrasi dikembalikan ke default',
    },
  },

  // ─────────────────────────── Scene 5 — turbin gas ───────────────────────────
  scene5: {
    title: 'Turbin gas: Brayton dari dekat',
    message: 'Kompresor menghabiskan sebagian besar kerja turbin; ambient panas langsung memotong daya.',
    messageWithNumbers: (bwr, perDegC) =>
      `Kompresor menghabiskan ±${fmt(bwr * 100, 0)}% kerja turbin; ambient panas memotong daya ±${fmt(perDegC * 100, 2)}%/°C (model).`,
    config: 'Configuration',
    configs: { generator: 'Generator', compressorDrive: 'Compressor drive' },
    rp: 'Pressure ratio r_p', T3: 'Turbine inlet T₃', etaC: 'Compressor η_c', etaT: 'Turbine η_t',
    etaGG: 'GG turbine η', etaPT: 'Power turbine η', Tamb: 'Ambient temperature',
    tips: {
      config: 'Generator: single-shaft, N tetap (sinkron grid), model braytonReal. Compressor drive: gas generator + free power turbine, model twinShaft() (sama dengan Scene 6).',
      rp: 'Rasio tekanan kompresor. Lebih tinggi → η naik sampai batas tertentu, T₂ naik.',
      T3: 'Suhu gas masuk turbin (firing temperature). Lebih tinggi → kerja & η naik, dibatasi material bilah.',
      etaC: 'Efisiensi isentropik kompresor: makin rendah, makin besar kerja kompresor.',
      etaT: 'Efisiensi isentropik turbin.',
      etaGG: 'Efisiensi turbin gas generator (hanya memutar kompresornya sendiri).',
      etaPT: 'Efisiensi free power turbine (menghasilkan kerja ke beban).',
      Tamb: 'Suhu udara masuk. Udara panas lebih ringan → aliran massa turun → daya turun (braytonDerated / twinShaftCycle).',
      reset: 'Kembalikan parameter ke titik desain konfigurasi ini (ISO 15 °C)',
    },
    hud: {
      eta: { label: 'Thermal η', tip: 'η = w_net / q_in.\nGenerator: braytonReal; Compressor drive: twinShaft().' },
      heatRate: { label: 'Heat rate', tip: 'Heat rate = 3600 / η (kJ bahan bakar per kWh listrik/poros). Makin kecil makin baik.' },
      power: { label: (mdot) => `Power (ṁ = ${fmt(mdot, 0)} kg/s)`, tip: 'Daya poros = ṁ · w_net. ṁ = 20 kg/s adalah ukuran contoh (kelas industri generik), bukan data unit.' },
      bwr: { label: 'Back-work ratio', tip: 'Kerja kompresor / kerja turbin total. Sekitar separuh kerja turbin habis untuk memutar kompresor.' },
      texh: { label: (twin) => (twin ? 'Exhaust T₅' : 'Exhaust T₄'), tip: 'Suhu gas buang (masuk ke cerobong atau HRSG).' },
      derate: { label: 'Derating', tip: (ref) => `Penurunan daya per °C di atas ISO 15 °C.${ref ? '\nPada 15 °C dihitung di acuan 35 °C.' : ''}\nSumber: braytonDerated().perDegC / twinShaftCycle().perDegC.` },
      powerIso: { label: 'Power vs ISO', tip: 'Daya relatif terhadap kondisi ISO (15 °C, 1 atm).' },
      /** Label model di bawah angka derating (tile Derating & Power vs ISO). */
      derateModel: { generator: 'Generator · braytonDerated', compressorDrive: 'Compressor drive · twinShaft' },
      speed: { label: 'Shaft speed', tipGen: 'Generator sinkron: N tetap (3000 rpm untuk 50 Hz). Beban turun → yang diatur adalah bahan bakar/IGV, bukan N (lihat Scene 6).', tipTwin: 'N_GG = gas generator, N_PT = power turbine. Pada compressor drive, N_PT mengikuti kebutuhan proses (Scene 6–7).' },
      perDegUnit: '%/°C', refSuffix: ' (ref 35 °C)',
      note: 'Model: efisiensi komponen (η_c, η_t), ΔP combustor 4%, rugi mekanis 1%. Derating: ṁ ∝ P/T pada rasio tekanan tetap (indikatif).',
    },
    speedGen: (rpm) => `${fmt(rpm, 0)} rpm`,
    speedTwin: (gg, pt) => `${fmt(gg * 100, 0)}% / ${fmt(pt * 100, 0)}%`,
    overlay: {
      bwr: (bwr) => `Kompresor memakan ${fmt(bwr * 100, 0)}% kerja turbin`,
      ambient: (Tamb, derate) => `Ambient ${fmt(Tamb, 0)} °C → daya ${derate >= 1 ? '+' : '−'}${fmt(Math.abs(derate - 1) * 100, 1)}% vs ISO`,
      t45: (T45) => `T₄.₅ (antara turbin GG dan power turbine) = ${fmt(T45, 0)} K`,
    },
    labels3d: {
      compressor: 'Axial compressor', combustor: 'Combustor', turbine: 'Turbine', ggTurbine: 'GG turbine',
      powerTurbine: 'Power turbine', generator: 'Generator', gasCompressor: 'Gas compressor (load)',
    },
    procs: {
      generator: ['1→2 compression', '2→3 combustor (ΔP)', '3→4 turbine expansion', '4→1 exhaust'],
      twin: ['1→2 compression', '2→3 combustor (ΔP)', '3→4.5 GG turbine', '4.5→5 power turbine', '5→1 exhaust'],
    },
  },

  // ─────────────────────────── panel asumsi (tombol H, semua scene) ───────────────────────────
  assumptions: {
    title: 'Model assumptions',
    close: 'Close',
    keys: 'H / Esc',
    intro: 'Semua korelasi emisi indikatif. Level NOx absolut dikalibrasi ke nilai tipikal literatur, bukan data unit atau vendor.',
    basis: {
      title: 'Emission basis',
      o2: 'Reference O₂ [%]',
      o2Tip: (min, max) => `O₂ acuan untuk koreksi ppm dan mg/Nm³. Rentang ${fmt(min, 0)}–${fmt(max, 0)} %.`,
      vol: 'Volume basis',
      vols: { 0: '0 °C (Nm³)', 25: '25 °C' },
      reset: 'Reset basis',
      active: (txt) => `Basis aktif: ${txt}`,
      note: 'Berlaku untuk semua angka ppm dan mg/Nm³ di semua scene. Gas kering, NOx sebagai NO₂.',
      example: (ppm15, ppm, mg, basisTxt) => `Contoh: ${fmt(ppm15, 0)} ppmvd @ 15 % O₂ = ${fmt(ppm, 1)} ppmvd = ${fmt(mg, 1)} mg/Nm³ (${basisTxt})`,
    },
    zeldovich: {
      title: 'Thermal NOx (Zeldovich)',
      formula: (A, Ea) => `d[NO]/dt ≈ ${A}/√T · exp(−${Ea}/T) · [O₂]<sup>½</sup> [N₂]`,
      notes: [
        'Atom O diasumsikan setimbang; laju dikalikan faktor kalibrasi. Prompt NO dan N₂O tidak dimodelkan.',
        '+100 K pada 1800 K ≈ ×7 laju pembentukan (rasio hanya bergantung pada T).',
      ],
    },
    engine: {
      title: 'Engine model (cylinderSim)',
      items: [
        'Siklus tertutup IVC→EVO, gas standar udara (air-standard) dengan k(T); kerja pumping dan kerja setelah EVO diabaikan.',
        'Pelepasan panas Wiebe (diesel: premix + difusi; gas: satu Wiebe).',
        'NOx: zona terbakar per elemen (ringan, mirip two-zone); diesel memakai φ lokal ≈ 0,95 walau φ global miskin.',
        'Rugi dinding dilumpkan (lossFrac); FMEP Chen-Flynn. Untuk tren dan orde besaran, bukan prediksi vendor.',
      ],
    },
    turbine: {
      title: 'Gas turbine / DLN model',
      items: [
        'Efisiensi komponen (η_c, η_t), ΔP combustor 4 %, rugi mekanis 1 %.',
        'Fixed premix fuel split: φ zona premix ∝ q_in terhadap titik desain (φ_pz desain 0,5). Penjadwalan fuel split/bleed OEM tidak dimodelkan.',
        'CO DLN: bentuk kurva ilustratif; ganti dengan kurva OEM/CEMS bila ada. Anggapan: CO dari coDLN dinyatakan sebagai ppmvd @ 15 % O₂, lalu dikoreksi ke basis aktif dengan rumus yang sama seperti NOx.',
        'Jadwal fuel staging OEM tidak dimodelkan (fixed premix split). Perilaku nyata bisa lebih baik atau lebih buruk; besarnya perlu data OEM/CEMS unit.',
        'Part-load: single-shaft = IGV menahan T3 sampai ṁ minimum 70 %, lalu T3 turun (atau fuel-only tanpa IGV); twin-shaft = ṁ ∝ N_GG dengan jadwal T3 = 0,75 + 0,25·N_GG. Kecepatan power turbine tidak dimodelkan.',
      ],
    },
    calib: {
      title: 'Calibration factors',
      head: ['Factor', 'Active', 'Default', 'Literature target'],
      rows: { diesel: 'Engine NOx · Diesel', gas: 'Engine NOx · Gas lean-burn', single: 'DLN NOx · Generator (single-shaft)', twin: 'DLN NOx · Compressor drive (twin-shaft)' },
      targetEngine: (v) => `≈ ${fmt(v, 1)} g/kWh`,
      targetDln: (ppm, ref) => `${fmt(ppm, 0)} ppmvd @ ${fmt(ref, 0)} % O₂ (desain)`,
      factor: (c) => `×${fmt(c, 2)}`,
      notUnit: 'Bukan data unit/vendor. Ganti dengan data CEMS/OEM sebelum presentasi resmi.',
    },
    flame: {
      title: 'Adiabatic flame temperature (indikatif ±100 K)',
      head: ['φ', 'Gas (CH₄) [K]', 'Diesel [K]'],
      note: (Tin) => `T_in = ${fmt(Tin, 0)} K. Tabel T_ad CH₄ + koreksi solar; disosiasi menumpulkan efek preheat.`,
    },
    levels: {
      title: 'Model level per chart',
      head: ['Scene', 'Chart', 'Level'],
      sep: ' / ',
    },
  },
};
