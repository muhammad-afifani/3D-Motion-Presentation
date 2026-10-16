# PROMPT — "Engine & Turbine Emission Lab" (presentasi web 3D interaktif)

> Cara pakai: letakkan `thermo.js` di `src/model/thermo.js`, buka folder proyek kosong di Claude Code / Cursor, lalu tempel seluruh dokumen ini sebagai instruksi awal. Kerjakan per milestone (bagian 13), jangan sekaligus.
>
> **Status (setelah M9 dan M10):** dokumen ini disinkronkan dengan aplikasi yang sudah jadi. Aturan kerja yang mengikat ada di `CLAUDE.md`; angka golden terbaru di bagian 12; alur presentasi dan angka demo di `docs/ALUR_SLIDE_presentasi.md`.

---

## 1. Peran dan tujuan

Kamu adalah senior creative-technologist (WebGL + termodinamika). Bangun **presentasi web 3D interaktif** yang menjelaskan kepada staf produksi migas:

1. Cara kerja 4 penggerak: **diesel engine, gas engine, turbin generator (single-shaft), turbin kompresor (twin-shaft)**.
2. Hubungan **siklus termodinamika → efisiensi → emisi (NOx, CO, CO₂, methane slip, PM)**.
3. Mengapa **baku mutu emisi yang seragam** untuk turbin generator dan turbin kompresor bermasalah secara engineering (trade-off NOx–CO, penalti GHG, operasi part-load).

Prinsip utama: **visual 3D, diagram P-V / T-s, dan angka di layar harus menampilkan state yang sama.** Semuanya dihitung oleh satu modul model (`thermo.js`), tidak ada angka hardcode di UI.

## 2. Audiens dan konteks presentasi

- Penonton: staf produksi/operasi, bukan ahli termodinamika. Presenter: engineer procurement/environmental.
- Dipresentasikan di proyektor 1080p, dibawakan live selama ±45 menit, dengan sesi tanya jawab.
- Bahasa UI (sejak M9 Step 02): **seluruh teks di layar berbahasa Inggris** (label, tombol, legenda, tooltip, catatan, HUD, kartu, judul scene, pesan kunci), dengan gaya kalimat pendek dan angka/satuan di depan. **Bahasa Indonesia** hanya untuk catatan presenter (`content/presenter.json`) dan nama resmi regulasi. Angka di layar memakai format en-US (1,500 dan 0.87). Semua teks UI di `src/ui/strings.js`; padanan istilah Indonesia → English di `docs/PADANAN_ISTILAH.md`.
- Presenter harus bisa: mengubah parameter live, membekukan animasi, menyorot satu variabel, dan kembali ke default dengan satu tombol.

## 3. Stack dan aturan teknis

- **Vite + JavaScript ES modules** (JSDoc untuk tipe), **three.js** (r16x+), `OrbitControls`, `EffectComposer` + `UnrealBloomPass` (untuk nyala api), `Line2` (garis tebal).
- Tanpa backend, tanpa API eksternal saat runtime. Semua aset lokal. Harus jalan **offline** dari `dist/` dan bisa di-deploy ke **GitHub Pages** (`base` dikonfigurasi, workflow Actions disertakan).
- Grafik 2D (P-V, T-s, bar, line): **canvas 2D buatan sendiri** (modul kecil) atau uPlot. Jangan pakai library chart berat.
- UI: DOM murni + CSS variables (tema gelap; tema terang untuk cetak belum diimplementasikan). Tanpa framework UI.
- Font: self-host (mis. Inter + JetBrains Mono untuk angka). Angka memakai `font-variant-numeric: tabular-nums`.
- Tidak ada geometri dari file eksternal: **semua model 3D dibangun prosedural** (silinder, piston, batang torak, poros engkol, bilah turbin via `InstancedMesh`, dll.).

## 4. Arsitektur

