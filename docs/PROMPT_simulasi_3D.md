# PROMPT — "Engine & Turbine Emission Lab" (presentasi web 3D interaktif)

> Cara pakai: letakkan `thermo.js` di `src/model/thermo.js`, buka folder proyek kosong di Claude Code / Cursor, lalu tempel seluruh dokumen ini sebagai instruksi awal. Kerjakan per milestone (bagian 13), jangan sekaligus.

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
- Bahasa UI: istilah teknis engineering dan label kontrol/menu dalam **bahasa Inggris** (*part-load, base load, heat rate, back-work ratio, derating, lean-burn, premix, methane slip, knocking, swirler, combustor, waterfall, compression ratio*; Play, Pause, Freeze, Reset, Replay, Animation speed). Kalimat penjelasan, pesan kunci, dan tooltip dalam **bahasa Indonesia**. Jangan memaksakan terjemahan bila terasa canggung. Semua teks UI di `src/ui/strings.js`.
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
  model/thermo.js            ← DISEDIAKAN. Jangan ubah rumus. Hanya impor.
  model/presets.js           ← preset unit (diesel, gas, GT-gen, GT-comp) + rentang slider
  state/store.js             ← satu store reaktif kecil (subscribe/set), sumber kebenaran tunggal
  state/derive.js            ← memanggil thermo.js → menghasilkan "frame" (P,V,T,s,φ,emisi…)
  scenes/                    ← satu modul per scene (lihat bagian 6)
    sceneBase.js             ← lifecycle: mount(), update(frame,dt), dispose()
    intro.js  piston.js  cycles.js  combustion.js  turbine.js  partload.js  emissions.js  policy.js
  gfx/
    renderer.js composer.js materials.js (shader suhu) particles.js (emisi) flame.js
    pistonRig.js turbineRig.js compressorRig.js (rig 3D prosedural)
  charts/
    pvChart.js tsChart.js lineChart.js barChart.js waterfall.js legend.js
  ui/
    controls.js (slider/segmented/toggle) hud.js presenter.js tooltip.js assumptionsPanel.js
  main.js
tests/
  thermo.golden.test.js      ← vitest, angka acuan di bagian 12
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
| Validasi | `selfTest()` (jalankan saat start; tampilkan lencana "Model OK" bila semua lulus) |

Aturan: bila butuh perhitungan baru, **tambahkan fungsi baru ke `thermo.js` beserta tes golden-nya**, bukan menghitung di tempat lain.

## 6. Spesifikasi scene

Navigasi: `→/←` pindah scene, `Spasi` play/pause animasi, `F` freeze, `R` reset parameter, `H` panel asumsi, `1–4` pindah mesin, `P` mode presenter. Tiap scene punya **judul satu kalimat pesan kunci** di atas layar.

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
- Pesan kunci: *pada r sama Otto ≥ Diesel; diesel menang karena r jauh lebih tinggi; teori 60–67% jadi 42–45% di lapangan.*

### Scene 3 — Pembakaran, φ, dan suhu nyala
- 3D: ruang bakar/combustor dengan nyala (shader + bloom). Warna nyala = `flameColor(φ)`. Tinggi/ukuran nyala ∝ laju pelepasan panas (`dxb/dθ` atau `qin`).
- Slider φ (0,3–1,2) dan suhu masuk campuran. Grafik `flameTemperature(φ)`: titik operasi bergerak di kurva.
- Menunjukkan: **diesel = campuran tak homogen → zona stoikiometrik lokal panas** (`phiLocal`) walau φ global lean; **gas lean-burn = homogen → nyala lebih dingin**.

### Scene 4 — NOx: kenapa suhu begitu menentukan
- 3D: zona terbakar sebagai "gelembung" berwarna suhu; partikel NOx (oranye) dipancarkan ∝ `logNorm(laju NOx)`.
- Grafik Arrhenius dari `noxCoTradeoff`: NOx (log) vs suhu nyala. Kursor menunjukkan **"+100 K ≈ ×6–7 NOx"** (hitung dari model, jangan hardcode).
- Rumus on-screen: Zeldovich `d[NO]/dt ≈ 6×10¹⁶/√T · exp(−69.090/T)·[O₂]^½[N₂]`, koreksi O₂ `C·(20,9−O₂ref)/(20,9−O₂ukur)`.
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
- **Catatan akurasi wajib ditampilkan di scene ini:** model memakai fuel split premix tetap. Hasilnya single-shaft menunjukkan "tebing" CO setelah IGV habis; twin-shaft menunjukkan **pergeseran gradual** (suhu nyala turun ±90 K dari 100% ke 50%). Penjadwalan fuel split OEM tidak dimodelkan.

### Scene 7 — Kompresor gas dan hukum affinitas
- 3D: kompresor sentrifugal + power turbine. Slider tekanan suction/discharge (`gasCompressor`) → head, daya, T discharge.
- Tampilkan `H ∝ N²`, `Q ∝ N`, `P ∝ N³` (`affinity`, `speedForHead`): perubahan tekanan sumur → rpm power turbine berubah → titik kerja DLN bergeser.
- Pesan kunci: *turbin kompresor mengikuti proses, bukan sebaliknya.*

