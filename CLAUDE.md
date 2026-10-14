# Engine & Turbine Emission Lab

Presentasi web 3D interaktif untuk staf produksi migas: diesel engine, gas engine, turbin generator (single-shaft), turbin kompresor (twin-shaft). Menghubungkan siklus termodinamika → efisiensi → emisi (NOx, CO, CO₂, methane slip) → argumen baku mutu. Bahasa UI: **campuran terarah**: istilah teknis engineering dan label kontrol/menu dalam bahasa **Inggris**; kalimat penjelasan, pesan kunci, dan tooltip dalam bahasa **Indonesia** (lihat Konvensi).

## Dokumen acuan (baca sebelum mengerjakan milestone)
- `docs/PROMPT_simulasi_3D.md`: spesifikasi lengkap (scene, arsitektur, mapping variabel→visual, golden test, milestone M1–M8)
- `docs/ALUR_SLIDE_presentasi.md`: alur presentasi dan angka demo per scene
- `src/model/thermo.js`: satu-satunya sumber perhitungan

## Stack
Vite + JavaScript ES modules (JSDoc untuk tipe), three.js, vitest. Tanpa backend dan tanpa API eksternal saat runtime. Harus jalan offline lewat `npm run build:offline` + server statis lokal (mis. `npm run preview:offline`; lihat README "Cara presentasi offline"; `file://` tidak didukung karena ES module/Web Worker), dan ter-deploy ke GitHub Pages lewat `.github/workflows/deploy.yml` (`npm run build`, base `/<nama-repo>/`). Semua model 3D prosedural (tanpa file aset berhak cipta). Grafik 2D memakai canvas buatan sendiri atau uPlot.

## Perintah
- `npm run dev`: server pengembangan
- `npm test`: vitest (golden test harus hijau sebelum milestone dianggap selesai)
- `npm run build`: bundle produksi untuk GitHub Pages, base `/<nama-repo>/` dari git remote / `GITHUB_REPOSITORY` (target < 1,5 MB gzip)
- `npm run build:offline` lalu `npm run preview:offline`: paket presentasi offline (base relatif `./`)
- `npm run preview`: uji build Pages di `http://localhost:4173/<nama-repo>/`
- `node -e "import('./src/model/thermo.js').then(t=>console.log(t.selfTest()))"`: validasi cepat model (harus `failed: 0`, saat ini 14 tes)

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
- Angka baku mutu **diisi presenter lewat input**, tidak ditulis di kode.
- Tidak menyebut vendor, merek, atau tipe turbin tertentu.
- Tingkat model berlabel di pojok tiap grafik: `Ideal` / `Real (component efficiency)` / `Semi-empirical` / `Site data`.

## Konvensi
- Satuan SI di dalam model; konversi hanya di lapisan tampilan.
- Sudut engkol dalam derajat, 0 = TDC pembakaran; 4-tak −360…+360.
- Kode warna spesies konsisten di semua scene: NOx oranye, CO merah-magenta, CO₂ abu-biru, CH₄ hijau, PM abu gelap. Skala suhu (`tempToRGB`) selalu disertai legenda K.
- Angka UI: font tabular-nums; pemisah desimal koma (id-ID) pada teks tampilan.
- Bahasa UI:
  - **Inggris**: istilah teknis (part-load, base load, heat rate, back-work ratio, derating, lean-burn, premix, methane slip, knocking, swirler, combustor, waterfall, compression ratio, dll.) dan label kontrol/menu/HUD/judul grafik/sumbu/status (mis. Play, Pause, Freeze, Reset, Replay, Animation speed, PAUSED, FROZEN).
  - **Indonesia**: kalimat penjelasan, pesan kunci, judul scene, tooltip, catatan/caption penjelas, dan toast. Label "indikatif" untuk korelasi emisi tetap.
  - Jangan memaksakan terjemahan bila terasa canggung.
  - Semua teks UI ada di `src/ui/strings.js` (dikelompokkan per scene). `scenes/`, `charts/`, `ui/`, `main.js`, dan `state/derive*.js` tidak menulis teks UI langsung (dijaga `tests/strings.test.js`).
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
- [ ] M7b Pengendali emisi dan penutup (Scene 10–11)
- [ ] M8 Finishing (transisi, mode presenter, ekspor PNG, performa, GitHub Pages)

## Golden test acuan (ringkas; tabel lengkap di `docs/PROMPT_simulasi_3D.md` bagian 12)
Otto r=10 η 0,602 · Diesel r=18 rc=2 η 0,632 · Brayton ideal rp=15 η 0,539 · Brayton real η 0,378 · CO₂ gas η=0,35 → 577 g/kWh · preset diesel Pmax ≈ 116 bar, η rem 0,441 · preset gas Pmax ≈ 109 bar, η rem 0,423.