```
src/
  model/thermo.js            ← satu-satunya sumber perhitungan (rumus hanya diubah dengan tes golden)
  model/basis.js             ← dasar teori tiap ekspor thermo.js (level, sumber, asumsi); kartu Basis & panel H
  model/presets.js           ← preset unit, grid tuas, rentang slider
  state/store.js             ← store reaktif (subscribe/set), sumber kebenaran tunggal
  state/derive*.js           ← memanggil thermo.js → "frame" per scene (derive, deriveCycles, deriveNox, deriveLoad, derivePolicy, deriveLevers, deriveCompliance, …)
  state/sim.worker.js + simClient.js ← cylinderSim / sapuan di Web Worker (debounce)
  state/content.js, contentStore.js  ← memuat content/*.json saat runtime (fallback bawaan + validasi)
  state/regulations.js       ← jalur regulasi: pemilih equipment/kelas/bahan bakar, baris kepatuhan
  state/route.js, mode.js    ← router hash (#/scene/N[/tab], halaman) dan mode Explore / Present
  scenes/                    ← satu modul per scene: piston, cycles, combustion, nox, turbine, partload, compressor, emissions, policy, controls, closing (+ sceneBase)
  gfx/                       ← renderer, composer (bloom), materials, flame, rig 3D prosedural (piston, turbin, kompresor, combustor, NOx, emisi), quality
  charts/                    ← canvas 2D: pvChart, cycleChart, multiLineChart, xyChart, barChart, waterfall, flameChart, legend
  ui/                        ← controls, hud, strings.js (semua teks UI), nav, halaman penuh (references, regulations, formation, glossary, assumptions), tab Scene 9, presenter, snapshot
  main.js                    ← boot, navigasi, router, tombol cepat, loop render
content/                     ← controls, closing, presenter, references, regulations, emission_formation, glossary (.json; bisa diedit di dist/content/)
tests/                       ← vitest: golden (bagian 12), bahasa, teks terpusat, regulasi, konten
scripts/e2e/                 ← Playwright terpisah: smoke tampilan, dispose, performa
```

**Alur data (wajib):** `UI control → store.set → derive() → frame → { 3D rig, chart, HUD }`. Rig 3D dan chart **hanya membaca `frame`**. Dilarang menghitung termodinamika di dalam file scene/gfx/chart.

`frame` minimal berisi: `θ` (sudut engkol), `V, P, T, s`, `xb` (fraksi terbakar), `phase`, `pistonPos`, `Tflame`, `φ`, laju emisi (`NOx, CO, CO2, PM`), `η`, `daya`, `load`, `N`.

## 5. Kontrak model `thermo.js` (yang boleh dipakai)

| Kebutuhan | Fungsi |
|---|---|
| Siklus ideal piston | `otto`, `diesel`, `dual` → `.states`, `.sample(n)` (kurva P-V & T-s), `.eta`, `.mep` |
| Brayton ideal / real | `braytonIdeal`, `braytonReal`, `braytonDerated` |
| Part-load turbin | `singleShaftLoad(design, load, {igvMin})`, `twinShaft`, `twinShaftForLoad` |
| Kompresor gas | `gasCompressor`, `affinity`, `speedForHead` |
| Silinder (animasi) | `engineGeometry`, `cylinderSim`, `sampleSim(sim, θ)`, `pvLoop`, `valveLift`, `crankAngleAt` |
| Emisi | `flameTemperature`, `burnedComposition`, `noxThermal`, `coDLN`, `dlnEmissions`, `dlnFromResult`, `loadSweep`, `noxCoTradeoff`, `retardSweep`, `lossWaterfall`, `zeldovichRate`, `noxRateRatio`, `zeldovichCurve`; `cylinderSim` juga memberi `TbTrace`/`noTrace` per θ |
| Konversi | `toDryRef`, `correctToRefO2`, `ppmToMgNm3`, `massRateKgH`, `exhaustFlowNm3h` |
| GHG | `co2Specific`, `co2eWithSlip`, `ghgPenalty`, `fuelPerKWh` |
| Visual | `tempToRGB`, `flameColor`, `logNorm` |
| Kalibrasi | `calibrateTo(fn, target)`, `lookup1D(points)`, `calibrateEngineNOx(kind, target)`, `calibrateDLN({targetPpm})` |
| Tuas mesin (Scene 9) | `leverSweep(kind, param, values, over)` (timing, φ, intake T, boost, rpm), `LEVER_PARAMS` |
| Bahan bakar | `fuelGasProps(comp)` (MW, LHV, AFR, CO₂/GJ), `so2FromFuelSulfur`, `exhaustO2FromLambda`, `dualIdealLimit` (batas ideal diesel) |
| Properti udara | `AIR_NASA7`, `airProps(T)`, `cvOfT`, `kOfT` (polinomial NASA, M10) |
| Jalur regulasi | `correctToRefO2Reg` (konstanta 21), `toRegulationBasis`, `ppmToMgNm3Reg`, `mgNm3ToPpmReg`, `molarVolumeReg`, `complianceStatus`, `complianceMargin`, `complianceCheck`, `MARGIN_UNCERTAINTY_PCT` |
| Rangkaian kompresor | `compressorTrain`, `suctionFlow`, `twinShaftCycle` |
| Validasi | `selfTest()` (jalankan saat start; tampilkan lencana "Model OK" bila semua lulus) |

