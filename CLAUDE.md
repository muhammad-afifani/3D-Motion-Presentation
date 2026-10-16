# Engine & Turbine Emission Lab

Presentasi web 3D interaktif untuk staf produksi migas: diesel engine, gas engine, turbin generator (single-shaft), turbin kompresor (twin-shaft). Menghubungkan siklus termodinamika → efisiensi → emisi (NOx, CO, CO₂, methane slip) → argumen baku mutu. Bahasa UI: **English** (seluruh teks di layar); catatan presenter (`content/presenter.json`) tetap **Indonesia** karena itu naskah lisan; nama resmi regulasi tetap Indonesia (lihat Konvensi).

## Dokumen acuan (baca sebelum mengerjakan milestone)
- `docs/PROMPT_simulasi_3D.md`: spesifikasi lengkap (scene, arsitektur, mapping variabel→visual, golden test, milestone M1–M8)
- `docs/ALUR_SLIDE_presentasi.md`: alur presentasi dan angka demo per scene
- `src/model/thermo.js`: satu-satunya sumber perhitungan
- `src/model/basis.js` + `content/references.json`: dasar teori tiap fungsi `thermo.js` dan daftar sumber (lihat Aturan referensi)
- `content/regulations.json`: baku mutu (Permen LH 13/2009 turbin gas, Permen LHK 11/2021 mesin), basis, catatan; halaman Regulations (tombol `G`, alamat `#/regulations`)

## Stack
Vite + JavaScript ES modules (JSDoc untuk tipe), three.js, vitest. Tanpa backend dan tanpa API eksternal saat runtime. Harus jalan offline lewat `npm run build:offline` + server statis lokal (mis. `npm run preview:offline`; lihat README "Cara presentasi offline"; `file://` tidak didukung karena ES module/Web Worker), dan ter-deploy ke GitHub Pages lewat `.github/workflows/deploy.yml` (`npm run build`, base `/<nama-repo>/`). Semua model 3D prosedural (tanpa file aset berhak cipta). Grafik 2D memakai canvas buatan sendiri atau uPlot.

## Perintah
- `npm run dev`: server pengembangan
- `npm test`: vitest (golden test harus hijau sebelum milestone dianggap selesai)
- `npm run build`: bundle produksi untuk GitHub Pages, base `/<nama-repo>/` dari git remote / `GITHUB_REPOSITORY` (target < 1,5 MB gzip)
- `npm run build:offline` lalu `npm run preview:offline`: paket presentasi offline (base relatif `./`)
- `npm run preview`: uji build Pages di `http://localhost:4173/<nama-repo>/`
- `npm run e2e`: uji dispose antar-scene (siklus 1→11→1) di browser lewat Playwright terpisah (bukan dependensi, bukan CI); `npm run e2e:perf` untuk tabel performa per scene
- `npm run package:offline`: paket presentasi offline di `release/` (build base `./` + server Node/Python/PowerShell + `start.bat`/`start.sh` + `BACA-SAYA.txt`)
- `node -e "import('./src/model/thermo.js').then(t=>console.log(t.selfTest()))"`: validasi cepat model (harus `failed: 0`, saat ini 19 tes)

## Arsitektur (wajib)
Alur data satu arah: `UI control → store.set → derive() → frame → { rig 3D, chart, HUD }`.
- Rig 3D, chart, dan HUD **hanya membaca `frame`**.
- Dilarang menghitung termodinamika/emisi di file `scenes/`, `gfx/`, `charts/`, `ui/`. Butuh perhitungan baru → tambahkan fungsi ke `thermo.js` beserta tes golden-nya.
- Tidak ada angka termodinamika atau emisi yang ditulis langsung (hardcode) di UI.
- Titik di diagram P-V/T-s dan posisi piston/rotor 3D harus berasal dari state yang sama pada setiap frame.

