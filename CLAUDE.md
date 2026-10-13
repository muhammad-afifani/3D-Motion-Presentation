# Engine & Turbine Emission Lab

Presentasi web 3D interaktif untuk staf produksi migas: diesel engine, gas engine, turbin generator (single-shaft), turbin kompresor (twin-shaft). Menghubungkan siklus termodinamika → efisiensi → emisi (NOx, CO, CO₂, methane slip) → argumen baku mutu. Bahasa UI: **Indonesia** (istilah teknis baku boleh Inggris).

## Dokumen acuan (baca sebelum mengerjakan milestone)
- `docs/PROMPT_simulasi_3D.md`: spesifikasi lengkap (scene, arsitektur, mapping variabel→visual, golden test, milestone M1–M8)
- `docs/ALUR_SLIDE_presentasi.md`: alur presentasi dan angka demo per scene
- `src/model/thermo.js`: satu-satunya sumber perhitungan

## Stack
Vite + JavaScript ES modules (JSDoc untuk tipe), three.js, vitest. Tanpa backend dan tanpa API eksternal saat runtime. Harus jalan offline dari `dist/` dan bisa di-deploy ke GitHub Pages. Semua model 3D prosedural (tanpa file aset berhak cipta). Grafik 2D memakai canvas buatan sendiri atau uPlot.

## Perintah
- `npm run dev`: server pengembangan
- `npm test`: vitest (golden test harus hijau sebelum milestone dianggap selesai)
- `npm run build`: bundle produksi (target < 1,5 MB gzip)
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
- Tingkat model berlabel di pojok tiap grafik: `Ideal` / `Real (efisiensi komponen)` / `Semi-empiris` / `Data unit`.

## Konvensi
- Satuan SI di dalam model; konversi hanya di lapisan tampilan.
- Sudut engkol dalam derajat, 0 = TDC pembakaran; 4-tak −360…+360.
- Kode warna spesies konsisten di semua scene: NOx oranye, CO merah-magenta, CO₂ abu-biru, CH₄ hijau, PM abu gelap. Skala suhu (`tempToRGB`) selalu disertai legenda K.
- Angka UI: font tabular-nums; pemisah desimal koma (id-ID) pada teks tampilan.
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
- [ ] M3 Siklus & waterfall (Scene 2), pembakaran (Scene 3)
- [ ] M4 NOx (Scene 4), panel kalibrasi, panel asumsi
- [ ] M5 Turbin (Scene 5), kompresor gas (Scene 7)
- [ ] M6 Part-load (Scene 6), scene terpenting
- [ ] M7 Emisi gabungan, kebijakan, pengendali, penutup (Scene 8–11)
- [ ] M8 Finishing (transisi, mode presenter, ekspor PNG, performa, GitHub Pages)

## Golden test acuan (ringkas; tabel lengkap di `docs/PROMPT_simulasi_3D.md` bagian 12)
Otto r=10 η 0,602 · Diesel r=18 rc=2 η 0,632 · Brayton ideal rp=15 η 0,539 · Brayton real η 0,378 · CO₂ gas η=0,35 → 577 g/kWh · preset diesel Pmax ≈ 116 bar, η rem 0,441 · preset gas Pmax ≈ 109 bar, η rem 0,423.