Aturan: bila butuh perhitungan baru, **tambahkan fungsi baru ke `thermo.js` beserta tes golden-nya**, bukan menghitung di tempat lain.

## 6. Spesifikasi scene

Navigasi (M9 Step 06): dua mode. **Explore** (default) menampilkan navigasi kiri yang dapat dilipat (Scene 1–11, halaman Regulations, Emission formation, References, Glossary, Assumptions, alat Snapshot/Presenter/Present mode); `←`/`→` hanya mengganti scene bila fokus ada di navigasi. **Present** (`M`) menyembunyikan navigasi; `→/←` pindah scene seperti sebelumnya. Tombol lain: `Spasi` play/pause animasi, `F` freeze, `R` reset parameter, `H` panel asumsi, `?` References, `G` Regulations, `P` jendela presenter, `S` snapshot, `1–4` pindah mesin. Tombol cepat tidak aktif saat fokus di kolom isian. Alamat langsung: `#/scene/N`, `#/scene/9/{limits|formation|levers|load-window|ghg}`, `#/regulations`, `#/formation`, `#/references[/id]`, `#/glossary`, `#/assumptions`. Halaman penuh menghentikan loop render; scene tetap ter-mount. Tiap scene punya **pesan kunci satu kalimat** di header (English).

### Scene 0 — Pembuka (tidak dibuat sebagai scene aplikasi)
- Aplikasi dimulai dari Scene 1; tidak ada scene peta 4 penggerak (kartu 3D berputar). Pembuka disampaikan secara lisan, dan catatannya digabung ke catatan presenter Scene 1 dengan awalan "Pembuka" (`content/presenter.json`; sumber: `docs/ALUR_SLIDE_presentasi.md` S0).
- Tujuannya tetap orientasi: bahan bakar sama, mesin beda, emisi beda.
- *Pengembangan lanjutan (belum diimplementasikan):* scene peta 4 penggerak dengan kartu 3D dan ringkasan siklus/η/profil emisi per kartu.

### Scene 1 — Piston: dari engkol ke diagram P-V (engine)
- 3D: silinder dengan penampang (cutaway), piston, batang torak, poros engkol, katup masuk/buang (`valveLift`), injektor/busi. Gerak piston **dari** `engineGeometry.pistonPos(θ)`.
- Warna gas di silinder = `tempToRGB(T)` dengan legenda skala K yang selalu tampil.
- Samping kanan: **P-V live** (titik berjalan sinkron dengan θ, area loop terarsir = kerja) dan **P-θ**.
- Rumus on-screen (dengan variabel yang menyala saat relevan): `V(θ)=Vc+(πB²/4)(l+a−s(θ))`, `s(θ)=a·cosθ+√(l²−a²sin²θ)`.
- Kontrol: pilih diesel/gas, rpm visual (slow-motion), rasio kompresi `r`, φ, timing `θ0`.
- HUD: Pmax, θPmax, IMEP, η indikator, η rem, BSFC.