## Aturan model dan akurasi
- JANGAN ubah rumus di `thermo.js` tanpa menambah atau memperbarui tes golden dan menyebutkan alasannya.
- Semua korelasi emisi berlabel **"indikatif"** di UI. Faktor kalibrasi (`ENGINE_NOX_CALIB`, kalibrasi DLN via `calibrateTo`) dan asumsi harus terlihat di panel asumsi (tombol `H`). Faktor ≠ 1 tampil di HUD.
- Level NOx absolut dikalibrasi ke nilai tipikal literatur, bukan data unit. Jangan menyajikannya sebagai prediksi vendor atau data lapangan.
- Model part-load memakai fuel split premix tetap. Jangan menampilkan klaim "CO meledak di twin-shaft". Kalimat yang didukung model: jendela operasi twin-shaft bergeser dan menyempit. Single-shaft menunjukkan "tebing" CO setelah IGV habis.
- Selalu tampilkan basis koreksi O₂ (mis. 15%) dan basis volume (0 °C / 25 °C) di samping angka ppm atau mg/Nm³.
- Limits live in `content/regulations.json` and are never written in code. Values are transcribed from the published tables and carry a `verified` flag. (Pemilik proyek yang mengubah `verified` menjadi `true` per grup setelah dicek ke teks resmi; selama `false`, banner "Transcribed from the published tables…" tampil di halaman Regulations, Scene 6, dan Scene 9.)
- Perbandingan ke limit (chip `Within` / `Above` / `Not modeled`, jendela operasi) **hanya** lewat jalur regulasi di `thermo.js`: `correctToRefO2Reg` (konstanta 21) dan konversi volume pada basis grup (`toRegulationBasis`, 25 °C). Jalur tampilan (`correctToRefO2`, 20,9) tidak dipakai untuk membandingkan. Chip tidak pernah menyatakan "compliant"/"lulus": teksnya "Model value vs limit (indicative)". Override presenter ditandai "limit: user override"; CO turbin hanya dari isian "permit/OEM value (user input)" (tabel turbin tidak punya limit CO). Site data diutamakan dan ditandai.
- Tidak menyebut vendor, merek, atau tipe turbin tertentu.
- Tingkat model berlabel di pojok tiap grafik lewat tag **Basis** (`Basis · <level>`): `Ideal` / `Real (component efficiency)` / `Semi-empirical` / `Site data`. Klik tag membuka kartu Basis (level, asal rumus, sumber, asumsi). Tag juga ada di HUD yang menampilkan angka model.

## Aturan referensi (M9)
- Hanya id dari `content/references.json` yang boleh dikutip di UI. Sumber yang belum ada di file itu tampil sebagai **"source to verify"**, tidak pernah dikarang; catat di `toVerify` pada entri `basis.js`.
- Setiap ekspor `thermo.js` wajib punya entri di `src/model/basis.js` (`level`, `refs`, `derivation`, `assumptions`), atau tercatat di `UTILITY` bila hanya helper matematika/gambar (dijaga `tests/basis.test.js`). Mengubah rumus di `thermo.js` berarti memperbarui entrinya.
- Flag `locatorVerified` di `references.json` hanya diubah pemilik proyek setelah mencocokkan bab/persamaan dengan salinan cetak. Selama `false`, halaman References (tombol `?`, alamat `#/references`) menampilkan "locator not verified".
- Nama fungsi/konstanta kode hanya boleh tampil di kartu Basis dan panel asumsi (`H`), tidak di caption, tooltip, atau HUD (dijaga `tests/language.test.js`).

## Konvensi
- Satuan SI di dalam model; konversi hanya di lapisan tampilan.
- Sudut engkol dalam derajat, 0 = TDC pembakaran; 4-tak −360…+360.
- Kode warna spesies konsisten di semua scene: NOx oranye, CO merah-magenta, CO₂ abu-biru, CH₄ hijau, PM abu gelap. Skala suhu (`tempToRGB`) selalu disertai legenda K.
- Angka UI: font tabular-nums; format en-US (titik desimal, koma ribuan, mis. 1,500 dan 0.87). Sejak M9 Step 02 pemisah desimal koma (id-ID) tidak dipakai lagi di layar; `presenter.json` tetap menulis angka gaya Indonesia di naskah lisan.
- Bahasa UI:
  - **English** untuk semua teks di layar: label, tombol, legenda, tooltip, catatan, toast, pesan galat, HUD, kartu, judul scene, pesan kunci. `index.html` dan `presenter.html` memakai `lang="en"`.
  - **Indonesia** hanya untuk catatan presenter (`content/presenter.json`; blok catatan di jendela presenter diberi `lang="id"`) dan nama resmi regulasi (apa adanya, disertai penjelasan English singkat). README, `BACA-SAYA.txt`, dan `docs/` tetap Indonesia.
  - Gaya: kalimat pendek, angka dan satuan di depan, tanpa kata hiasan, bentuk aktif, jangan menjelaskan yang sudah terlihat. Tanpa nama fungsi/konstanta kode di caption, tooltip, atau HUD.
  - Kalimat kejujuran model tidak boleh berubah makna: korelasi emisi berlabel "indicative"; twin-shaft = jendela operasi bergeser dan menyempit; single-shaft = "cliff" CO setelah IGV habis; basis O₂ dan volume selalu di samping angka ppm / mg/Nm³.
  - Semua teks UI ada di `src/ui/strings.js` (dikelompokkan per scene). `scenes/`, `charts/`, `ui/`, `main.js`, dan `state/derive*.js` tidak menulis teks UI langsung (dijaga `tests/strings.test.js`). `tests/language.test.js` gagal bila kata Indonesia tertinggal di `strings.js`, `content/controls.json`, `closing.json`, `basis.js`, atau `references.json`, atau bila identifier kode muncul di teks layar di luar panel `H`.