### Scene 8 — Emisi gabungan: diesel vs gas vs turbin
- Bar chart + 3D partikel: NOx, CO₂ (g/kWh), PM (kualitatif), methane slip. CO₂ dari `co2Specific(η)`; slip dari `co2eWithSlip` dengan slider slip 0–3%.
- Menunjukkan: gas lebih rendah CO₂ per kWh, **tapi slip 1% menambah ±11% CO₂e, 3% menambah ±33%** (angka dari model).

### Scene 9 — Trade-off kebijakan: NOx vs CO vs GHG
- Panel A: **retard timing** (`retardSweep`) — NOx turun, η turun, CO₂ naik. Slider θ0 menggerakkan titik di tiga grafik sekaligus.
- Panel B: `ghgPenalty` — slider "penalti bahan bakar %" → CO₂ spesifik naik langsung.
- Panel C: ilustrasi **baku mutu seragam**: garis batas NOx dan CO di grafik part-load; area yang melanggar CO diarsir. Judul: *"Satu angka baku mutu, dua mesin dengan jendela operasi berbeda."*
- Disclaimer permanen: **angka acuan baku mutu diisi presenter** (input), bukan hardcode, termasuk basis O₂ dan basis volume (Nm³ pada 0 °C atau 25 °C; gunakan `molarVolume(Tref)`).

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
| Preset diesel `cylinderSim`: Pmax / η rem / BSFC | 116 bar / 0,441 / 192 g/kWh (±3 / ±0,005 / ±3) |
| Preset gas `cylinderSim`: Pmax / η rem / BSFC | 109 bar / 0,423 / 177 g/kWh (±3 / ±0,005 / ±3) |
| NOx diesel / gas (preset terkalibrasi) | 10,7 / 2,6 g/kWh (±0,5 / ±0,2) |
| `noxThermal` rasio laju 1900 K / 1800 K | 7,1 (±0,2) |
| `twinShaft({})`: η / T2 / T45 / T5 | 0,405 / 742 K / 1049 K / 760 K (±0,005 / ±3 / ±5 / ±5) |
| `gasCompressor({Psuc:20e5,Pdis:60e5,Tsuc:308,MWgas:18,mdot:20})` head / daya | 172 kJ/kg / 4,31 MW (±1 / ±0,03) |
| `selfTest().failed` | 0 |

**Kriteria penerimaan (manual):**

- [ ] Geser rasio kompresi → piston, P-V, T-s, HUD berubah bersamaan, tanpa selisih terlihat.
- [ ] Titik di P-V selalu berada di kurva yang sama dengan posisi piston 3D pada setiap θ.
- [ ] Semua angka HUD dapat ditelusuri ke fungsi di `thermo.js` (tooltip rumus tersedia).
- [ ] Scene 6 menunjukkan perbedaan perilaku single-shaft (tebing CO setelah IGV habis) vs twin-shaft (pergeseran gradual), disertai catatan keterbatasan.
- [ ] Legenda warna suhu dan warna spesies emisi ada di setiap scene yang memakainya.
- [ ] 60 fps di laptop iGPU; jalan offline dari `dist/`.
- [ ] Mode presenter, freeze, reset, snapshot PNG berfungsi.
- [ ] Istilah teknis dan label kontrol/menu berbahasa Inggris; kalimat penjelasan, pesan kunci, dan tooltip berbahasa Indonesia; semua teks dari `src/ui/strings.js`; bebas typo.

## 13. Urutan kerja (milestone)

1. **M1 — Fondasi**: Vite, struktur folder, store, `derive`, impor `thermo.js`, golden test hijau, lencana "Model OK".
2. **M2 — Piston + P-V** (Scene 1): rig 3D, grafik P-V/P-θ, HUD.
3. **M3 — Siklus & waterfall** (Scene 2) dan **pembakaran** (Scene 3).
4. **M4 — NOx** (Scene 4) + panel kalibrasi + panel asumsi.
5. **M5 — Turbin** (Scene 5) + **kompresor gas** (Scene 7).
6. **M6 — Part-load** (Scene 6) — scene paling penting; selesaikan dengan teliti.
7. **M7 — Emisi gabungan, kebijakan, pengendali, penutup** (Scene 8–11).
8. **M8 — Finishing**: transisi, mode presenter, ekspor PNG, performa, uji lintas browser, deployment GitHub Pages.

Di akhir tiap milestone: jalankan tes, berikan ringkasan 5 baris + tangkapan layar, lalu berhenti dan tunggu konfirmasi.

## 14. Yang tidak boleh dilakukan

- Mengubah rumus di `thermo.js` tanpa tes golden baru.
- Menulis angka termodinamika/emisi langsung di UI.
- Menyajikan korelasi indikatif sebagai prediksi vendor atau data unit.
- Memakai aset berhak cipta (model 3D, foto, logo vendor).
- Menambahkan dependensi besar tanpa alasan yang ditulis.
- Menyembunyikan faktor kalibrasi, asumsi, atau batas model.