### Scene 2 — Siklus ideal vs real
- Tiga panel sinkron: **3D (state bergerak)**, **P-V**, **T-s**. Tombol segmen: Otto / Diesel / Dual / Brayton.
- Kurva dari `cycle.sample()`. Titik state 1–4 berlabel, bisa di-hover (T, P, v, s).
- Toggle **Ideal ↔ Real**. Real memakai `cylinderSim` (piston) atau `braytonReal` (turbin); tampilkan **celah efisiensi**.
- Waterfall dari `lossWaterfall(kind)`: batas ideal → k(T) → pembakaran berwaktu → rugi panas → friksi. Animasikan bar turun satu per satu.
- Pesan kunci: *pada r sama Otto ≥ Diesel; diesel menang karena r jauh lebih tinggi; teori 62–63% vs efisiensi rem model (indicative) 42,5% diesel / 40,6% gas; tipikal/literatur 42–45% (to be sourced).* (M9 Step 04: batas ideal diesel = siklus dual dari preset, dulu Otto 67%.) Kata "lapangan" hanya untuk data unit.

### Scene 3 — Pembakaran, φ, dan suhu nyala
- 3D: ruang bakar/combustor dengan nyala (shader + bloom). Warna nyala = `flameColor(φ)`. Tinggi/ukuran nyala ∝ laju pelepasan panas (`dxb/dθ` atau `qin`).
- Slider φ (0,3–1,2) dan suhu masuk campuran. Grafik `flameTemperature(φ)`: titik operasi bergerak di kurva.
- Menunjukkan: **diesel = campuran tak homogen → zona stoikiometrik lokal panas** (`phiLocal`) walau φ global lean; **gas lean-burn = homogen → nyala lebih dingin**.

### Scene 4 — NOx: kenapa suhu begitu menentukan
- 3D: zona terbakar sebagai "gelembung" berwarna suhu; partikel NOx (oranye) dipancarkan ∝ `logNorm(laju NOx)`.
- Grafik Arrhenius dari `noxCoTradeoff`: NOx (log) vs suhu nyala. Kursor menunjukkan **"+100 K ≈ ×6–7 NOx"** (hitung dari model, jangan hardcode).
- Rumus on-screen: Zeldovich `d[NO]/dt ≈ 6×10¹⁶/√T · exp(−69.090/T)·[O₂]^½[N₂]`, koreksi O₂ `C·(20,9−O₂ref)/(20,9−O₂ukur)` (jalur tampilan; perbandingan ke limit memakai jalur regulasi dengan konstanta 21).
- Panel kalibrasi: input target NOx pada titik desain → `calibrateTo`. Tampilkan faktor kalibrasi yang dipakai.

### Scene 5 — Turbin gas: Brayton dari dekat
- 3D: kompresor aksial (baris bilah `InstancedMesh`, warna = T per tahap), combustor (can/annular), turbin; poros; generator (single-shaft) **atau** power turbine + kompresor gas (twin-shaft). Segmen: Generator / Kompresor.
- T-s dan P-V live dari `braytonReal.sample()`. Slider: `rp`, `T3`, `ηc`, `ηt`, suhu ambient (`braytonDerated`).
- HUD: η, heat rate, daya, back-work ratio, T exhaust, **derating %/°C**.
- Pesan kunci: *kompresor makan ±50% kerja turbin; ambient panas = daya turun ±0,7%/°C.*

### Scene 6 — Part-load: generator vs kompresor (inti argumen)
- Layar terbagi dua: kiri **single-shaft** (N tetap 3000 rpm), kanan **twin-shaft** (Ngg dan N power turbine berubah). Slider beban 40–100%.
- Garis grafik bersama: **suhu nyala vs beban**, **NOx vs beban**, **CO vs beban**, **η vs beban** (`loadSweep` mode `single` / `fuelOnly` / `twin`).
- Tampilkan **jendela DLN** sebagai pita horizontal pada grafik suhu nyala; saat keluar pita, CO naik (warna merah, partikel CO).
- Toggle strategi single-shaft: **IGV** vs **fuel-only**.
- **Baris regulasi (M9 Step 03/05a):** chip NOx/CO per konfigurasi pada beban saat ini, basis regulasi (15 % O₂, kering, 25 °C, NO₂), dengan margin %; klik → Scene 9 tab Limits (`Esc`/`←` kembali). CO turbin "Not modeled" sampai nilai permit/OEM diisi.
- **Catatan akurasi wajib ditampilkan di scene ini:** model memakai fuel split premix tetap. Hasilnya single-shaft menunjukkan "tebing" CO setelah IGV habis; twin-shaft menunjukkan **pergeseran gradual** (suhu nyala turun ±90 K dari 100% ke 50%). Penjadwalan fuel split OEM tidak dimodelkan.