- Tombol cepat global (H, ?, G, P, S, Q, B, K, F, R, angka) tidak aktif saat fokus di kolom isian (`ui/keys.js` `isTypingTarget`; dijaga `tests/keys.test.js`).
- Dispose geometri, material, dan listener saat pindah scene. `InstancedMesh` untuk bilah dan partikel.
- `cylinderSim` berjalan di Web Worker, dengan debounce saat slider digeser.

## Cara kerja per sesi
- Kerjakan **satu milestone per permintaan**. Sebelum menulis kode, beri rencana singkat dan tunggu persetujuan.
- Setelah selesai: jalankan `npm test` dan `npm run build`, lalu laporkan dalam 5 baris (apa yang dibuat, hasil tes, cara mengecek di browser, keterbatasan), lalu **berhenti**.
- Jangan memperluas lingkup (scene lain, dependensi besar) tanpa persetujuan. Dependensi baru harus disertai alasan tertulis.
- Jawab dan beri ringkasan dalam bahasa Indonesia yang singkat.

## Status milestone (perbarui setelah tiap milestone selesai)
- [x] M1 Fondasi (Vite, store, derive, golden test, lencana "Model OK")
- [x] M2 Piston + P-V (Scene 1)
- [x] M2a Verifikasi rig piston, pisah jeda (Spasi) / beku (F)
- [x] M3a Siklus ideal vs real + waterfall (Scene 2)
- [x] M3b Pembakaran (Scene 3)
- [x] M4a NOx (Scene 4): Zeldovich, retardSweep NOx–η, Arrhenius, gelembung zona terbakar + partikel NO, fungsi kalibrasi di thermo.js
- [x] M4b Panel kalibrasi (engine per jenis + DLN, store global), panel asumsi (H), basis O₂/volume global (emissionAtBasis)
- [x] M5a Turbin gas (Scene 5): Generator (braytonReal) / Compressor drive (twinShaft)
- [x] M5b Kompresor gas (Scene 7): gasCompressor, affinity what-if, suctionFlow, compressorTrain (beban compressor drive)
- [x] M6 Part-load (Scene 6): single-shaft IGV/fuel-only vs twin-shaft, loadSweep, kalibrasi DLN per konfigurasi, batas presenter + jendela beban
- [x] M7a Emisi gabungan (Scene 8) dan trade-off kebijakan (Scene 9): ppmToGkWh, methane slip, retardSweep, ghgPenalty, baku mutu seragam
- [x] M7b Pengendali emisi dan penutup (Scene 10–11)
- [x] M8a Fitur presentasi: mode presenter (P, jendela kedua + BroadcastChannel, panel pengganti), content/presenter.json, snapshot PNG 2× tema gelap (S), persistensi ringan (localStorage), dock panel Calibration, Animation speed 0,1×–2× bersama
- [x] M8b Finishing: overlay debug (Shift+D), kualitas adaptif Auto/High/Low + bloom global (Q/B), uji dispose e2e (npm run e2e), transisi fade-through, paket offline (npm run package:offline), cek Pages & bundle, laser pointer/spotlight (K/Shift+K); ekspor PNG tema terang belum dikerjakan

- [ ] M9 Perbaikan dan kedalaman (pack `docs/m9_pack/`, satu Step per permintaan)
  - [x] Step 01 Perbaikan Scene 7 dan Scene 9 (smoke test tampilan `npm run e2e:smoke`)
  - [x] Step 02 Bahasa English + gaya, format en-US, `content/references.json`, `basis.js`, tag Basis, halaman References
  - [x] Step 03 Data regulasi: `content/regulations.json`, jalur regulasi (O₂ 21, 25 °C) + `complianceStatus`, pemilih equipment/kelas/bahan bakar, chip Scene 6 dan 9, site data, Permit/OEM CO, halaman Regulations (`G`)
  - [ ] Step 04–06 (model bahan bakar dan tuas, redesain Scene 9, mode Explore)
- [ ] M10 cv(T) correction + recalibration: ganti `cvOfT` linear (menyimpang sampai −7,5 % di 1200–1400 K dibanding polinomial NASA, lihat `basis.js`) dengan data tabel, lalu kalibrasi ulang preset, `ENGINE_NOX_CALIB`, dan golden yang bergantung (Pmax, η rem, waterfall, NOx, retardSweep, angka Step 03 berbasis model). Perlu persetujuan pemilik proyek.

## Golden test acuan (ringkas; tabel lengkap di `docs/PROMPT_simulasi_3D.md` bagian 12)
Otto r=10 η 0,602 · Diesel r=18 rc=2 η 0,632 · Brayton ideal rp=15 η 0,539 · Brayton real η 0,378 · CO₂ gas η=0,35 → 577 g/kWh · preset diesel Pmax ≈ 116 bar, η rem 0,441 · preset gas Pmax ≈ 109 bar, η rem 0,423.