### Scene 7 — Kompresor gas dan hukum affinitas
- 3D: kompresor sentrifugal + power turbine. Slider tekanan suction/discharge (`gasCompressor`) → head, daya, T discharge.
- Tampilkan `H ∝ N²`, `Q ∝ N`, `P ∝ N³` (`affinity`, `speedForHead`): perubahan tekanan sumur → rpm power turbine berubah → titik kerja DLN bergeser.
- Pesan kunci: *turbin kompresor mengikuti proses, bukan sebaliknya.*

### Scene 8 — Emisi gabungan: diesel vs gas vs turbin
- Bar chart + 3D partikel: NOx, CO₂ (g/kWh), PM (kualitatif), methane slip. CO₂ dari `co2Specific(η)`; slip dari `co2eWithSlip` dengan slider slip 0–3%.
- Menunjukkan: gas lebih rendah CO₂ per kWh, **tapi slip 1% menambah ±11% CO₂e, 3% menambah ±33%** (angka dari model).

### Scene 9 — Emisi teregulasi: terbentuk dari mana dan apa pengendalinya (M9 Step 05)
- Judul layar: *Regulated emissions: how they form and what controls them.* Header semua tab: pemilih equipment / kelas kapasitas / bahan bakar, basis regulasi, banner `verified: false`, lencana Preset/Modified + "Reset to preset".
- **Tab 1 Limits:** tabel limit dari `content/regulations.json` berdampingan dengan nilai model dan isian site data; chip "Model value vs limit (indicative)" + margin %; alasan untuk "Not modeled"; matriks cakupan model.
- **Tab 2 Formation:** kartu kualitatif dari `content/emission_formation.json` (juga halaman `#/formation`).
- **Tab 3 Levers:** `leverSweep` di Web Worker; lima tuas (EGR "not available in this model") + panel Fuel (komposisi tidak mengubah NOx dan CO); grafik NOx mg/Nm³ basis regulasi vs tuas dengan garis limit dan η rem vs tuas; tab Limits membaca frame yang sama.
- **Tab 4 Load window:** kurva Scene 6, garis limit NOx dari file regulasi (override presenter ditandai), garis CO hanya dari isian permit/OEM; kalimat model single-shaft "cliff" / twin-shaft "shifts and narrows".
- **Tab 5 GHG:** `ghgPenalty` (penalti bahan bakar = skenario ilustrasi) dan `co2eWithSlip` (GWP 29,8, IPCC AR6); methane slip tidak termasuk di CO₂ biasa.
- Angka limit **tidak pernah** ditulis di kode; satu-satunya sumber `content/regulations.json`. Perbandingan hanya lewat jalur regulasi (`correctToRefO2Reg`, `toRegulationBasis`, `complianceCheck`).

### Scene 10 — Perangkat pengendali emisi
- Kartu interaktif: DLN, lean-burn, EGR, water/steam injection, SCR, oxidation catalyst, DPF. Tiap kartu: **apa yang turun, apa yang naik, efek ke η/CO₂, kebutuhan operasi**. Teks statis oleh presenter (JSON `content/controls.json`), bukan hasil model.

### Scene 11 — Penutup
- Ringkasan 3 poin + daftar opsi arah diskusi (diisi dari `content/closing.json`). Tanpa klaim baru.

## 7. Pemetaan variabel → visual

| Variabel | Visual |
|---|---|
| θ (sudut engkol) | posisi piston/katup, titik di P-V dan P-θ |
| T gas | warna volume gas via `tempToRGB`, **dengan legenda skala (K) selalu tampil** |
| P | denyut tipis dinding silinder, jarum gauge |
| `dxb/dθ`, `qin` | ukuran dan kecerahan nyala (bloom) |
| φ | warna nyala (`flameColor`) |
| laju NOx/CO/CO₂ | jumlah partikel di exhaust, **skala log** (`logNorm`), warna per spesies + legenda |
| N (rpm) | kecepatan putar rotor (selalu dengan faktor slow-motion yang ditampilkan di HUD) |
| beban | tinggi bilah level, posisi di jendela DLN |

Kode warna spesies (konsisten di semua scene, aman buta warna): NOx = oranye, CO = merah-magenta, CO₂ = abu-biru, CH₄ slip = hijau, PM = hitam/abu gelap.

## 8. UI/UX dan mode presentasi

- **Mode presenter (`P`)**: panel kecil terpisah (jendela kedua) berisi catatan, timer, scene berikutnya; sinkron via `BroadcastChannel`.
- **Fragmen** (langkah `Enter` yang memunculkan elemen berurutan): **tidak diimplementasikan**; seluruh elemen scene tampil bersamaan dan presenter mengatur urutan lewat pesan kunci, catatan presenter, dan interaksi kontrol. Tidak ada rencana mengerjakannya.
- **Freeze/Play**, **slow-motion** (0,1×–2×), **reset parameter**, **snapshot PNG** layar saat ini.
- **Tooltip rumus**: hover pada angka HUD memunculkan rumus, variabel, dan asumsi (panel `H` memuat semua asumsi model).
- **Laser pointer** (kursor menyala) dan **spotlight** (redupkan sisanya).
- Semua kontrol dapat dioperasikan dengan keyboard; target ukuran tombol ≥ 44 px untuk layar sentuh di ruang rapat.
- **Mode Explore / Present** dan halaman penuh (Regulations, Emission formation, References, Glossary, Assumptions) seperti bagian 6; pilihan mode disimpan di `localStorage` (try/catch).

## 9. Arah visual (high-end)

- Tema gelap, latar gradasi sangat gelap (bukan hitam murni), aksen hangat untuk panas dan dingin untuk udara.
- Material logam brushed prosedural (PBR sederhana, environment map prosedural), cutaway dengan **clipping plane** dan potongan berwarna.
- Pencahayaan: key + rim light, bayangan lembut, bloom hanya untuk nyala/partikel panas.
- Transisi antar scene: **fade-through ±350 ms** (keluar 150 ms, masuk 200 ms; lewat opacity CSS), instan bila `prefers-reduced-motion`; tidak mengubah data frame atau angka HUD. Transisi kamera (dolly/orbit) **tidak diimplementasikan** karena label 3D akan tertinggal dari kamera selama animasi.
- Tipografi besar dan padat informasi tetapi tidak ramai; maksimum **1 grafik utama + 1 grafik pendukung + HUD** per layar.
- Anotasi 3D: label ringkas pada komponen (tampil bersama scene; tombol `L` di Scene 1 menyembunyikannya). Leader line per fragmen tidak diimplementasikan karena fragmen tidak dibuat.
- Snapshot PNG resolusi 2× (`S`) saat ini hanya **tema gelap**. *Mode terang untuk cetak/PDF (belum diimplementasikan):* ekspor tema terang butuh token warna chart sebagai pengganti warna netral yang kini tertulis di modul grafik.

## 10. Performa dan kompatibilitas

- Target **60 fps** di laptop iGPU 1080p; **minimal 30 fps** di perangkat lemah (deteksi otomatis lalu turunkan: bloom off, partikel ×0,3, `devicePixelRatio` ≤ 1,5).
- `InstancedMesh` untuk bilah dan partikel; satu draw call per jenis. Dispose geometri/material saat pindah scene.
- Hitung ulang `cylinderSim` hanya saat parameter berubah (debounce 80 ms), di **Web Worker**; hasilnya array bertipe (`Float64Array`).
- Bundle awal < 1,5 MB gzip. Muat scene secara lazy.
- Uji di Chrome, Edge, Firefox, Safari terbaru; WebGL2 wajib; sediakan layar fallback bila WebGL gagal (screenshot statis + penjelasan).

## 11. Akurasi dan keterbukaan (wajib)

1. **Label tingkat model** di pojok tiap grafik: `Ideal` / `Real (component efficiency)` / `Semi-empirical` / `Site data`.
2. Semua korelasi emisi berlabel **"indikatif"**. Panel asumsi (`H`) mencantumkan: rumus Zeldovich, konstanta, asumsi fuel split tetap, faktor kalibrasi (`ENGINE_NOX_CALIB`, kalibrasi DLN) beserta nilai tipikal literatur yang dipakai sebagai target.
3. **Faktor kalibrasi tampil di HUD** bila ≠ 1. *Pengembangan lanjutan (belum diimplementasikan):* presenter memasukkan data CEMS/OEM (CSV `Tflame,NOx,CO` atau `load,NOx,CO`) → diubah menjadi `lookup1D` dan menggantikan kurva model (badge berubah menjadi "Site data"). Saat ini data unit hanya bisa dipakai lewat panel Calibration (target NOx engine dan DLN); label "Site data" belum dipakai di grafik mana pun.
4. Tidak ada klaim yang menyebut vendor, merek, atau tipe turbin tertentu.
5. Basis koreksi O₂ dan basis volume (0 °C / 25 °C) selalu terlihat di samping angka mg/Nm³ atau ppm.
6. **Tag Basis** (`Basis · <level>`) di pojok tiap grafik dan HUD membuka kartu Basis (asal rumus, sumber, asumsi). Hanya id dari `content/references.json` yang dikutip; sumber yang belum ada tampil "source to verify".
7. **Baku mutu:** angka limit hanya dari `content/regulations.json` (flag `verified`). Chip tidak pernah menyatakan "compliant"; margin < 10 % diberi keterangan "margin is smaller than model uncertainty". Site data diutamakan dan ditandai.

## 12. Pengujian dan kriteria penerimaan

**Golden test (vitest)** — toleransi dalam kurung:

| Uji | Nilai acuan |
|---|---|
| `otto({r:10}).eta` | 0,602 (±0,001) |
| `diesel({r:18, rc:2}).eta` | 0,632 (±0,001) |
| `otto({r:18}).eta` | 0,685 (±0,001) |
| `dual({r:16, rp:1.5, rc:1.4}).eta` | 0,655 (±0,001) |
| `braytonIdeal({rp:15}).eta` | 0,539 (±0,001) |
| `braytonReal({})` η / T2 / T4 | 0,378 / 675 K / 843 K (±0,005 / ±2 / ±3) |
| `braytonDerated({}, {TambC:35}).derate` | 0,865 (±0,005) |
| `co2Specific(0.35,'gas')` / `co2Specific(0.42,'diesel')` | 577,0 / 635,1 g/kWh (±0,3) |
| Preset diesel `cylinderSim`: Pmax / η rem / BSFC | 112,4 bar / 0,425 / 199 g/kWh (±3 / ±0,005 / ±3) |
| Preset gas `cylinderSim`: Pmax / η rem / BSFC | 104,6 bar / 0,406 / 184,5 g/kWh (±3 / ±0,005 / ±3) |
| NOx diesel / gas (preset terkalibrasi, `ENGINE_NOX_CALIB` 0,185) | 11,1 / 2,5 g/kWh (±0,5 / ±0,2) |
| `cvOfT` udara vs NIST-JANAF (4th ed., 1998) di 300 / 1000 / 1500 / 2000 K | ≤ 0,5 % |
| `noxThermal` rasio laju 1900 K / 1800 K | 7,1 (±0,2) |
| `twinShaft({})`: η / T2 / T45 / T5 | 0,405 / 742 K / 1049 K / 760 K (±0,005 / ±3 / ±5 / ±5) |
| `gasCompressor({Psuc:20e5,Pdis:60e5,Tsuc:308,MWgas:18,mdot:20})` head / daya | 172 kJ/kg / 4,31 MW (±1 / ±0,03) |
| `dualIdealLimit` preset diesel (batas ideal waterfall) | 0,6321 (±0,0005) |
| `calibrateDLN` single / twin (15 ppm @15 % O₂ di desain) | 14,33 / 4,38 (±0,005) |
| `emissionAtBasis({ppm:25})` NOx → mg/Nm³ pada 0 °C / 25 °C | 51,3 / 47,0 (±0,1) |
| `co2eWithSlip` η 40 %, slip 1 % / 3 % | 560,8 / 672,5 g/kWh (±0,1) |
| `ghgPenalty` η 35 %, penalti 3 % | 577,0 → 594,3 g/kWh (±0,1) |
| `retardSweep` diesel −4° → 0° | NOx −30,2 % (±1), CO₂ +3,06 % (±0,2) |
| `complianceMargin(292, 300)` / `(316, 300)` | +2,67 % / −5,33 % |
| `selfTest().failed` | 0 (19 tes) |

**Kriteria penerimaan (manual):**

- [ ] Geser rasio kompresi → piston, P-V, T-s, HUD berubah bersamaan, tanpa selisih terlihat.
- [ ] Titik di P-V selalu berada di kurva yang sama dengan posisi piston 3D pada setiap θ.
- [ ] Semua angka HUD dapat ditelusuri ke fungsi di `thermo.js` (tooltip rumus tersedia).
- [ ] Scene 6 menunjukkan perbedaan perilaku single-shaft (tebing CO setelah IGV habis) vs twin-shaft (pergeseran gradual), disertai catatan keterbatasan.
- [ ] Legenda warna suhu dan warna spesies emisi ada di setiap scene yang memakainya.
- [ ] 60 fps di laptop iGPU; jalan offline dari `dist/`.
- [ ] Mode presenter, freeze, reset, snapshot PNG berfungsi.
- [ ] Seluruh teks di layar berbahasa Inggris (catatan presenter dan nama resmi regulasi tetap Indonesia); semua teks dari `src/ui/strings.js`; bebas typo.
- [ ] Setiap deep link (`#/scene/N`, tab Scene 9, halaman penuh) terbuka langsung; Present menyembunyikan navigasi dan jendela presenter tetap sinkron (`npm run e2e:smoke`).

## 13. Urutan kerja (milestone)

1. **M1 — Fondasi**: Vite, struktur folder, store, `derive`, impor `thermo.js`, golden test hijau, lencana "Model OK".
2. **M2 — Piston + P-V** (Scene 1): rig 3D, grafik P-V/P-θ, HUD.
3. **M3 — Siklus & waterfall** (Scene 2) dan **pembakaran** (Scene 3).
4. **M4 — NOx** (Scene 4) + panel kalibrasi + panel asumsi.
5. **M5 — Turbin** (Scene 5) + **kompresor gas** (Scene 7).
6. **M6 — Part-load** (Scene 6) — scene paling penting; selesaikan dengan teliti.
7. **M7 — Emisi gabungan, kebijakan, pengendali, penutup** (Scene 8–11).
8. **M8 — Finishing**: transisi, mode presenter, ekspor PNG, performa, uji lintas browser, deployment GitHub Pages.
9. **M9 — Perbaikan dan kedalaman** (`docs/m9_pack/`): bahasa English + referensi + tag Basis, data regulasi dan jalur kepatuhan, model bahan bakar dan tuas, redesain Scene 9 (5 tab), mode Explore / Present + deep link + Glossary.
10. **M10 — Koreksi cv(T) + kalibrasi ulang**: cv(T) udara dari polinomial NASA (golden terhadap NIST-JANAF), `ENGINE_NOX_CALIB` 0,185, margin kepatuhan %.

Di akhir tiap milestone: jalankan tes, berikan ringkasan 5 baris + tangkapan layar, lalu berhenti dan tunggu konfirmasi.

## 14. Yang tidak boleh dilakukan

- Mengubah rumus di `thermo.js` tanpa tes golden baru.
- Menulis angka termodinamika/emisi langsung di UI.
- Menyajikan korelasi indikatif sebagai prediksi vendor atau data unit.
- Memakai aset berhak cipta (model 3D, foto, logo vendor).
- Menambahkan dependensi besar tanpa alasan yang ditulis.
- Menyembunyikan faktor kalibrasi, asumsi, atau batas model.
